/* ═══════════════════════════════════════════════════════════
   🌐 HOKM PRO v6.1.1 — online.js
   ساخت اتاق و ورود (نسخه ساده و بدون تکرار)
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // 🎯 آدرس سرور
  const SERVER_URL = 'https://hokm-1-1ikl.onrender.com';
  
  // یه آیدی ثابت برای این نشست
  const USER_ID = 'guest_' + Math.random().toString(36).substr(2, 9);

  const state = {
    socket: null,
    connected: false,
    room: null,
    isHost: false
  };

  // ابزار دیباگ روی صفحه (برای اینکه ببینی چه خبره)
  function showDebug(msg, color = '#0f0') {
    let box = document.getElementById('onlineDebugBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'onlineDebugBox';
      box.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,0.9);color:#fff;font-family:monospace;font-size:11px;padding:10px;z-index:999999;max-height:120px;overflow-y:auto;direction:ltr;text-align:left;';
      
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = 'position:absolute;top:5px;right:5px;background:red;color:white;border:none;padding:2px 6px;border-radius:3px;';
      closeBtn.onclick = () => box.style.display = 'none';
      
      const content = document.createElement('div');
      content.id = 'onlineDebugContent';
      
      box.appendChild(closeBtn);
      box.appendChild(content);
      document.body.appendChild(box);
    }
    const content = document.getElementById('onlineDebugContent');
    content.innerHTML += `<div style="color:${color}; margin-top:4px;">> ${msg}</div>`;
    box.scrollTop = box.scrollHeight;
  }

  const Online = {

    connect() {
      if (state.socket && state.connected) return true;

      if (typeof io === 'undefined') {
        showDebug('خطا: Socket.io لود نشده!', '#f00');
        return false;
      }

      showDebug('در حال اتصال...', '#ffd60a');
      
      state.socket = io(SERVER_URL, {
        transports: ['websocket'],
        timeout: 60000
      });

      state.socket.on('connect', () => {
        state.connected = true;
        showDebug('✅ به سرور وصل شد!', '#0f0');
        if (global.HokmUI) global.HokmUI.showToast('متصل شد', 'به سرور وصل شدی', 'success');
      });

      state.socket.on('disconnect', () => {
        state.connected = false;
        showDebug('❌ از سرور قطع شد', '#f00');
      });

      state.socket.on('connect_error', (err) => {
        showDebug('❌ خطای اتصال: ' + err.message, '#f00');
        if (global.HokmUI) global.HokmUI.showToast('خطا', 'اتصال برقرار نشد', 'error');
      });

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

      showDebug('ارسال درخواست ساخت اتاق...', '#ffd60a');
      
      state.socket.emit('room:create', {
        userId: USER_ID,
        name: profile.name || 'تو',
        avatar: profile.avatar || '😎'
      });
    },

    joinRoom(code) {
      if (!state.connected) {
        if (!Online.connect()) return;
        setTimeout(() => Online.joinRoom(code), 1500);
        return;
      }

      const profile = global.HokmProfile?.get() || { name: 'تو', avatar: '😎' };
      
      showDebug('ارسال درخواست ورود: ' + code, '#ffd60a');

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

    renderRoom() {
      if (!state.room) return;

      const container = document.querySelector('.online-container');
      if (!container) {
        showDebug('❌ خطا: المان .online-container در HTML نیست!', '#f00');
        return;
      }

      showDebug('🎨 در حال رندر اتاق...', '#0f0');

      const isHost = state.isHost;
      const players = state.room.players || [];
      const roomCode = state.room.code;

      // 🎯 فقط ساخت اتاق و نمایش آن (بدون تکرار)
      container.innerHTML = `
        <h2 class="screen-title">🌐 اتاق بازی</h2>
        
        <div style="text-align: center; padding: 24px; background: var(--bg-surface); border: 2px solid var(--accent); border-radius: var(--radius-lg); margin-bottom: 16px;">
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">کد اتاق</div>
          <div style="font-family: var(--font-num); font-size: 40px; font-weight: 900; color: var(--accent); letter-spacing: 0.2em; margin: 8px 0;">
            ${roomCode}
          </div>
          <div style="font-size: 11px; color: var(--text-muted);">این کد رو به دوستات بده</div>
        </div>

        <div class="panel" style="margin-bottom: 16px;">
          <div class="panel-header">
            <div class="panel-title">👥 بازیکنان (${players.length}/4)</div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${players.map(p => `
              <div style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--bg-elevated); border-radius: var(--radius-sm);">
                <span style="font-size: 22px;">${p.avatar || '👤'}</span>
                <span style="flex: 1; font-weight: 600;">${p.name}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${isHost ? `
            <button class="btn btn-primary btn-large btn-block" id="btnStartOnlineGame" ${players.length < 2 ? 'disabled style="opacity:0.5;"' : ''}>
              🎮 شروع بازی
            </button>
          ` : `
            <button class="btn btn-outline btn-large btn-block" id="btnToggleReady">
              ✋ اعلام آمادگی
            </button>
          `}
          <button class="btn btn-danger btn-block" id="btnLeaveRoom">❌ خروج از اتاق</button>
        </div>
      `;

      // دکمه‌ها
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

    // ✅ پاسخ ساخت اتاق از سرور
    state.socket.on('room:created', (data) => {
      showDebug('🏠 اتاق ساخته شد! کد: ' + data.room.code, '#0f0');
      state.room = data.room;
      state.isHost = true;
      Online.renderRoom();
    });

    // ✅ پاسخ ورود به اتاق
    state.socket.on('room:joined', (data) => {
      showDebug('🚪 وارد اتاق شدی!', '#0f0');
      state.room = data.room;
      state.isHost = false;
      Online.renderRoom();
    });

    state.socket.on('room:error', (data) => {
      showDebug('❌ خطای اتاق: ' + data.error, '#f00');
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

    // ─── شروع بازی ───
    state.socket.on('game:started', (data) => {
      showDebug('🎮 بازی شروع شد!', '#ffd60a');
      if (state.room && data.room) state.room = data.room;
      if (global.HokmUI) {
        global.HokmUI.navigate('game', { force: true });
      }
    });

    // ─── کارت‌ها ───
    state.socket.on('game:dealt', (data) => {
      showDebug('🎴 کارت‌ها توزیع شد', '#118ab2');
      if (global.HokmUI) {
        global.HokmUI.navigate('game', { force: true });
        if (!global.HokmUI.state) global.HokmUI.state = {};
        global.HokmUI.state.isOnlineGame = true;
        global.HokmUI.state.onlineData = {
          mySeat: data.mySeat,
          currentTurnSeat: data.turnSeat,
          hokm: null,
          myCards: data.cards
        };
        global.HokmUI.renderOnlineHand(data.cards);
      }
    });
  }

  global.HokmOnline = Online;
  console.log(`%c🌐 ماژول آنلاین آماده است.`, 'color: #06d6a0;');
})(typeof window !== 'undefined' ? window : globalThis);