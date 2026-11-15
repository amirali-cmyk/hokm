#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════
   🃏 HOKM PRO v6.2.0 — ServerFriends.py
   سرور اختصاصی دوستان، چت و دعوت به بازی
═══════════════════════════════════════════════════════════════
"""

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
# 🎯 آدرس دیسک مخصوص Render (برای ذخیره دائمی)
DB_FRIENDS_PATH = Path("/data/hokm_friends.db") if os.path.exists("/data") else BASE_DIR / "hokm_friends.db"

app = Flask(__name__)
app.config["SECRET_KEY"] = secrets.token_hex(32)
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)
CORS(app, supports_credentials=True)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

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
    return "HK-" + ''.join(random.choices(string.digits, k=5))

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def init_db():
    db = sqlite3.connect(str(DB_FRIENDS_PATH))
    cursor = db.cursor()
    
    # ۱. کاربران
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
    
    # ۲. دوستان
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
    
    # ۳. پیام‌ها
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
    print(f"✅ دیتابیس دوستان در {DB_FRIENDS_PATH} آماده شد.")

def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return jsonify({"error": "unauthorized"}), 401
            
        db = get_db()
        user = db.execute("SELECT * FROM users WHERE user_id = ?", (token,)).fetchone()
        if not user:
            return jsonify({"error": "invalid_token"}), 401
            
        g.user_id = user["user_id"]
        return f(*args, **kwargs)
    return wrapper

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
    
    # چک کردن اینکه آیا کاربر قبلاً با این ایمیل ثبت‌نام کرده؟ (برای مهمان‌ها)
    existing = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        return jsonify({
            "ok": True, 
            "token": existing["user_id"], 
            "friendCode": existing["friend_code"]
        })

    user_id = generate_user_id()
    friend_code = generate_friend_code()
    ts = now_ms()

    try:
        db.execute("""
            INSERT INTO users (user_id, friend_code, name, email, password, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, friend_code, name, email, hash_password(password), ts))
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "خطا در ثبت‌نام"}), 500

    return jsonify({
        "ok": True, 
        "token": user_id, 
        "friendCode": friend_code
    })

# 🎯 API جدید: گرفتن اطلاعات کاربر (برای پروفایل و نمایش کد HK)
@app.route("/api/me", methods=["GET"])
@require_auth
def get_me():
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE user_id = ?", (g.user_id,)).fetchone()
    if not user:
        return jsonify({"error": "user_not_found"}), 404
    
    return jsonify({
        "userId": user["user_id"],
        "friendCode": user["friend_code"],
        "name": user["name"],
        "avatar": user["avatar"]
    })

@app.route("/api/friends", methods=["GET"])
@require_auth
def get_friends():
    db = get_db()
    rows = db.execute("""
        SELECT u.user_id, u.name, u.avatar, f.status
        FROM friendships f
        JOIN users u ON (u.user_id = f.sender_id OR u.user_id = f.receiver_id)
        WHERE (f.sender_id = ? OR f.receiver_id = ?) 
          AND u.user_id != ? AND f.status = 'accepted'
    """, (g.user_id, g.user_id, g.user_id)).fetchall()
    return jsonify({"friends": [dict(r) for r in rows]})

@app.route("/api/friends/add", methods=["POST"])
@require_auth
def add_friend():
    data = request.get_json() or {}
    friend_code = (data.get("friendCode") or "").strip().upper()

    db = get_db()
    friend = db.execute("SELECT user_id FROM users WHERE friend_code = ?", (friend_code,)).fetchone()
    
    if not friend:
        return jsonify({"error": "کاربر پیدا نشد"}), 404
    if friend["user_id"] == g.user_id:
        return jsonify({"error": "نمی‌توانید خودتان را اضافه کنید"}), 400
    
    ts = now_ms()
    try:
        db.execute("""
            INSERT INTO friendships (sender_id, receiver_id, status, created_at)
            VALUES (?, ?, 'pending', ?)
        """, (g.user_id, friend["user_id"], ts))
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "درخواست قبلاً ارسال شده"}), 409

    socketio.emit("friend:new_request", {"from_user_id": g.user_id}, room=f"user_{friend['user_id']}")
    return jsonify({"ok": True})

# ═══════════════════════════════════════════════════════════
# SocketIO ها (چت و دعوت)
# ═══════════════════════════════════════════════════════════

@socketio.on("auth")
def on_auth(data):
    user_id = data.get("userId")
    if user_id:
        join_room(f"user_{user_id}")
        emit("auth:ok", {"userId": user_id})
        print(f"👤 User {user_id} authenticated in friends server.")

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

    socketio.emit("chat:receive", {
        "senderId": sender_id, "text": text, "timestamp": ts
    }, room=f"user_{receiver_id}")
    
    emit("chat:sent", {"receiverId": receiver_id, "text": text, "timestamp": ts})

@socketio.on("game:invite")
def on_game_invite(data):
    friend_id = data.get("friendId")
    room_code = data.get("roomCode")
    sender_name = data.get("senderName")
    
    socketio.emit("game:invited", {
        "fromName": sender_name, "roomCode": room_code
    }, room=f"user_{friend_id}")

if __name__ == "__main__":
    init_db()
    print("🚀 سرور دوستان Hokm Pro روی پورت 8081 اجرا شد")
    socketio.run(app, host="0.0.0.0", port=8081, debug=True)