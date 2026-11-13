#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════
   🃏 HOKM PRO v6.2.0 — server.py
   سرور اصلی بازی آنلاین (مدیریت اتاق‌ها و بازیکنان)
═══════════════════════════════════════════════════════════════
"""

import os
import sys
import time
import secrets
import random
import string
from pathlib import Path

try:
    from flask import Flask, request, jsonify, send_from_directory
    from flask_cors import CORS
    from flask_socketio import SocketIO, emit, join_room, leave_room
except ImportError as e:
    print(f"\n❌ وابستگی گمشده: {e.name}")
    print("   اجرا کن: pip install -r requirements.txt\n")
    sys.exit(1)

BASE_DIR = Path(__file__).resolve().parent

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
app.config["SECRET_KEY"] = os.environ.get("HOKM_SECRET", secrets.token_hex(32))
CORS(app, supports_credentials=True)

# تنظیمات Socket.io
socketio = SocketIO(
    app, 
    cors_allowed_origins="*", 
    async_mode="threading",
    ping_timeout=60,
    ping_interval=25
)

# ═══════════════════════════════════════════════════════════
# دیکشنری اتاق‌ها (In-Memory)
# ═══════════════════════════════════════════════════════════
rooms = {}

def now_ms():
    return int(time.time() * 1000)

def generate_room_code():
    """ساخت کد ۶ رقمی یکتا برای اتاق"""
    for _ in range(100):
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if code not in rooms:
            return code
    return "ERROR"

# ═══════════════════════════════════════════════════════════
# کلاس مدیریت اتاق بازی
# ═══════════════════════════════════════════════════════════
class GameRoom:
    def __init__(self, code, host_sid, host_data):
        self.code = code
        self.host_sid = host_sid
        self.players = {}  # { sid: {userId, name, avatar, seat} }
        self.max_players = 4
        self.game_started = False
        self.created_at = now_ms()
        self.add_player(host_sid, host_data)

    def add_player(self, sid, data):
        """افزودن بازیکن به اتاق"""
        if len(self.players) >= self.max_players:
            return False, "اتاق پر است"
        if self.game_started:
            return False, "بازی شروع شده"
        
        # چک تکراری بودن userId
        for p in self.players.values():
            if p["userId"] == data.get("userId"):
                return False, "قبلاً وارد شدی"
        
        seat = len(self.players)
        self.players[sid] = {
            "userId": data.get("userId"),
            "name": data.get("name", "مهمان"),
            "avatar": data.get("avatar", "👤"),
            "seat": seat,
            "ready": False
        }
        return True, None

    def remove_player(self, sid):
        """حذف بازیکن از اتاق"""
        if sid in self.players:
            del self.players[sid]
            # اگه میزبان رفت، میزبان جدید
            if sid == self.host_sid and self.players:
                self.host_sid = list(self.players.keys())[0]
            return True
        return False

    def to_dict(self):
        """تبدیل به دیکشنری برای ارسال به کلاینت"""
        return {
            "code": self.code,
            "hostId": self.host_sid,
            "players": [
                {
                    "sid": sid,
                    "userId": p["userId"],
                    "name": p["name"],
                    "avatar": p["avatar"],
                    "seat": p["seat"]
                } for sid, p in self.players.items()
            ],
            "maxPlayers": self.max_players,
            "gameStarted": self.game_started
        }

# ═══════════════════════════════════════════════════════════
# Socket.io — اتصال و قطع اتصال
# ═══════════════════════════════════════════════════════════

@socketio.on("connect")
def on_connect():
    print(f"🔌 Connected: {request.sid}")

@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    print(f"🔌 Disconnected: {sid}")
    
    # پیدا کردن اتاقی که این بازیکن توشه
    for code, room in list(rooms.items()):
        if sid in room.players:
            player_name = room.players[sid]["name"]
            room.remove_player(sid)
            
            # اگه اتاق خالی شد → حذف
            if not room.players:
                del rooms[code]
                print(f"🗑️ اتاق {code} حذف شد")
            else:
                # اطلاع به بقیه
                emit("room:update", {"room": room.to_dict()}, room=code)
                emit("room:playerLeft", {"name": player_name}, room=code)
            break

# ═══════════════════════════════════════════════════════════
# Socket.io — مدیریت اتاق‌ها
# ═══════════════════════════════════════════════════════════

@socketio.on("room:create")
def on_room_create(data):
    """ساخت اتاق جدید"""
    sid = request.sid
    code = generate_room_code()
    
    if code == "ERROR":
        emit("room:error", {"error": "خطا در ساخت اتاق"})
        return
    
    room = GameRoom(code, sid, data)
    rooms[code] = room
    join_room(code)
    
    emit("room:created", {"room": room.to_dict()})
    print(f"🏠 اتاق {code} توسط {data.get('name')} ساخته شد")

@socketio.on("room:join")
def on_room_join(data):
    """ورود به اتاق"""
    sid = request.sid
    code = data.get("code", "").upper()
    
    if code not in rooms:
        emit("room:error", {"error": "اتاق پیدا نشد"})
        return
    
    room = rooms[code]
    success, error = room.add_player(sid, data)
    
    if not success:
        emit("room:error", {"error": error})
        return
    
    join_room(code)
    
    # به خود بازیکن
    emit("room:joined", {"room": room.to_dict()})
    
    # به همه (شامل میزبان)
    emit("room:update", {"room": room.to_dict()}, room=code)
    emit("room:playerJoined", {"name": data.get("name")}, room=code)
    
    print(f"👥 {data.get('name')} وارد اتاق {code} شد ({len(room.players)}/{room.max_players})")

@socketio.on("room:leave")
def on_room_leave():
    """خروج از اتاق"""
    sid = request.sid
    for code, room in list(rooms.items()):
        if sid in room.players:
            player_name = room.players[sid]["name"]
            room.remove_player(sid)
            leave_room(code)
            
            if not room.players:
                del rooms[code]
                print(f"🗑️ اتاق {code} حذف شد")
            else:
                emit("room:update", {"room": room.to_dict()}, room=code)
                emit("room:playerLeft", {"name": player_name}, room=code)
            break

@socketio.on("room:start")
def on_room_start():
    """شروع بازی توسط میزبان"""
    sid = request.sid
    for code, room in list(rooms.items()):
        if room.host_sid == sid and not room.game_started:
            if len(room.players) < 2:
                emit("game:error", {"error": "حداقل ۲ بازیکن لازم است"})
                return
            
            room.game_started = True
            emit("game:started", {"room": room.to_dict()}, room=code)
            print(f"🎮 بازی در اتاق {code} شروع شد")
            return
    emit("game:error", {"error": "فقط میزبان می‌تواند شروع کند"})

# ═══════════════════════════════════════════════════════════
# Socket.io — چت در اتاق
# ═══════════════════════════════════════════════════════════

@socketio.on("room:chat")
def on_room_chat(data):
    """ارسال پیام در اتاق"""
    sid = request.sid
    text = data.get("text", "").strip()[:200]
    if not text:
        return
    
    for code, room in rooms.items():
        if sid in room.players:
            emit("room:chat_message", {
                "name": room.players[sid]["name"],
                "text": text,
                "timestamp": now_ms()
            }, room=code)
            break

# ═══════════════════════════════════════════════════════════
# Static Serving
# ═══════════════════════════════════════════════════════════

@app.route("/")
def index():
    return send_from_directory(str(BASE_DIR), "index.html")

@app.route("/api/health")
def health():
    """برای UptimeRobot که سرور بیدار بمونه"""
    return jsonify({"ok": True, "rooms": len(rooms), "time": now_ms()})

@app.route("/<path:path>")
def static_files(path):
    full_path = BASE_DIR / path
    if full_path.exists() and full_path.is_file():
        return send_from_directory(str(BASE_DIR), path)
    return send_from_directory(str(BASE_DIR), "404.html"), 404

# ═══════════════════════════════════════════════════════════
# اجرا
# ═══════════════════════════════════════════════════════════
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()
    
    print("🚀 سرور آنلاین Hokm Pro اجرا شد")
    print(f"   → http://{args.host}:{args.port}")
    socketio.run(app, host=args.host, port=args.port, debug=args.debug, allow_unsafe_werkzeug=True)