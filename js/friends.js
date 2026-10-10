/* ═══════════════════════════════════════════════════════════
   👥 HOKM PRO v6.0 — friends.js
   سیستم دوستان: افزودن، حذف، وضعیت آنلاین، چت، دعوت
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     ثابت‌ها
     ───────────────────────────────────────────── */
  const STORAGE_KEY = 'hokm_friends';
  const MAX_FRIENDS = 50;
  const MAX_CHAT_HISTORY = 100;
  const MAX_REQUESTS = 20;

  const STATUS = {
    ONLINE: 'online',
    OFFLINE: 'offline',
    IN_GAME: 'inGame',
    AWAY: 'away'
  };

  const STATUS_LABELS = {
    online: { fa: 'آنلاین', color: '#06d6a0', icon: '🟢' },
    offline: { fa: 'آفلاین', color: '#6b7280', icon: '⚫' },
    inGame: { fa: 'در بازی', color: '#ffd60a', icon: '🎮' },
    away: { fa: 'غایب', color: '#f4a259', icon: '🟡' }
  };

  /* ─────────────────────────────────────────────
     وضعیت
     ───────────────────────────────────────────── */
  const state = {
    friends: [],      // [{id, name, avatar, status, lastSeen, elo}]
    requests: [],     // [{id, name, avatar, sentAt}]
    chats: {},        // { friendId: [{from, text, timestamp}] }
    listeners: [],
    polling: null,
    usingServer: false
  };

  /* ─────────────────────────────────────────────
     کمکی‌ها
     ───────────────────────────────────────────── */
  function _storage() { return global.HokmStorage; }
  function _profile() { return global.HokmProfile; }
  function _audio() { return global.HokmAudio; }
  function _ui() { return global.HokmUI; }

  function _emit(event, data) {
    state.listeners.forEach(({ event: e, handler }) => {
      if (e === event || e === '*') {
        try { handler(data); } catch (err) { console.error(err); }
      }
    });
  }

  function _toPersianNumber(n) {
    const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(n).replace(/\d/g, d => fa[+d]);
  }

  function _escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _timeAgo(timestamp) {
    if (!timestamp) return 'نامشخص';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'همین الان';
    if (seconds < 3600) return `${_toPersianNumber(Math.floor(seconds / 60))} دقیقه پیش`;
    if (seconds < 86400) return `${_toPersianNumber(Math.floor(seconds / 3600))} ساعت پیش`;
    if (seconds < 604800) return `${_toPersianNumber(Math.floor(seconds / 86400))} روز پیش`;
    return `${_toPersianNumber(Math.floor(seconds / 604800))} هفته پیش`;
  }

  function _generateId() {
    return 'friend_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ─────────────────────────────────────────────
     ذخیره/بارگذاری
     ───────────────────────────────────────────── */
  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      state.friends = data.friends || [];
      state.requests = data.requests || [];
      state.chats = data.chats || {};
    } catch (e) {
      console.warn('[Friends] Load error:', e);
    }
  }

  function _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        friends: state.friends,
        requests: state.requests,
        chats: state.chats,
        savedAt: Date.now()
      }));
    } catch (e) {
      console.warn('[Friends] Save error:', e);
    }
  }

  /* ─────────────────────────────────────────────
     تشخیص کاربر جعلی (Demo)
     ───────────────────────────────────────────── */
  const DEMO_FRIENDS = [
    { id: 'demo_1', name: 'علی', avatar: '🦁', elo: 1450, status: 'online' },
    { id: 'demo_2', name: 'سارا', avatar: '🌸', elo: 1620, status: 'inGame' },
    { id: 'demo_3', name: 'رضا', avatar: '🎭', elo: 1280, status: 'offline' },
    { id: 'demo_4', name: 'مریم', avatar: '🦋', elo: 1750, status: 'online' }
  ];

  function _addDemoFriends() {
    // فقط یک بار، اگر دوستی نداری
    if (state.friends.length > 0) return;

    DEMO_FRIENDS.forEach(f => {
      state.friends.push({
        ...f,
        addedAt: Date.now(),
        lastSeen: Date.now() - Math.random() * 24 * 60 * 60 * 1000
      });
    });
    _save();
  }

  /* ─────────────────────────────────────────────
     API عمومی
     ───────────────────────────────────────────── */
  const Friends = {

    STATUS,
    STATUS_LABELS,

    /**
     * راه‌اندازی
     */
    init() {
      _load();

      // اگر خالی بود، دوستان نمونه اضافه کن
      if (state.friends.length === 0) {
        _addDemoFriends();
      }

      Friends.render();
      _bindEvents();

      // شروع polling برای وضعیت آنلاین (هر ۱۵ ثانیه)
      _startPolling();

      console.log(
        `%c👥 Friends: ${state.friends.length} دوست`,
        'color: #118ab2; font-weight: bold;'
      );
      return state;
    },

    /* ─── لیست دوستان ─── */

    getFriends() {
      return state.friends.slice();
    },

    getFriend(id) {
      return state.friends.find(f => f.id === id) || null;
    },

    getOnlineFriends() {
      return state.friends.filter(f =>
        f.status === STATUS.ONLINE || f.status === STATUS.IN_GAME
      );
    },

    getOnlineCount() {
      return Friends.getOnlineFriends().length;
    },

    /* ─── افزودن دوست ─── */

    /**
     * افزودن دوست با کد کاربری یا نام
     */
    addFriend(input) {
      if (!input || typeof input !== 'string') {
        return { ok: false, error: 'کد نامعتبر' };
      }

      const code = input.trim();
      if (code.length < 3) {
        return { ok: false, error: 'کد باید حداقل ۳ کاراکتر باشد' };
      }

      // چک تکراری
      if (state.friends.some(f =>
        f.id === code || f.name === code
      )) {
        return { ok: false, error: 'این دوست قبلاً اضافه شده' };
      }

      if (state.friends.length >= MAX_FRIENDS) {
        return { ok: false, error: `حداکثر ${_toPersianNumber(MAX_FRIENDS)} دوست` };
      }

      // در حالت دمو، یک دوست جدید می‌سازیم
      const newFriend = {
        id: 'user_' + code.toLowerCase().replace(/\s/g, '_') + '_' + Date.now().toString(36).slice(-4),
        name: code,
        avatar: _randomAvatar(),
        elo: 1000 + Math.floor(Math.random() * 800),
        status: Math.random() < 0.7 ? STATUS.ONLINE : STATUS.OFFLINE,
        lastSeen: Date.now(),
        addedAt: Date.now(),
        isNew: true
      };

      state.friends.push(newFriend);
      _save();
      Friends.render();

      if (_audio()) _audio().play('success');

      _emit('friend:added', newFriend);

      return { ok: true, friend: newFriend };
    },

    /**
     * حذف دوست
     */
    removeFriend(id) {
      const idx = state.friends.findIndex(f => f.id === id);
      if (idx === -1) return false;

      const removed = state.friends.splice(idx, 1)[0];
      delete state.chats[id];

      _save();
      Friends.render();

      if (_audio()) _audio().play('softClick');

      _emit('friend:removed', removed);
      return true;
    },

    /**
     * بلاک کردن دوست
     */
    blockFriend(id) {
      const friend = Friends.getFriend(id);
      if (!friend) return false;

      friend.blocked = true;
      friend.status = STATUS.OFFLINE;
      _save();
      Friends.render();

      _emit('friend:blocked', friend);
      return true;
    },

    /* ─── درخواست‌ها ─── */

    getRequests() {
      return state.requests.slice();
    },

    acceptRequest(id) {
      const idx = state.requests.findIndex(r => r.id === id);
      if (idx === -1) return false;

      const req = state.requests.splice(idx, 1)[0];

      const newFriend = {
        ...req,
        status: STATUS.ONLINE,
        lastSeen: Date.now(),
        addedAt: Date.now()
      };

      state.friends.push(newFriend);
      _save();
      Friends.render();

      _emit('friend:accepted', newFriend);
      return true;
    },

    rejectRequest(id) {
      const idx = state.requests.findIndex(r => r.id === id);
      if (idx === -1) return false;

      state.requests.splice(idx, 1);
      _save();
      Friends.render();
      return true;
    },

    /* ─── چت ─── */

    /**
     * ارسال پیام
     */
    sendMessage(friendId, text) {
      if (!text || !text.trim()) return false;

      const friend = Friends.getFriend(friendId);
      if (!friend) return false;

      if (!state.chats[friendId]) state.chats[friendId] = [];

      const msg = {
        id: 'msg_' + Date.now(),
        from: 'me',
        text: text.trim().slice(0, 500),
        timestamp: Date.now(),
        read: false
      };

      state.chats[friendId].push(msg);

      // محدودیت تاریخچه
      if (state.chats[friendId].length > MAX_CHAT_HISTORY) {
        state.chats[friendId] = state.chats[friendId].slice(-MAX_CHAT_HISTORY);
      }

      _save();
      _emit('message:sent', { friendId, msg });

      // پاسخ خودکار (دمو)
      setTimeout(() => {
        _autoReply(friendId);
      }, 1000 + Math.random() * 2000);

      return true;
    },

    /**
     * دریافت پیام‌ها
     */
    getMessages(friendId) {
      return (state.chats[friendId] || []).slice();
    },

    /**
     * پاک کردن چت
     */
    clearChat(friendId) {
      delete state.chats[friendId];
      _save();
      _emit('chat:cleared', { friendId });
      return true;
    },

    /**
     * تعداد پیام‌های خوانده‌نشده
     */
    getUnreadCount(friendId) {
      if (!friendId) {
        // کل
        return Object.values(state.chats).reduce((sum, msgs) =>
          sum + msgs.filter(m => !m.read && m.from !== 'me').length, 0
        );
      }
      const msgs = state.chats[friendId] || [];
      return msgs.filter(m => !m.read && m.from !== 'me').length;
    },

    markAsRead(friendId) {
      const msgs = state.chats[friendId] || [];
      msgs.forEach(m => { if (m.from !== 'me') m.read = true; });
      _save();
    },

    /* ─── دعوت به بازی ─── */

    inviteToPlay(friendId) {
      const friend = Friends.getFriend(friendId);
      if (!friend) return false;

      if (friend.status === STATUS.OFFLINE) {
        return { ok: false, error: 'دوست آفلاین است' };
      }

      _emit('friend:invited', { friend });

      if (_audio()) _audio().play('notification');

      return { ok: true };
    },

    /* ─── رندر ─── */

    render() {
      const container = document.getElementById('friendsList');
      if (!container) return;

      if (state.friends.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-title">هنوز دوستی اضافه نکرده‌ای</div>
            <div class="empty-state-msg">با کد کاربری دوستانت رو اضافه کن</div>
          </div>
        `;
        _updateCounter();
        return;
      }

      // مرتب‌سازی: آنلاین اول، بعد inGame، بعد آفلاین
      const sorted = state.friends.slice().sort((a, b) => {
        const order = { online: 0, inGame: 1, away: 2, offline: 3 };
        const oa = order[a.status] ?? 4;
        const ob = order[b.status] ?? 4;
        if (oa !== ob) return oa - ob;
        return a.name.localeCompare(b.name, 'fa');
      });

      container.innerHTML = sorted.map(f => _renderFriendRow(f)).join('');

      _updateCounter();
      _bindRowEvents();
    },

    /* ─── رویدادها ─── */

    on(event, handler) {
      const entry = { event, handler };
      state.listeners.push(entry);
      return () => Friends.off(event, handler);
    },

    off(event, handler) {
      state.listeners = state.listeners.filter(
        l => !(l.event === event && l.handler === handler)
      );
    },

    /* ─── Reset ─── */

    reset() {
      state.friends = [];
      state.requests = [];
      state.chats = {};
      _save();
      _addDemoFriends();
      Friends.render();
      _emit('friends:reset');
    },

    /* ─── Export/Import ─── */

    export() {
      return JSON.parse(JSON.stringify({
        friends: state.friends,
        requests: state.requests,
        chats: state.chats
      }));
    },

    import(data) {
      if (!data || typeof data !== 'object') return false;
      state.friends = data.friends || [];
      state.requests = data.requests || [];
      state.chats = data.chats || {};
      _save();
      Friends.render();
      return true;
    }
  };

  /* ─────────────────────────────────────────────
     رندر ردیف دوست
     ───────────────────────────────────────────── */
  function _renderFriendRow(f) {
    const statusInfo = STATUS_LABELS[f.status] || STATUS_LABELS.offline;
    const isOnline = f.status === STATUS.ONLINE || f.status === STATUS.IN_GAME;
    const unread = Friends.getUnreadCount(f.id);
    const lastSeenText = isOnline ? 'اکنون آنلاین' : _timeAgo(f.lastSeen);

    // آواتار
    const avatarHtml = typeof f.avatar === 'string' && f.avatar.startsWith('data:image')
      ? `<img src="${f.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`
      : (f.avatar || '🤖');

    // بج پیام‌های نخوانده
    const unreadBadge = unread > 0
      ? `<span style="
          background: var(--color-danger);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          border-radius: 50%;
          min-width: 18px;
          height: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-right: 4px;
        ">${_toPersianNumber(unread)}</span>`
      : '';

    return `
      <div class="friend-item" data-friend-id="${_escapeHtml(f.id)}">
        <div class="friend-status ${isOnline ? 'online' : ''}"
             style="background: ${statusInfo.color};"
             title="${statusInfo.fa}"></div>
        <div class="lb-avatar" style="width:44px;height:44px;font-size:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--bg-elevated);border:1.5px solid var(--border-color);">
          ${avatarHtml}
        </div>
        <div class="friend-info">
          <div class="friend-name">
            ${_escapeHtml(f.name)}
            ${unreadBadge}
          </div>
          <div class="friend-sub">
            ${statusInfo.icon} ${lastSeenText}
            ${f.elo ? ` · ⚡ ${_toPersianNumber(f.elo)}` : ''}
          </div>
        </div>
        <div class="friend-actions">
          ${isOnline ? `
            <button class="icon-btn friend-invite-btn"
                    data-action="invite"
                    data-friend-id="${_escapeHtml(f.id)}"
                    title="دعوت به بازی"
                    style="width:36px;height:36px;font-size:16px;">
              🎮
            </button>
          ` : ''}
          <button class="icon-btn friend-chat-btn"
                  data-action="chat"
                  data-friend-id="${_escapeHtml(f.id)}"
                  title="چت"
                  style="width:36px;height:36px;font-size:16px;">
            💬
          </button>
          <button class="icon-btn friend-menu-btn"
                  data-action="menu"
                  data-friend-id="${_escapeHtml(f.id)}"
                  title="گزینه‌ها"
                  style="width:36px;height:36px;font-size:16px;">
            ⋮
          </button>
        </div>
      </div>
    `;
  }

  /* ─────────────────────────────────────────────
     آپدیت شمارنده در منو
     ───────────────────────────────────────────── */
  function _updateCounter() {
    const label = document.getElementById('friendsCountLabel');
    if (label) {
      const online = Friends.getOnlineCount();
      label.textContent = `${_toPersianNumber(online)} آنلاین`;
    }
  }

  /* ─────────────────────────────────────────────
     پاسخ خودکار (دمو)
     ───────────────────────────────────────────── */
  function _autoReply(friendId) {
    const replies = [
      'سلام! چطوری؟',
      'چه خبر؟',
      'آماده بازی هستی؟',
      'بزن یه دست!',
      '😂',
      'منم خوبم ممنون',
      'بریم یه بازی؟',
      'موافقم 👍'
    ];

    const friend = Friends.getFriend(friendId);
    if (!friend) return;

    if (!state.chats[friendId]) state.chats[friendId] = [];

    const msg = {
      id: 'msg_' + Date.now() + '_r',
      from: 'them',
      text: replies[Math.floor(Math.random() * replies.length)],
      timestamp: Date.now(),
      read: false
    };

    state.chats[friendId].push(msg);
    _save();

    _emit('message:received', { friendId, msg });

    // صدا
    if (_audio()) _audio().play('chat');

    // Toast اگر در صفحه دوستان نیست
    const currentScreen = _ui()?.getCurrentScreen();
    if (currentScreen !== 'friends' && _ui()) {
      _ui().showToast(
        `${friend.avatar || '👤'} ${friend.name}`,
        msg.text,
        'info',
        3000
      );
    }
  }

  /* ─────────────────────────────────────────────
     Polling وضعیت (دمو)
     ───────────────────────────────────────────── */
  function _startPolling() {
    if (state.polling) return;

    state.polling = setInterval(() => {
      _simulateStatusChanges();
    }, 15000); // هر ۱۵ ثانیه
  }

  function _simulateStatusChanges() {
    let changed = false;

    state.friends.forEach(f => {
      if (f.isNew || Math.random() < 0.15) {
        // ۱۵٪ احتمال تغییر
        const statuses = [STATUS.ONLINE, STATUS.OFFLINE, STATUS.IN_GAME, STATUS.AWAY];
        const newStatus = statuses[Math.floor(Math.random() * statuses.length)];

        if (f.status !== newStatus) {
          f.status = newStatus;
          f.lastSeen = Date.now();
          changed = true;
        }

        // حذف isNew بعد اولین تغییر
        if (f.isNew) delete f.isNew;
      }
    });

    if (changed) {
      _save();
      Friends.render();
      _updateCounter();
    }
  }

  /* ─────────────────────────────────────────────
     انتخاب آواتار تصادفی
     ───────────────────────────────────────────── */
  function _randomAvatar() {
    const avatars = ['🐱', '🐶', '🦊', '🐼', '🦁', '🐯', '🦉', '🐺', '🌟', '⚡', '🎭', '😎'];
    return avatars[Math.floor(Math.random() * avatars.length)];
  }

  /* ─────────────────────────────────────────────
     Modal چت
     ───────────────────────────────────────────── */
  function _openChat(friendId) {
    const friend = Friends.getFriend(friendId);
    if (!friend) return;

    if (!_ui()) return;

    const msgs = Friends.getMessages(friendId);
    Friends.markAsRead(friendId);

    const messagesHtml = msgs.length === 0
      ? `<p style="text-align:center;color:var(--text-muted);padding:20px;">هنوز پیامی رد و بدل نشده</p>`
      : msgs.map(m => _renderMessage(m)).join('');

    _ui().openModal(`
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid var(--divider);">
        <div style="font-size:32px;">${_escapeHtml(friend.avatar || '👤')}</div>
        <div style="flex:1;">
          <div style="font-weight:700; font-size:15px;">${_escapeHtml(friend.name)}</div>
          <div style="font-size:11px; color:var(--text-muted);">
            ${STATUS_LABELS[friend.status]?.icon || '⚫'} ${STATUS_LABELS[friend.status]?.fa || 'آفلاین'}
          </div>
        </div>
      </div>
      <div id="chatMessages" style="
        max-height:300px;
        overflow-y:auto;
        display:flex;
        flex-direction:column;
        gap:8px;
        padding:8px 0;
        margin-bottom:12px;
      ">${messagesHtml}</div>
      <form id="chatForm" style="display:flex; gap:8px;">
        <input type="text"
               id="chatInput"
               class="input"
               placeholder="پیام..."
               autocomplete="off"
               maxlength="500"
               style="flex:1;" />
        <button type="submit" class="btn btn-primary" style="padding:0 16px;">📤</button>
      </form>
    `);

    // اسکرول به آخر
    setTimeout(() => {
      const msgsEl = document.getElementById('chatMessages');
      if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
    }, 50);

    // Bind فرم
    const form = document.getElementById('chatForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (!text) return;

        Friends.sendMessage(friendId, text);
        input.value = '';

        // افزودن به صفحه
        const msgsEl = document.getElementById('chatMessages');
        if (msgsEl) {
          const msg = state.chats[friendId][state.chats[friendId].length - 1];
          msgsEl.insertAdjacentHTML('beforeend', _renderMessage(msg));
          msgsEl.scrollTop = msgsEl.scrollHeight;
        }

        if (_audio()) _audio().play('chat');
      });
    }

    // Focus روی input
    setTimeout(() => {
      const input = document.getElementById('chatInput');
      if (input) input.focus();
    }, 100);

    // لیسن به پیام‌های جدید
    const handler = ({ friendId: fid, msg }) => {
      if (fid !== friendId) return;
      const msgsEl = document.getElementById('chatMessages');
      if (msgsEl) {
        msgsEl.insertAdjacentHTML('beforeend', _renderMessage(msg));
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }
    };

    Friends.on('message:received', handler);

    // حذف لیسنر بعد از بستن مودال
    const overlay = document.getElementById('modalOverlay');
    const observer = new MutationObserver(() => {
      if (overlay.classList.contains('hidden')) {
        Friends.off('message:received', handler);
        observer.disconnect();
      }
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }

  function _renderMessage(m) {
    const isMe = m.from === 'me';
    const align = isMe ? 'flex-end' : 'flex-start';
    const bg = isMe ? 'var(--accent-soft)' : 'var(--bg-elevated)';
    const color = isMe ? 'var(--accent)' : 'var(--text-primary)';
    const time = new Date(m.timestamp).toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <div style="
        display: flex;
        justify-content: ${align};
        width: 100%;
      ">
        <div style="
          max-width: 75%;
          padding: 8px 12px;
          background: ${bg};
          color: ${color};
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.5;
        ">
          <div>${_escapeHtml(m.text)}</div>
          <div style="font-size:9px; color:var(--text-muted); margin-top:4px; text-align:left;">
            ${time}
          </div>
        </div>
      </div>
    `;
  }

  /* ─────────────────────────────────────────────
     منوی گزینه‌ها
     ───────────────────────────────────────────── */
  function _openFriendMenu(friendId) {
    const friend = Friends.getFriend(friendId);
    if (!friend || !_ui()) return;

    _ui().openModal(`
      <h3 class="modal-title">${_escapeHtml(friend.name)}</h3>
      <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
        <button class="btn btn-ghost" id="fmInvite" style="justify-content:flex-start;">
          🎮 دعوت به بازی
        </button>
        <button class="btn btn-ghost" id="fmChat" style="justify-content:flex-start;">
          💬 چت
        </button>
        <button class="btn btn-ghost" id="fmClear" style="justify-content:flex-start;">
          🗑️ پاک کردن چت
        </button>
        <button class="btn btn-danger" id="fmRemove" style="justify-content:flex-start;">
          ❌ حذف دوست
        </button>
      </div>
    `);

    setTimeout(() => {
      const invite = document.getElementById('fmInvite');
      const chat = document.getElementById('fmChat');
      const clear = document.getElementById('fmClear');
      const remove = document.getElementById('fmRemove');

      if (invite) invite.addEventListener('click', () => {
        _ui().closeModal();
        const result = Friends.inviteToPlay(friendId);
        if (result && result.ok) {
          _ui().showToast('دعوت', `${friend.name} دعوت شد`, 'success');
        } else {
          _ui().showToast('خطا', result?.error || 'دعوت ناموفق', 'error');
        }
      });

      if (chat) chat.addEventListener('click', () => {
        _ui().closeModal();
        setTimeout(() => _openChat(friendId), 200);
      });

      if (clear) clear.addEventListener('click', () => {
        if (confirm('چت پاک شود؟')) {
          Friends.clearChat(friendId);
          _ui().closeModal();
          _ui().showToast('پاک شد', '', 'success');
        }
      });

      if (remove) remove.addEventListener('click', () => {
        if (confirm(`${friend.name} از دوستان حذف شود؟`)) {
          Friends.removeFriend(friendId);
          _ui().closeModal();
          _ui().showToast('حذف شد', '', 'info');
        }
      });
    }, 100);
  }

  /* ─────────────────────────────────────────────
     Bind رویدادها
     ───────────────────────────────────────────── */
  function _bindEvents() {
    // دکمه افزودن دوست
    const addBtn = document.getElementById('btnAddFriend');
    const input = document.getElementById('friendCodeInput');

    if (addBtn && !addBtn.dataset.bound) {
      addBtn.dataset.bound = '1';
      addBtn.addEventListener('click', () => {
        const val = input?.value?.trim();
        if (!val) {
          if (_ui()) _ui().showToast('خطا', 'کد را وارد کن', 'error');
          return;
        }

        const result = Friends.addFriend(val);

        if (result.ok) {
          input.value = '';
          if (_ui()) _ui().showToast('✅ افزوده شد', result.friend.name, 'success');
        } else {
          if (_ui()) _ui().showToast('خطا', result.error, 'error');
        }
      });
    }

    if (input && !input.dataset.bound) {
      input.dataset.bound = '1';
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addBtn?.click();
        }
      });
    }

    // Enter روی فرم چت — هندل می‌شه در _openChat

    // به‌روزرسانی خودکار در پیام‌های جدید
    Friends.on('message:received', () => {
      _updateCounter();
    });

    Friends.on('friend:added', () => {
      _updateCounter();
    });

    Friends.on('friend:removed', () => {
      _updateCounter();
    });
  }

  function _bindRowEvents() {
    // پاک کردن لیسنرهای قبلی
    const container = document.getElementById('friendsList');
    if (!container || container.dataset.bound === '1') return;
    container.dataset.bound = '1';

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) {
        // کلیک روی خود ردیف → چت
        const row = e.target.closest('.friend-item');
        if (row) {
          _openChat(row.dataset.friendId);
        }
        return;
      }

      const action = btn.dataset.action;
      const friendId = btn.dataset.friendId;

      switch (action) {
        case 'invite': {
          const result = Friends.inviteToPlay(friendId);
          if (result && result.ok) {
            const friend = Friends.getFriend(friendId);
            if (_ui()) _ui().showToast('🎮 دعوت شد', `${friend.name} دعوت به بازی شد`, 'success');
          } else {
            if (_ui()) _ui().showToast('خطا', result?.error || 'دعوت ناموفق', 'error');
          }
          break;
        }
        case 'chat':
          _openChat(friendId);
          break;
        case 'menu':
          _openFriendMenu(friendId);
          break;
      }
    });
  }

  /* ─────────────────────────────────────────────
     Bootstrap
     ───────────────────────────────────────────── */
  function bootstrap() {
    Friends.init();
  }

  /* ─────────────────────────────────────────────
     Export
     ───────────────────────────────────────────── */
  global.HokmFriends = Friends;

  // Auto-init
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(bootstrap, 200));
    } else {
      setTimeout(bootstrap, 200);
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);