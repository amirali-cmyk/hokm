#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════
   🃏 HOKM PRO v6.2.0 — ServerFriends.py
   سرور اختصاصی دوستان، چت، ثبت‌نام و ورود (برای Render)
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

# 🎯 باید قبل از هر import دیگه‌ای باشه (برای Gunicorn + Eventlet)
import eventlet
eventlet.monkey_patch()

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

# 🎯 مسیر دیتابیس (اگر روی Render دیسک داری، مسیر /data رو بذار)
# برای تست محلی همین DB_FRIENDS_PATH خوبه. روی Render مسیر mount شده رو بذار.
DB_FRIENDS_PATH = Path(os.environ.get("FRIENDS_DB_PATH", str(BASE_DIR / "hokm_friends.db")))

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("HOKM_SECRET", secrets.token_hex(32))
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)
CORS(app, supports_credentials=True, origins="*")

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")


# ═══════════════════════════════════════════════════════════
# اتصال به دیتابیس
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

def verify_password(password, hashed):
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


# ═══════════════════════════════════════════════════════════
# ساخت جداول
# ═══════════════════════════════════════════════════════════

def init_db():
    db = sqlite3.connect(str(DB_FRIENDS_PATH))
    cursor = db.cursor()
    
    # کاربران
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
    
    # دوستان
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
    
    # پیام‌ها
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
    print(f"✅ دیتابیس دوستان آماده است: {DB_FRIENDS_PATH}")


# ═══════════════════════════════════════════════════════════
# احراز هویت با توکن
# ═══════════════════════════════════════════════════════════

def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else auth
        
        if not token:
            return jsonify({"error": "توکن نامعتبر است"}), 401
            
        db = get_db()
        user = db.execute("SELECT * FROM users WHERE user_id = ?", (token,)).fetchone()
        if not user:
            return jsonify({"error": "کاربر پیدا نشد"}), 401
            
        g.user_id = user["user_id"]
        g.user = user
        return f(*args, **kwargs)
    return wrapper


def user_to_dict(row):
    if not row:
        return None
    return {
        "userId": row["user_id"],
        "friendCode": row["friend_code"],
        "name": row["name"],
        "email": row["email"],
        "avatar": row["avatar"]
    }


# ═══════════════════════════════════════════════════════════
# API: ثبت‌نام، ورود و پروفایل
# ═══════════════════════════════════════════════════════════

@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or len(name) < 2:
        return jsonify({"error": "نام حداقل ۲ کاراکتر باشد"}), 400
    if not email or "@" not in email:
        return jsonify({"error": "ایمیل نامعتبر است"}), 400
    if len(password) < 6:
        return jsonify({"error": "رمز حداقل ۶ کاراکتر باشد"}), 400

    db = get_db()
    if db.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        return jsonify({"error": "این ایمیل قبلاً ثبت شده است"}), 409

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
        return jsonify({"error": "خطا در ثبت‌نام. دوباره تلاش کنید"}), 500

    print(f"👤 کاربر جدید: {name} ({email}) — کد: {friend_code}")

    return jsonify({
        "ok": True,
        "token": user_id,
        "friendCode": friend_code,
        "user": {
            "userId": user_id,
            "friendCode": friend_code,
            "name": name,
            "email": email
        }
    }), 201


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "ایمیل و رمز الزامی است"}), 400

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    if not user or not verify_password(password, user["password"]):
        return jsonify({"error": "ایمیل یا رمز عبور اشتباه است"}), 401

    print(f"🔑 ورود موفق: {user['name']}")

    return jsonify({
        "ok": True,
        "token": user["user_id"],
        "user": user_to_dict(user)
    })


@app.route("/api/me", methods=["GET"])
@require_auth
def get_me():
    return jsonify({"user": user_to_dict(g.user)})


@app.route("/", methods=["GET"])
def root():
    return jsonify({
        "status": "ok",
        "service": "Hokm Friends Server",
        "version": "6.2.0",
        "endpoints": [
            "POST /api/register",
            "POST /api/login",
            "GET /api/me",
            "GET /api/friends",
            "POST /api/friends/add",
            "POST /api/friends/accept"
        ]
    })


# ═══════════════════════════════════════════════════════════
# API: دوستان
# ═══════════════════════════════════════════════════════════

@app.route("/api/friends", methods=["GET"])
@require_auth
def get_friends():
    db = get_db()
    # دوستانی که درخواستشون accepted شده
    rows = db.execute("""
        SELECT u.user_id, u.name, u.avatar, u.friend_code,
               CASE WHEN f.sender_id = ? THEN f.receiver_id ELSE f.sender_id END AS other_id
        FROM friendships f
        JOIN users u ON u.user_id = CASE WHEN f.sender_id = ? THEN f.receiver_id ELSE f.sender_id END
        WHERE (f.sender_id = ? OR f.receiver_id = ?) AND f.status = 'accepted'
    """, (g.user_id, g.user_id, g.user_id, g.user_id)).fetchall()

    friends = [{
        "user_id": r["user_id"],
        "name": r["name"],
        "avatar": r["avatar"],
        "friendCode": r["friend_code"]
    } for r in rows]

    return jsonify({"friends": friends})


@app.route("/api/friends/pending", methods=["GET"])
@require_auth
def get_pending_requests():
    db = get_db()
    rows = db.execute("""
        SELECT u.user_id, u.name, u.avatar, f.created_at
        FROM friendships f
        JOIN users u ON u.user_id = f.sender_id
        WHERE f.receiver_id = ? AND f.status = 'pending'
        ORDER BY f.created_at DESC
    """, (g.user_id,)).fetchall()

    return jsonify({"requests": [dict(r) for r in rows]})


@app.route("/api/friends/add", methods=["POST"])
@require_auth
def add_friend():
    data = request.get_json() or {}
    friend_code = (data.get("friendCode") or "").strip().upper()

    if not friend_code:
        return jsonify({"error": "کد کاربری را وارد کنید"}), 400

    db = get_db()
    friend = db.execute("SELECT * FROM users WHERE friend_code = ?", (friend_code,)).fetchone()
    
    if not friend:
        return jsonify({"error": "کاربری با این کد پیدا نشد"}), 404
    
    if friend["user_id"] == g.user_id:
        return jsonify({"error": "نمی‌توانید خودتان را اضافه کنید"}), 400

    existing = db.execute("""
        SELECT * FROM friendships 
        WHERE (sender_id = ? AND receiver_id = ?) 
           OR (sender_id = ? AND receiver_id = ?)
    """, (g.user_id, friend["user_id"], friend["user_id"], g.user_id)).fetchone()

    if existing:
        return jsonify({"error": "درخواست قبلاً ارسال شده یا شما دوست هستید"}), 409

    ts = now_ms()
    db.execute("""
        INSERT INTO friendships (sender_id, receiver_id, status, created_at)
        VALUES (?, ?, 'pending', ?)
    """, (g.user_id, friend["user_id"], ts))
    db.commit()

    # اطلاع آنی به کاربر هدف اگر آنلاین باشد
    socketio.emit("friend:new_request", {
        "from_user_id": g.user_id,
        "from_name": g.user["name"]
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
    db.execute("""
        UPDATE friendships SET status = 'accepted' 
        WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'
    """, (sender_id, g.user_id))
    db.commit()

    socketio.emit("friend:accepted", {
        "by_user_id": g.user_id,
        "by_name": g.user["name"]
    }, room=f"user_{sender_id}")

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


@app.route("/api/friends/<friend_id>", methods=["DELETE"])
@require_auth
def remove_friend(friend_id):
    db = get_db()
    db.execute("""
        DELETE FROM friendships 
        WHERE (sender_id = ? AND receiver_id = ?) 
           OR (sender_id = ? AND receiver_id = ?)
    """, (g.user_id, friend_id, friend_id, g.user_id))
    db.commit()
    return jsonify({"ok": True})


# ═══════════════════════════════════════════════════════════
# API: پیام‌ها
# ═══════════════════════════════════════════════════════════

@app.route("/api/messages/<friend_id>", methods=["GET"])
@require_auth
def get_messages(friend_id):
    db = get_db()
    limit = min(int(request.args.get("limit", 100)), 200)

    rows = db.execute("""
        SELECT * FROM messages 
        WHERE (sender_id = ? AND receiver_id = ?) 
           OR (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at DESC
        LIMIT ?
    """, (g.user_id, friend_id, friend_id, g.user_id, limit)).fetchall()

    # علامت خوانده‌شده
    db.execute("""
        UPDATE messages SET is_read = 1 
        WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
    """, (friend_id, g.user_id))
    db.commit()

    messages = [{
        "id": r["id"],
        "senderId": r["sender_id"],
        "receiverId": r["receiver_id"],
        "text": r["text"],
        "timestamp": r["created_at"],
        "isRead": bool(r["is_read"])
    } for r in reversed(rows)]

    return jsonify({"messages": messages})


# ═══════════════════════════════════════════════════════════
# Socket.IO
# ═══════════════════════════════════════════════════════════

@socketio.on("connect")
def on_connect():
    print(f"🔌 Connected: {request.sid}")


@socketio.on("disconnect")
def on_disconnect():
    print(f"🔌 Disconnected: {request.sid}")


@socketio.on("auth")
def on_auth(data):
    user_id = data.get("userId")
    if user_id:
        join_room(f"user_{user_id}")
        emit("auth:ok", {"userId": user_id})
        print(f"👤 Authenticated: {user_id}")


@socketio.on("chat:send")
def on_chat_send(data):
    receiver_id = data.get("receiverId")
    text = (data.get("text") or "").strip()
    sender_id = data.get("senderId")

    if not receiver_id or not text or not sender_id:
        return

    if len(text) > 500:
        text = text[:500]

    ts = now_ms()

    # ذخیره در دیتابیس
    db = sqlite3.connect(str(DB_FRIENDS_PATH))
    db.execute("""
        INSERT INTO messages (sender_id, receiver_id, text, created_at)
        VALUES (?, ?, ?, ?)
    """, (sender_id, receiver_id, text, ts))
    db.commit()
    db.close()

    # ارسال به گیرنده
    socketio.emit("chat:receive", {
        "senderId": sender_id,
        "text": text,
        "timestamp": ts
    }, room=f"user_{receiver_id}")

    # تأیید به فرستنده
    emit("chat:sent", {
        "receiverId": receiver_id,
        "text": text,
        "timestamp": ts
    })


@socketio.on("game:invite")
def on_game_invite(data):
    friend_id = data.get("friendId")
    room_code = data.get("roomCode")
    sender_name = data.get("senderName")

    if friend_id and room_code:
        socketio.emit("game:invited", {
            "fromName": sender_name or "یک دوست",
            "roomCode": room_code
        }, room=f"user_{friend_id}")


# ═══════════════════════════════════════════════════════════
# اجرای سرور (فقط برای تست محلی)
# ═══════════════════════════════════════════════════════════

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 8081))
    print(f"🚀 Friends Server running on port {port}")
    socketio.run(app, host="0.0.0.0", port=port, debug=False)