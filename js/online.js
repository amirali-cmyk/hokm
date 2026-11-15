/* ═══════════════════════════════════════════════════════════
   🌐 HOKM PRO v6.2.0 — online.js
   مدیریت اتاق‌های آنلاین (ساخت، ورود و آماده‌سازی بازی)
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // 🎯 آدرس سرور اصلی بازی آنلاین (همونی که توی رندره)
  const GAME_SERVER_URL = 'https://hokm-friends.onrender.com'; // اگه آدرس سرور اصلیت فرق داره، اینو عوض کن

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
        console.error('[Online] Socket.io script not loaded');
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
      // اگه سوکت از قبل وصل بود، مستقیم برو جلو
      if (state.socket && state.socket.connected) {
        onReady();
        return;
      }

      // اتصال جدید
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
        _showRoomCreatedModal(data.room);
      });

      state.socket.on('room:joined', (data) => {
        state.currentRoom = data.room;
        state.isHost = false;
        _showWaitingModal(data.room);
      });

      state.socket.on('room:update', (data) => {
        state.currentRoom = data.room;
        _updateWaitingModal(data.room);
      });

      state.socket.on('room:playerJoined', (data) => {
        if (_audio()) _audio().play('notification');
        _toast('👋 بازیکن جدید', `${data.name} وارد اتاق شد`, 'success');
      });

      state.socket.on('room:error', (data) => {
        _toast('خطا', data.error, 'error');
      });

      state.socket.on('game:error', (data) => {
        _toast('خطا', data.error, 'error');
      });

      // شروع بازی توسط میزبان
      state.socket.on('game:started', (data) => {
        _toast('🎮 بازی شروع شد!', '', 'success');
        if (_ui()) {
          _ui().closeModal();
          _ui().navigate('game');
          // کدهای شروع بازی در ui.js/game.js اضافه میشه
        }
      });
    }
  };

  // ═══════════════════════════════════════════
  // مودال‌ها (ساخت اتاق و انتظار)
  // ═══════════════════════════════════════════

  function _showRoomCreatedModal(room) {
    if (!_ui()) return;
    
    _ui().openModal(`
      <div style="text-align: center;">
        <h2 class="modal-title" style="color: var(--accent); margin-bottom: 8px;">✅ اتاق ساخته شد!</h2>
        <p style="color: var(--text-secondary); margin-bottom: 16px;">این کد رو به دوستات بفرست:</p>
        
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
        
        <div style="margin-top: 16px; padding: 12px; background: var(--bg-elevated); border-radius: var(--radius-sm);">
          <p style="font-size: 13px; margin-bottom: 8px;">👥 بازیکنان (۱/${room.maxPlayers}):</p>
          <div id="waitingPlayersList">
            <div style="padding: 6px; background: var(--accent-soft); border-radius: 6px; margin-bottom: 4px; font-size: 13px;">
              ${room.players[0]?.name || 'شما'} <span style="color: var(--accent); font-size: 10px;">👑 میزبان</span>
            </div>
          </div>
        </div>
        
        <p style="margin-top: 16px; font-size: 12px; color: var(--text-muted);">
          وقتی بازیکنا اومدن، بازی شروع میشه.
        </p>
      </div>
    `, { dismissible: false });
  }

  function _showWaitingModal(room) {
    if (!_ui()) return;
    
    _ui().openModal(`
      <div style="text-align: center;">
        <h2 class="modal-title" style="color: var(--accent); margin-bottom: 8px;">⏳ در انتظار شروع بازی</h2>
        <p style="color: var(--text-secondary); margin-bottom: 16px;">
          شما وارد اتاق <strong style="color: var(--accent);">${room.code}</strong> شدید.
        </p>
        
        <div style="padding: 12px; background: var(--bg-elevated); border-radius: var(--radius-sm);">
          <p style="font-size: 13px; margin-bottom: 8px;">👥 بازیکنان (${room.players.length}/${room.maxPlayers}):</p>
          <div id="waitingPlayersList">
            ${room.players.map(p => `
              <div style="padding: 6px; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 4px; font-size: 13px;">
                ${p.name} ${p.sid === room.hostId ? '<span style="color: var(--accent); font-size: 10px;">👑</span>' : ''}
              </div>
            `).join('')}
          </div>
        </div>
        
        <p style="margin-top: 16px; font-size: 12px; color: var(--text-muted);">
          منتظر میزبان بمونید...
        </p>
      </div>
    `, { dismissible: true });
  }

  function _updateWaitingModal(room) {
    const list = document.getElementById('waitingPlayersList');
    if (!list) return;
    
    list.innerHTML = room.players.map(p => `
      <div style="padding: 6px; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 4px; font-size: 13px;">
        ${p.name} ${p.sid === room.hostId ? '<span style="color: var(--accent); font-size: 10px;">👑 میزبان</span>' : ''}
      </div>
    `).join('');
  }

  // ═══════════════════════════════════════════
  // Export
  // ═══════════════════════════════════════════
  global.HokmOnline = Online;

  // راه‌اندازی خودکار بعد از لود DOM
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => Online.init(), 800);
  });

})(typeof window !== 'undefined' ? window : globalThis);