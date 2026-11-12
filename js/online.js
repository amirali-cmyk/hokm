/* ═══════════════════════════════════════════════════════════
   🌐 HOKM PRO v6.2.0 — online.js
   مدیریت اتاق‌های آنلاین (ساخت، ورود، آپدیت لیست و شروع بازی)
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // 🎯 آدرس سرور آنلاین (اگر روی رندره، آدرسش رو اینجا بذار)
  const GAME_SERVER_URL = 'https://hokm-1-1ikl.onrender.com/'; // ⚠️ آدرس سرور بازی آنلاین خودت رو بذار

  const state = {
    socket: null,
    currentRoom: null,
    isHost: false
  };

  function _ui() { return global.HokmUI; }
  function _profile() { return global.HokmProfile; }
  function _audio() { return global.HokmAudio; }
  function _toast(title, msg, type) { if (_ui()) _ui().showToast(title, msg, type); }
  
  function _toPersianNumber(n) {
    const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(n).replace(/\d/g, d => fa[+d]);
  }

  const Online = {
    
    init() {
      this.bindEvents();
      console.log('%c🌐 Online module ready (v6.2.0)', 'color: #118ab2; font-weight: bold;');
    },

    bindEvents() {
      const createBtn = document.getElementById('btnCreateRoom');
      const joinBtn = document.getElementById('btnJoinRoom');
      const input = document.getElementById('roomCodeInput');
      
      if (createBtn) {
        createBtn.addEventListener('click', () => {
          if (_audio()) _audio().play('click');
          this.createRoom();
        });
      }
      
      if (joinBtn) {
        joinBtn.addEventListener('click', () => {
          const code = input?.value.trim();
          if (code && code.length === 6) {
            if (_audio()) _audio().play('click');
            this.joinRoom(code);
          } else {
            _toast('خطا', 'کد اتاق باید ۶ رقم باشد', 'error');
          }
        });
      }
      
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') joinBtn.click();
        });
      }
    },

    createRoom() {
      if (typeof io === 'undefined') {
        _toast('خطا', 'ارتباط با سرور (Socket.io) برقرار نشد', 'error');
        return;
      }
      _toast('⏳', 'در حال اتصال به سرور...', 'info', 2000);

      this._connectSocket(() => {
        const p = _profile()?.get() || { name: 'مهمان', avatar: '😎' };
        state.socket.emit('room:create', {
          userId: p.userId || 'guest_' + Date.now(),
          name: p.name,
          avatar: p.avatar
        });
      });
    },

    joinRoom(code) {
      if (typeof io === 'undefined') {
        _toast('خطا', 'ارتباط با سرور (Socket.io) برقرار نشد', 'error');
        return;
      }
      _toast('⏳', 'در حال اتصال به سرور...', 'info', 2000);

      this._connectSocket(() => {
        const p = _profile()?.get() || { name: 'مهمان', avatar: '😎' };
        state.socket.emit('room:join', {
          code: code,
          userId: p.userId || 'guest_' + Date.now(),
          name: p.name,
          avatar: p.avatar
        });
      });
    },

    _connectSocket(onReady) {
      if (state.socket && state.socket.connected) {
        onReady();
        return;
      }

      state.socket = io(GAME_SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 3,
        timeout: 10000
      });

      state.socket.on('connect', () => {
        console.log('[Online] Connected to game server');
        onReady();
      });

      state.socket.on('connect_error', (err) => {
        console.error('[Online] Connection error:', err.message);
        _toast('خطا در اتصال', 'سرور بیدار نشده یا مشکل اینترنت دارید', 'error');
      });

      // ═══ رویدادهای اتاق ═══
      state.socket.on('room:created', (data) => {
        state.currentRoom = data.room;
        state.isHost = true;
        _showRoomModal(data.room, true);
      });

      state.socket.on('room:joined', (data) => {
        state.currentRoom = data.room;
        state.isHost = false;
        _showRoomModal(data.room, false);
      });

      state.socket.on('room:update', (data) => {
        state.currentRoom = data.room;
        // فقط لیست بازیکنان رو رفرش کن، مودال رو نبند
        _updatePlayersList(data.room);
      });

      state.socket.on('room:playerJoined', (data) => {
        if (_audio()) _audio().play('notification');
        _toast('👋 بازیکن جدید', `${data.name} وارد اتاق شد`, 'success', 2000);
      });

      state.socket.on('room:error', (data) => {
        _toast('خطا', data.error, 'error');
      });

      // شروع بازی
      state.socket.on('game:started', (data) => {
        _toast('🎮 بازی شروع شد!', 'در حال رفتن به میز بازی...', 'success', 3000);
        if (_ui()) {
          _ui().closeModal();
          setTimeout(() => {
            _ui().navigate('game');
            _toast('⚠️ در حال آماده‌سازی', 'بخش بازی آنلاین در حال توسعه است', 'info', 3000);
          }, 1000);
        }
      });
    },

    startGame() {
      if (state.socket && state.currentRoom) {
        state.socket.emit('room:start');
      }
    }
  };

  // ═══════════════════════════════════════════
  // مودال اتاق (نمایش لیست بازیکنان و کد)
  // ═══════════════════════════════════════════

  function _showRoomModal(room, isHost) {
    if (!_ui()) return;
    
    _ui().openModal(`
      <div style="text-align: center;">
        <h2 class="modal-title" style="color: var(--accent); margin-bottom: 8px;">
          ${isHost ? '✅ اتاق ساخته شد!' : '⏳ در انتظار شروع بازی'}
        </h2>
        <p style="color: var(--text-secondary); margin-bottom: 16px;">
          ${isHost ? 'این کد رو به دوستات بفرست:' : 'شما وارد اتاق زیر شدید:'}
        </p>
        
        <div style="
          font-family: var(--font-num);
          font-size: 42px;
          font-weight: 900;
          color: var(--accent);
          letter-spacing: 0.2em;
          padding: 16px;
          background: var(--bg-secondary);
          border: 2px dashed var(--accent);
          border-radius: var(--radius-md);
          margin-bottom: 16px;
        ">${room.code}</div>
        
        <button class="btn btn-primary btn-block" onclick="navigator.clipboard.writeText('${room.code}'); HokmUI.showToast('کپی شد', 'کد اتاق کپی شد', 'success');">
          📋 کپی کد اتاق
        </button>
        
        <div style="margin-top: 16px; padding: 12px; background: var(--bg-elevated); border-radius: var(--radius-sm); text-align: right;">
          <p style="font-size: 13px; margin-bottom: 8px; color: var(--text-secondary);">
            👥 بازیکنان (<span id="playerCount">${_toPersianNumber(room.players.length)}</span>/${_toPersianNumber(room.maxPlayers)}):
          </p>
          <div id="waitingPlayersList">
            ${room.players.map(p => `
              <div style="padding: 8px; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 4px; font-size: 13px; display: flex; justify-content: space-between; align-items: center;">
                <span>${p.avatar} ${p.name}</span>
                ${p.sid === room.hostId ? '<span style="color: var(--accent); font-size: 10px; background: var(--accent-soft); padding: 2px 6px; border-radius: 10px;">👑 میزبان</span>' : ''}
              </div>
            `).join('')}
          </div>
        </div>
        
        ${isHost ? `
          <button class="btn btn-primary btn-large btn-block" style="margin-top: 16px;" onclick="HokmOnline.startGame()">
            🎮 شروع بازی (حداقل ۲ نفر)
          </button>
        ` : `
          <p style="margin-top: 16px; font-size: 12px; color: var(--text-muted);">
            منتظر میزبان بمونید...
          </p>
        `}
        
        <button class="btn btn-ghost btn-block" style="margin-top: 8px;" onclick="HokmOnline.leaveRoom()">
          🚪 خروج از اتاق
        </button>
      </div>
    `, { dismissible: false });
  }

  function _updatePlayersList(room) {
    const list = document.getElementById('waitingPlayersList');
    const count = document.getElementById('playerCount');
    
    if (count) count.textContent = _toPersianNumber(room.players.length);
    
    if (!list) return;
    
    list.innerHTML = room.players.map(p => `
      <div style="padding: 8px; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 4px; font-size: 13px; display: flex; justify-content: space-between; align-items: center;">
        <span>${p.avatar} ${p.name}</span>
        ${p.sid === room.hostId ? '<span style="color: var(--accent); font-size: 10px; background: var(--accent-soft); padding: 2px 6px; border-radius: 10px;">👑 میزبان</span>' : ''}
      </div>
    `).join('');
  }

  // ═══════════════════════════════════════════
  // Export
  // ═══════════════════════════════════════════
  
  // تابع خروج از اتاق
  Online.leaveRoom = function() {
    if (state.socket && state.currentRoom) {
      state.socket.emit('room:leave');
      state.socket.disconnect();
      state.socket = null;
      state.currentRoom = null;
    }
    if (_ui()) _ui().closeModal();
    _toast('خارج شدی', 'از اتاق خارج شدید', 'info');
  };

  global.HokmOnline = Online;

  // راه‌اندازی خودکار
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => Online.init(), 800);
  });

})(typeof window !== 'undefined' ? window : globalThis);