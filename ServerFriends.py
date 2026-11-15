#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════
   🃏 HOKM PRO v6.2.0 — ServerFriends.py
   سرور اختصاصی دوستان، چت و دعوت به بازی (آپدیت نهایی)
═══════════════════════════════════════════════════════════════
"""

import eventlet
eventlet.monkey_patch()

import os
import sys
import time
import sqlite3
import secrets
import random
import string
from datetime import timedelta
from functools import wraps
from pathlib import Path

try:
    from flask import Flask, request, jsonify, session, g
    from flask_cors import CORS
    from flask_socketio import SocketIO, emit, join_room
    import bcrypt
except ImportError as e:
    print(f"\n❌ وابستگی گمشده: {e.name}")
    print("   اجرا کن: pip install -r requirements.txt\n")
    sys.exit(1)

BASE_DIR = Path(__file__).resolve().parent

# 🎯 آدرس دیتابیس (برای Render باید روی دیسک پایدار تنظیم شود)
# اگر دیسک Render را روی /data وصل کردی، این خط را تغییر بده:
# DB_FRIENDS_PATH = Path("/data/hokm_friends.db")
DB_FRIENDS_PATH = BASE_DIR / "hokm_friends.db"

app = Flask(__name__)
app.config["SECRET_KEY"] = secrets.token_hex(32)
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)
CORS(app, supports_credentials=True)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

# ═══════════════════════════════════════════════════════════
# دیتابیس و توابع کمکی
# ═══════════════════════════════════════════════════════════

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(str(DB_FRIENDS_PATH))
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def now_ms():
    return int(time.time() * 1000)

def generate_user_id():
    return "u_" + secrets.token_urlsafe(9)

def generate_friend_code():
    # ساخت کد یکتای ۵ رقمی
    while True:
        code = "HK-" + ''.join(random.choices(string.digits, k=5))
        # چک می‌کنیم تکراری نباشه
        conn = sqlite3.connect(str(DB_FRIENDS_PATH))
        conn.row_factory = sqlite3.Row
        existing = conn.execute("SELECT 1 FROM users WHERE friend_code = ?", (code,)).fetchone()
        conn.close()
        if not existing:
            return code

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, hashed):
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except:
        return False

def init_db():
    db = sqlite3.connect(str(DB_FRIENDS_PATH))
    cursor = db.cursor()
    
    # جدول کاربران
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT UNIQUE NOT NULL,
            friend_code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            avatar TEXT DEFAULT '🌱',
            created_at INTEGER NOT NULL
        )
    """)
    
    # جدول دوستان
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS friendships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id TEXT NOT NULL,
            receiver_id TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at INTEGER NOT NULL,
            UNIQUE(sender_id, receiver_id)
        )
    """)
    
    # جدول پیام‌ها
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id TEXT NOT NULL,
            receiver_id TEXT NOT NULL,
            text TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL
        )
    """)
    
    db.commit()
    db.close()
    print("✅ دیتابیس دوستان (hokm_friends.db) آماده شد.")

def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            token = session.get("token")
        
        if not token:
            return jsonify({"error": "unauthorized"}), 401
            
        db = get_db()
        user = db.execute("SELECT * FROM users WHERE user_id = ?", (token,)).fetchone()
        if not user:
            return jsonify({"error": "invalid_token"}), 401
            
        g.user_id = user["user_id"]
        return f(*args, **kwargs)
    return wrapper

def user_to_dict(row):
    if not row: return None
    return {
        "userId": row["user_id"],
        "friendCode": row["friend_code"],
        "name": row["name"],
        "avatar": row["avatar"]
    }

# ═══════════════════════════════════════════════════════════
# API ها
# ═══════════════════════════════════════════════════════════

@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or len(password) < 6:
        return jsonify({"error": "اطلاعات نامعتبر"}), 400

    db = get_db()
    if db.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        return jsonify({"error": "ایمیل تکراری"}), 409

    user_id = generate_user_id()
    friend_code = generate_friend_code()
    ts = now_ms()

    db.execute("""
        INSERT INTO users (user_id, friend_code, name, email, password, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (user_id, friend_code, name, email, hash_password(password), ts))
    db.commit()

    print(f"👤 کاربر جدید ثبت‌نام کرد: {name} ({friend_code})")

    return jsonify({
        "ok": True, 
        "token": user_id, 
        "friendCode": friend_code,
        "user": {"userId": user_id, "name": name, "friendCode": friend_code}
    })

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "ایمیل و رمز الزامی"}), 400

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    if not user or not verify_password(password, user["password"]):
        return jsonify({"error": "ایمیل یا رمز اشتباه"}), 401

    return jsonify({
        "ok": True, 
        "token": user["user_id"],
        "user": user_to_dict(user)
    })

@app.route("/api/me", methods=["GET"])
@require_auth
def get_me():
    """🎯 دریافت اطلاعات کامل کاربر برای نمایش کد دوست‌یابی در پروفایل"""
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE user_id = ?", (g.user_id,)).fetchone()
    if not user:
        return jsonify({"error": "user_not_found"}), 404
    
    return jsonify(user_to_dict(user))

@app.route("/api/friends", methods=["GET"])
@require_auth
def get_friends():
    db = get_db()
    # گرفتن لیست دوستانی که status=accepted هستن
    rows = db.execute("""
        SELECT u.user_id, u.name, u.avatar
        FROM friendships f
        JOIN users u ON (u.user_id = f.sender_id OR u.user_id = f.receiver_id)
        WHERE (f.sender_id = ? OR f.receiver_id = ?) 
          AND u.user_id != ? 
          AND f.status = 'accepted'
    """, (g.user_id, g.user_id, g.user_id)).fetchall()
    
    return jsonify({"friends": [dict(r) for r in rows]})

@app.route("/api/friends/requests", methods=["GET"])
@require_auth
def get_requests():
    """🎯 دریافت درخواست‌های دوستی در انتظار (برای طرف مقابل)"""
    db = get_db()
    rows = db.execute("""
        SELECT f.id, f.sender_id, u.name, u.avatar, f.created_at
        FROM friendships f
        JOIN users u ON u.user_id = f.sender_id
        WHERE f.receiver_id = ? AND f.status = 'pending'
    """, (g.user_id,)).fetchall()
    
    return jsonify({"requests": [dict(r) for r in rows]})

@app.route("/api/friends/add", methods=["POST"])
@require_auth
def add_friend():
    data = request.get_json() or {}
    friend_code = (data.get("friendCode") or "").strip().upper()

    db = get_db()
    friend = db.execute("SELECT user_id, name FROM users WHERE friend_code = ?", (friend_code,)).fetchone()
    
    if not friend:
        return jsonify({"error": "کاربری با این کد پیدا نشد"}), 404
    
    if friend["user_id"] == g.user_id:
        return jsonify({"error": "نمی‌توانید خودتان را اضافه کنید"}), 400

    # بررسی وجود درخواست قبلی
    existing = db.execute("""
        SELECT status FROM friendships 
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
    """, (g.user_id, friend["user_id"], friend["user_id"], g.user_id)).fetchone()

    if existing:
        if existing["status"] == 'accepted':
            return jsonify({"error": "شما قبلاً با این کاربر دوست هستید"}), 409
        elif existing["status"] == 'pending':
            return jsonify({"error": "درخواست قبلاً ارسال شده است"}), 409

    ts = now_ms()
    db.execute("""
        INSERT INTO friendships (sender_id, receiver_id, status, created_at)
        VALUES (?, ?, 'pending', ?)
    """, (g.user_id, friend["user_id"], ts))
    db.commit()
    
    # سیگنال به کاربر گیرنده
    socketio.emit("friend:new_request", {
        "from_user_id": g.user_id,
        "from_name": db.execute("SELECT name FROM users WHERE user_id=?", (g.user_id,)).fetchone()["name"]
    }, room=f"user_{friend['user_id']}")
    
    return jsonify({"ok": True, "message": "درخواست دوستی ارسال شد"})

@app.route("/api/friends/accept", methods=["POST"])
@require_auth
def accept_friend():
    data = request.get_json() or {}
    sender_id = data.get("senderId")
    
    if not sender_id:
        return jsonify({"error": "شناسه فرستنده الزامی است"}), 400
    
    db = get_db()
    # پیدا کردن درخواست در حالت pending
    req = db.execute("""
        SELECT id FROM friendships 
        WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'
    """, (sender_id, g.user_id)).fetchone()
    
    if not req:
        return jsonify({"error": "درخواستی یافت نشد"}), 404
    
    db.execute("UPDATE friendships SET status = 'accepted' WHERE id = ?", (req["id"],))
    db.commit()
    
    # سیگنال به فرستنده
    socketio.emit("friend:accepted", {"by_user_id": g.user_id}, room=f"user_{sender_id}")
    
    return jsonify({"ok": True})

@app.route("/api/friends/reject", methods=["POST"])
@require_auth
def reject_friend():
    data = request.get_json() or {}
    sender_id = data.get("senderId")
    
    if not sender_id:
        return jsonify({"error": "شناسه فرستنده الزامی است"}), 400
    
    db = get_db()
    db.execute("""
        DELETE FROM friendships 
        WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'
    """, (sender_id, g.user_id))
    db.commit()
    
    return jsonify({"ok": True})

# ═══════════════════════════════════════════════════════════
# SocketIO
# ═══════════════════════════════════════════════════════════

@socketio.on("connect")
def on_connect():
    print(f"🔌 متصل شد: {request.sid}")

@socketio.on("disconnect")
def on_disconnect():
    print(f"🔌 قطع شد: {request.sid}")

@socketio.on("auth")
def on_auth(data):
    user_id = data.get("userId")
    if user_id:
        join_room(f"user_{user_id}")
        emit("auth:ok", {"userId": user_id})
        print(f"👤 احراز هویت شد: {user_id}")

@socketio.on("chat:send")
def on_chat_send(data):
    receiver_id = data.get("receiverId")
    text = data.get("text", "").strip()
    sender_id = data.get("senderId")
    
    if not receiver_id or not text or not sender_id:
        return
        
    ts = now_ms()
    db = sqlite3.connect(str(DB_FRIENDS_PATH))
    db.execute("""
        INSERT INTO messages (sender_id, receiver_id, text, created_at)
        VALUES (?, ?, ?, ?)
    """, (sender_id, receiver_id, text, ts))
    db.commit()
    db.close()

    # ارسال به گیرنده
    socketio.emit("chat:receive", {
        "senderId": sender_id, "text": text, "timestamp": ts
    }, room=f"user_{receiver_id}")
    
    # تایید به فرستنده
    emit("chat:sent", {"receiverId": receiver_id, "text": text, "timestamp": ts})

@socketio.on("game:invite")
def on_game_invite(data):
    friend_id = data.get("friendId")
    room_code = data.get("roomCode")
    sender_name = data.get("senderName")
    
    socketio.emit("game:invited", {
        "fromName": sender_name, "roomCode": room_code
    }, room=f"user_{friend_id}")

# ═══════════════════════════════════════════════════════════
# اجرای سرور
# ═══════════════════════════════════════════════════════════
if __name__ == "__main__":
    init_db()
    print("🚀 سرور دوستان Hokm Pro روی پورت 8081 اجرا شد")
    # برای اجرا با Gunicorn: gunicorn -k eventlet -w 1 ServerFriends:app
    socketio.run(app, host="0.0.0.0", port=8081, debug=False)