/* ═══════════════════════════════════════════════════════════
   🌐 HOKM PRO v6.2.0 — online.js (نسخه اصلاح‌شده)
   مدیریت اتاق‌های آنلاین + Polling 10s برای آپدیت لیست
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // 🎯 آدرس سرور اصلی بازی آنلاین (server.py روی Render)
  const GAME_SERVER_URL = 'https://hokm-friends.onrender.com'; // ← اگه آدرس سرور اصلیت فرق داره، اینو عوض کن

  const state = {
    socket: null,
    currentRoom: null,
    isHost: false,
    myUserId: null,
    pollingInterval: null
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
      console.log('%c🌐 Online module ready (v6.2.0 + polling)', 'color: #118ab2; font-weight: bold;');
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
          if (e.key === 'Enter') joinBtn?.click();
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
        state.myUserId = p.userId || ('guest_' + Date.now());
        
        state.socket.emit('room:create', {
          userId: state.myUserId,
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
        state.myUserId = p.userId || ('guest_' + Date.now());
        
        state.socket.emit('room:join', {
          code: code,
          userId: state.myUserId,
          name: p.name,
          avatar: p.avatar
        });
      });
    },

    _connectSocket(onReady) {
      // اگر قبلاً وصل بود، فقط onReady رو صدا بزن
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
        console.log('[Online] ✅ Connected to game server');
        onReady();
      });

      state.socket.on('connect_error', (err) => {
        console.error('[Online] ❌ Connection error:', err.message);
        _toast('خطا در اتصال', 'سرور بیدار نشده یا مشکل اینترنت دارید', 'error');
      });

      // ═══ رویدادهای اتاق ═══
      state.socket.on('room:created', (data) => {
        state.currentRoom = data.room;
        state.isHost = true;
        _showRoomModal(data.room, true);
        _startPolling();
      });

      state.socket.on('room:joined', (data) => {
        state.currentRoom = data.room;
        state.isHost = false;
        _showRoomModal(data.room, false);
        _startPolling();
      });

      // 🎯 آپدیت لیست وقتی بازیکن جدید میاد
      state.socket.on('room:update', (data) => {
        console.log('[Online] 📋 room:update received:', data.room.players.length, 'players');
        state.currentRoom = data.room;
        _updateRoomModal(data.room);
      });

      // 🎯 آپدیت لیست وقتی بازیکن میاد
      state.socket.on('room:playerJoined', (data) => {
        console.log('[Online] 👋 Player joined:', data.name);
        if (_audio()) _audio().play('notification');
        _toast('👋 بازیکن جدید', `${data.name} وارد اتاق شد`, 'success');
        
        if (data.players) {
          state.currentRoom.players = data.players;
          _updateRoomModal(state.currentRoom);
        }
      });

      // 🎯 آپدیت لیست وقتی بازیکن میره
      state.socket.on('room:playerLeft', (data) => {
        if (data.players) {
          state.currentRoom.players = data.players;
          _updateRoomModal(state.currentRoom);
        }
      });

      state.socket.on('room:error', (data) => {
        _toast('خطا', data.error, 'error');
      });

      state.socket.on('game:error', (data) => {
        _toast('خطا', data.error, 'error');
      });

      // 🎯 شروع بازی
      state.socket.on('game:started', (data) => {
        _stopPolling();
        _toast('🎮 بازی شروع شد!', '', 'success');
        if (_ui()) {
          _ui().closeModal();
          _ui().navigate('game');
        }
      });

      state.socket.on('game:dealt', (data) => {
        console.log('[Online] 🎴 Cards dealt:', data.cards);
        // اینجا می‌تونیم کارت‌ها رو به game.js پاس بدیم
        if (global.HokmGameOnline) {
          global.HokmGameOnline.handleDealt(data);
        }
      });
    }
  };

  // ═══════════════════════════════════════════
  // 🎯 Polling هر ۱۰ ثانیه برای اطمینان از آپدیت
  // ═══════════════════════════════════════════

  function _startPolling() {
    _stopPolling();
    
    state.pollingInterval = setInterval(() => {
      if (!state.socket || !state.socket.connected) return;
      if (!state.currentRoom) return;
      
      console.log('[Online] 🔄 Polling for room update...');
      
      // درخواست آپدیت از سرور
      state.socket.emit('room:refresh', {
        code: state.currentRoom.code
      });
    }, 10000); // هر ۱۰ ثانیه
    
    console.log('%c🔄 Polling started (every 10s)', 'color: #06d6a0; font-weight: bold;');
  }

  function _stopPolling() {
    if (state.pollingInterval) {
      clearInterval(state.pollingInterval);
      state.pollingInterval = null;
      console.log('%c⏹ Polling stopped', 'color: #ef476f;');
    }
  }

  // ═══════════════════════════════════════════
  // مودال اتاق
  // ═══════════════════════════════════════════

  function _showRoomModal(room, isHost) {
    if (!_ui()) return;
    
    const playersList = room.players.map(p => `
      <div style="padding: 8px 12px; background: ${p.sid === room.hostId ? 'var(--accent-soft)' : 'var(--bg-secondary)'}; border-radius: 8px; margin-bottom: 6px; font-size: 13px; display: flex; align-items: center; justify-content: space-between;">
        <span>${p.avatar || '👤'} ${p.name}</span>
        ${p.sid === room.hostId ? '<span style="color: var(--accent); font-size: 10px;">👑 میزبان</span>' : ''}
      </div>
    `).join('');

    _ui().openModal(`
      <div style="text-align: center;">
        <h2 class="modal-title" style="color: var(--accent); margin-bottom: 8px;">
          ${isHost ? '✅ اتاق ساخته شد!' : '⏳ در انتظار شروع بازی'}
        </h2>
        
        <p style="color: var(--text-secondary); margin-bottom: 12px;">
          کد اتاق:
        </p>
        
        <div style="
          font-family: var(--font-num);
          font-size: 36px;
          font-weight: 900;
          color: var(--accent);
          letter-spacing: 0.2em;
          padding: 12px;
          background: var(--bg-secondary);
          border: 2px dashed var(--accent);
          border-radius: var(--radius-md);
          margin-bottom: 12px;
        ">${room.code}</div>
        
        <button class="btn btn-primary btn-block" onclick="navigator.clipboard.writeText('${room.code}'); HokmUI.showToast('کپی شد', 'کد اتاق کپی شد', 'success');" style="margin-bottom: 12px;">
          📋 کپی کد اتاق
        </button>
        
        <div style="padding: 12px; background: var(--bg-elevated); border-radius: var(--radius-sm);">
          <p style="font-size: 13px; margin-bottom: 8px; font-weight: 700;">
            👥 بازیکنان (<span id="playersCount">${room.players.length}</span>/${room.maxPlayers}):
          </p>
          <div id="waitingPlayersList">
            ${playersList}
          </div>
        </div>
        
        ${isHost ? `
          <button class="btn btn-success btn-block" id="btnStartOnlineGame" style="margin-top: 16px;">
            🎮 شروع بازی
          </button>
        ` : `
          <p style="margin-top: 16px; font-size: 12px; color: var(--text-muted);">
            ⏳ منتظر میزبان بمونید...
          </p>
        `}
        
        <p style="margin-top: 8px; font-size: 10px; color: var(--text-muted);">
          🔄 آپدیت خودکار هر ۱۰ ثانیه
        </p>
      </div>
    `, { dismissible: false });

    // 🎯 دکمه شروع بازی (فقط برای میزبان)
    const startBtn = document.getElementById('btnStartOnlineGame');
    if (startBtn && state.socket) {
      startBtn.addEventListener('click', () => {
        if (state.currentRoom.players.length < 2) {
          _toast('خطا', 'حداقل ۲ بازیکن لازم است', 'error');
          return;
        }
        console.log('[Online] 🎮 Starting game...');
        state.socket.emit('game:start');
      });
    }
  }

  function _updateRoomModal(room) {
    const playersList = document.getElementById('waitingPlayersList');
    const playersCount = document.getElementById('playersCount');
    
    if (playersCount) {
      playersCount.textContent = room.players.length;
    }
    
    if (playersList) {
      playersList.innerHTML = room.players.map(p => `
        <div style="padding: 8px 12px; background: ${p.sid === room.hostId ? 'var(--accent-soft)' : 'var(--bg-secondary)'}; border-radius: 8px; margin-bottom: 6px; font-size: 13px; display: flex; align-items: center; justify-content: space-between;">
          <span>${p.avatar || '👤'} ${p.name}</span>
          ${p.sid === room.hostId ? '<span style="color: var(--accent); font-size: 10px;">👑 میزبان</span>' : ''}
        </div>
      `).join('');
    }
    
    console.log('[Online] 🔄 UI updated with', room.players.length, 'players');
  }

  // ═══════════════════════════════════════════
  // Export
  // ═══════════════════════════════════════════
  global.HokmOnline = Online;

  // راه‌اندازی خودکار
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => Online.init(), 800);
  });

})(typeof window !== 'undefined' ? window : globalThis);