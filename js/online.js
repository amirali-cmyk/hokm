/* ═══════════════════════════════════════════════════════════
   🌐 HOKM PRO v6.1.1 — online.js
   مدیریت اتصال آنلاین، ساخت اتاق، ورود، دعوت و بازی
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // 🎯 آدرس سرور (هر وقت سرور عوض شد، فقط اینجا رو تغییر بده)
  const SERVER_URL = 'https://hokm-14k9.onrender.com';

  const state = {
    socket: null,
    connected: false,
    room: null,
    myRole: null,
    isHost: false,
    listeners: []
  };

  function _ui() { return global.HokmUI; }
  function _profile() { return global.HokmProfile; }
  function _game() { return global.HokmGame; }
  function _audio() { return global.HokmAudio; }

  function _emit(event, data) {
    state.listeners.forEach(({ event: e, handler }) => {
      if (e === event || e === '*') {
        try { handler(data); } catch (err) { console.error(err); }
      }
    });
  }

  const Online = {

    /**
     * اتصال به سرور
     */
    connect() {
      if (state.socket && state.connected) {
        return true;
      }

      if (typeof io === 'undefined') {
        console.error('Socket.io script not loaded!');
        if (_ui()) _ui().showToast('خطا', 'کتابخانه آنلاین لود نشد', 'error');
        return false;
      }

      try {
        state.socket = io(SERVER_URL, {
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000
        });

        state.socket.on('connect', () => {
          state.connected = true;
          console.log('%c🌐 Connected to server', 'color: #06d6a0; font-weight: bold;');

          // احراز هویت (اگه کاربر پروفایل داره)
          const profile = _profile()?.get();
          if (profile && profile.userId) {
            state.socket.emit('auth', { token: profile.userId });
          }

          if (_ui()) _ui().showToast('متصل شد!', 'به سرور آنلاین وصل شدی', 'success');
          _emit('connected');
        });

        state.socket.on('disconnect', (reason) => {
          state.connected = false;
          console.log('%c🔌 Disconnected: ' + reason, 'color: #ef476f; font-weight: bold;');
          if (_ui()) _ui().showToast('قطع شد', 'اتصال به سرور قطع شد', 'warning');
          _emit('disconnected', { reason });
        });

        state.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          if (_ui()) _ui().showToast('خطا', 'اتصال به سرور برقرار نشد', 'error');
        });

        _bindSocketEvents();
        return true;

      } catch (err) {
        console.error('Socket init error:', err);
        return false;
      }
    },

    /**
     * قطع اتصال
     */
    disconnect() {
      if (state.socket) {
        state.socket.disconnect();
        state.socket = null;
        state.connected = false;
        state.room = null;
      }
    },

    /* ─────────────────────────────────────────────
       اتاق‌ها
       ───────────────────────────────────────────── */

    /**
     * ساخت اتاق جدید
     */
    createRoom() {
      if (!state.connected) {
        if (!Online.connect()) return;
        setTimeout(() => Online.createRoom(), 1000);
        return;
      }

      const profile = _profile()?.get() || { name: 'تو', avatar: '😎', userId: 'guest_' + Date.now() };

      state.isHost = true;

      state.socket.emit('room:create', {
        userId: profile.userId || 'guest_' + Date.now(),
        name: profile.name || 'تو',
        avatar: profile.avatar || '😎'
      });

      if (_ui()) _ui().showToast('در حال ساخت اتاق...', 'لطفاً صبر کن', 'info', 2000);
    },

    /**
     * ورود به اتاق
     */
    joinRoom(code) {
      if (!state.connected) {
        if (!Online.connect()) return;
        setTimeout(() => Online.joinRoom(code), 1000);
        return;
      }

      const profile = _profile()?.get() || { name: 'تو', avatar: '😎', userId: 'guest_' + Date.now() };

      state.socket.emit('room:join', {
        code: code.toUpperCase(),
        userId: profile.userId || 'guest_' + Date.now(),
        name: profile.name || 'تو',
        avatar: profile.avatar || '😎'
      });
    },

    /**
     * خروج از اتاق
     */
    leaveRoom() {
      if (state.socket) {
        state.socket.emit('room:leave');
      }
      state.room = null;
      state.isHost = false;

      if (_ui()) {
        _ui().navigate('online', { force: true });
      }
    },

    /**
     * اعلام آمادگی
     */
    setReady(ready) {
      if (state.socket && state.connected) {
        state.socket.emit('room:ready', { ready });
      }
    },

    /**
     * شروع بازی (فقط host)
     */
    startGame() {
      if (state.socket && state.connected && state.isHost) {
        state.socket.emit('game:start');
      } else {
        if (_ui()) _ui().showToast('خطا', 'فقط سازنده اتاق می‌تونه بازی رو شروع کنه', 'error');
      }
    },

    /* ─────────────────────────────────────────────
       بازی
       ───────────────────────────────────────────── */

    /**
     * تعیین حکم (فقط حکم‌خوان)
     */
    setHokm(suit) {
      if (state.socket && state.connected) {
        state.socket.emit('hokm:set', { suit });
      }
    },

    /**
     * بازی کارت
     */
    playCard(card) {
      if (state.socket && state.connected) {
        state.socket.emit('card:play', { card: { suit: card.suit, rank: card.rank } });
      }
    },

    /**
     * ارسال پیام چت
     */
    sendMessage(text) {
      if (state.socket && state.connected && text) {
        state.socket.emit('chat:send', { text });
      }
    },

    /* ─────────────────────────────────────────────
       رویدادهای Socket
       ───────────────────────────────────────────── */
    _bindSocketEvents() {
      if (!state.socket) return;

      // ─── اتاق‌ها ───
      state.socket.on('room:created', (data) => {
        console.log('Room created:', data);
        state.room = data.room;
        state.isHost = true;
        Online.renderRoom();
      });

      state.socket.on('room:joined', (data) => {
        console.log('Room joined:', data);
        state.room = data.room;
        state.isHost = false;
        Online.renderRoom();
      });

      state.socket.on('room:error', (data) => {
        console.error('Room error:', data.error);
        if (_ui()) _ui().showToast('خطا', data.error || 'خطا در اتاق', 'error');
      });

      state.socket.on('room:playerJoined', (data) => {
        console.log('Player joined:', data);
        if (state.room) {
          state.room.players = data.players;
          Online.renderRoom();
        }
        if (_ui()) _ui().showToast('👥 بازیکن جدید', 'یه بازیکن وارد اتاق شد', 'info', 2500);
      });

      state.socket.on('room:playerLeft', (data) => {
        console.log('Player left:', data);
        if (state.room) {
          state.room.players = data.players;
          Online.renderRoom();
        }
      });

      state.socket.on('room:update', (data) => {
        if (state.room && data.room) {
          state.room = data.room;
          Online.renderRoom();
        }
      });

      // ─── بازی ───
      state.socket.on('game:started', (data) => {
        console.log('Game started:', data);
        if (_ui()) {
          _ui().navigate('game', { force: true });
          _ui().resetGameView();
        }
        if (_audio()) _audio().play('gameStart');
      });

      state.socket.on('game:dealt', (data) => {
        console.log('Cards dealt:', data);
        // TODO: نمایش کارت‌ها (در ui.js باید یه تابع برای آنلاین بسازیم)
        if (_ui() && _ui().renderOnlineHand) {
          _ui().renderOnlineHand(data.cards);
        }
      });

      state.socket.on('game:error', (data) => {
        if (_ui()) _ui().showToast('خطا', data.error || 'خطای بازی', 'error');
      });

      state.socket.on('hokm:chosen', (data) => {
        console.log('Hokm chosen:', data.suit);
        if (_ui()) _ui().updateHokmDisplay(data.suit);
      });

      state.socket.on('card:played', (data) => {
        console.log('Card played:', data);
        if (_audio()) _audio().play('playCard');
      });

      state.socket.on('trick:won', (data) => {
        console.log('Trick won:', data);
        if (_audio()) _audio().play('winTrick');
      });

      state.socket.on('turn:changed', (data) => {
        console.log('Turn changed to seat:', data.turnSeat);
      });

      state.socket.on('game:ended', (data) => {
        console.log('Game ended:', data);
        if (_ui()) _ui().showToast('پایان بازی', 'برنده تیم ' + data.winnerTeam, 'info', 5000);
      });

      // ─── چت ───
      state.socket.on('chat:message', (data) => {
        console.log('Chat:', data);
        // TODO: نمایش چت در UI
      });
    },

    /* ─────────────────────────────────────────────
       رندر اتاق
       ───────────────────────────────────────────── */
    renderRoom() {
      if (!state.room) return;

      const container = document.querySelector('.online-container');
      if (!container) return;

      const isHost = state.isHost;
      const players = state.room.players || [];
      const maxPlayers = state.room.maxPlayers || 4;
      const roomCode = state.room.code;

      container.innerHTML = `
        <h2 class="screen-title">🌐 اتاق بازی</h2>
        
        <div class="tournament-card" style="margin-bottom: 16px;">
          <div style="text-align: center; padding: 20px 0;">
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">کد اتاق</div>
            <div style="font-family: var(--font-num); font-size: 32px; font-weight: 900; color: var(--accent); letter-spacing: 0.2em; margin: 8px 0;">
              ${roomCode}
            </div>
            <div style="font-size: 11px; color: var(--text-muted);">این کد رو به دوستات بده</div>
          </div>
        </div>

        <div class="panel" style="margin-bottom: 16px;">
          <div class="panel-header">
            <div class="panel-title">👥 بازیکنان (${players.length}/${maxPlayers})</div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${players.length === 0 ? '<p class="empty-msg">در انتظار بازیکنان...</p>' : ''}
            ${players.map(p => `
              <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--bg-elevated); border-radius: var(--radius-sm);">
                <span style="font-size: 20px;">${p.avatar || '👤'}</span>
                <span style="flex: 1; font-weight: 600;">${p.name}</span>
                ${p.ready ? '<span class="badge badge-success">آماده</span>' : '<span class="badge">در انتظار</span>'}
              </div>
            `).join('')}
          </div>
        </div>

        <div class="modal-actions" style="display: flex; flex-direction: column; gap: 10px;">
          ${isHost ? `
            <button class="btn btn-primary btn-large btn-block" id="btnStartOnlineGame" ${players.length < 2 ? 'disabled style="opacity:0.5;"' : ''}>
              🎮 شروع بازی (${players.length < 2 ? 'حداقل ۲ بازیکن' : 'آماده'})
            </button>
          ` : `
            <button class="btn btn-outline btn-large btn-block" id="btnToggleReady">
              ✋ اعلام آمادگی
            </button>
          `}
          <button class="btn btn-danger btn-block" id="btnLeaveRoom">
            ❌ خروج از اتاق
          </button>
        </div>
      `;

      // Bind دکمه‌ها
      const startBtn = document.getElementById('btnStartOnlineGame');
      if (startBtn && isHost) {
        startBtn.addEventListener('click', () => Online.startGame());
      }

      const readyBtn = document.getElementById('btnToggleReady');
      if (readyBtn && !isHost) {
        readyBtn.addEventListener('click', () => Online.setReady(true));
      }

      const leaveBtn = document.getElementById('btnLeaveRoom');
      if (leaveBtn) {
        leaveBtn.addEventListener('click', () => Online.leaveRoom());
      }
    },

    /* ─── رویدادها ─── */
    on(event, handler) {
      const entry = { event, handler };
      state.listeners.push(entry);
      return () => Online.off(event, handler);
    },

    off(event, handler) {
      state.listeners = state.listeners.filter(
        l => !(l.event === event && l.handler === handler)
      );
    },

    getState() {
      return {
        connected: state.connected,
        room: state.room,
        isHost: state.isHost
      };
    }
  };

  global.HokmOnline = Online;

  console.log(
    `%c🌐 Online module loaded (server: ${SERVER_URL})`,
    'color: #06d6a0; font-weight: bold;'
  );

})(typeof window !== 'undefined' ? window : globalThis);