/* ═══════════════════════════════════════════════════════════
   🌐 HOKM PRO v6.1.1 — online.js
   نسخه کامل: اتاق، بازی، حکم، نوبت‌ها، همگام‌سازی
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // 🎯 آدرس سرور
  const SERVER_URL = 'https://hokm-1-1ikl.onrender.com';

  const state = {
    socket: null,
    connected: false,
    room: null,
    isHost: false,
    mySeat: 0,
    myCards: [],
    currentTurnSeat: 0,
    hokm: null,
    listeners: []
  };

  function _ui() { return global.HokmUI; }
  function _profile() { return global.HokmProfile; }
  function _audio() { return global.HokmAudio; }

  function _emit(event, data) {
    state.listeners.forEach(({ event: e, handler }) => {
      if (e === event || e === '*') {
        try { handler(data); } catch (err) { console.error(err); }
      }
    });
  }

  const SUIT_SYMBOLS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

  const Online = {

    /* ─────────────────────────────────────────────
       اتصال
       ───────────────────────────────────────────── */

    connect() {
      if (state.socket && state.connected) return true;

      if (typeof io === 'undefined') {
        if (_ui()) _ui().showToast('خطا', 'کتابخانه Socket.io لود نشد', 'error');
        return false;
      }

      try {
        if (_ui()) _ui().showToast('در حال اتصال...', 'کمی صبر کن', 'info', 3000);

        state.socket = io(SERVER_URL, {
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
          timeout: 60000
        });

        state.socket.on('connect', () => {
          state.connected = true;
          console.log('%c🌐 Connected to server', 'color: #06d6a0; font-weight: bold;');
          if (_ui()) _ui().showToast('متصل شد!', 'به سرور آنلاین وصل شدی', 'success', 2000);
          _emit('connected');
        });

        state.socket.on('disconnect', (reason) => {
          state.connected = false;
          console.log('%c🔌 Disconnected: ' + reason, 'color: #ef476f;');
          if (_ui()) _ui().showToast('قطع شد', 'اتصال به سرور قطع شد', 'warning');
          _emit('disconnected', { reason });
        });

        state.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          if (_ui()) _ui().showToast('خطا', 'اتصال برقرار نشد', 'error');
        });

        _bindSocketEvents();
        return true;

      } catch (err) {
        console.error('Socket init error:', err);
        return false;
      }
    },

    disconnect() {
      if (state.socket) {
        state.socket.disconnect();
        state.socket = null;
        state.connected = false;
        state.room = null;
      }
    },

    /* ─────────────────────────────────────────────
       اتاق
       ───────────────────────────────────────────── */

    createRoom() {
      if (!state.connected) {
        if (!Online.connect()) return;
        setTimeout(() => Online.createRoom(), 1500);
        return;
      }

      const profile = _profile()?.get() || { name: 'تو', avatar: '😎' };

      state.isHost = true;

      state.socket.emit('room:create', {
        userId: 'guest_' + Date.now(),
        name: profile.name || 'تو',
        avatar: profile.avatar || '😎'
      });

      if (_ui()) _ui().showToast('در حال ساخت اتاق...', '', 'info', 2000);
    },

    joinRoom(code) {
      if (!state.connected) {
        if (!Online.connect()) return;
        setTimeout(() => Online.joinRoom(code), 1500);
        return;
      }

      const profile = _profile()?.get() || { name: 'تو', avatar: '😎' };

      state.socket.emit('room:join', {
        code: code.toUpperCase(),
        userId: 'guest_' + Date.now(),
        name: profile.name || 'تو',
        avatar: profile.avatar || '😎'
      });
    },

    leaveRoom() {
      if (state.socket) state.socket.emit('room:leave');
      state.room = null;
      state.isHost = false;
      state.myCards = [];
      state.hokm = null;
      if (_ui()) _ui().navigate('online', { force: true });
    },

    setReady(ready) {
      if (state.socket && state.connected) {
        state.socket.emit('room:ready', { ready });
      }
    },

    startGame() {
      if (state.socket && state.connected && state.isHost) {
        state.socket.emit('game:start');
      }
    },

    /* ─────────────────────────────────────────────
       بازی
       ───────────────────────────────────────────── */

    setHokm(suit) {
      if (state.socket && state.connected) {
        state.socket.emit('hokm:set', { suit });
      }
    },

    playCard(card) {
      if (state.socket && state.connected) {
        state.socket.emit('card:play', { card: { suit: card.suit, rank: card.rank } });
      }
    },

    /* ─────────────────────────────────────────────
       رویدادهای Socket
       ───────────────────────────────────────────── */

    _bindSocketEvents() {
      if (!state.socket) return;

      // ─── اتاق ───
      state.socket.on('room:created', (data) => {
        console.log('%c🏠 Room created:', 'color: #06d6a0; font-weight: bold;', data);
        state.room = data.room;
        state.isHost = true;
        Online.renderRoom();
      });

      state.socket.on('room:joined', (data) => {
        console.log('%c🚪 Room joined:', 'color: #06d6a0; font-weight: bold;', data);
        state.room = data.room;
        state.isHost = false;
        Online.renderRoom();
      });

      state.socket.on('room:error', (data) => {
        console.error('Room error:', data.error);
        if (_ui()) _ui().showToast('خطا', data.error || 'خطای اتاق', 'error');
      });

      state.socket.on('room:playerJoined', (data) => {
        if (state.room) {
          state.room.players = data.players;
          Online.renderRoom();
        }
        if (_ui()) _ui().showToast('👥 بازیکن جدید', data.name + ' وارد اتاق شد', 'info', 2500);
      });

      state.socket.on('room:playerLeft', (data) => {
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

      // ─── بازی شروع شد ───
      state.socket.on('game:started', (data) => {
        console.log('%c🎮 Game started', 'color: #ffd60a; font-weight: bold;');
        if (state.room && data.room) state.room = data.room;
        if (_ui()) {
          _ui().navigate('game', { force: true });
          _ui().resetGameView();
        }
        if (_audio()) _audio().play('gameStart');
      });

      // ─── کارت‌ها توزیع شد ───
      state.socket.on('game:dealt', (data) => {
        console.log('%c🎴 Cards dealt:', 'color: #118ab2; font-weight: bold;', data);

        state.mySeat = data.mySeat;
        state.myCards = data.cards;
        state.currentTurnSeat = data.turnSeat;

        if (_ui()) {
          _ui().navigate('game', { force: true });

          // ذخیره state آنلاین
          if (!_ui().state) _ui().state = {};
          _ui().state.isOnlineGame = true;
          _ui().state.onlineData = {
            mySeat: data.mySeat,
            currentTurnSeat: data.turnSeat,
            hokm: null,
            myCards: data.cards
          };

          _ui().renderOnlineHand(data.cards);
          _ui().highlightCurrentPlayer(data.turnSeat);

          if (data.turnSeat === data.mySeat) {
            _ui().showToast('🎯 نوبت توئه!', 'یه خال رو انتخاب کن', 'info', 3000);
            _ui().showHokmPicker();
          }
        }
      });

      state.socket.on('game:error', (data) => {
        console.warn('Game error:', data.error);
        if (_ui()) _ui().showToast('خطا', data.error || 'خطای بازی', 'error');
      });

      // ─── حکم انتخاب شد ───
      state.socket.on('hokm:chosen', (data) => {
        console.log('%c👑 Hokm chosen:', 'color: #ffd60a; font-weight: bold;', data.suit);
        state.hokm = data.suit;

        if (_ui()) {
          _ui().updateHokmDisplay(data.suit);
          _ui().hideHokmPicker();

          if (_ui().state && _ui().state.onlineData) {
            _ui().state.onlineData.hokm = data.suit;
          }

          _ui().showToast('👑 حکم', SUIT_SYMBOLS[data.suit], 'success', 2500);
        }
      });

      // ─── کارت بازی شد ───
      state.socket.on('card:played', (data) => {
        console.log('%c🎴 Card played:', 'color: #118ab2;', data);

        if (_audio()) _audio().play('playCard');

        // حذف کارت بازی‌شده از دست ما (اگه ما بودیم)
        if (data.userId === state.room?.players?.find(p => p.sid === state.socket.id)?.userId) {
          // TODO
        }

        // رندر کارت‌های روی میز
        if (_ui() && _ui().state && _ui().state.isOnlineGame) {
          _renderOnlineTrick(data.trick);
        }
      });

      // ─── دور برده شد ───
      state.socket.on('trick:won', (data) => {
        console.log('%c🏆 Trick won:', 'color: #06d6a0; font-weight: bold;', data);

        if (_audio()) _audio().play('winTrick');

        if (_ui()) {
          _ui().updateScores(data.scores, 0);
          _ui().showToast('🏆 برنده دور', 'تیم ' + data.winnerTeam, 'success', 2000);
        }

        // پاک کردن میز بعد از ۱.۵ ثانیه
        setTimeout(() => {
          if (_ui()) {
            const center = document.getElementById('trickCenter');
            if (center) center.innerHTML = '';
          }
        }, 1500);
      });

      // ─── نوبت عوض شد ───
      state.socket.on('turn:changed', (data) => {
        console.log('%c⏱️ Turn changed:', 'color: #ffd60a;', data.turnSeat);
        state.currentTurnSeat = data.turnSeat;

        if (_ui() && _ui().state && _ui().state.onlineData) {
          _ui().state.onlineData.currentTurnSeat = data.turnSeat;
          _ui().highlightCurrentPlayer(data.turnSeat);
          _ui().renderOnlineHand(_ui().state.onlineData.myCards);

          if (data.turnSeat === _ui().state.onlineData.mySeat) {
            _ui().showToast('🎯 نوبت توئه', 'یک کارت انتخاب کن', 'info', 2000);
          }
        }
      });

      // ─── دور جدید ───
      state.socket.on('trick:new', (data) => {
        console.log('%c🔄 New trick', 'color: #118ab2;', data);
        state.currentTurnSeat = data.turnSeat;

        if (_ui() && _ui().state && _ui().state.onlineData) {
          _ui().state.onlineData.currentTurnSeat = data.turnSeat;
          _ui().highlightCurrentPlayer(data.turnSeat);
          _ui().renderOnlineHand(_ui().state.onlineData.myCards);

          const center = document.getElementById('trickCenter');
          if (center) center.innerHTML = '';
        }
      });

      // ─── بازی تمام شد ───
      state.socket.on('game:ended', (data) => {
        console.log('%c🏁 Game ended:', 'color: #ffd60a; font-weight: bold;', data);

        if (_audio()) _audio().play('win');

        if (_ui()) {
          _ui().openModal(`
            <div style="text-align: center;">
              <div style="font-size: 72px; margin-bottom: 12px;">🏆</div>
              <h2 class="modal-title">پایان بازی</h2>
              <p style="margin: 16px 0; color: var(--text-secondary);">
                برنده: تیم <strong style="color: var(--accent);">${data.winnerTeam}</strong>
              </p>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0;">
                <div class="stat-card">
                  <div class="stat-value">${data.scores.A}</div>
                  <div class="stat-label">تیم A</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">${data.scores.B}</div>
                  <div class="stat-label">تیم B</div>
                </div>
              </div>
              <button class="btn btn-primary btn-block" onclick="HokmUI.closeModal(); HokmOnline.leaveRoom();">
                🏠 بازگشت به منو
              </button>
            </div>
          `, { dismissible: false });
        }
      });

      // ─── چت ───
      state.socket.on('chat:message', (data) => {
        console.log('Chat:', data);
      });
    },

    /* ─────────────────────────────────────────────
       رندر اتاق
       ───────────────────────────────────────────── */

    renderRoom() {
      if (!state.room) return;

      const container = document.querySelector('.online-container');
      if (!container) {
        console.error('❌ .online-container پیدا نشد');
        return;
      }

      const isHost = state.isHost;
      const players = state.room.players || [];
      const maxPlayers = state.room.maxPlayers || 4;
      const roomCode = state.room.code;

      container.innerHTML = `
        <h2 class="screen-title">🌐 اتاق بازی</h2>
        
        <div style="
          text-align: center;
          padding: 24px;
          background: var(--bg-surface);
          border: 2px solid var(--accent);
          border-radius: var(--radius-lg);
          margin-bottom: 16px;
        ">
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">کد اتاق</div>
          <div style="
            font-family: var(--font-num);
            font-size: 40px;
            font-weight: 900;
            color: var(--accent);
            letter-spacing: 0.2em;
            margin: 8px 0;
            text-shadow: 0 0 20px var(--accent-glow);
          ">
            ${roomCode}
          </div>
          <div style="font-size: 11px; color: var(--text-muted);">این کد رو به دوستات بده</div>
        </div>

        <div class="panel" style="margin-bottom: 16px;">
          <div class="panel-header">
            <div class="panel-title">👥 بازیکنان (${players.length}/${maxPlayers})</div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${players.length === 0 ? '<p class="empty-msg">در انتظار بازیکنان...</p>' : ''}
            ${players.map(p => `
              <div style="
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 12px;
                background: var(--bg-elevated);
                border-radius: var(--radius-sm);
              ">
                <span style="font-size: 22px;">${p.avatar || '👤'}</span>
                <span style="flex: 1; font-weight: 600;">${p.name}</span>
                ${p.ready ? '<span style="color: #06d6a0; font-size: 11px; font-weight: 700;">✓ آماده</span>' : '<span style="color: #ffd60a; font-size: 11px; font-weight: 700;">⏳ در انتظار</span>'}
              </div>
            `).join('')}
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${isHost ? `
            <button class="btn btn-primary btn-large btn-block" id="btnStartOnlineGame" ${players.length < 2 ? 'disabled style="opacity:0.5;"' : ''}>
              🎮 شروع بازی (${players.length < 2 ? 'حداقل ۲ بازیکن' : 'آماده'})
            </button>
          ` : `
            <button class="btn btn-outline btn-large btn-block" id="btnToggleReady">
              ✋ اعلام آمادگی
            </button>
          `}
          <button class="btn btn-danger btn-block" id="btnLeaveRoom">❌ خروج از اتاق</button>
        </div>
      `;

      // Bind
      const startBtn = document.getElementById('btnStartOnlineGame');
      if (startBtn) startBtn.addEventListener('click', () => Online.startGame());

      const readyBtn = document.getElementById('btnToggleReady');
      if (readyBtn) readyBtn.addEventListener('click', () => Online.setReady(true));

      const leaveBtn = document.getElementById('btnLeaveRoom');
      if (leaveBtn) leaveBtn.addEventListener('click', () => Online.leaveRoom());
    },

    /* ─── رویدادها ─── */
    on(event, handler) {
      const entry = { event, handler };
      state.listeners.push(entry);
      return () => Online.off(event, handler);
    },

    off(event, handler) {
      state.listeners = state.listeners.filter(l => !(l.event === event && l.handler === handler));
    },

    getState() {
      return {
        connected: state.connected,
        room: state.room,
        isHost: state.isHost,
        mySeat: state.mySeat,
        currentTurnSeat: state.currentTurnSeat,
        hokm: state.hokm
      };
    }
  };

  /* ─────────────────────────────────────────────
     رندر کارت‌های روی میز (آنلاین)
     ───────────────────────────────────────────── */
  function _renderOnlineTrick(trick) {
    const center = document.getElementById('trickCenter');
    if (!center) return;

    center.innerHTML = '';
    const positionMap = ['bottom', 'left', 'top', 'right'];

    trick.forEach((entry) => {
      const card = entry.card;
      const pos = positionMap[entry.seat] || 'bottom';

      const el = document.createElement('div');
      el.className = 'card-face';
      el.dataset.pos = pos;
      el.innerHTML = `
        <div class="card-corner top">
          <span class="card-rank">${card.rank === 11 ? 'J' : card.rank === 12 ? 'Q' : card.rank === 13 ? 'K' : card.rank === 14 ? 'A' : card.rank}</span>
        </div>
        <div class="card-suit">${SUIT_SYMBOLS[card.suit]}</div>
        <div class="card-corner bottom">
          <span class="card-rank">${card.rank === 11 ? 'J' : card.rank === 12 ? 'Q' : card.rank === 13 ? 'K' : card.rank === 14 ? 'A' : card.rank}</span>
        </div>
      `;

      if (card.suit === 'hearts' || card.suit === 'diamonds') {
        el.classList.add('red');
      }

      center.appendChild(el);
    });
  }

  global.HokmOnline = Online;

  console.log(
    `%c🌐 Online module loaded (server: ${SERVER_URL})`,
    'color: #06d6a0; font-weight: bold;'
  );

})(typeof window !== 'undefined' ? window : globalThis);