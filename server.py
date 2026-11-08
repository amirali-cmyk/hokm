#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════
   🃏 HOKM PRO v6.1.1 — server.py
   سرور Flask + SocketIO + SQLite برای بازی آنلاین
═══════════════════════════════════════════════════════════════
"""

# 🎯 مهم: eventlet باید قبل از هر چیز دیگه‌ای monkey_patch بشه
import eventlet
eventlet.monkey_patch()

import os
import sys
import json
import time
import sqlite3
import secrets
import random
import string
from datetime import timedelta
from functools import wraps
from pathlib import Path

# ─── وابستگی‌ها ───
try:
    from flask import Flask, request, jsonify, send_from_directory, g
    from flask_cors import CORS
    from flask_socketio import SocketIO, emit, join_room, leave_room
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
app.config["SESSION_COOKIE_SAMESITE"] = "None"
app.config["SESSION_COOKIE_SECURE"] = True
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)

CORS(app, supports_credentials=True, origins="*")

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="eventlet",
    ping_timeout=60,
    ping_interval=25,
    logger=False,
    engineio_logger=False,
)

# ═══════════════════════════════════════════════════════════
# دیتابیس SQLite
# ═══════════════════════════════════════════════════════════

def get_db():
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
    try:
        db = sqlite3.connect(str(DB_PATH))
        db.row_factory = sqlite3.Row
        cursor = db.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     TEXT UNIQUE NOT NULL,
                name        TEXT NOT NULL,
                email       TEXT UNIQUE NOT NULL,
                password    TEXT NOT NULL,
                avatar      TEXT DEFAULT '🌱',
                elo         INTEGER DEFAULT 1000,
                coins       INTEGER DEFAULT 500,
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

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token       TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                created_at  INTEGER NOT NULL,
                expires_at  INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        """)

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

        db.commit()
        db.close()
        print("✅ دیتابیس آماده است")
    except Exception as e:
        print(f"❌ خطا در ساخت دیتابیس: {e}")

# ═══════════════════════════════════════════════════════════
# API: احراز هویت
# ═══════════════════════════════════════════════════════════

@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or len(name) < 2: return jsonify({"error": "نام حداقل ۲ کاراکتر"}), 400
    if not email or "@" not in email: return jsonify({"error": "ایمیل نامعتبر"}), 400
    if not password or len(password) < 6: return jsonify({"error": "رمز حداقل ۶ کاراکتر"}), 400

    db = get_db()
    if db.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        return jsonify({"error": "این ایمیل قبلاً ثبت شده"}), 409

    user_id = "u_" + secrets.token_urlsafe(9)
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    ts = int(time.time() * 1000)

    try:
        db.execute("""
            INSERT INTO users (user_id, name, email, password, created_at, last_seen)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, name[:20], email, hashed, ts, ts))
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "خطا در ثبت‌نام"}), 500

    token = secrets.token_urlsafe(32)
    expires = ts + (30 * 24 * 60 * 60 * 1000)
    db.execute("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", (token, user_id, ts, expires))
    db.commit()

    user = db.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)).fetchone()
    return jsonify({"ok": True, "token": token, "user": dict(user)})

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    if not user or not bcrypt.checkpw(password.encode("utf-8"), user["password"].encode("utf-8")):
        return jsonify({"error": "ایمیل یا رمز اشتباه"}), 401

    ts = int(time.time() * 1000)
    token = secrets.token_urlsafe(32)
    expires = ts + (30 * 24 * 60 * 60 * 1000)
    db.execute("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", (token, user["user_id"], ts, expires))
    db.commit()

    return jsonify({"ok": True, "token": token, "user": dict(user)})

@app.route("/api/leaderboard", methods=["GET"])
def leaderboard():
    filter_type = request.args.get("filter", "all")
    limit = min(int(request.args.get("limit", 100)), 100)
    db = get_db()
    rows = db.execute("SELECT * FROM users WHERE games > 0 ORDER BY elo DESC LIMIT ?", (limit,)).fetchall()
    entries = []
    for i, row in enumerate(rows):
        e = dict(row)
        e["rank"] = i + 1
        entries.append(e)
    return jsonify({"entries": entries, "filter": filter_type})

# ═══════════════════════════════════════════════════════════
# اتاق‌های بازی (In-Memory)
# ═══════════════════════════════════════════════════════════

rooms = {}
user_rooms = {}

class GameRoom:
    def __init__(self, code, host_id, host_name):
        self.code = code
        self.host_id = host_id
        self.players = {}
        self.max_players = 4
        self.started = False
        self.hokm = None
        self.turn = None
        self.trick = []
        self.scores = {"A": 0, "B": 0}
        self.created_at = int(time.time() * 1000)
        self.last_activity = int(time.time() * 1000)

    def add_player(self, sid, user_id, name, avatar):
        if len(self.players) >= self.max_players: return False, "اتاق پر است"
        if self.started: return False, "بازی شروع شده"
        for p in self.players.values():
            if p["userId"] == user_id: return False, "قبلاً وارد شدی"
        team = "A" if len(self.players) % 2 == 0 else "B"
        self.players[sid] = {"userId": user_id, "name": name, "avatar": avatar, "ready": False, "team": team, "cards": []}
        self.last_activity = int(time.time() * 1000)
        return True, None

    def remove_player(self, sid):
        if sid in self.players:
            del self.players[sid]
            self.last_activity = int(time.time() * 1000)
            return True
        return False

    def to_dict(self):
        return {
            "code": self.code,
            "hostId": self.host_id,
            "players": [{"sid": sid, "userId": p["userId"], "name": p["name"], "avatar": p["avatar"], "ready": p["ready"], "team": p["team"]} for sid, p in self.players.items()],
            "maxPlayers": self.max_players,
            "started": self.started,
            "hokm": self.hokm,
            "turn": self.turn,
            "scores": self.scores,
        }

def generate_room_code():
    for _ in range(100):
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if code not in rooms: return code
    return None

# ═══════════════════════════════════════════════════════════
# SocketIO Events
# ═══════════════════════════════════════════════════════════

def get_user_from_sid(sid):
    for code, room in rooms.items():
        if sid in room.players:
            return room.players[sid]["userId"], code
    return None, None

@socketio.on("connect")
def on_connect():
    print(f"🔌 اتصال جدید: {request.sid}")
    emit("hello", {"sid": request.sid, "serverTime": int(time.time() * 1000)})

@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    print(f"🔌 قطع: {sid}")
    user_id, room_code = get_user_from_sid(sid)
    if room_code and room_code in rooms:
        room = rooms[room_code]
        room.remove_player(sid)
        emit("room:playerLeft", {"sid": sid, "userId": user_id, "players": room.to_dict()["players"]}, room=room_code)
        if not room.players:
            del rooms[room_code]
            print(f"🗑️ اتاق خالی {room_code} حذف شد")
        elif sid == room.host_id and room.players:
            new_host_sid = next(iter(room.players))
            room.host_id = new_host_sid
            emit("room:newHost", {"hostSid": new_host_sid, "hostUserId": room.players[new_host_sid]["userId"]}, room=room_code)

@socketio.on("room:create")
def on_room_create(data):
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
    emit("room:playerJoined", {"sid": request.sid, "userId": user_id, "name": name, "players": room.to_dict()["players"]}, room=code, include_self=False)
    print(f"👥 {name} وارد {code} شد")

@socketio.on("room:leave")
def on_room_leave():
    sid = request.sid
    user_id, room_code = get_user_from_sid(sid)
    if not room_code or room_code not in rooms: return
    room = rooms[room_code]
    room.remove_player(sid)
    leave_room(room_code)
    if sid in user_rooms: del user_rooms[sid]
    emit("room:playerLeft", {"sid": sid, "userId": user_id, "players": room.to_dict()["players"]}, room=room_code)
    if not room.players:
        del rooms[room_code]

@socketio.on("room:ready")
def on_room_ready(data):
    sid = request.sid
    ready = bool(data.get("ready", True))
    user_id, room_code = get_user_from_sid(sid)
    if not room_code or room_code not in rooms: return
    room = rooms[room_code]
    if sid in room.players:
        room.players[sid]["ready"] = ready
        room.last_activity = int(time.time() * 1000)
    emit("room:update", {"room": room.to_dict()}, room=room_code)

@socketio.on("game:start")
def on_game_start():
    sid = request.sid
    user_id, room_code = get_user_from_sid(sid)
    if not room_code or room_code not in rooms: return
    room = rooms[room_code]

    if room.host_id != sid:
        emit("game:error", {"error": "فقط host می‌تواند شروع کند"})
        return
    if len(room.players) < 2:
        emit("game:error", {"error": "حداقل ۲ بازیکن لازم است"})
        return

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
    room.turn = random.randint(0, count - 1)
    room.last_activity = int(time.time() * 1000)

    for i, p_sid in enumerate(player_sids):
        emit("game:dealt", {"cards": room.players[p_sid]["cards"], "mySeat": i, "turnSeat": room.turn, "totalPlayers": count}, room=p_sid)

    emit("game:started", {"room": room.to_dict()}, room=room_code)
    print(f"🎮 بازی در {room_code} شروع شد ({count} بازیکن)")

@socketio.on("hokm:set")
def on_hokm_set(data):
    sid = request.sid
    suit = data.get("suit")
    user_id, room_code = get_user_from_sid(sid)
    if not room_code or room_code not in rooms: return
    room = rooms[room_code]
    if suit not in ["spades", "hearts", "diamonds", "clubs"]: return
    room.hokm = suit
    room.last_activity = int(time.time() * 1000)
    emit("hokm:chosen", {"suit": suit, "byUserId": user_id}, room=room_code)
    print(f"👑 حکم {room_code}: {suit}")

@socketio.on("card:play")
def on_card_play(data):
    sid = request.sid
    card = data.get("card")
    user_id, room_code = get_user_from_sid(sid)
    if not room_code or room_code not in rooms: return
    room = rooms[room_code]
    if not room.started: return

    player_sids = list(room.players.keys())
    current_sid = player_sids[room.turn]

    if sid != current_sid:
        emit("game:error", {"error": "نوبت تو نیست"})
        return

    player = room.players[sid]
    card_in_hand = next((c for c in player["cards"] if c["suit"] == card["suit"] and c["rank"] == card["rank"]), None)
    if not card_in_hand:
        emit("game:error", {"error": "این کارت را نداری"})
        return

    player["cards"].remove(card_in_hand)
    room.trick.append({"userId": user_id, "sid": sid, "card": card_in_hand})

    emit("card:played", {"userId": user_id, "card": card_in_hand, "seat": room.turn, "trick": room.trick, "remainingCards": len(player["cards"])}, room=room_code)

    if len(room.trick) >= len(player_sids):
        winner_trick = determine_trick_winner(room.trick, room.hokm)
        winner_sid = winner_trick["sid"]
        winner_team = room.players[winner_sid]["team"]
        room.scores[winner_team] += 1

        emit("trick:won", {"winnerUserId": winner_trick["userId"], "winnerSid": winner_sid, "winnerTeam": winner_team, "scores": room.scores, "trick": room.trick}, room=room_code)

        room.trick = []
        room.turn = player_sids.index(winner_sid)

        if room.scores["A"] >= 7 or room.scores["B"] >= 7:
            room.started = False
            emit("game:ended", {"scores": room.scores, "winnerTeam": "A" if room.scores["A"] >= 7 else "B"}, room=room_code)
        else:
            emit("trick:new", {"turnSeat": room.turn, "scores": room.scores}, room=room_code)
    else:
        room.turn = (room.turn + 1) % len(player_sids)
        emit("turn:changed", {"turnSeat": room.turn, "userId": player_sids[room.turn]}, room=room_code)

    room.last_activity = int(time.time() * 1000)

def determine_trick_winner(trick, hokm):
    if not trick: return None
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
    text = (data.get("text") or "").strip()[:200]
    if not text: return
    sid = request.sid
    user_id, room_code = get_user_from_sid(sid)
    if not room_code: return
    name = rooms[room_code].players[sid]["name"]
    emit("chat:message", {"userId": user_id, "name": name, "text": text, "timestamp": int(time.time() * 1000)}, room=room_code)

# ═══════════════════════════════════════════════════════════
# Static Serving
# ═══════════════════════════════════════════════════════════

@app.route("/")
def index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return send_from_directory(str(STATIC_DIR), "index.html")
    return jsonify({"status": "ok", "message": "Hokm Pro Server is running!"})

@app.route("/<path:path>")
def static_files(path):
    full_path = STATIC_DIR / path
    if full_path.exists() and full_path.is_file():
        return send_from_directory(str(STATIC_DIR), path)
    not_found_path = STATIC_DIR / "404.html"
    if not_found_path.exists():
        return send_from_directory(str(STATIC_DIR), "404.html"), 404
    return "404 Not Found", 404

@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/api/") or request.path.startswith("/socket.io/"):
        return jsonify({"error": "not_found"}), 404
    not_found_path = STATIC_DIR / "404.html"
    if not_found_path.exists():
        return send_from_directory(str(STATIC_DIR), "404.html"), 404
    return "404 Not Found", 404

# ═══════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════

init_db()
port = int(os.environ.get("PORT", 8080))

if __name__ == "__main__":
    print(f"🚀 سرور روی پورت {port} استارت شد")
    socketio.run(app, host="0.0.0.0", port=port, allow_unsafe_werkzeug=True)
else:
    print(f"🚀 سرور توسط gunicorn روی پورت {port} استارت شد")