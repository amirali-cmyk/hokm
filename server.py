#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════
   🃏 HOKM PRO v6.2.0 — server.py
   سرور اصلی بازی آنلاین (اتاق‌ها + بازی چندنفره + چت اتاق)
═══════════════════════════════════════════════════════════════
"""

import os
import sys
import time
import random
import string
import secrets
from pathlib import Path

import eventlet
eventlet.monkey_patch()

try:
    from flask import Flask, request, jsonify, send_from_directory
    from flask_cors import CORS
    from flask_socketio import SocketIO, emit, join_room, leave_room
except ImportError as e:
    print(f"\n❌ وابستگی گمشده: {e.name}")
    print("   اجرا کن: pip install -r requirements.txt\n")
    sys.exit(1)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="")
app.config["SECRET_KEY"] = os.environ.get("HOKM_SECRET", secrets.token_hex(32))
CORS(app, supports_credentials=True, origins="*")

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")


# ═══════════════════════════════════════════════════════════
# مدل‌های داده (در حافظه)
# ═══════════════════════════════════════════════════════════

rooms = {}      # { room_code: Room }
user_rooms = {} # { sid: room_code }


class GameRoom:
    def __init__(self, code, host_sid):
        self.code = code
        self.host_sid = host_sid
        self.players = {}   # { sid: { userId, name, avatar, ready, cards, seat } }
        self.max_players = 4
        self.started = False
        self.hokm = None
        self.turn = None
        self.leader = None
        self.trick = []
        self.scores = {"A": 0, "B": 0}
        self.trick_count = 0
        self.created_at = now_ms()
        self.last_activity = now_ms()

    def add_player(self, sid, user_id, name, avatar):
        if len(self.players) >= self.max_players:
            return False, "اتاق پر است"
        if self.started:
            return False, "بازی شروع شده"
        for p in self.players.values():
            if p["userId"] == user_id:
                return False, "قبلاً وارد شدی"
        team = "A" if len(self.players) % 2 == 0 else "B"
        self.players[sid] = {
            "userId": user_id,
            "name": name,
            "avatar": avatar,
            "ready": False,
            "team": team,
            "cards": [],
            "seat": len(self.players)
        }
        self.last_activity = now_ms()
        return True, None

    def remove_player(self, sid):
        if sid in self.players:
            del self.players[sid]
            # جابجایی host
            if sid == self.host_sid and self.players:
                self.host_sid = next(iter(self.players))
            self.last_activity = now_ms()
            return True
        return False

    def to_dict(self):
        return {
            "code": self.code,
            "hostId": self.players[self.host_sid]["userId"] if self.host_sid in self.players else None,
            "players": [
                {
                    "userId": p["userId"],
                    "name": p["name"],
                    "avatar": p["avatar"],
                    "ready": p["ready"],
                    "team": p["team"],
                    "seat": p["seat"]
                }
                for p in self.players.values()
            ],
            "maxPlayers": self.max_players,
            "started": self.started,
            "hokm": self.hokm,
            "turn": self.turn,
            "scores": self.scores
        }


def now_ms():
    return int(time.time() * 1000)


def generate_room_code():
    for _ in range(100):
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if code not in rooms:
            return code
    return None


def cleanup_rooms():
    now = now_ms()
    to_delete = []
    for code, room in list(rooms.items()):
        if not room.players or (now - room.last_activity) > 30 * 60 * 1000:
            to_delete.append(code)
    for code in to_delete:
        del rooms[code]
        print(f"🗑️ اتاق {code} حذف شد")
    return len(to_delete)


# ═══════════════════════════════════════════════════════════
# ابزارها و منطق کارت
# ═══════════════════════════════════════════════════════════

SUIT_LIST = ['spades', 'hearts', 'diamonds', 'clubs']
RANK_LIST = list(range(2, 15))  # 2 تا 14 (A=14)
RANK_SYMBOLS = {2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A'}


def create_deck():
    return [{"suit": s, "rank": r, "symbol": RANK_SYMBOLS[r], "id": f"{s}_{r}"} for s in SUIT_LIST for r in RANK_LIST]


def get_valid_cards(room, player_sid):
    player = room.players.get(player_sid)
    if not player or not player["cards"]:
        return []
    if not room.trick:
        return player["cards"][:]
    lead_suit = room.trick[0]["card"]["suit"]
    same_suit = [c for c in player["cards"] if c["suit"] == lead_suit]
    return same_suit if same_suit else player["cards"][:]


def determine_trick_winner(room):
    if not room.trick:
        return None
    lead_suit = room.trick[0]["card"]["suit"]
    hokm = room.hokm
    winner = room.trick[0]
    for entry in room.trick[1:]:
        c, w = entry["card"], winner["card"]
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


# ═══════════════════════════════════════════════════════════
# Static files
# ═══════════════════════════════════════════════════════════

@app.route("/")
def index():
    return send_from_directory(str(STATIC_DIR), "index.html")

@app.route("/<path:path>")
def static_files(path):
    full = STATIC_DIR / path
    if full.exists() and full.is_file():
        return send_from_directory(str(STATIC_DIR), path)
    try:
        return send_from_directory(str(STATIC_DIR), "404.html"), 404
    except Exception:
        return "404 Not Found", 404

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "Hokm Online Server",
        "version": "6.2.0",
        "rooms": len(rooms)
    })


# ═══════════════════════════════════════════════════════════
# Socket.IO Events
# ═══════════════════════════════════════════════════════════

@socketio.on("connect")
def on_connect():
    print(f"🔌 Connected: {request.sid}")
    emit("hello", {"sid": request.sid})


@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    print(f"🔌 Disconnected: {sid}")
    room_code = user_rooms.get(sid)
    if room_code and room_code in rooms:
        room = rooms[room_code]
        removed_player = room.players.get(sid)
        room.remove_player(sid)
        leave_room(room_code)
        if sid in user_rooms:
            del user_rooms[sid]
        if room.players:
            emit("room:playerLeft", {
                "sid": sid,
                "userId": removed_player["userId"] if removed_player else None,
                "players": room.to_dict()["players"]
            }, room=room_code)
        else:
            del rooms[room_code]
            print(f"🗑️ اتاق خالی {room_code} حذف شد")


@socketio.on("room:create")
def on_room_create(data):
    user_id = data.get("userId", "guest_" + request.sid[:8])
    name = data.get("name", "بازیکن")
    avatar = data.get("avatar", "😎")

    cleanup_rooms()
    code = generate_room_code()
    if not code:
        emit("room:error", {"error": "خطا در ساخت اتاق"})
        return

    room = GameRoom(code, request.sid)
    ok, err = room.add_player(request.sid, user_id, name, avatar)
    if not ok:
        emit("room:error", {"error": err})
        return

    rooms[code] = room
    user_rooms[request.sid] = code
    join_room(code)

    emit("room:created", {"room": room.to_dict()})
    print(f"🏠 اتاق ساخته شد: {code} توسط {name}")


@socketio.on("room:join")
def on_room_join(data):
    code = (data.get("code") or "").strip().upper()
    user_id = data.get("userId", "guest_" + request.sid[:8])
    name = data.get("name", "بازیکن")
    avatar = data.get("avatar", "😎")

    if code not in rooms:
        emit("room:error", {"error": "اتاق پیدا نشد"})
        return

    room = rooms[code]
    ok, err = room.add_player(request.sid, user_id, name, avatar)
    if not ok:
        emit("room:error", {"error": err})
        return

    user_rooms[request.sid] = code
    join_room(code)

    emit("room:joined", {"room": room.to_dict()})
    emit("room:playerJoined", {
        "sid": request.sid,
        "userId": user_id,
        "name": name,
        "players": room.to_dict()["players"]
    }, room=code, include_self=False)
    print(f"👥 {name} وارد اتاق {code} شد")


@socketio.on("room:leave")
def on_room_leave():
    sid = request.sid
    code = user_rooms.get(sid)
    if not code or code not in rooms:
        return
    room = rooms[code]
    removed = room.players.get(sid)
    room.remove_player(sid)
    leave_room(code)
    if sid in user_rooms:
        del user_rooms[sid]
    if room.players:
        emit("room:playerLeft", {
            "sid": sid,
            "userId": removed["userId"] if removed else None,
            "players": room.to_dict()["players"]
        }, room=code)
    else:
        del rooms[code]


@socketio.on("room:ready")
def on_room_ready(data):
    sid = request.sid
    code = user_rooms.get(sid)
    if not code or code not in rooms:
        return
    room = rooms[code]
    if sid in room.players:
        room.players[sid]["ready"] = bool(data.get("ready", True))
        room.last_activity = now_ms()
    emit("room:update", {"room": room.to_dict()}, room=code)


@socketio.on("game:start")
def on_game_start():
    sid = request.sid
    code = user_rooms.get(sid)
    if not code or code not in rooms:
        return
    room = rooms[code]

    if sid != room.host_sid:
        emit("game:error", {"error": "فقط میزبان می‌تواند شروع کند"})
        return

    if len(room.players) < 2:
        emit("game:error", {"error": "حداقل ۲ بازیکن نیاز است"})
        return

    # توزیع کارت‌ها
    deck = create_deck()
    random.shuffle(deck)
    count = len(room.players)
    hand_size = 52 // count

    player_sids = list(room.players.keys())
    for i, p_sid in enumerate(player_sids):
        room.players[p_sid]["cards"] = deck[i * hand_size:(i + 1) * hand_size]

    room.started = True
    room.hokm = random.choice(SUIT_LIST)
    room.turn = random.randint(0, count - 1)
    room.leader = room.turn
    room.trick = []
    room.scores = {"A": 0, "B": 0}
    room.trick_count = 0
    room.last_activity = now_ms()

    # ارسال کارت‌های هر بازیکن به صورت خصوصی
    for i, p_sid in enumerate(player_sids):
        socketio.emit("game:dealt", {
            "cards": room.players[p_sid]["cards"],
            "mySeat": i,
            "turnSeat": room.turn,
            "totalPlayers": count,
            "hokm": room.hokm
        }, room=p_sid)

    emit("game:started", {
        "room": room.to_dict(),
        "hokm": room.hokm,
        "turnSeat": room.turn
    }, room=code)
    print(f"🎮 بازی در {code} شروع شد (حکم: {room.hokm})")


@socketio.on("hokm:set")
def on_hokm_set(data):
    sid = request.sid
    suit = data.get("suit")
    code = user_rooms.get(sid)
    if not code or code not in rooms:
        return
    room = rooms[code]
    if suit not in SUIT_LIST:
        return
    room.hokm = suit
    room.last_activity = now_ms()
    emit("hokm:chosen", {"suit": suit}, room=code)


@socketio.on("card:play")
def on_card_play(data):
    sid = request.sid
    card = data.get("card")
    code = user_rooms.get(sid)
    if not code or code not in rooms:
        return
    room = rooms[code]
    if not room.started:
        return

    player_sids = list(room.players.keys())
    current_sid = player_sids[room.turn]

    if sid != current_sid:
        emit("game:error", {"error": "نوبت تو نیست"})
        return

    player = room.players[sid]
    actual_card = next((c for c in player["cards"] if c["suit"] == card["suit"] and c["rank"] == card["rank"]), None)
    if not actual_card:
        emit("game:error", {"error": "این کارت را نداری"})
        return

    # چک قانون پیروی از خال
    valid = get_valid_cards(room, sid)
    if not any(c["id"] == actual_card["id"] for c in valid):
        emit("game:error", {"error": "باید از خال جاری بازی کنی"})
        return

    player["cards"].remove(actual_card)
    room.trick.append({"sid": sid, "userId": player["userId"], "card": actual_card})

    emit("card:played", {
        "sid": sid,
        "userId": player["userId"],
        "card": actual_card,
        "seat": room.turn,
        "trick": room.trick,
        "remainingCards": len(player["cards"])
    }, room=code)

    # بررسی پایان دست
    if len(room.trick) >= len(player_sids):
        winner = determine_trick_winner(room)
        winner_sid = winner["sid"]
        winner_team = room.players[winner_sid]["team"]
        room.scores[winner_team] += 1
        room.trick_count += 1

        emit("trick:won", {
            "winnerUserId": winner["userId"],
            "winnerSid": winner_sid,
            "winnerTeam": winner_team,
            "scores": room.scores,
            "trick": room.trick
        }, room=code)

        room.trick = []
        room.turn = player_sids.index(winner_sid)

        if room.scores["A"] >= 7 or room.scores["B"] >= 7:
            room.started = False
            emit("game:ended", {
                "scores": room.scores,
                "winnerTeam": "A" if room.scores["A"] >= 7 else "B"
            }, room=code)
            print(f"🏆 بازی {code} تمام شد: {room.scores}")
        else:
            emit("trick:new", {
                "turnSeat": room.turn,
                "scores": room.scores
            }, room=code)
    else:
        room.turn = (room.turn + 1) % len(player_sids)
        emit("turn:changed", {
            "turnSeat": room.turn,
            "userId": player_sids[room.turn]
        }, room=code)

    room.last_activity = now_ms()


@socketio.on("chat:send")
def on_chat_send(data):
    text = (data.get("text") or "").strip()[:200]
    if not text:
        return
    sid = request.sid
    code = user_rooms.get(sid)
    if not code or code not in rooms:
        return
    room = rooms[code]
    player = room.players.get(sid)
    if not player:
        return
    emit("chat:message", {
        "userId": player["userId"],
        "name": player["name"],
        "text": text,
        "timestamp": now_ms()
    }, room=code)


# ═══════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"🚀 Hokm Online Server running on port {port}")
    socketio.run(app, host="0.0.0.0", port=port, debug=False)