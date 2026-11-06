/* ═══════════════════════════════════════════════════════════
   🌐 HOKM PRO v6.1.1 — online.js (نسخه دیباگ و ضدخطا)
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const SERVER_URL = 'https://hokm-1-1ikl.onrender.com';
  const USER_ID = 'guest_' + Math.random().toString(36).substr(2, 9);
  const SUIT_SYMBOLS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

  const state = {
    socket: null,
    connected: false,
    room: null,
    isHost: false
  };

  const Online = {

    connect() {
      if (state.socket && state.connected) return true;

      if (typeof io === 'undefined') {
        alert('کتابخانه Socket.io لود نشده!');
        return false;
      }

      console.log('⏳ در حال اتصال به سرور...');
      
      state.socket = io(SERVER_URL, {
        transports: ['websocket'],
        timeout: 60000
      });

      state.socket.on('connect', () => {
        state.connected = true;
        console.log('%c✅ متصل شد!', 'color: #06d6a0; font-weight: bold; font-size: 16px;');
        if (global.HokmUI) global.HokmUI.showToast('متصل شد', 'به سرور وصل شدی', 'success');
      });

      state.socket.on('disconnect', () => {
        state.connected = false;
        console.log('❌ قطع شد');
      });

      state.socket.on('connect_error', (err) => {
        console.error('❌ خطای اتصال:', err);
        if (global.HokmUI) global.HokmUI.showToast('خطا', 'اتصال برقرار نشد', 'error');
      });

      // بایند کردن رویدادها
      _bindEvents();
      return true;
    },

    createRoom() {
      if (!state.connected) {
        if (!Online.connect()) return;
        setTimeout(() => Online.createRoom(), 1500);
        return;
      }

      const profile = global.HokmProfile?.get() || { name: 'تو', avatar: '😎' };
      state.isHost = true;

      console.log('📤 ارسال درخواست ساخت اتاق...');
      
      state.socket.emit('room:create', {
        userId: USER_ID,
        name: profile.name || 'تو',
        avatar: profile.avatar || '😎'
      });

      if (global.HokmUI) global.HokmUI.showToast('در حال ساخت...', 'صبر کن', 'info');
    },

    joinRoom(code) {
      if (!state.connected) {
        if (!Online.connect()) return;
        setTimeout(() => Online.joinRoom(code), 1500);
        return;
      }

      const profile = global.HokmProfile?.get() || { name: 'تو', avatar: '😎' };
      
      console.log('📤 ارسال درخواست ورود به اتاق:', code);

      state.socket.emit('room:join', {
        code: code.toUpperCase(),
        userId: USER_ID,
        name: profile.name || 'تو',
        avatar: profile.avatar || '😎'
      });
    },

    leaveRoom() {
      if (state.socket) state.socket.emit('room:leave');
      state.room = null;
      state.isHost = false;
      if (global.HokmUI) global.HokmUI.navigate('online', { force: true });
    },

    startGame() {
      if (state.socket && state.connected && state.isHost) {
        state.socket.emit('game:start');
      }
    },

    setReady(ready) {
      if (state.socket && state.connected) {
        state.socket.emit('room:ready', { ready });
      }
    },

    setHokm(suit) {
      if (state.socket && state.connected) state.socket.emit('hokm:set', { suit });
    },

    playCard(card) {
      if (state.socket && state.connected) {
        state.socket.emit('card:play', { card: { suit: card.suit, rank: card.rank } });
      }
    },

    renderRoom() {
      if (!state.room) return;

      const container = document.querySelector('.online-container');
      if (!container) {
        console.error('❌ المان .online-container پیدا نشد!');
        return;
      }

      console.log('%c🎨 رندر کردن اتاق در صفحه...', 'color: #ffd60a;');

      const isHost = state.isHost;
      const players = state.room.players || [];
      const maxPlayers = state.room.maxPlayers || 4;
      const roomCode = state.room.code;

      container.innerHTML = `
        <h2 class="screen-title">🌐 اتاق بازی</h2>
        
        <div style="text-align: center; padding: 24px; background: var(--bg-surface); border: 2px solid var(--accent); border-radius: var(--radius-lg); margin-bottom: 16px;">
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">کد اتاق</div>
          <div style="font-family: var(--font-num); font-size: 40px; font-weight: 900; color: var(--accent); letter-spacing: 0.2em; margin: 8px 0; text-shadow: 0 0 20px var(--accent-glow);">
            ${roomCode}
          </div>
          <div style="font-size: 11px; color: var(--text-muted);">این کد رو به دوستات بده</div>
        </div>

        <div class="panel" style="margin-bottom: 16px;">
          <div class="panel-header">
            <div class="panel-title">👥 بازیکنان (${players.length}/${maxPlayers})</div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${players.map(p => `
              <div style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--bg-elevated); border-radius: var(--radius-sm);">
                <span style="font-size: 22px;">${p.avatar || '👤'}</span>
                <span style="flex: 1; font-weight: 600;">${p.name}</span>
                ${p.ready ? '<span style="color: #06d6a0; font-size: 11px;">✓ آماده</span>' : '<span style="color: #ffd60a; font-size: 11px;">⏳ در انتظار</span>'}
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
            <button class="btn btn-outline btn-large btn-block" id="btnToggleReady">✋ اعلام آمادگی</button>
          `}
          <button class="btn btn-danger btn-block" id="btnLeaveRoom">❌ خروج از اتاق</button>
        </div>
      `;

      const startBtn = document.getElementById('btnStartOnlineGame');
      if (startBtn) startBtn.onclick = () => Online.startGame();
      const readyBtn = document.getElementById('btnToggleReady');
      if (readyBtn) readyBtn.onclick = () => Online.setReady(true);
      const leaveBtn = document.getElementById('btnLeaveRoom');
      if (leaveBtn) leaveBtn.onclick = () => Online.leaveRoom();
    },

    getState() {
      return { connected: state.connected, room: state.room, isHost: state.isHost };
    }
  };

  function _bindEvents() {
    if (!state.socket) return;

    state.socket.on('room:created', (data) => {
      console.log('%c🏠 پاسخ سرور (ساخت اتاق):', 'color: #06d6a0; font-weight: bold;', data);
      state.room = data.room;
      state.isHost = true;
      Online.renderRoom();
    });

    state.socket.on('room:joined', (data) => {
      console.log('%c🚪 پاسخ سرور (ورود به اتاق):', 'color: #06d6a0; font-weight: bold;', data);
      state.room = data.room;
      state.isHost = false;
      Online.renderRoom();
    });

    state.socket.on('room:error', (data) => {
      console.error('❌ خطای اتاق:', data.error);
      if (global.HokmUI) global.HokmUI.showToast('خطا', data.error, 'error');
    });

    state.socket.on('room:playerJoined', (data) => {
      if (state.room) {
        state.room.players = data.players;
        Online.renderRoom();
      }
    });

    state.socket.on('room:playerLeft', (data) => {
      if (state.room) {
        state.room.players = data.players;
        Online.renderRoom();
      }
    });
    
    // ... (بقیه رویدادهای بازی مثل game:started، game:dealt و غیره مثل قبله)
  }

  global.HokmOnline = Online;
  console.log(`%c🌐 ماژول آنلاین آماده است.`, 'color: #06d6a0;');
})(typeof window !== 'undefined' ? window : globalThis);