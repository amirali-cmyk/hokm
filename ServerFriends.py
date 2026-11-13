#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════
   🃏 HOKM PRO v6.2.0 — ServerFriends.py (نسخه نهایی)
   سرور دوستان، چت، ثبت‌نام و ورود
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

# 🎯 Monkey Patch برای Eventlet (باید قبل از بقیه ایمپورت‌ها باشه)
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

# 🎯 مسیر دیتابیس
# اگر روی Render دیسک داری، این خط را به DB_FRIENDS_PATH = Path("/data/hokm_friends.db") تغییر بده
DB_FRIENDS_PATH = Path(os.environ.get("FRIENDS_DB_PATH", str(BASE_DIR / "hokm_friends.db")))

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("HOKM_SECRET", secrets.token_hex(32))
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)

# 🎯 CORS کاملاً باز باشد تا مرورگر با Render مشکل نداشته باشد
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

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
    return "HK-" + ''.join(random.choices(string.digits, k=5))

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, hashed):
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

def init_db():
    db = sqlite3.connect(str(DB_FRIENDS_PATH))
    cursor = db.cursor()
    
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
    if not row: return None
    return {
        "userId": row["user_id"],
        "friendCode": row["friend_code"],
        "name": row["name"],
        "email": row["email"],
        "avatar": row["avatar"]
    }

# ═══════════════════════════════════════════════════════════
# API ها
# ═══════════════════════════════════════════════════════════

@app.route("/", methods=["GET"])
def root():
    return jsonify({"status": "ok", "service": "Hokm Friends Server"})

@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or len(password) < 6:
        return jsonify({"error": "اطلاعات نامعتبر است (رمز حداقل ۶ کاراکتر)"}), 400

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
        return jsonify({"error": "خطا در ثبت‌نام"}), 500

    return jsonify({
        "ok": True,
        "token": user_id,
        "friendCode": friend_code,
        "user": {"userId": user_id, "friendCode": friend_code, "name": name, "email": email}
    })

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

    return jsonify({
        "ok": True,
        "token": user["user_id"],
        "user": user_to_dict(user)
    })

@app.route("/api/me", methods=["GET"])
@require_auth
def get_me():
    return jsonify({"user": user_to_dict(g.user)})

@app.route("/api/friends", methods=["GET"])
@require_auth
def get_friends():
    db = get_db()
    rows = db.execute("""
        SELECT u.user_id, u.name, u.avatar, u.friend_code
        FROM friendships f
        JOIN users u ON u.user_id = CASE WHEN f.sender_id = ? THEN f.receiver_id ELSE f.sender_id END
        WHERE (f.sender_id = ? OR f.receiver_id = ?) AND f.status = 'accepted'
    """, (g.user_id, g.user_id, g.user_id)).fetchall()

    friends = [{"user_id": r["user_id"], "name": r["name"], "avatar": r["avatar"], "friendCode": r["friend_code"]} for r in rows]
    return jsonify({"friends": friends})

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
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
    """, (g.user_id, friend["user_id"], friend["user_id"], g.user_id)).fetchone()

    if existing:
        return jsonify({"error": "درخواست قبلاً ارسال شده"}), 409

    ts = now_ms()
    db.execute("""
        INSERT INTO friendships (sender_id, receiver_id, status, created_at)
        VALUES (?, ?, 'pending', ?)
    """, (g.user_id, friend["user_id"], ts))
    db.commit()

    socketio.emit("friend:new_request", {"from_name": g.user["name"]}, room=f"user_{friend['user_id']}")
    return jsonify({"ok": True, "message": "درخواست دوستی ارسال شد"})

# ═══════════════════════════════════════════════════════════
# SocketIO
# ═══════════════════════════════════════════════════════════

@socketio.on("connect")
def on_connect():
    print(f"🔌 Connected: {request.sid}")

@socketio.on("auth")
def on_auth(data):
    user_id = data.get("userId")
    if user_id:
        join_room(f"user_{user_id}")
        emit("auth:ok", {"userId": user_id})

@socketio.on("chat:send")
def on_chat_send(data):
    receiver_id = data.get("receiverId")
    text = (data.get("text") or "").strip()
    sender_id = data.get("senderId")
    if not receiver_id or not text or not sender_id: return

    ts = now_ms()
    db = sqlite3.connect(str(DB_FRIENDS_PATH))
    db.execute("INSERT INTO messages (sender_id, receiver_id, text, created_at) VALUES (?, ?, ?, ?)",
               (sender_id, receiver_id, text[:500], ts))
    db.commit()
    db.close()

    socketio.emit("chat:receive", {"senderId": sender_id, "text": text[:500], "timestamp": ts}, room=f"user_{receiver_id}")
    emit("chat:sent", {"receiverId": receiver_id, "text": text[:500], "timestamp": ts})

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 8081))
    socketio.run(app, host="0.0.0.0", port=port)