/* ═══════════════════════════════════════════════════════════
   🌐 HOKM PRO v6.2.0 — online.js
   مدیریت اتاق‌های آنلاین و بازی
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const GAME_SERVER_URL = 'https://your-game-server.onrender.com'; // 🎯 آدرس سرور بازی رو بذار (ServerGame.py)

  const state = {
    socket: null,
    currentRoom: null,
    isHost: false,
    mySeat: -1,
    isPlaying: false
  };

  function _ui() { return global.HokmUI; }
  function _profile() { return global.HokmProfile; }
  function _toast(title, msg, type) { if (_ui()) _ui().showToast(title, msg, type); }

  const Online = {
    
    init() {
      this.bindEvents();
      console.log('%c🌐 Online module ready', 'color: #118ab2; font-weight: bold;');
    },

    bindEvents() {
      const createBtn = document.getElementById('btnCreateRoom');
      const joinBtn = document.getElementById('btnJoinRoom');
      
      if (createBtn) {
        createBtn.addEventListener('click', () => this.createRoom());
      }
      if (joinBtn) {
        joinBtn.addEventListener('click', () => {
          const code = document.getElementById('roomCodeInput')?.value.trim();
          if (code && code.length === 6) this.joinRoom(code);
        });
      }
    },

    _initSocket() {
      if (typeof io === 'undefined') {
        _toast('خطا', 'Socket.io لود نشده', 'error');
        return false;
      }

      if (state.socket && state.socket.connected) return true;

      state.socket = io(GAME_SERVER_URL, {
        transports: ['websocket', 'polling']
      });

      state.socket.on('connect', () => console.log('Connected to game server'));
      
      // رویدادهای اتاق
      state.socket.on('room:created', (data) => {
        state.currentRoom = data.roomCode;
        state.isHost = true;
        _showRoomModal(data.roomCode, data.players, true);
      });

      state.socket.on('room:playerJoined', (data) => {
        _toast('👋 بازیکن جدید', `${data.name} وارد اتاق شد`, 'success');
        _updateRoomModal(data.players, state.isHost);
      });

      state.socket.on('room:error', (data) => _toast('خطا', data.error, 'error'));

      // شروع بازی
      state.socket.on('game:dealt', (data) => {
        state.mySeat = data.seat;
        state.isPlaying = true;
        _toast('🎮 بازی شروع شد!', `نوبت بازیکن ${data.turnSeat + 1}`, 'success');
        if (_ui()) _ui().closeModal();
        
        // ذخیره کارت‌ها و رفتن به صفحه بازی
        if (global.HokmGame) {
           // اینجا باید کارت‌ها رو به game.js بدیم تا نشون بده
           console.log('Cards received:', data.cards);
           _toast('کارت‌ها دریافت شد', `${data.cards.length} کارت`, 'info');
        }
      });

      state.socket.on('turn:changed', (data) => {
        _toast('⏱️ نوبت', `نوبت بازیکن ${data.turnSeat + 1}`, 'info', 1500);
      });

      state.socket.on('card:played', (data) => {
        console.log('Card played:', data);
      });

      return true;
    },

    createRoom() {
      if (!this._initSocket()) return;
      const p = _profile()?.get() || { name: 'مهمان', avatar: '😎' };
      state.socket.emit('room:create', {
        userId: p.userId || 'guest_' + Date.now(),
        name: p.name,
        avatar: p.avatar
      });
    },

    joinRoom(code) {
      if (!this._initSocket()) return;
      const p = _profile()?.get() || { name: 'مهمان', avatar: '😎' };
      state.socket.emit('room:join', {
        code: code,
        userId: p.userId || 'guest_' + Date.now(),
        name: p.name,
        avatar: p.avatar
      });
    },

    startGame() {
      if (state.socket && state.isHost) {
        state.socket.emit('game:start');
      }
    }
  };

  // مودال‌های اتاق
  function _showRoomModal(code, players, isHost) {
    if (!_ui()) return;
    
    let playersHtml = players.map((p, i) => `
      <div style="padding: 8px; background: ${i === 0 ? 'var(--accent-soft)' : 'var(--bg-secondary)'}; border-radius: 6px; margin-bottom: 4px; font-size: 13px;">
        ${p.name} ${i === 0 ? '👑' : ''}
      </div>
    `).join('');

    let startBtn = isHost ? `
      <button class="btn btn-primary btn-block" id="btnStartOnlineGame" style="margin-top: 16px;" onclick="HokmOnline.startGame()">
        🎮 شروع بازی
      </button>
    ` : `<p style="margin-top: 16px; font-size: 12px; color: var(--text-muted);">منتظر میزبان...</p>`;

    _ui().openModal(`
      <div style="text-align: center;">
        <h2 class="modal-title" style="color: var(--accent);">اتاق: ${code}</h2>
        <p style="margin: 8px 0 16px; font-size: 13px;">کد را به دوستات بده</p>
        
        <div style="font-size: 32px; font-weight: 900; color: var(--accent); letter-spacing: 0.2em; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
          ${code}
        </div>

        <div style="margin-top: 16px; text-align: right;">
          <p style="font-size: 12px; margin-bottom: 8px;">👥 بازیکنان (${players.length}/4):</p>
          <div id="roomPlayersList">${playersHtml}</div>
        </div>

        ${startBtn}
      </div>
    `, { dismissible: false });
  }

  function _updateRoomModal(players, isHost) {
    const list = document.getElementById('roomPlayersList');
    if (!list) return;
    
    list.innerHTML = players.map((p, i) => `
      <div style="padding: 8px; background: ${i === 0 ? 'var(--accent-soft)' : 'var(--bg-secondary)'}; border-radius: 6px; margin-bottom: 4px; font-size: 13px;">
        ${p.name} ${i === 0 ? '👑' : ''}
      </div>
    `).join('');
  }

  global.HokmOnline = Online;

  document.addEventListener('DOMContentLoaded', () => setTimeout(() => Online.init(), 800));

})(typeof window !== 'undefined' ? window : globalThis);