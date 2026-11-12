#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════
   🃏 HOKM PRO v6.2.0 — server.py (اتاق‌های آنلاین)
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
    sys.exit(1)

BASE_DIR = Path(__file__).resolve().parent
app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
CORS(app, supports_credentials=True)

# تنظیمات Socket.io
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# دیکشنری برای ذخیره اتاق‌ها در حافظه (In-Memory)
rooms = {}

def now_ms():
    return int(time.time() * 1000)

def generate_room_code():
    """ساخت کد ۶ رقمی تصادفی برای اتاق"""
    while True:
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if code not in rooms:
            return code

class GameRoom:
    def __init__(self, code, host_sid, host_data):
        self.code = code
        self.host_sid = host_sid
        self.players = {} # { sid: {userId, name, avatar, ready} }
        self.max_players = 4
        self.game_started = False
        self.add_player(host_sid, host_data)

    def add_player(self, sid, data):
        if len(self.players) >= self.max_players:
            return False
        self.players[sid] = {
            "userId": data.get("userId"),
            "name": data.get("name", "مهمان"),
            "avatar": data.get("avatar", "👤"),
            "ready": False
        }
        return True

    def remove_player(self, sid):
        if sid in self.players:
            del self.players[sid]
            # اگه میزبان رفت، میزبان جدید انتخاب کن
            if sid == self.host_sid and self.players:
                self.host_sid = list(self.players.keys())[0]

    def to_dict(self):
        return {
            "code": self.code,
            "hostId": self.host_sid,
            "players": [
                {"sid": sid, **data} for sid, data in self.players.items()
            ],
            "maxPlayers": self.max_players,
            "gameStarted": self.game_started
        }

# ═══════════════════════════════════════════════════════════
# SocketIO Events (مدیریت اتاق‌ها)
# ═══════════════════════════════════════════════════════════

@socketio.on("connect")
def on_connect():
    print(f"🔌 Connected: {request.sid}")

@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    for code, room in list(rooms.items()):
        if sid in room.players:
            room.remove_player(sid)
            if not room.players:
                # اتاق خالی شد، حذفش کن
                del rooms[code]
            else:
                # به بقیه اطلاع بده
                emit("room:update", {"room": room.to_dict()}, room=code)
                emit("room:playerLeft", {"sid": sid}, room=code)
            break

@socketio.on("room:create")
def on_room_create(data):
    sid = request.sid
    code = generate_room_code()
    
    room = GameRoom(code, sid, data)
    rooms[code] = room
    join_room(code)
    
    emit("room:created", {"room": room.to_dict()})
    print(f"🏠 اتاق {code} توسط {data.get('name')} ساخته شد")

@socketio.on("room:join")
def on_room_join(data):
    sid = request.sid
    code = data.get("code", "").upper()

    if code not in rooms:
        emit("room:error", {"error": "اتاق پیدا نشد"})
        return

    room = rooms[code]
    
    if room.game_started:
        emit("room:error", {"error": "بازی این اتاق شروع شده است"})
        return

    if room.add_player(sid, data):
        join_room(code)
        
        # به خود بازیکن
        emit("room:joined", {"room": room.to_dict()})
        
        # به همه (از جمله میزبان) بگو بازیکن جدید اومد
        emit("room:update", {"room": room.to_dict()}, room=code)
        emit("room:playerJoined", {"name": data.get("name")}, room=code)
        print(f"👥 {data.get('name')} وارد اتاق {code} شد")
    else:
        emit("room:error", {"error": "اتاق پر است"})

@socketio.on("room:start")
def on_room_start():
    sid = request.sid
    # پیدا کردن اتاقی که این کاربر میزبانشه
    for code, room in rooms.items():
        if room.host_sid == sid and not room.game_started:
            room.game_started = True
            emit("game:started", {"room": room.to_dict()}, room=code)
            print(f"🎮 بازی در اتاق {code} شروع شد")
            break

# ═══════════════════════════════════════════════════════════
# Static Serving
# ═══════════════════════════════════════════════════════════

@app.route("/")
def index():
    return send_from_directory(str(BASE_DIR), "index.html")

@app.route("/<path:path>")
def static_files(path):
    full_path = BASE_DIR / path
    if full_path.exists() and full_path.is_file():
        return send_from_directory(str(BASE_DIR), path)
    return send_from_directory(str(BASE_DIR), "404.html"), 404

if __name__ == "__main__":
    print("🚀 سرور آنلاین Hokm Pro روی پورت 8080 اجرا شد")
    socketio.run(app, host="0.0.0.0", port=8080, debug=True)