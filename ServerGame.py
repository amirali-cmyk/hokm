#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════
   🃏 HOKM PRO v6.2.0 — ServerGame.py
   سرور اختصاصی بازی آنلاین (مدیریت اتاق، توزیع کارت، نوبت‌ها)
═══════════════════════════════════════════════════════════════
"""

import eventlet
eventlet.monkey_patch()

import os
import sys
import time
import random
import string
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room

app = Flask(__name__)
app.config["SECRET_KEY"] = "hokm_game_secret"
CORS(app, supports_all_origins=True)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# دیکشنری برای نگهداری اتاق‌ها در حافظه سرور
rooms = {}

class GameRoom:
    def __init__(self, code, host_sid):
        self.code = code
        self.host_sid = host_sid
        self.players = {} # { sid: { userId, name, avatar, cards, seat } }
        self.status = "waiting" # waiting, playing, finished
        self.turn = None
        self.trick = []
        self.hokm = None
        self.scores = {"A": 0, "B": 0}
        self.max_players = 4

def generate_room_code():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

def get_room_by_sid(sid):
    for room_code, room in rooms.items():
        if sid in room.players:
            return room
    return None

@socketio.on("connect")
def on_connect():
    print(f"Connected: {request.sid}")

@socketio.on("disconnect")
def on_disconnect():
    room = get_room_by_sid(request.sid)
    if room:
        del room.players[request.sid]
        emit("room:playerLeft", {"sid": request.sid, "players": list(room.players.values())}, room=room.code)
        
        # اگر اتاق خالی شد، حذفش کن
        if not room.players:
            del rooms[room.code]
            print(f"Room {room.code} deleted (empty)")
        else:
            # اگر میزبان رفت، میزبان جدید انتخاب کن
            if request.sid == room.host_sid:
                new_host = list(room.players.keys())[0]
                room.host_sid = new_host
                emit("room:update", {"room": room.__dict__}, room=room.code)

@socketio.on("room:create")
def on_room_create(data):
    code = generate_room_code()
    room = GameRoom(code, request.sid)
    rooms[code] = room
    
    room.players[request.sid] = {
        "userId": data.get("userId"),
        "name": data.get("name"),
        "avatar": data.get("avatar"),
        "cards": [],
        "seat": 0,
        "ready": False
    }
    
    join_room(code)
    emit("room:created", {"roomCode": code, "players": list(room.players.values()), "hostSid": room.host_sid})
    print(f"Room created: {code} by {data.get('name')}")

@socketio.on("room:join")
def on_room_join(data):
    code = data.get("code")
    room = rooms.get(code)
    
    if not room:
        emit("room:error", {"error": "اتاق پیدا نشد"})
        return
    
    if len(room.players) >= room.max_players:
        emit("room:error", {"error": "اتاق پر است"})
        return
        
    seat_idx = len(room.players)
    room.players[request.sid] = {
        "userId": data.get("userId"),
        "name": data.get("name"),
        "avatar": data.get("avatar"),
        "cards": [],
        "seat": seat_idx,
        "ready": False
    }
    
    join_room(code)
    
    # به همه اطلاع بده که بازیکن جدید اومده
    emit("room:playerJoined", {
        "sid": request.sid,
        "name": data.get("name"),
        "players": list(room.players.values()),
        "hostSid": room.host_sid
    }, room=code)

@socketio.on("game:start")
def on_game_start():
    room = get_room_by_sid(request.sid)
    if not room or request.sid != room.host_sid:
        emit("game:error", {"error": "فقط میزبان می‌تواند بازی را شروع کند"})
        return
        
    if len(room.players) < 2:
        emit("game:error", {"error": "حداقل به ۲ بازیکن نیاز است"})
        return
        
    # توزیع کارت
    suits = ['spades', 'hearts', 'diamonds', 'clubs']
    ranks = list(range(2, 15))
    deck = [{"suit": s, "rank": r} for s in suits for r in ranks]
    random.shuffle(deck)
    
    player_sids = list(room.players.keys())
    for i, sid in enumerate(player_sids):
        room.players[sid]["cards"] = deck[i*13 : (i+1)*13]
        room.players[sid]["seat"] = i

    room.status = "playing"
    room.turn = 0 # نفر اول شروع می‌کند
    
    # ارسال کارت‌های هر بازیکن به صورت مخفیانه به خودش
    for i, sid in enumerate(player_sids):
        emit("game:dealt", {
            "cards": room.players[sid]["cards"],
            "seat": i,
            "turnSeat": room.turn
        }, room=sid)
        
    # به همه بگو بازی شروع شد
    emit("game:started", {
        "turnSeat": room.turn, 
        "playerCount": len(player_sids),
        "scores": room.scores
    }, room=room.code)

@socketio.on("game:play_card")
def on_play_card(data):
    room = get_room_by_sid(request.sid)
    if not room or room.status != "playing":
        return
        
    player_sids = list(room.players.keys())
    
    # بررسی نوبت
    if player_sids[room.turn] != request.sid:
        emit("game:error", {"error": "نوبت شما نیست"})
        return
        
    card = data.get("card")
    player = room.players[request.sid]
    
    # حذف کارت از دست بازیکن
    found = False
    for c in player["cards"]:
        if c["suit"] == card["suit"] and c["rank"] == card["rank"]:
            player["cards"].remove(c)
            found = True
            break
            
    if not found:
        return # کارت تقلبی
        
    room.trick.append({"sid": request.sid, "seat": room.turn, "card": card})
    
    # به همه بگو کارت بازی شد
    emit("card:played", {
        "seat": room.turn, 
        "card": card, 
        "playerCount": len(player_sids)
    }, room=room.code)
    
    # اگر همه بازی کردند
    if len(room.trick) >= len(player_sids):
        # تعیین برنده (منطق ساده برای ۲ نفره)
        winner_trick = room.trick[0]
        if len(room.trick) == 2:
            c0 = room.trick[0]["card"]
            c1 = room.trick[1]["card"]
            # فرض می‌کنیم حکم هنوز تعیین نشده، پس خال اول برنده است
            if c1["suit"] == c0["suit"] and c1["rank"] > c0["rank"]:
                winner_trick = room.trick[1]
        
        winner_seat = winner_trick["seat"]
        room.turn = winner_seat
        room.trick = []
        
        emit("trick:won", {"winnerSeat": winner_seat}, room=room.code)
    else:
        # نوبت بعدی
        room.turn = (room.turn + 1) % len(player_sids)
        emit("turn:changed", {"turnSeat": room.turn}, room=room.code)

if __name__ == "__main__":
    print("🎮 Game Server running on port 8082")
    socketio.run(app, host="0.0.0.0", port=8082, debug=True)