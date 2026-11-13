/* ═══════════════════════════════════════════════════════════
   👥 HOKM PRO v6.2.0 — friends.js
   سیستم دوستان، کد کاربری، و چت آنلاین (متصل به Render)
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // 🎯 آدرس سرور دوستان روی Render
  const FRIENDS_API = 'https://hokm-friends.onrender.com';

  const state = {
    socket: null,
    friends: [],
    pendingRequests: [],
    chats: {},
    unreadCounts: {},
    myFriendCode: '',
    listeners: []
  };

  function _profile() { return global.HokmProfile; }
  function _ui() { return global.HokmUI; }
  function _audio() { return global.HokmAudio; }
  function _toast(title, msg, type) {
    if (_ui() && typeof _ui().showToast === 'function') {
      _ui().showToast(title, msg, type || 'info');
    } else {
      console.log(`[${type}] ${title}: ${msg}`);
    }
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

  function _getAuthToken() {
    return localStorage.getItem('hokm_auth_token') ||
           (_profile() && _profile().get().userId) || null;
  }

  const Friends = {

    init() {
      const userId = _getAuthToken();

      // نمایش کد دوست‌یابی در صفحه دوستان (اگر لاگین است)
      if (userId) {
        state.myFriendCode = localStorage.getItem('hokm_friend_code') ||
                             (_profile() && _profile().get().friendCode) || '';

        // اتصال Socket.io
        try {
          if (typeof io !== 'undefined' && !state.socket) {
            state.socket = io(FRIENDS_API, {
              transports: ['websocket', 'polling']
            });

            state.socket.on('connect', () => {
              console.log('%c✅ Friends socket connected', 'color: #06d6a0; font-weight: bold;');
              state.socket.emit('auth', { userId });
            });

            state.socket.on('connect_error', (err) => {
              console.warn('[Friends] Socket connection error:', err.message);
            });

            state.socket.on('chat:receive', (data) => {
              Friends._handleIncomingMessage(data);
            });

            state.socket.on('chat:sent', (data) => {
              console.log('%c✅ پیام ارسال شد', 'color: #06d6a0;');
            });

            state.socket.on('friend:new_request', (data) => {
              Friends.loadData();
              _toast('👋 درخواست دوستی', (data.from_name || 'یک کاربر') + ' به شما درخواست دوستی داد', 'info');
              if (_audio()) _audio().play('notification');
            });

            state.socket.on('friend:accepted', (data) => {
              Friends.loadData();
              _toast('✅ دوست جدید!', (data.by_name || 'کاربر') + ' درخواست شما را پذیرفت', 'success');
              if (_audio()) _audio().play('success');
            });

            state.socket.on('game:invited', (data) => {
              if (confirm(`🎮 ${data.fromName} شما را به بازی دعوت کرد!\nکد اتاق: ${data.roomCode}\nآیا می‌خواهید وارد شوید؟`)) {
                if (_ui()) _ui().navigate('online');
                setTimeout(() => {
                  const input = document.getElementById('roomCodeInput');
                  if (input) {
                    input.value = data.roomCode;
                    const btn = document.getElementById('btnJoinRoom');
                    if (btn) btn.click();
                  }
                }, 300);
              }
            });
          }
        } catch (e) {
          console.warn('[Friends] Socket init failed:', e.message);
        }
      }

      Friends.loadData();
      Friends.render();
      Friends.bindEvents();
    },

    async loadData() {
      const token = _getAuthToken();
      if (!token) {
        Friends.render();
        return;
      }

      try {
        const res = await fetch(`${FRIENDS_API}/api/friends`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          state.friends = data.friends || [];
          Friends.render();
        }
      } catch (err) {
        console.warn('[Friends] Could not load friends list:', err.message);
        Friends.render();
      }
    },

    async addFriend(code) {
      const token = _getAuthToken();
      if (!token) {
        _toast('خطا', 'برای افزودن دوست ابتدا وارد حساب خود شوید', 'error');
        if (_ui()) _ui().navigate('auth');
        return;
      }

      try {
        const res = await fetch(`${FRIENDS_API}/api/friends/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ friendCode: code })
        });

        const data = await res.json();
        if (res.ok) {
          _toast('✅', 'درخواست دوستی ارسال شد', 'success');
          if (_audio()) _audio().play('success');
        } else {
          _toast('خطا', data.error || 'خطا در ارسال درخواست', 'error');
        }
      } catch (err) {
        _toast('خطا', 'ارتباط با سرور برقرار نشد', 'error');
      }
    },

    sendMessage(friendId, text) {
      if (!state.socket || !text || !text.trim()) return;
      const senderId = _getAuthToken();
      if (!senderId) return;

      state.socket.emit('chat:send', {
        senderId: senderId,
        receiverId: friendId,
        text: text.trim()
      });

      // اضافه کردن به chat محلی
      if (!state.chats[friendId]) state.chats[friendId] = [];
      state.chats[friendId].push({
        senderId: senderId,
        receiverId: friendId,
        text: text.trim(),
        timestamp: Date.now()
      });
    },

    render() {
      const container = document.getElementById('friendsList');
      if (!container) return;

      // نمایش کد دوست‌یابی بالای لیست
      let friendCodeBox = document.getElementById('myFriendCodeDisplay');
      if (!friendCodeBox) {
        friendCodeBox = document.createElement('div');
        friendCodeBox.id = 'myFriendCodeDisplay';
        friendCodeBox.style.cssText = 'margin-bottom: 16px;';
        container.parentNode.insertBefore(friendCodeBox, container);
      }

      const token = _getAuthToken();
      const code = state.myFriendCode || localStorage.getItem('hokm_friend_code');

      if (token && code) {
        friendCodeBox.innerHTML = `
          <div style="padding: 12px; background: var(--bg-secondary); border: 1px solid var(--accent); border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">کد دوست‌یابی شما:</div>
            <div style="font-size: 22px; font-weight: 900; color: var(--accent); font-family: var(--font-num); letter-spacing: 0.1em;">${_escapeHtml(code)}</div>
            <button class="btn btn-outline" style="margin-top: 8px; font-size: 12px; padding: 4px 12px;" onclick="HokmFriends.copyCode('${_escapeHtml(code)}')">📋 کپی کد</button>
          </div>
        `;
      } else {
        friendCodeBox.innerHTML = `
          <div style="padding: 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 13px; color: var(--text-muted);">
              برای دریافت کد دوست‌یابی، ابتدا وارد حساب خود شوید.
            </div>
            <button class="btn btn-primary" style="margin-top: 8px; font-size: 13px;" onclick="HokmUI.navigate('auth')">ورود / ثبت‌نام</button>
          </div>
        `;
      }

      if (!state.friends || state.friends.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-title">هنوز دوستی اضافه نکرده‌ای</div>
            <div class="empty-state-msg">با کد کاربری دوستانت رو اضافه کن</div>
          </div>
        `;
        return;
      }

      container.innerHTML = state.friends.map(f => {
        const unread = state.unreadCounts[f.user_id] || 0;
        const unreadBadge = unread > 0 ? `<span style="background: var(--color-danger); color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; margin-right: 4px;">${_toPersianNumber(unread)}</span>` : '';
        const avatarContent = (f.avatar && f.avatar.startsWith('data:image'))
          ? `<img src="${f.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
          : (f.avatar || '👤');

        return `
          <div class="friend-item">
            <div class="friend-status" style="background: #6b7280;"></div>
            <div class="lb-avatar" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; background: var(--bg-elevated); border-radius: 50%; overflow: hidden;">
              ${avatarContent}
            </div>
            <div class="friend-info">
              <div class="friend-name">${_escapeHtml(f.name)} ${unreadBadge}</div>
              <div class="friend-sub">${_escapeHtml(f.friendCode || '')}</div>
            </div>
            <div class="friend-actions">
              <button class="icon-btn" onclick="HokmFriends.openChat('${f.user_id}', '${_escapeHtml(f.name)}')" style="width:36px;height:36px;font-size:16px;">💬</button>
              <button class="icon-btn" onclick="HokmFriends.inviteToGame('${f.user_id}')" style="width:36px;height:36px;font-size:16px;">🎮</button>
            </div>
          </div>
        `;
      }).join('');
    },

    copyCode(code) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(() => {
            _toast('✅', 'کد شما کپی شد', 'success');
          }).catch(() => {
            _toast('کد شما: ' + code, '', 'info');
          });
        } else {
          _toast('کد شما: ' + code, '', 'info');
        }
      } catch (e) {
        _toast('کد شما: ' + code, '', 'info');
      }
    },

    openChat(friendId, friendName) {
      if (!_ui()) return;

      const msgs = state.chats[friendId] || [];
      const myId = _getAuthToken();
      const messagesHtml = msgs.length
        ? msgs.map(m => {
            const isMe = m.senderId === myId;
            return `
              <div style="display:flex; justify-content:${isMe ? 'flex-start' : 'flex-end'}; margin-bottom:8px;">
                <div style="background:${isMe ? 'var(--accent-soft)' : 'var(--bg-elevated)'}; padding:8px 12px; border-radius:12px; font-size:13px; max-width:80%;">
                  ${_escapeHtml(m.text)}
                </div>
              </div>
            `;
          }).join('')
        : '<p style="text-align:center;color:var(--text-muted);padding-top:100px;">هنوز پیامی رد و بدل نشده</p>';

      _ui().openModal(`
        <h3 class="modal-title" style="margin-bottom: 12px;">💬 چت با ${_escapeHtml(friendName)}</h3>
        <div id="chatMessages" style="height:250px; overflow-y:auto; margin-bottom:12px; padding:8px; background:var(--bg-secondary); border-radius:8px;">
          ${messagesHtml}
        </div>
        <div style="display:flex; gap:8px;">
          <input type="text" id="chatInput" class="input" placeholder="پیام..." autocomplete="off" maxlength="500" />
          <button class="btn btn-primary" id="btnSendChat" style="padding:0 16px;">📤</button>
        </div>
        <div style="margin-top:16px; display:flex; gap:8px; flex-wrap: wrap;">
          <button class="btn btn-outline" style="flex:1; font-size:12px; min-width:80px;" onclick="HokmFriends.sendQuickChat('${friendId}', 'آفرین! 👏')">آفرین! 👏</button>
          <button class="btn btn-outline" style="flex:1; font-size:12px; min-width:80px;" onclick="HokmFriends.sendQuickChat('${friendId}', 'حکم دل! ♥️')">حکم دل! ♥️</button>
          <button class="btn btn-outline" style="flex:1; font-size:12px; min-width:80px;" onclick="HokmFriends.sendQuickChat('${friendId}', 'دستت درد نکنه 🙏')">دستت درد نکنه 🙏</button>
        </div>
      `);

      state.unreadCounts[friendId] = 0;
      Friends.render();

      setTimeout(() => {
        const input = document.getElementById('chatInput');
        const sendBtn = document.getElementById('btnSendChat');
        const msgsEl = document.getElementById('chatMessages');
        if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;

        const send = () => {
          if (!input || !input.value.trim()) return;
          const text = input.value.trim();
          Friends.sendMessage(friendId, text);

          // آپدیت UI محلی
          if (msgsEl) {
            // اگر پیام "خالی" بود، حذفش کن
            const emptyMsg = msgsEl.querySelector('p');
            if (emptyMsg) emptyMsg.remove();
            const wrapper = document.createElement('div');
            wrapper.innerHTML = `<div style="display:flex; justify-content:flex-start; margin-bottom:8px;"><div style="background:var(--accent-soft); padding:8px 12px; border-radius:12px; font-size:13px; max-width:80%;">${_escapeHtml(text)}</div></div>`;
            msgsEl.appendChild(wrapper.firstChild);
            msgsEl.scrollTop = msgsEl.scrollHeight;
          }
          input.value = '';
        };

        if (sendBtn) sendBtn.addEventListener('click', send);
        if (input) {
          input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
          input.focus();
        }
      }, 100);
    },

    sendQuickChat(friendId, text) {
      Friends.sendMessage(friendId, text);

      const msgsEl = document.getElementById('chatMessages');
      if (msgsEl) {
        const emptyMsg = msgsEl.querySelector('p');
        if (emptyMsg) emptyMsg.remove();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `<div style="display:flex; justify-content:flex-start; margin-bottom:8px;"><div style="background:var(--accent-soft); padding:8px 12px; border-radius:12px; font-size:13px; max-width:80%;">${_escapeHtml(text)}</div></div>`;
        msgsEl.appendChild(wrapper.firstChild);
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }
    },

    inviteToGame(friendId) {
      const roomCode = Math.floor(100000 + Math.random() * 900000).toString();

      if (state.socket) {
        state.socket.emit('game:invite', {
          friendId: friendId,
          roomCode: roomCode,
          senderName: (_profile() && _profile().get().name) || 'دوست شما'
        });
        _toast('🎮 دعوت ارسال شد', 'دعوت‌نامه برای دوست شما ارسال شد', 'success');
        if (_audio()) _audio().play('success');
      } else {
        _toast('خطا', 'اتصال به سرور برقرار نیست', 'error');
      }
    },

    _handleIncomingMessage(data) {
      const friendId = data.senderId;

      if (!state.chats[friendId]) state.chats[friendId] = [];
      state.chats[friendId].push(data);

      // آپدیت مودال چت اگر باز است
      const chatMessagesEl = document.getElementById('chatMessages');
      const modalTitle = document.querySelector('.modal-title');
      if (chatMessagesEl && modalTitle && modalTitle.textContent.includes('چت')) {
        const emptyMsg = chatMessagesEl.querySelector('p');
        if (emptyMsg) emptyMsg.remove();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `<div style="display:flex; justify-content:flex-end; margin-bottom:8px;"><div style="background:var(--bg-elevated); padding:8px 12px; border-radius:12px; font-size:13px; max-width:80%;">${_escapeHtml(data.text)}</div></div>`;
        chatMessagesEl.appendChild(wrapper.firstChild);
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
      } else {
        // badge
        if (!state.unreadCounts[friendId]) state.unreadCounts[friendId] = 0;
        state.unreadCounts[friendId]++;
        Friends.render();

        _toast('💬 پیام جدید', data.text, 'info');
        if (_audio()) _audio().play('chat');
      }
    },

    bindEvents() {
      const addBtn = document.getElementById('btnAddFriend');
      const input = document.getElementById('friendCodeInput');
      if (addBtn && input && !addBtn.dataset.bound) {
        addBtn.dataset.bound = '1';
        addBtn.addEventListener('click', () => {
          const val = input.value.trim().toUpperCase();
          if (val) {
            Friends.addFriend(val);
            input.value = '';
          } else {
            _toast('خطا', 'لطفاً کد دوست را وارد کنید', 'warning');
          }
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') addBtn.click();
        });
      }
    }
  };

  global.HokmFriends = Friends;

  // راه‌اندازی خودکار بعد از لود
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(() => Friends.init(), 500));
    } else {
      setTimeout(() => Friends.init(), 500);
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);