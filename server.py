#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════
   🃏 HOKM PRO v6.0 — server.py
   سرور Flask + SocketIO + SQLite برای قابلیت آنلاین کامل
═══════════════════════════════════════════════════════════════

امکانات:
  ✅ حساب کاربری (bcrypt hash)
  ✅ جلسه کاربری (session token)
  ✅ لیدربورد (هفتگی/ماهانه/کل)
  ✅ اتاق‌های بازی (۶ کاراکتری)
  ✅ بازی چندنفره Realtime (SocketIO)
  ✅ دوستان
  ✅ تورنمنت
  ✅ ذخیره Replay
"""

import os
import sys
import json
import time
import sqlite3
import secrets
import hashlib
import random
import string
from datetime import datetime, timedelta
from functools import wraps
from pathlib import Path

# ─── وابستگی‌ها ───
try:
    from flask import Flask, request, jsonify, session, send_from_directory, g
    from flask_cors import CORS
    from flask_socketio import SocketIO, emit, join_room, leave_room, rooms
    import bcrypt
except ImportError as e:
    print(f"\n❌ وابستگی گمشده: {e.name}")
    print("   اجرا کن: pip install -r requirements.txt\n")
    sys.exit(1)


# ═══════════════════════════════════════════════════════════
# پیکربندی
# ═══════════════════════════════════════════════════════════

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "hokm.db"
STATIC_DIR = BASE_DIR

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="")
app.config["SECRET_KEY"] = os.environ.get("HOKM_SECRET", secrets.token_hex(32))
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)

CORS(app, supports_credentials=True)

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
    ping_timeout=30,
    ping_interval=10,
    logger=False,
    engineio_logger=False,
)


# ═══════════════════════════════════════════════════════════
# دیتابیس SQLite
# ═══════════════════════════════════════════════════════════

def get_db():
    """اتصال دیتابیس برای request جاری"""
    if "db" not in g:
        g.db = sqlite3.connect(str(DB_PATH))
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """ساخت جداول اولیه"""
    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = sqlite3.Row
    cursor = db.cursor()

    # ─── کاربران ───
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     TEXT UNIQUE NOT NULL,
            name        TEXT NOT NULL,
            email       TEXT UNIQUE NOT NULL,
            password    TEXT NOT NULL,
            avatar      TEXT DEFAULT '🌱',
            elo         INTEGER DEFAULT 1000,
            coins       INTEGER DEFAULT 100,
            wins        INTEGER DEFAULT 0,
            losses      INTEGER DEFAULT 0,
            games       INTEGER DEFAULT 0,
            best_streak INTEGER DEFAULT 0,
            current_streak INTEGER DEFAULT 0,
            hokm_claimed INTEGER DEFAULT 0,
            hokm_won    INTEGER DEFAULT 0,
            created_at  INTEGER NOT NULL,
            last_played_at INTEGER,
            last_seen   INTEGER,
            is_online   INTEGER DEFAULT 0
        )
    """)

    # ─── جلسات ───
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token       TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            created_at  INTEGER NOT NULL,
            expires_at  INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
    """)

    # ─── بازی‌ها ───
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS games (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id     TEXT UNIQUE NOT NULL,
            winner_team TEXT NOT NULL,
            score_a     INTEGER NOT NULL,
            score_b     INTEGER NOT NULL,
            player_ids  TEXT NOT NULL,
            mode        TEXT DEFAULT 'online',
            duration_ms INTEGER,
            created_at  INTEGER NOT NULL
        )
    """)

    # ─── تاریخچه ELO ───
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS elo_history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     TEXT NOT NULL,
            old_elo     INTEGER NOT NULL,
            new_elo     INTEGER NOT NULL,
            change      INTEGER NOT NULL,
            game_id     TEXT,
            created_at  INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
    """)

    # ─── دوستان ───
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS friendships (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     TEXT NOT NULL,
            friend_id   TEXT NOT NULL,
            status      TEXT DEFAULT 'accepted',
            created_at  INTEGER NOT NULL,
            UNIQUE(user_id, friend_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
            FOREIGN KEY (friend_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
    """)

    # ─── پیام‌های چت ───
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            from_user   TEXT NOT NULL,
            to_user     TEXT NOT NULL,
            text        TEXT NOT NULL,
            read        INTEGER DEFAULT 0,
            created_at  INTEGER NOT NULL,
            FOREIGN KEY (from_user) REFERENCES users(user_id) ON DELETE CASCADE
        )
    """)

    # ─── Replays ───
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS replays (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            replay_id   TEXT UNIQUE NOT NULL,
            game_id     TEXT NOT NULL,
            owner_id    TEXT NOT NULL,
            data        TEXT NOT NULL,
            created_at  INTEGER NOT NULL
        )
    """)

    # ─── ایندکس‌ها ───
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_elo ON users(elo DESC)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_elo_user ON elo_history(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_users ON messages(from_user, to_user)")

    db.commit()
    db.close()
    print("✅ دیتابیس آماده است")


# ═══════════════════════════════════════════════════════════
# ابزارهای کاربر
# ═══════════════════════════════════════════════════════════

def generate_user_id():
    """ساخت user_id یکتا"""
    return "u_" + secrets.token_urlsafe(9)


def generate_token():
    """ساخت session token"""
    return secrets.token_urlsafe(32)


def now_ms():
    """زمان جاری به میلی‌ثانیه"""
    return int(time.time() * 1000)


def hash_password(password: str) -> str:
    """هش رمز با bcrypt"""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """بررسی رمز"""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_rank_from_elo(elo: int) -> str:
    """تبدیل ELO به رتبه"""
    if elo >= 2000: return "legend"
    if elo >= 1800: return "grandmaster"
    if elo >= 1600: return "master"
    if elo >= 1400: return "pro"
    if elo >= 1200: return "intermediate"
    if elo >= 1000: return "rookie"
    return "beginner"


def user_to_dict(row):
    """تبدیل ردیف کاربر به dict"""
    if row is None:
        return None
    return {
        "userId": row["user_id"],
        "name": row["name"],
        "email": row["email"],
        "avatar": row["avatar"],
        "elo": row["elo"],
        "rank": get_rank_from_elo(row["elo"]),
        "coins": row["coins"],
        "wins": row["wins"],
        "losses": row["losses"],
        "games": row["games"],
        "bestStreak": row["best_streak"],
        "currentStreak": row["current_streak"],
        "hokmClaimed": row["hokm_claimed"],
        "hokmWon": row["hokm_won"],
        "winRate": round(row["wins"] / row["games"] * 100) if row["games"] > 0 else 0,
        "createdAt": row["created_at"],
        "lastPlayedAt": row["last_played_at"],
        "lastSeen": row["last_seen"],
        "isOnline": bool(row["is_online"]),
    }


def require_auth(f):
    """دکوراتور چک احراز هویت"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = None

        # از header
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]

        # از session cookie
        if not token:
            token = session.get("token")

        if not token:
            return jsonify({"error": "unauthorized"}), 401

        db = get_db()
        row = db.execute(
            "SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?",
            (token, now_ms())
        ).fetchone()

        if not row:
            return jsonify({"error": "invalid_token"}), 401

        g.user_id = row["user_id"]
        g.token = token
        return f(*args, **kwargs)
    return wrapper


# ═══════════════════════════════════════════════════════════
# API: احراز هویت
# ═══════════════════════════════════════════════════════════

@app.route("/api/register", methods=["POST"])
def register():
    """ثبت‌نام کاربر جدید"""
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    # اعتبارسنجی
    if not name or len(name) < 2:
        return jsonify({"error": "نام حداقل ۲ کاراکتر"}), 400
    if not email or "@" not in email:
        return jsonify({"error": "ایمیل نامعتبر"}), 400
    if not password or len(password) < 6:
        return jsonify({"error": "رمز حداقل ۶ کاراکتر"}), 400

    db = get_db()

    # چک تکراری
    if db.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        return jsonify({"error": "این ایمیل قبلاً ثبت شده"}), 409

    # ساخت کاربر
    user_id = generate_user_id()
    hashed = hash_password(password)
    ts = now_ms()

    try:
        db.execute("""
            INSERT INTO users (user_id, name, email, password, created_at, last_seen)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, name[:20], email, hashed, ts, ts))
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "خطا در ثبت‌نام"}), 500

    # ساخت session
    token = generate_token()
    expires = ts + (30 * 24 * 60 * 60 * 1000)

    db.execute("""
        INSERT INTO sessions (token, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
    """, (token, user_id, ts, expires))
    db.commit()

    user = db.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)).fetchone()

    print(f"👤 کاربر جدید: {name} ({email})")

    return jsonify({
        "ok": True,
        "token": token,
        "user": user_to_dict(user)
    })


@app.route("/api/login", methods=["POST"])
def login():
    """ورود کاربر"""
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "ایمیل و رمز الزامی"}), 400

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    if not user or not verify_password(password, user["password"]):
        return jsonify({"error": "ایمیل یا رمز اشتباه"}), 401

    # ساخت session
    ts = now_ms()
    token = generate_token()
    expires = ts + (30 * 24 * 60 * 60 * 1000)

    db.execute("""
        INSERT INTO sessions (token, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
    """, (token, user["user_id"], ts, expires))

    # آپدیت last_seen
    db.execute("UPDATE users SET last_seen = ? WHERE user_id = ?", (ts, user["user_id"]))
    db.commit()

    print(f"🔑 ورود: {user['name']}")

    return jsonify({
        "ok": True,
        "token": token,
        "user": user_to_dict(user)
    })


@app.route("/api/logout", methods=["POST"])
@require_auth
def logout():
    """خروج کاربر"""
    db = get_db()
    db.execute("DELETE FROM sessions WHERE token = ?", (g.token,))
    db.execute("UPDATE users SET is_online = 0 WHERE user_id = ?", (g.user_id,))
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/me", methods=["GET"])
@require_auth
def get_me():
    """اطلاعات کاربر جاری"""
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE user_id = ?", (g.user_id,)).fetchone()
    if not user:
        return jsonify({"error": "user_not_found"}), 404
    return jsonify({"user": user_to_dict(user)})


@app.route("/api/me", methods=["PATCH"])
@require_auth
def update_me():
    """آپدیت پروفایل"""
    data = request.get_json() or {}
    db = get_db()

    updates = []
    values = []

    if "name" in data and data["name"]:
        updates.append("name = ?")
        values.append(str(data["name"]).strip()[:20])

    if "avatar" in data:
        updates.append("avatar = ?")
        values.append(str(data["avatar"])[:2048])

    if not updates:
        return jsonify({"error": "چیزی برای آپدیت نیست"}), 400

    values.append(g.user_id)
    db.execute(f"UPDATE users SET {', '.join(updates)} WHERE user_id = ?", values)
    db.commit()

    user = db.execute("SELECT * FROM users WHERE user_id = ?", (g.user_id,)).fetchone()
    return jsonify({"ok": True, "user": user_to_dict(user)})


# ═══════════════════════════════════════════════════════════
# API: بازی‌ها
# ═══════════════════════════════════════════════════════════

@app.route("/api/games/record", methods=["POST"])
@require_auth
def record_game():
    """ثبت نتیجه یک بازی"""
    data = request.get_json() or {}

    win = bool(data.get("win"))
    score_a = int(data.get("scoreA", 0))
    score_b = int(data.get("scoreB", 0))
    duration_ms = int(data.get("durationMs", 0))
    opponent_elo = int(data.get("opponentElo", 1100))
    mode = data.get("mode", "online")

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE user_id = ?", (g.user_id,)).fetchone()
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    old_elo = user["elo"]

    # ─── محاسبه ELO FIDE ───
    expected = 1 / (1 + 10 ** ((opponent_elo - old_elo) / 400))
    actual = 1 if win else 0
    change = round(32 * (actual - expected))

    if actual == 1 and change < 5:
        change = 5
    if actual == 0 and change > -5:
        change = -5

    new_elo = max(0, old_elo + change)

    # ─── آمار ───
    wins = user["wins"] + (1 if win else 0)
    losses = user["losses"] + (0 if win else 1)
    games = user["games"] + 1
    current_streak = (user["current_streak"] + 1) if win else 0
    best_streak = max(user["best_streak"], current_streak)
    coins_earned = 50 if win else 20

    db.execute("""
        UPDATE users SET
            elo = ?,
            wins = ?,
            losses = ?,
            games = ?,
            current_streak = ?,
            best_streak = ?,
            coins = coins + ?,
            last_played_at = ?
        WHERE user_id = ?
    """, (
        new_elo, wins, losses, games,
        current_streak, best_streak,
        coins_earned, now_ms(), g.user_id
    ))

    # تاریخچه ELO
    db.execute("""
        INSERT INTO elo_history (user_id, old_elo, new_elo, change, created_at)
        VALUES (?, ?, ?, ?, ?)
    """, (g.user_id, old_elo, new_elo, change, now_ms()))

    db.commit()

    print(f"🎮 {user['name']}: {old_elo} → {new_elo} ({change:+d})")

    return jsonify({
        "ok": True,
        "oldElo": old_elo,
        "newElo": new_elo,
        "change": change,
        "coinsEarned": coins_earned,
        "rank": get_rank_from_elo(new_elo),
    })


# ═══════════════════════════════════════════════════════════
# API: لیدربورد
# ═══════════════════════════════════════════════════════════

@app.route("/api/leaderboard", methods=["GET"])
def leaderboard():
    """Top 100 بازیکنان"""
    filter_type = request.args.get("filter", "all")
    limit = min(int(request.args.get("limit", 100)), 100)

    db = get_db()

    if filter_type == "all":
        rows = db.execute("""
            SELECT * FROM users
            WHERE games > 0
            ORDER BY elo DESC
            LIMIT ?
        """, (limit,)).fetchall()
    else:
        days = 7 if filter_type == "weekly" else 30
        cutoff = now_ms() - (days * 24 * 60 * 60 * 1000)

        rows = db.execute("""
            SELECT u.*, COUNT(g.id) as recent_games
            FROM users u
            JOIN elo_history g ON g.user_id = u.user_id
            WHERE g.created_at >= ?
            GROUP BY u.user_id
            ORDER BY u.elo DESC
            LIMIT ?
        """, (cutoff, limit)).fetchall()

    entries = []
    for i, row in enumerate(rows):
        e = user_to_dict(row)
        e["rank"] = i + 1
        entries.append(e)

    return jsonify({"entries": entries, "filter": filter_type})


# ═══════════════════════════════════════════════════════════
# API: دوستان
# ═══════════════════════════════════════════════════════════

@app.route("/api/friends", methods=["GET"])
@require_auth
def get_friends():
    """لیست دوستان"""
    db = get_db()

    rows = db.execute("""
        SELECT u.* FROM users u
        JOIN friendships f ON f.friend_id = u.user_id
        WHERE f.user_id = ? AND f.status = 'accepted'
        ORDER BY u.is_online DESC, u.last_seen DESC
    """, (g.user_id,)).fetchall()

    return jsonify({"friends": [user_to_dict(r) for r in rows]})


@app.route("/api/friends/add", methods=["POST"])
@require_auth
def add_friend():
    """افزودن دوست"""
    data = request.get_json() or {}
    friend_identifier = (data.get("userId") or data.get("name") or "").strip()

    if not friend_identifier:
        return jsonify({"error": "کد کاربری الزامی"}), 400

    db = get_db()

    # پیدا کردن دوست
    friend = db.execute("""
        SELECT * FROM users
        WHERE user_id = ? OR name = ?
        LIMIT 1
    """, (friend_identifier, friend_identifier)).fetchone()

    if not friend:
        return jsonify({"error": "کاربر پیدا نشد"}), 404

    if friend["user_id"] == g.user_id:
        return jsonify({"error": "نمی‌توانی خودت را اضافه کنی"}), 400

    # چک تکراری
    existing = db.execute("""
        SELECT * FROM friendships
        WHERE (user_id = ? AND friend_id = ?)
           OR (user_id = ? AND friend_id = ?)
    """, (g.user_id, friend["user_id"], friend["user_id"], g.user_id)).fetchone()

    if existing:
        return jsonify({"error": "قبلاً اضافه شده"}), 409

    ts = now_ms()

    # دوطرفه
    db.execute("""
        INSERT INTO friendships (user_id, friend_id, status, created_at)
        VALUES (?, ?, 'accepted', ?), (?, ?, 'accepted', ?)
    """, (g.user_id, friend["user_id"], ts, friend["user_id"], g.user_id, ts))
    db.commit()

    return jsonify({"ok": True, "friend": user_to_dict(friend)})


@app.route("/api/friends/<friend_id>", methods=["DELETE"])
@require_auth
def remove_friend(friend_id):
    """حذف دوست"""
    db = get_db()
    db.execute("""
        DELETE FROM friendships
        WHERE (user_id = ? AND friend_id = ?)
           OR (user_id = ? AND friend_id = ?)
    """, (g.user_id, friend_id, friend_id, g.user_id))
    db.commit()
    return jsonify({"ok": True})


# ═══════════════════════════════════════════════════════════
# API: چت
# ═══════════════════════════════════════════════════════════

@app.route("/api/messages/<friend_id>", methods=["GET"])
@require_auth
def get_messages(friend_id):
    """دریافت پیام‌ها با یک دوست"""
    db = get_db()
    limit = min(int(request.args.get("limit", 100)), 200)

    rows = db.execute("""
        SELECT * FROM messages
        WHERE (from_user = ? AND to_user = ?)
           OR (from_user = ? AND to_user = ?)
        ORDER BY created_at DESC
        LIMIT ?
    """, (g.user_id, friend_id, friend_id, g.user_id, limit)).fetchall()

    # علامت خوانده‌شده
    db.execute("""
        UPDATE messages SET read = 1
        WHERE from_user = ? AND to_user = ? AND read = 0
    """, (friend_id, g.user_id))
    db.commit()

    messages = [
        {
            "id": r["id"],
            "from": "me" if r["from_user"] == g.user_id else "them",
            "text": r["text"],
            "timestamp": r["created_at"],
            "read": bool(r["read"]),
        }
        for r in reversed(rows)
    ]

    return jsonify({"messages": messages})


@app.route("/api/messages/<friend_id>", methods=["POST"])
@require_auth
def send_message(friend_id):
    """ارسال پیام"""
    data = request.get_json() or {}
    text = (data.get("text") or "").strip()[:500]

    if not text:
        return jsonify({"error": "پیام خالی"}), 400

    db = get_db()
    ts = now_ms()

    cursor = db.execute("""
        INSERT INTO messages (from_user, to_user, text, created_at)
        VALUES (?, ?, ?, ?)
    """, (g.user_id, friend_id, text, ts))
    db.commit()

    msg = {
        "id": cursor.lastrowid,
        "from": "me",
        "text": text,
        "timestamp": ts,
        "read": False,
    }

    # ارسال realtime
    socketio.emit("chat:message", {
        "fromUserId": g.user_id,
        "message": msg,
    }, room=f"user_{friend_id}")

    return jsonify({"ok": True, "message": msg})


# ═══════════════════════════════════════════════════════════
# API: Replays
# ═══════════════════════════════════════════════════════════

@app.route("/api/replays", methods=["GET"])
@require_auth
def list_replays():
    """لیست رپلی‌ها"""
    db = get_db()
    rows = db.execute("""
        SELECT replay_id, game_id, created_at
        FROM replays
        WHERE owner_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    """, (g.user_id,)).fetchall()

    return jsonify({
        "replays": [
            {
                "id": r["replay_id"],
                "gameId": r["game_id"],
                "createdAt": r["created_at"],
            }
            for r in rows
        ]
    })


@app.route("/api/replays/<replay_id>", methods=["GET"])
@require_auth
def get_replay(replay_id):
    """دریافت یک رپلی"""
    db = get_db()
    row = db.execute("""
        SELECT * FROM replays
        WHERE replay_id = ? AND owner_id = ?
    """, (replay_id, g.user_id)).fetchone()

    if not row:
        return jsonify({"error": "not_found"}), 404

    return jsonify(json.loads(row["data"]))


@app.route("/api/replays", methods=["POST"])
@require_auth
def save_replay():
    """ذخیره رپلی جدید"""
    data = request.get_json() or {}
    replay_id = "r_" + secrets.token_urlsafe(8)

    db = get_db()
    db.execute("""
        INSERT INTO replays (replay_id, game_id, owner_id, data, created_at)
        VALUES (?, ?, ?, ?, ?)
    """, (
        replay_id,
        data.get("gameId", ""),
        g.user_id,
        json.dumps(data, ensure_ascii=False),
        now_ms(),
    ))
    db.commit()

    return jsonify({"ok": True, "replayId": replay_id})


# ═══════════════════════════════════════════════════════════
# اتاق‌های بازی (In-Memory)
# ═══════════════════════════════════════════════════════════

rooms = {}          # { room_code: Room }
user_rooms = {}     # { user_id/sid: room_code }


class GameRoom:
    """مدل یک اتاق بازی"""

    def __init__(self, code, host_id, host_name):
        self.code = code
        self.host_id = host_id
        self.players = {}       # { sid: {userId, name, avatar, ready, team, cards} }
        self.max_players = 4
        self.started = False
        self.hokm = None
        self.turn = None
        self.trick = []
        self.scores = {"A": 0, "B": 0}
        self.created_at = now_ms()
        self.last_activity = now_ms()

    def add_player(self, sid, user_id, name, avatar):
        """افزودن بازیکن"""
        if len(self.players) >= self.max_players:
            return False, "اتاق پر است"

        if self.started:
            return False, "بازی شروع شده"

        # چک تکراری
        for p in self.players.values():
            if p["userId"] == user_id:
                return False, "قبلاً وارد شدی"

        # تیم
        team = "A" if len(self.players) % 2 == 0 else "B"

        self.players[sid] = {
            "userId": user_id,
            "name": name,
            "avatar": avatar,
            "ready": False,
            "team": team,
            "cards": [],
        }
        self.last_activity = now_ms()
        return True, None

    def remove_player(self, sid):
        """حذف بازیکن"""
        if sid in self.players:
            del self.players[sid]
            self.last_activity = now_ms()
            return True
        return False

    def to_dict(self):
        """تبدیل به dict"""
        return {
            "code": self.code,
            "hostId": self.host_id,
            "players": [
                {
                    "sid": sid,
                    "userId": p["userId"],
                    "name": p["name"],
                    "avatar": p["avatar"],
                    "ready": p["ready"],
                    "team": p["team"],
                }
                for sid, p in self.players.items()
            ],
            "maxPlayers": self.max_players,
            "started": self.started,
            "hokm": self.hokm,
            "turn": self.turn,
            "scores": self.scores,
        }


def generate_room_code():
    """ساخت کد اتاق ۶ کاراکتری"""
    for _ in range(100):
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if code not in rooms:
            return code
    return None


def cleanup_rooms():
    """پاک‌سازی اتاق‌های قدیمی"""
    now = now_ms()
    to_delete = []

    for code, room in rooms.items():
        # اتاق خالی یا غیرفعال > ۳۰ دقیقه
        if not room.players or (now - room.last_activity) > 30 * 60 * 1000:
            to_delete.append(code)

    for code in to_delete:
        del rooms[code]
        print(f"🗑️ اتاق {code} حذف شد")

    return len(to_delete)


# ═══════════════════════════════════════════════════════════
# SocketIO Events
# ═══════════════════════════════════════════════════════════

def get_user_from_sid(sid):
    """پیدا کردن user_id از sid"""
    for code, room in rooms.items():
        if sid in room.players:
            return room.players[sid]["userId"], code
    return None, None


@socketio.on("connect")
def on_connect():
    """اتصال جدید"""
    print(f"🔌 اتصال: {request.sid}")
    emit("hello", {"sid": request.sid, "serverTime": now_ms()})


@socketio.on("disconnect")
def on_disconnect():
    """قطع اتصال"""
    sid = request.sid
    print(f"🔌 قطع: {sid}")

    # حذف از اتاق
    user_id, room_code = get_user_from_sid(sid)

    if room_code and room_code in rooms:
        room = rooms[room_code]
        room.remove_player(sid)

        # اطلاع به بقیه
        emit("room:playerLeft", {
            "sid": sid,
            "userId": user_id,
            "players": room.to_dict()["players"],
        }, room=room_code)

        # اگر خالی شد
        if not room.players:
            del rooms[room_code]
            print(f"🗑️ اتاق خالی {room_code} حذف شد")
        # اگر host رفت
        elif sid == room.host_id and room.players:
            # host جدید
            new_host_sid = next(iter(room.players))
            room.host_id = new_host_sid
            emit("room:newHost", {
                "hostSid": new_host_sid,
                "hostUserId": room.players[new_host_sid]["userId"],
            }, room=room_code)


@socketio.on("auth")
def on_auth(data):
    """احراز هویت socket"""
    token = data.get("token")
    if not token:
        return

    # بررسی در دیتابیس
    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = sqlite3.Row
    row = db.execute(
        "SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?",
        (token, now_ms())
    ).fetchone()
    db.close()

    if row:
        user_id = row["user_id"]
        join_room(f"user_{user_id}")

        # آپدیت is_online
        db = sqlite3.connect(str(DB_PATH))
        db.execute("UPDATE users SET is_online = 1, last_seen = ? WHERE user_id = ?",
                   (now_ms(), user_id))
        db.commit()
        db.close()

        emit("auth:ok", {"userId": user_id})
        print(f"✅ احراز هویت: {user_id}")


@socketio.on("room:create")
def on_room_create(data):
    """ساخت اتاق جدید"""
    user_id = data.get("userId", "guest_" + request.sid[:8])
    name = data.get("name", "مهمان")
    avatar = data.get("avatar", "😎")

    code = generate_room_code()
    if not code:
        emit("room:error", {"error": "خطا در ساخت اتاق"})
        return

    room = GameRoom(code, request.sid, user_id)
    room.add_player(request.sid, user_id, name, avatar)
    rooms[code] = room
    user_rooms[request.sid] = code

    join_room(code)

    emit("room:created", {"room": room.to_dict()})
    print(f"🏠 اتاق ساخته شد: {code} توسط {name}")


@socketio.on("room:join")
def on_room_join(data):
    """ورود به اتاق"""
    code = (data.get("code") or "").strip().upper()
    user_id = data.get("userId", "guest_" + request.sid[:8])
    name = data.get("name", "مهمان")
    avatar = data.get("avatar", "😎")

    if code not in rooms:
        emit("room:error", {"error": "اتاق پیدا نشد"})
        return

    room = rooms[code]
    ok, error = room.add_player(request.sid, user_id, name, avatar)

    if not ok:
        emit("room:error", {"error": error})
        return

    join_room(code)
    user_rooms[request.sid] = code

    emit("room:joined", {"room": room.to_dict()})
    emit("room:playerJoined", {
        "sid": request.sid,
        "userId": user_id,
        "name": name,
        "players": room.to_dict()["players"],
    }, room=code, include_self=False)

    print(f"👥 {name} وارد {code} شد")


@socketio.on("room:leave")
def on_room_leave():
    """خروج از اتاق"""
    sid = request.sid
    user_id, room_code = get_user_from_sid(sid)

    if not room_code or room_code not in rooms:
        return

    room = rooms[room_code]
    room.remove_player(sid)

    leave_room(room_code)
    if sid in user_rooms:
        del user_rooms[sid]

    emit("room:playerLeft", {
        "sid": sid,
        "userId": user_id,
        "players": room.to_dict()["players"],
    }, room=room_code)

    if not room.players:
        del rooms[room_code]
        print(f"🗑️ اتاق {room_code} خالی شد")


@socketio.on("room:ready")
def on_room_ready(data):
    """اعلام آمادگی"""
    sid = request.sid
    ready = bool(data.get("ready", True))
    user_id, room_code = get_user_from_sid(sid)

    if not room_code or room_code not in rooms:
        return

    room = rooms[room_code]
    if sid in room.players:
        room.players[sid]["ready"] = ready
        room.last_activity = now_ms()

    emit("room:update", {"room": room.to_dict()}, room=room_code)


@socketio.on("game:start")
def on_game_start():
    """شروع بازی (توسط host)"""
    sid = request.sid
    user_id, room_code = get_user_from_sid(sid)

    if not room_code or room_code not in rooms:
        return

    room = rooms[room_code]

    if room.host_id != sid:
        emit("game:error", {"error": "فقط host می‌تواند شروع کند"})
        return

    if len(room.players) < 2:
        emit("game:error", {"error": "حداقل ۲ بازیکن لازم است"})
        return

    # ─── توزیع کارت‌ها ───
    suits = ["spades", "hearts", "diamonds", "clubs"]
    ranks = list(range(2, 15))
    deck = [{"suit": s, "rank": r} for s in suits for r in ranks]
    random.shuffle(deck)

    count = len(room.players)
    hand_size = 52 // count

    player_sids = list(room.players.keys())

    for i, p_sid in enumerate(player_sids):
        hand = deck[i * hand_size:(i + 1) * hand_size]
        room.players[p_sid]["cards"] = hand

    room.started = True
    room.hokm = None

    # تعیین شروع‌کننده
    room.turn = random.randint(0, count - 1)
    room.last_activity = now_ms()

    # ارسال به هر بازیکن (کارت‌های خودش)
    for i, p_sid in enumerate(player_sids):
        emit("game:dealt", {
            "cards": room.players[p_sid]["cards"],
            "mySeat": i,
            "turnSeat": room.turn,
            "totalPlayers": count,
        }, room=p_sid)

    emit("game:started", {
        "room": room.to_dict(),
    }, room=room_code)

    print(f"🎮 بازی در {room_code} شروع شد ({count} بازیکن)")


@socketio.on("hokm:set")
def on_hokm_set(data):
    """تعیین حکم"""
    sid = request.sid
    suit = data.get("suit")
    user_id, room_code = get_user_from_sid(sid)

    if not room_code or room_code not in rooms:
        return

    room = rooms[room_code]

    if suit not in ["spades", "hearts", "diamonds", "clubs"]:
        return

    room.hokm = suit
    room.last_activity = now_ms()

    emit("hokm:chosen", {
        "suit": suit,
        "byUserId": user_id,
    }, room=room_code)

    print(f"👑 حکم {room_code}: {suit}")


@socketio.on("card:play")
def on_card_play(data):
    """بازی یک کارت"""
    sid = request.sid
    card = data.get("card")
    user_id, room_code = get_user_from_sid(sid)

    if not room_code or room_code not in rooms:
        return

    room = rooms[room_code]

    if not room.started:
        return

    # چک نوبت
    player_sids = list(room.players.keys())
    current_sid = player_sids[room.turn]

    if sid != current_sid:
        emit("game:error", {"error": "نوبت تو نیست"})
        return

    # چک کارت در دست
    player = room.players[sid]
    card_in_hand = next(
        (c for c in player["cards"] if c["suit"] == card["suit"] and c["rank"] == card["rank"]),
        None
    )

    if not card_in_hand:
        emit("game:error", {"error": "این کارت را نداری"})
        return

    # حذف از دست
    player["cards"].remove(card_in_hand)

    # اضافه به trick
    room.trick.append({
        "userId": user_id,
        "sid": sid,
        "card": card_in_hand,
    })

    # پخش به همه
    emit("card:played", {
        "userId": user_id,
        "card": card_in_hand,
        "seat": room.turn,
        "trick": room.trick,
        "remainingCards": len(player["cards"]),
    }, room=room_code)

    # چک پایان دور
    if len(room.trick) >= len(player_sids):
        # تعیین برنده
        winner_trick = determine_trick_winner(room.trick, room.hokm)
        winner_sid = winner_trick["sid"]
        winner_team = room.players[winner_sid]["team"]

        # امتیاز
        room.scores[winner_team] += 1

        emit("trick:won", {
            "winnerUserId": winner_trick["userId"],
            "winnerSid": winner_sid,
            "winnerTeam": winner_team,
            "scores": room.scores,
            "trick": room.trick,
        }, room=room_code)

        # شروع دور جدید
        room.trick = []
        room.turn = player_sids.index(winner_sid)

        # چک پایان بازی
        if room.scores["A"] >= 7 or room.scores["B"] >= 7:
            room.started = False

            emit("game:ended", {
                "scores": room.scores,
                "winnerTeam": "A" if room.scores["A"] >= 7 else "B",
            }, room=room_code)

            print(f"🏆 بازی {room_code} تمام شد: {room.scores}")
        else:
            emit("trick:new", {
                "turnSeat": room.turn,
                "scores": room.scores,
            }, room=room_code)
    else:
        # نوبت بعدی
        room.turn = (room.turn + 1) % len(player_sids)

        emit("turn:changed", {
            "turnSeat": room.turn,
            "userId": player_sids[room.turn],
        }, room=room_code)

    room.last_activity = now_ms()


def determine_trick_winner(trick, hokm):
    """تعیین برنده دور"""
    if not trick:
        return None

    lead_suit = trick[0]["card"]["suit"]
    winner = trick[0]

    for entry in trick[1:]:
        c = entry["card"]
        w = winner["card"]

        c_is_hokm = c["suit"] == hokm
        w_is_hokm = w["suit"] == hokm

        if c_is_hokm and not w_is_hokm:
            winner = entry
            continue

        if c_is_hokm == w_is_hokm:
            if c["suit"] == w["suit"] and c["rank"] > w["rank"]:
                winner = entry
            elif c["suit"] == lead_suit and w["suit"] != lead_suit:
                winner = entry

    return winner


@socketio.on("chat:send")
def on_chat_send(data):
    """ارسال پیام در اتاق"""
    text = (data.get("text") or "").strip()[:200]
    if not text:
        return

    sid = request.sid
    user_id, room_code = get_user_from_sid(sid)

    if not room_code:
        return

    name = rooms[room_code].players[sid]["name"]

    emit("chat:message", {
        "userId": user_id,
        "name": name,
        "text": text,
        "timestamp": now_ms(),
    }, room=room_code)


# ═══════════════════════════════════════════════════════════
# Static Serving
# ═══════════════════════════════════════════════════════════

@app.route("/")
def index():
    """صفحه اصلی"""
    return send_from_directory(str(STATIC_DIR), "index.html")


@app.route("/<path:path>")
def static_files(path):
    """فایل‌های استاتیک"""
    full_path = STATIC_DIR / path

    if full_path.exists() and full_path.is_file():
        return send_from_directory(str(STATIC_DIR), path)

    # 404
    return send_from_directory(str(STATIC_DIR), "404.html"), 404


# ═══════════════════════════════════════════════════════════
# Error Handlers
# ═══════════════════════════════════════════════════════════

@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/api/"):
        return jsonify({"error": "not_found"}), 404
    try:
        return send_from_directory(str(STATIC_DIR), "404.html"), 404
    except Exception:
        return "404 Not Found", 404


@app.errorhandler(500)
def server_error(e):
    print(f"❌ خطای سرور: {e}")
    return jsonify({"error": "internal_error"}), 500


# ═══════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════

def print_banner(host, port):
    """نمایش بنر"""
    print()
    print("═" * 60)
    print("  🃏 HOKM PRO v6.0 — سرور")
    print("═" * 60)
    print(f"  🌐 http://{host}:{port}")
    print(f"  📁 دیتابیس: {DB_PATH.name}")
    print(f"  🎮 SocketIO: فعال")
    print("═" * 60)
    print("  Ctrl+C برای خروج")
    print("═" * 60)
    print()


def main():
    """اجرای سرور"""
    import argparse

    parser = argparse.ArgumentParser(description="Hokm Pro Server")
    parser.add_argument("--host", default="0.0.0.0", help="آدرس (پیش‌فرض: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8080, help="پورت (پیش‌فرض: 8080)")
    parser.add_argument("--debug", action="store_true", help="حالت دیباگ")
    args = parser.parse_args()

    # ساخت دیتابیس
    init_db()

    # پاک‌سازی دوره‌ای اتاق‌ها
    import threading

    def periodic_cleanup():
        while True:
            time.sleep(5 * 60)
            try:
                cleaned = cleanup_rooms()
                if cleaned > 0:
                    print(f"🧹 {cleaned} اتاق قدیمی پاک شد")
            except Exception as e:
                print(f"⚠️ خطا در cleanup: {e}")

    cleanup_thread = threading.Thread(target=periodic_cleanup, daemon=True)
    cleanup_thread.start()

    # نمایش بنر
    print_banner(args.host, args.port)

    # اجرا
    socketio.run(
        app,
        host=args.host,
        port=args.port,
        debug=args.debug,
        use_reloader=args.debug,
        allow_unsafe_werkzeug=True,
    )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 سرور متوقف شد")
        sys.exit(0)