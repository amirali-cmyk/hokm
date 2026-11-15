/* ═══════════════════════════════════════════════════════════
   👥 HOKM PRO v6.2.0 — friends.js
   سیستم دوستان، کد کاربری، و چت آنلاین (نسخه نهایی)
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // 🎯 آدرس سرور دوستان روی Render
  const FRIENDS_API = 'https://hokm-friends.onrender.com';
  
  const state = {
    socket: null,
    friends: [],
    pendingRequests: [],
    chats: {}, // { friendId: [messages] }
    unreadCounts: {}, // { friendId: count }
    myFriendCode: '',
    listeners: []
  };

  function _storage() { return global.HokmStorage; }
  function _profile() { return global.HokmProfile; }
  function _ui() { return global.HokmUI; }
  function _audio() { return global.HokmAudio; }
  function _toast(title, msg, type) { if (_ui()) _ui().showToast(title, msg, type); }

  function _toPersianNumber(n) {
    const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(n).replace(/\d/g, d => fa[+d]);
  }

  // دریافت توکن (در این نسخه، user_id رو به عنوان توکن ذخیره کردیم)
  function _getAuthToken() {
    return localStorage.getItem('hokm_auth_token') || _profile()?.get().userId;
  }

  const Friends = {

    init() {
      const userId = _getAuthToken();
      
      // 🎯 بررسی امنیتی: آیا کتابخانه Socket.io لود شده است؟
      if (typeof io === 'undefined') {
        console.warn('[Friends] Socket.io لود نشده است. بخش چت غیرفعال می‌شود.');
        this.render();
        return;
      }

      if (userId) {
        try {
          // ساخت اتصال Socket.io
          state.socket = io(FRIENDS_API, {
             transports: ['websocket', 'polling']
          });
          
          state.socket.on('connect', () => {
            console.log('[Friends] Connected to server');
            state.socket.emit('auth', { userId });
            
            // 🎯 گرفتن اطلاعات من از سرور (برای کد دوست‌یابی)
            Friends.loadMyInfo();
          });
          
          // گوش دادن به پیام‌های جدید
          state.socket.on('chat:receive', (data) => {
            _handleIncomingMessage(data);
          });

          state.socket.on('friend:new_request', (data) => {
            Friends.loadData();
            _toast('👋 درخواست دوستی', 'شما یک درخواست دوستی جدید دارید', 'info');
            if (_audio()) _audio().play('notification');
          });

          state.socket.on('game:invited', (data) => {
            if (confirm(`🎮 ${data.fromName} شما را به بازی دعوت کرد!\nکد اتاق: ${data.roomCode}\nآیا می‌خواهید وارد شوید؟`)) {
              if (_ui()) _ui().navigate('online');
              const input = document.getElementById('roomCodeInput');
              if (input) {
                input.value = data.roomCode;
                document.getElementById('btnJoinRoom')?.click();
              }
            }
          });
        } catch (err) {
          console.error('[Friends] خطا در اتصال به سوکت:', err);
        }
      }

      this.loadData();
      this.render();
      this.bindEvents();
    },

    // 🎯 گرفتن اطلاعات من از سرور (شامل کد دوست‌یابی)
    async loadMyInfo() {
      const token = _getAuthToken();
      if (!token) return;

      try {
        const res = await fetch(`${FRIENDS_API}/api/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          
          if (data.friendCode) {
            state.myFriendCode = data.friendCode;
            
            // ذخیره در پروفایل محلی
            const storage = _storage();
            if (storage) {
              const profile = storage.getProfile();
              profile.friendCode = data.friendCode;
              profile.userId = token;
              storage.setProfile(profile);
            }
            
            // آپدیت UI
            this.render();
            this.updateProfileFriendCode();
            
            console.log('%c[Friends] کد دوست‌یابی: ' + data.friendCode, 'color: #06d6a0; font-weight: bold;');
          }
        }
      } catch (err) {
        console.warn('[Friends] خطا در دریافت اطلاعات:', err.message);
      }
    },

    // آپدیت کد دوست‌یابی توی صفحه پروفایل
    updateProfileFriendCode() {
      const codeEl = document.getElementById('profileFriendCode');
      if (!codeEl) return;
      
      if (state.myFriendCode && state.myFriendCode !== '---') {
        codeEl.innerHTML = `
          <div style="margin-top: 8px; padding: 8px 16px; background: var(--bg-secondary); border: 1px solid var(--accent); border-radius: var(--radius-full); display: inline-block;">
            <span style="font-size: 11px; color: var(--text-muted);">کد دوست‌یابی شما:</span>
            <span style="font-size: 16px; font-weight: 900; color: var(--accent); font-family: var(--font-num); margin-right: 6px; letter-spacing: 0.05em;">${state.myFriendCode}</span>
            <button class="icon-btn" style="width: 24px; height: 24px; font-size: 12px; margin-right: 4px;" onclick="navigator.clipboard.writeText('${state.myFriendCode}'); HokmUI.showToast('کپی شد', 'کد شما کپی شد', 'success');">📋</button>
          </div>
        `;
      } else {
        codeEl.innerHTML = `
          <div style="margin-top: 8px; font-size: 11px; color: var(--text-muted);">
            برای دریافت کد دوست‌یابی، وارد حساب خود شوید.
          </div>
        `;
      }
    },

    async loadData() {
      const token = _getAuthToken();
      if (!token) return;

      try {
        const res = await fetch(`${FRIENDS_API}/api/friends`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          state.friends = data.friends || [];
          
          // اگر کد دوست‌یابی هنوز نداریم، از پروفایل بگیر
          if (!state.myFriendCode) {
            const profile = _profile()?.get();
            if (profile?.friendCode) {
              state.myFriendCode = profile.friendCode;
            }
          }

          this.render();
        }
      } catch (err) {
        console.warn('[Friends] Could not load friends list:', err.message);
      }
    },

    async addFriend(code) {
      const token = _getAuthToken();
      if (!token) {
        _toast('خطا', 'برای افزودن دوست ابتدا باید ثبت‌نام کنید (ورود با ایمیل).', 'error');
        return;
      }

      if (!code || code.length < 6) {
        _toast('خطا', 'کد کاربری باید حداقل ۶ کاراکتر باشد', 'error');
        return;
      }

      try {
        const res = await fetch(`${FRIENDS_API}/api/friends/add`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ friendCode: code.toUpperCase() })
        });

        const data = await res.json();
        if (res.ok) {
          _toast('✅', 'درخواست دوستی ارسال شد', 'success');
          if (_audio()) _audio().play('success');
        } else {
          _toast('خطا', data.error || 'افزودن دوست ناموفق', 'error');
        }
      } catch (err) {
        _toast('خطا', 'ارتباط با سرور برقرار نشد', 'error');
      }
    },

    sendMessage(friendId, text) {
      if (!state.socket || !text.trim()) return;
      const senderId = _getAuthToken();

      // ارسال به سرور
      state.socket.emit('chat:send', {
        senderId: senderId,
        receiverId: friendId,
        text: text.trim()
      });
    },

    render() {
      const container = document.getElementById('friendsList');
      if (!container) return;

      // نمایش کد دوست‌یابی کاربر (در باکس بالای لیست)
      let friendCodeBox = document.getElementById('myFriendCodeDisplay');
      if (!friendCodeBox) {
        friendCodeBox = document.createElement('div');
        friendCodeBox.id = 'myFriendCodeDisplay';
        friendCodeBox.style.cssText = 'margin-bottom: 16px; padding: 12px; background: var(--bg-secondary); border: 1px solid var(--accent); border-radius: var(--radius-md); text-align: center;';
        container.parentNode.insertBefore(friendCodeBox, container);
      }

      if (state.myFriendCode && state.myFriendCode !== '---') {
        friendCodeBox.innerHTML = `
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">کد دوست‌یابی شما:</div>
          <div style="font-size: 22px; font-weight: 900; color: var(--accent); font-family: var(--font-num); letter-spacing: 0.1em;">${state.myFriendCode}</div>
          <button class="btn btn-outline" style="margin-top: 8px; font-size: 12px; padding: 4px 12px;" onclick="navigator.clipboard.writeText('${state.myFriendCode}'); HokmUI.showToast('کپی شد', 'کد شما کپی شد', 'success');">📋 کپی کد</button>
        `;
      } else {
        friendCodeBox.innerHTML = `
          <div style="font-size: 13px; color: var(--text-muted);">
            برای دریافت کد دوست‌یابی، ابتدا وارد حساب خود شوید.
          </div>
        `;
      }

      if (state.friends.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-title">هنوز دوستی اضافه نکرده‌ای</div>
            <div class="empty-state-msg">با کد کاربری دوستانت رو اضافه کن</div>
          </div>
        `;
        return;
      }

      // رندر لیست دوستان
      container.innerHTML = state.friends.map(f => {
        const unread = state.unreadCounts[f.user_id] || 0;
        const unreadBadge = unread > 0 ? `<span style="background: var(--color-danger); color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; margin-right: 4px;">${_toPersianNumber(unread)}</span>` : '';

        return `
        <div class="friend-item">
          <div class="friend-status" style="background: #6b7280;"></div>
          <div class="lb-avatar" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; background: var(--bg-elevated); border-radius: 50%;">
            ${f.avatar || '👤'}
          </div>
          <div class="friend-info">
            <div class="friend-name">${f.name} ${unreadBadge}</div>
            <div class="friend-sub">ELO: ${_toPersianNumber(f.elo || 1000)}</div>
          </div>
          <div class="friend-actions">
            <button class="icon-btn" onclick="HokmFriends.openChat('${f.user_id}', '${f.name}')" style="width:36px;height:36px;font-size:16px;">💬</button>
            <button class="icon-btn" onclick="HokmFriends.inviteToGame('${f.user_id}')" style="width:36px;height:36px;font-size:16px;">🎮</button>
          </div>
        </div>
      `}).join('');
    },

    openChat(friendId, friendName) {
      if (!_ui()) return;

      const msgs = state.chats[friendId] || [];
      const messagesHtml = msgs.map(m => `
        <div style="display:flex; justify-content:${m.senderId === _getAuthToken() ? 'flex-start' : 'flex-end'}; margin-bottom:8px;">
          <div style="background:${m.senderId === _getAuthToken() ? 'var(--accent-soft)' : 'var(--bg-elevated)'}; padding:8px 12px; border-radius:12px; font-size:13px; max-width: 80%;">
            ${m.text}
          </div>
        </div>
      `).join('');

      _ui().openModal(`
        <h3 class="modal-title" style="margin-bottom: 12px;">💬 چت با ${friendName}</h3>
        <div id="chatMessages" style="height:250px; overflow-y:auto; margin-bottom:12px; padding:8px; background:var(--bg-secondary); border-radius:8px;">
          ${msgs.length ? messagesHtml : '<p style="text-align:center;color:var(--text-muted);padding-top:100px;">هنوز پیامی رد و بدل نشده</p>'}
        </div>
        <div style="display:flex; gap:8px;">
          <input type="text" id="chatInput" class="input" placeholder="پیام..." autocomplete="off" />
          <button class="btn btn-primary" id="btnSendChat" style="padding:0 16px;">📤</button>
        </div>
        <div style="margin-top:16px; display:flex; gap:8px;">
          <button class="btn btn-outline" style="flex:1; font-size:12px;" onclick="HokmFriends.sendQuickChat('${friendId}', 'آفرین!')">آفرین! 👏</button>
          <button class="btn btn-outline" style="flex:1; font-size:12px;" onclick="HokmFriends.sendQuickChat('${friendId}', 'حکم دل! ♥️')">حکم دل! ♥️</button>
          <button class="btn btn-outline" style="flex:1; font-size:12px;" onclick="HokmFriends.sendQuickChat('${friendId}', 'دستت درد نکنه')">دستت درد نکنه 🙏</button>
        </div>
      `);

      // پاک کردن unread count این دوست
      state.unreadCounts[friendId] = 0;
      this.render();
      this.updateBadges();

      const input = document.getElementById('chatInput');
      const sendBtn = document.getElementById('btnSendChat');

      const send = () => {
        if (input.value.trim()) {
          Friends.sendMessage(friendId, input.value.trim());
          
          // آپدیت UI (خود پیام ارسالی رو نشون بده)
          const wrapper = document.createElement('div');
          wrapper.innerHTML = `<div style="display:flex; justify-content:flex-start; margin-bottom:8px;"><div style="background:var(--accent-soft); padding:8px 12px; border-radius:12px; font-size:13px; max-width: 80%;">${input.value.trim()}</div></div>`;
          document.getElementById('chatMessages').appendChild(wrapper.firstChild);
          document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
          
          input.value = '';
        }
      };

      sendBtn.addEventListener('click', send);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
      setTimeout(() => input.focus(), 100);
    },

    sendQuickChat(friendId, text) {
      Friends.sendMessage(friendId, text);
    },

    inviteToGame(friendId) {
      const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      if (state.socket) {
        state.socket.emit('game:invite', {
          friendId: friendId,
          roomCode: roomCode,
          senderName: _profile()?.get().name || 'دوست شما'
        });
        _toast('🎮 دعوت ارسال شد', 'دعوت‌نامه به دوست شما ارسال شد', 'success');
      }
    },

    _handleIncomingMessage(data) {
      const friendId = data.senderId;
      
      if (!state.chats[friendId]) state.chats[friendId] = [];
      state.chats[friendId].push(data);

      const chatMessagesEl = document.getElementById('chatMessages');
      if (chatMessagesEl && document.querySelector('.modal-title')?.textContent.includes('چت')) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `<div style="display:flex; justify-content:flex-end; margin-bottom:8px;"><div style="background:var(--bg-elevated); padding:8px 12px; border-radius:12px; font-size:13px; max-width: 80%;">${data.text}</div></div>`;
        chatMessagesEl.appendChild(wrapper.firstChild);
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
      } else {
        if (!state.unreadCounts[friendId]) state.unreadCounts[friendId] = 0;
        state.unreadCounts[friendId]++;
        this.render();
        this.updateBadges();
        
        _toast('💬 پیام جدید', data.text, 'info');
        if (_audio()) _audio().play('chat');
      }
    },

    updateBadges() {
      let totalUnread = 0;
      for (let k in state.unreadCounts) {
        totalUnread += state.unreadCounts[k];
      }
      
      const badge = document.getElementById('friendsUnreadBadge');
      if (badge) {
        badge.textContent = _toPersianNumber(totalUnread);
        badge.style.display = totalUnread > 0 ? 'flex' : 'none';
      }
    },

    bindEvents() {
      const addBtn = document.getElementById('btnAddFriend');
      const input = document.getElementById('friendCodeInput');
      if (addBtn && input) {
        addBtn.onclick = () => {
          const val = input.value.trim().toUpperCase();
          if (val) {
            Friends.addFriend(val);
            input.value = '';
          }
        };
      }
    }
  };

  global.HokmFriends = Friends;

})(typeof window !== 'undefined' ? window : globalThis);