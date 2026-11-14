/* ═══════════════════════════════════════════════════════════
   🌐 HOKM PRO v6.2.0 — online.js
   بازی آنلاین چندنفره با Socket.io
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // 🎯 آدرس سرور آنلاین
  const ONLINE_SERVER = 'https://hokm-1-1ikl.onrender.com';

  const state = {
    socket: null,
    roomCode: null,
    mySeat: null,
    myUserId: null,
    isHost: false,
    players: [],
    connected: false,
    myCards: [],
    currentTurnSeat: null,
    hokm: null,
    isMyTurn: false
  };

  function _ui() { return global.HokmUI; }
  function _profile() { return global.HokmProfile; }
  function _audio() { return global.HokmAudio; }

  function _toast(title, msg, type) {
    if (_ui() && typeof _ui().showToast === 'function') {
      _ui().showToast(title, msg, type || 'info');
    } else {
      console.log(`[Online] ${title}: ${msg}`);
    }
  }

  function _toPersianNumber(n) {
    const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(n).replace(/\d/g, d => fa[+d]);
  }

  const Online = {

    init() {
      if (typeof io === 'undefined') {
        console.warn('[Online] socket.io not loaded');
        _toast('خطا', 'کتابخانه Socket.io لود نشده', 'error');
        return;
      }

      try {
        state.socket = io(ONLINE_SERVER, {
          transports: ['websocket', 'polling'],
          timeout: 30000,
          reconnection: true,
          reconnectionAttempts: 5
        });

        this._bindSocketEvents();
        this._bindUIEvents();

        console.log('%c🌐 Online initialized', 'color: #06d6a0; font-weight: bold;');
      } catch (e) {
        console.error('[Online] Init error:', e);
      }
    },

    _bindSocketEvents() {
      const s = state.socket;

      s.on('connect', () => {
        console.log('%c✅ Connected to online server', 'color: #06d6a0; font-weight: bold;');
        state.connected = true;
        _toast('🌐 متصل شد', 'به سرور آنلاین وصل شدی', 'success', 2000);
      });

      s.on('disconnect', () => {
        console.warn('[Online] Disconnected');
        state.connected = false;
      });

      s.on('connect_error', (err) => {
        console.warn('[Online] Connect error:', err.message);
        _toast('خطا', 'ارتباط با سرور برقرار نشد. صبر کن و دوباره تلاش کن.', 'error', 5000);
      });

      s.on('hello', (data) => {
        console.log('[Online] Server hello:', data);
      });

      // ─── اتاق: ساخت ───
      s.on('room:created', (data) => {
        state.roomCode = data.room.code;
        state.isHost = true;
        state.players = data.room.players;
        state.myUserId = data.room.players.find(p => !p.isAI && p.userId === state.myUserId)?.userId ||
                          (_profile() ? _profile().get().userId : null) ||
                          data.room.players[data.room.players.length - 1]?.userId;
        _toast('✅ اتاق ساخته شد', 'کد اتاق: ' + data.room.code, 'success');
        Online.showRoomModal(data.room);
        if (_audio()) _audio().play('success');
      });

      // ─── اتاق: ورود ───
      s.on('room:joined', (data) => {
        state.roomCode = data.room.code;
        state.isHost = false;
        state.players = data.room.players;
        _toast('✅ وارد اتاق شدی', 'کد اتاق: ' + data.room.code, 'success');
        Online.showRoomModal(data.room);
        if (_audio()) _audio().play('success');
      });

      s.on('room:playerJoined', (data) => {
        state.players = data.players;
        _toast('👋 بازیکن جدید', data.name + ' وارد اتاق شد', 'info', 2500);
        Online.refreshPlayersList(data.players);
        if (_audio()) _audio().play('notification');
      });

      s.on('room:playerLeft', (data) => {
        state.players = data.players;
        _toast('👋 بازیکن رفت', 'یک بازیکن اتاق را ترک کرد', 'info', 2500);
        Online.refreshPlayersList(data.players);
      });

      s.on('room:update', (data) => {
        state.players = data.room.players;
        Online.refreshPlayersList(data.room.players);
      });

      s.on('room:error', (data) => {
        _toast('خطا', data.error || 'خطای اتاق', 'error');
      });

      s.on('game:error', (data) => {
        _toast('خطا', data.error || 'خطای بازی', 'error');
      });

      // ─── بازی: شروع ───
      s.on('game:started', (data) => {
        console.log('[Online] Game started:', data);
        state.hokm = data.hokm;
        state.currentTurnSeat = data.turnSeat;
        _toast('🎮 بازی شروع شد!', 'حکم: ' + data.hokm, 'success', 3000);

        // بستن مودال اتاق
        if (_ui()) _ui().closeModal();

        // نمایش صفحه بازی
        Online._setupOnlineGameView(data.room, data.hokm, data.turnSeat);
      });

      // ─── کارت‌های من ───
      s.on('game:dealt', (data) => {
        console.log('[Online] Cards dealt:', data.cards.length);
        state.myCards = data.cards;
        state.mySeat = data.mySeat;
        state.currentTurnSeat = data.turnSeat;
        state.hokm = data.hokm;

        Online._renderMyCards();
        Online._updateTurnDisplay(data.turnSeat);
      });

      // ─── کارت بازی شد ───
      s.on('card:played', (data) => {
        console.log('[Online] Card played:', data);
        Online._renderPlayedCard(data.seat, data.card);
        if (_audio()) _audio().play('playCard');
      });

      // ─── برنده دور ───
      s.on('trick:won', (data) => {
        console.log('[Online] Trick won:', data);
        Online._updateScores(data.scores);
        _toast('🏆 برنده دور', 'تیم ' + (data.winnerTeam === 'A' ? 'ما' : 'حریف'), 'info', 2500);

        setTimeout(() => {
          Online._clearTrickCards();
        }, 1500);
      });

      // ─── دور جدید ───
      s.on('trick:new', (data) => {
        state.currentTurnSeat = data.turnSeat;
        Online._clearTrickCards();
        Online._updateScores(data.scores);
        Online._updateTurnDisplay(data.turnSeat);
      });

      // ─── نوبت عوض شد ───
      s.on('turn:changed', (data) => {
        state.currentTurnSeat = data.turnSeat;
        Online._updateTurnDisplay(data.turnSeat);
        Online._updateMyCardsPlayability();
      });

      // ─── پایان بازی ───
      s.on('game:ended', (data) => {
        console.log('[Online] Game ended:', data);
        const win = data.winnerTeam === 'A';
        _toast(
          win ? '🏆 بردی!' : '💔 باختی',
          'نتیجه: ' + data.scores.A + ' - ' + data.scores.B,
          win ? 'success' : 'error',
          8000
        );

        setTimeout(() => {
          if (_ui()) {
            _ui().openModal(`
              <h2 class="modal-title" style="text-align:center;">${win ? '🏆 بردی!' : '💔 باختی'}</h2>
              <p style="text-align:center; font-size: 24px; font-family: var(--font-num); margin: 20px 0;">
                ${_toPersianNumber(data.scores.A)} - ${_toPersianNumber(data.scores.B)}
              </p>
              <button class="btn btn-primary btn-block" onclick="HokmUI.closeModal(); HokmUI.navigate('menu');">
                🏠 بازگشت به منو
              </button>
            `);
          }
        }, 2000);
      });

      // ─── چت اتاق ───
      s.on('chat:message', (data) => {
        _toast('💬 ' + data.name, data.text, 'info', 4000);
        if (_audio()) _audio().play('chat');
      });
    },

    _bindUIEvents() {
      // دکمه ساخت اتاق
      const createBtn = document.getElementById('btnCreateRoom');
      if (createBtn && !createBtn.dataset.bound) {
        createBtn.dataset.bound = '1';
        createBtn.addEventListener('click', () => {
          if (!state.socket) {
            _toast('خطا', 'اتصال به سرور برقرار نیست', 'error');
            return;
          }
          if (!state.connected) {
            _toast('صبر کن...', 'در حال اتصال به سرور', 'info');
            return;
          }

          const profile = _profile() ? _profile().get() : { name: 'بازیکن', avatar: '😎' };
          state.myUserId = profile.userId || 'guest_' + Date.now();

          state.socket.emit('room:create', {
            userId: state.myUserId,
            name: profile.name || 'بازیکن',
            avatar: profile.avatar || '😎'
          });

          _toast('⏳', 'در حال ساخت اتاق...', 'info', 2000);
        });
      }

      // دکمه ورود به اتاق
      const joinBtn = document.getElementById('btnJoinRoom');
      const roomInput = document.getElementById('roomCodeInput');
      if (joinBtn && roomInput && !joinBtn.dataset.bound) {
        joinBtn.dataset.bound = '1';

        const joinRoom = () => {
          const code = roomInput.value.trim().toUpperCase();
          if (!code || code.length !== 6) {
            _toast('خطا', 'کد اتاق باید ۶ کاراکتر باشد', 'error');
            return;
          }
          if (!state.socket || !state.connected) {
            _toast('خطا', 'اتصال به سرور برقرار نیست', 'error');
            return;
          }

          const profile = _profile() ? _profile().get() : { name: 'بازیکن', avatar: '😎' };
          state.myUserId = profile.userId || 'guest_' + Date.now();

          state.socket.emit('room:join', {
            code: code,
            userId: state.myUserId,
            name: profile.name || 'بازیکن',
            avatar: profile.avatar || '😎'
          });

          _toast('⏳', 'در حال ورود به اتاق...', 'info', 2000);
        };

        joinBtn.addEventListener('click', joinRoom);
        roomInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') joinRoom();
        });
      }
    },

    showRoomModal(room) {
      if (!_ui()) return;

      const isHost = state.isHost;
      const html = `
        <h3 class="modal-title" style="text-align: center;">🎉 اتاق ${room.code}</h3>
        <p style="text-align: center; color: var(--text-secondary); font-size: 13px; margin: 12px 0;">
          این کد را با دوستانت به اشتراک بگذار
        </p>

        <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 16px;">
          <div style="font-size: 42px; font-weight: 900; letter-spacing: 0.3em; color: var(--accent); font-family: var(--font-num);">
            ${room.code}
          </div>
          <button class="btn btn-outline" style="margin-top: 12px; font-size: 12px;"
                  onclick="navigator.clipboard.writeText('${room.code}'); HokmUI.showToast('کپی شد', 'کد اتاق کپی شد', 'success')">
            📋 کپی کد
          </button>
        </div>

        <h4 style="font-size: 14px; margin-bottom: 8px; display: flex; justify-content: space-between;">
          <span>بازیکنان</span>
          <span style="color: var(--accent);">${_toPersianNumber(room.players.length)}/${_toPersianNumber(room.maxPlayers)}</span>
        </h4>
        <div id="roomPlayersList" style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto;">
          ${room.players.map(p => `
            <div style="padding: 10px 14px; background: var(--bg-elevated); border-radius: 10px; display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">${p.avatar || '👤'}</span>
              <span style="font-weight: 700; flex: 1;">${p.name}</span>
              ${p.userId === room.hostId ? '<span class="badge badge-accent" style="font-size: 10px;">میزبان</span>' : ''}
            </div>
          `).join('')}
        </div>

        <div class="modal-actions" style="margin-top: 20px; display: flex; gap: 10px;">
          <button class="btn btn-ghost" onclick="HokmOnline.leaveRoom()" style="flex: 1;">
            ❌ خروج
          </button>
          ${isHost ? `
            <button class="btn btn-primary" onclick="HokmOnline.startGame()" style="flex: 1;">
              🎮 شروع بازی
            </button>
          ` : `
            <div style="flex: 1; text-align: center; padding: 12px; color: var(--text-muted); font-size: 12px;">
              منتظر میزبان...
            </div>
          `}
        </div>
      `;

      _ui().openModal(html, { dismissible: false });
    },

    refreshPlayersList(players) {
      const list = document.getElementById('roomPlayersList');
      if (!list) return;

      list.innerHTML = players.map(p => `
        <div style="padding: 10px 14px; background: var(--bg-elevated); border-radius: 10px; display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 24px;">${p.avatar || '👤'}</span>
          <span style="font-weight: 700; flex: 1;">${p.name}</span>
          ${p.team === 'A' ? '<span class="badge" style="background: var(--color-success); font-size: 10px;">تیم ما</span>' : '<span class="badge" style="background: var(--color-danger); font-size: 10px;">حریف</span>'}
        </div>
      `).join('');
    },

    startGame() {
      if (!state.socket || !state.connected) {
        _toast('خطا', 'اتصال به سرور برقرار نیست', 'error');
        return;
      }
      if (state.players.length < 2) {
        _toast('خطا', 'حداقل ۲ بازیکن نیاز است', 'warning');
        return;
      }
      state.socket.emit('game:start');
    },

    leaveRoom() {
      if (state.socket) {
        state.socket.emit('room:leave');
      }
      state.roomCode = null;
      state.isHost = false;
      state.myCards = [];
      state.currentTurnSeat = null;
      if (_ui()) _ui().closeModal();
      _toast('👋', 'از اتاق خارج شدی', 'info');
    },

    // ─── نمایش بازی آنلاین ───
    _setupOnlineGameView(room, hokm, turnSeat) {
      if (!_ui()) return;

      _ui().navigate('game', { force: true });

      // تنظیم اطلاعات اولیه
      const state_game = {
        players: room.players.map(p => ({
          name: p.name,
          avatar: p.avatar,
          hand: [],
          isAI: false,
          team: p.team,
          seat: p.seat
        })),
        hokm: hokm,
        currentPlayer: turnSeat,
        scores: { A: 0, B: 0 },
        trick: [],
        trickCount: 0,
        phase: 'playing'
      };

      // رندر صندلی‌ها
      const seatMap = { 0: 'Bottom', 1: 'Left', 2: 'Top', 3: 'Right' };
      state_game.players.forEach((p, i) => {
        const pos = seatMap[i];
        if (!pos) return;
        const nameEl = document.getElementById('name' + pos);
        const avatarEl = document.getElementById('avatar' + pos);
        if (nameEl) nameEl.textContent = p.name;
        if (avatarEl) avatarEl.textContent = p.avatar || '👤';
      });

      // هایلایت نوبت
      Online._updateTurnDisplay(turnSeat);
    },

    _renderMyCards() {
      const hand = document.getElementById('playerHand');
      if (!hand) return;

      hand.innerHTML = state.myCards.map(card => {
        const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
        const symbolMap = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

        return `
          <div class="card-face ${isRed ? 'red' : ''}" data-card-id="${card.id}"
               onclick="HokmOnline.playCard('${card.id}')">
            <div class="card-corner top">
              <span class="card-rank">${card.symbol}</span>
            </div>
            <div class="card-suit">${symbolMap[card.suit]}</div>
            <div class="card-corner bottom">
              <span class="card-rank">${card.symbol}</span>
            </div>
          </div>
        `;
      }).join('');

      Online._updateMyCardsPlayability();
    },

    _updateMyCardsPlayability() {
      const isMyTurn = state.currentTurnSeat === state.mySeat;
      state.isMyTurn = isMyTurn;

      document.querySelectorAll('#playerHand .card-face').forEach(el => {
        if (isMyTurn) {
          el.classList.add('playable');
          el.style.pointerEvents = 'auto';
          el.style.cursor = 'pointer';
        } else {
          el.classList.remove('playable');
          el.style.pointerEvents = 'none';
          el.style.cursor = 'default';
          el.style.opacity = '0.7';
        }
      });

      if (isMyTurn) {
        _toast('🎯 نوبت توئه!', 'یه کارت انتخاب کن', 'success', 2500);
        if (_audio()) _audio().play('turn');
      }
    },

    playCard(cardId) {
      if (!state.isMyTurn) {
        _toast('صبر کن', 'نوبت تو نیست', 'warning');
        return;
      }

      const card = state.myCards.find(c => c.id === cardId);
      if (!card) return;

      state.socket.emit('card:play', {
        card: { suit: card.suit, rank: card.rank }
      });

      // حذف از UI (بهینه - سرور هم تأیید می‌کنه)
      const idx = state.myCards.findIndex(c => c.id === cardId);
      if (idx !== -1) {
        state.myCards.splice(idx, 1);
        Online._renderMyCards();
      }
    },

    _renderPlayedCard(seat, card) {
      const seatPos = ['bottom', 'left', 'top', 'right'][seat];
      if (!seatPos) return;

      const center = document.getElementById('trickCenter');
      if (!center) return;

      const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
      const symbolMap = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

      const cardEl = document.createElement('div');
      cardEl.className = 'card-face' + (isRed ? ' red' : '');
      cardEl.dataset.pos = seatPos;
      cardEl.innerHTML = `
        <div class="card-corner top">
          <span class="card-rank">${card.symbol}</span>
        </div>
        <div class="card-suit">${symbolMap[card.suit]}</div>
        <div class="card-corner bottom">
          <span class="card-rank">${card.symbol}</span>
        </div>
      `;

      center.appendChild(cardEl);
    },

    _clearTrickCards() {
      const center = document.getElementById('trickCenter');
      if (center) center.innerHTML = '';
    },

    _updateTurnDisplay(seat) {
      state.currentTurnSeat = seat;
      const seatMap = { 0: 'Bottom', 1: 'Left', 2: 'Top', 3: 'Right' };

      ['Top', 'Left', 'Right', 'Bottom'].forEach(pos => {
        const el = document.getElementById('seat' + pos);
        if (el) el.classList.remove('active');
      });

      const activePos = seatMap[seat];
      if (activePos) {
        const el = document.getElementById('seat' + activePos);
        if (el) el.classList.add('active');
      }

      Online._updateMyCardsPlayability();
    },

    _updateScores(scores) {
      const a = document.getElementById('scoreA');
      const b = document.getElementById('scoreB');
      if (a) a.textContent = _toPersianNumber(scores.A);
      if (b) b.textContent = _toPersianNumber(scores.B);
    },

    // ─── چت آنلاین ───
    sendChatMessage(text) {
      if (!state.socket || !state.connected || !text) return;
      state.socket.emit('chat:send', { text: text.trim() });
    }
  };

  global.HokmOnline = Online;

  // راه‌اندازی
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(() => Online.init(), 1200));
    } else {
      setTimeout(() => Online.init(), 1200);
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);