/* ═══════════════════════════════════════════════════════════
   🧪 تست سرور بازی آنلاین
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let socket = null;
  let myRoom = null;
  let myUserId = 'test_' + Math.random().toString(36).slice(2, 8);

  // ─── لاگ ───
  const logEl = document.getElementById('log');
  const logHistory = [];

  function log(type, message, data) {
    const time = new Date().toLocaleTimeString('fa-IR');
    const icon = {
      ok: '✅',
      err: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      event: '📡'
    }[type] || '•';

    const line = document.createElement('div');
    line.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-${type}">${icon} ${message}</span>`;
    logEl.appendChild(line);

    if (data !== undefined) {
      const dataLine = document.createElement('div');
      dataLine.style.cssText = 'padding-right: 20px; color: #6b7280; font-size: 11px;';
      dataLine.textContent = '   └─ ' + JSON.stringify(data, null, 2).replace(/\n/g, '\n   ');
      logEl.appendChild(dataLine);
    }

    logEl.scrollTop = logEl.scrollHeight;
    logHistory.push(`[${time}] ${icon} ${message}`);
  }

  function updateStatus(status, text) {
    const el = document.getElementById('connectionStatus');
    el.className = 'status ' + status;
    el.textContent = text;
  }

  // ─── اتصال ───
  document.getElementById('btnConnect').addEventListener('click', () => {
    const url = document.getElementById('serverUrl').value.trim();
    if (!url) {
      log('err', 'آدرس سرور خالی است');
      return;
    }

    if (typeof io === 'undefined') {
      log('err', 'کتابخانه Socket.io لود نشده!');
      return;
    }

    log('info', 'اتصال به: ' + url);
    updateStatus('wait', 'در حال اتصال...');

    socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3,
      timeout: 15000
    });

    // ─── رویدادهای Socket ───
    socket.on('connect', () => {
      log('ok', 'متصل شد! Socket ID: ' + socket.id);
      updateStatus('ok', 'متصل ✅');
      document.getElementById('btnConnect').disabled = true;
      document.getElementById('btnDisconnect').disabled = false;
      document.getElementById('btnCreateRoom').disabled = false;
      document.getElementById('btnJoinRoom').disabled = false;
    });

    socket.on('connect_error', (err) => {
      log('err', 'خطای اتصال: ' + err.message);
      updateStatus('err', 'خطا در اتصال');
    });

    socket.on('disconnect', (reason) => {
      log('warn', 'قطع شد: ' + reason);
      updateStatus('err', 'قطع شد');
      document.getElementById('btnConnect').disabled = false;
      document.getElementById('btnDisconnect').disabled = true;
      document.getElementById('btnCreateRoom').disabled = true;
      document.getElementById('btnJoinRoom').disabled = true;
    });

    socket.on('hello', (data) => {
      log('ok', 'سلام از سرور:', data);
    });

    socket.on('room:created', (data) => {
      log('ok', 'room:created دریافت شد', data);
      myRoom = data.room;
      document.getElementById('myRoomCode').textContent = myRoom.code;
      renderPlayers(myRoom.players);
    });

    socket.on('room:joined', (data) => {
      log('ok', 'room:joined دریافت شد', data);
      myRoom = data.room;
      document.getElementById('myRoomCode').textContent = myRoom.code;
      renderPlayers(myRoom.players);
    });

    socket.on('room:update', (data) => {
      log('event', 'room:update (آپدیت بازیکنان)', data.room.players.length + ' بازیکن');
      myRoom = data.room;
      renderPlayers(myRoom.players);
    });

    socket.on('room:playerJoined', (data) => {
      log('ok', 'بازیکن جدید وارد شد: ' + data.name);
      if (data.players) {
        myRoom.players = data.players;
        renderPlayers(myRoom.players);
      }
    });

    socket.on('room:playerLeft', (data) => {
      log('warn', 'بازیکن خارج شد');
      if (data.players) {
        myRoom.players = data.players;
        renderPlayers(myRoom.players);
      }
    });

    socket.on('room:error', (data) => {
      log('err', 'room:error: ' + data.error);
    });

    socket.on('game:error', (data) => {
      log('err', 'game:error: ' + data.error);
    });

    socket.on('game:started', (data) => {
      log('ok', 'بازی شروع شد!', data);
    });

    socket.on('game:dealt', (data) => {
      log('ok', 'کارت‌ها توزیع شد');
    });

    // لاگ همه رویدادها
    socket.onAny((event, ...args) => {
      if (!['connect', 'disconnect', 'connect_error'].includes(event)) {
        log('event', '🔔 رویداد: ' + event, args[0]);
      }
    });
  });

  // ─── قطع ───
  document.getElementById('btnDisconnect').addEventListener('click', () => {
    if (socket) {
      socket.disconnect();
      socket = null;
      log('info', 'قطع شد');
      updateStatus('wait', 'قطع شده');
      document.getElementById('btnConnect').disabled = false;
      document.getElementById('btnDisconnect').disabled = true;
      document.getElementById('btnCreateRoom').disabled = true;
      document.getElementById('btnJoinRoom').disabled = true;
    }
  });

  // ─── ساخت اتاق ───
  document.getElementById('btnCreateRoom').addEventListener('click', () => {
    const name = document.getElementById('playerName').value.trim() || 'میزبان تست';
    if (!socket || !socket.connected) {
      log('err', 'اول باید متصل بشی');
      return;
    }
    log('info', 'درخواست ساخت اتاق...');
    socket.emit('room:create', {
      userId: myUserId,
      name: name,
      avatar: '😎'
    });
  });

  // ─── ورود به اتاق ───
  document.getElementById('btnJoinRoom').addEventListener('click', () => {
    const name = document.getElementById('joinName').value.trim() || 'مهمان تست';
    const code = document.getElementById('joinCode').value.trim().toUpperCase();
    if (!socket || !socket.connected) {
      log('err', 'اول باید متصل بشی');
      return;
    }
    if (!code || code.length !== 6) {
      log('err', 'کد اتاق باید ۶ کاراکتر باشه');
      return;
    }
    log('info', 'درخواست ورود به اتاق ' + code);
    socket.emit('room:join', {
      code: code,
      userId: myUserId,
      name: name,
      avatar: '🧑'
    });
  });

  // ─── پاک کردن لاگ ───
  document.getElementById('btnClearLog').addEventListener('click', () => {
    logEl.innerHTML = '';
  });

  // ─── رندر بازیکنان ───
  function renderPlayers(players) {
    const el = document.getElementById('playersList');
    if (!players || players.length === 0) {
      el.innerHTML = 'هنوز بازیکنی نیست';
      return;
    }
    el.innerHTML = players.map(p => `
      <div style="padding: 6px 10px; background: #0d1b2a; border-radius: 6px; margin-bottom: 4px; display: flex; justify-content: space-between;">
        <span>${p.avatar || '👤'} ${p.name}</span>
        <span style="font-size: 10px; color: #6b7280;">${p.sid === myRoom?.hostId ? '👑 میزبان' : ''}</span>
      </div>
    `).join('');
  }

  // ─── لاگ اولیه ───
  log('info', 'صفحه تست آماده است. روی "اتصال" کلیک کن.');

  // نمایش socket.io ID
  if (typeof io !== 'undefined') {
    log('ok', 'کتابخانه Socket.io لود شد');
  } else {
    log('err', 'کتابخانه Socket.io لود نشد!');
  }

})();