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
    myFriendCode: '---',
    isConnected: false
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

  // 🎯 فقط توکن واقعی لاگین رو قبول می‌کنه (توکن مهمان حذف شد)
  function _getAuthToken() {
    return localStorage.getItem('hokm_auth_token');
  }

  const Friends = {

    init() {
      if (typeof io === 'undefined') {
        console.warn('[Friends] Socket.io لود نشده است.');
        this.renderEmpty();
        return;
      }

      this.bindEvents();
      
      // فقط اگه کاربر لاگین باشه به سرور وصل میشیم
      const token = _getAuthToken();
      if (token) {
        this.connectSocket();
        this.loadData();
      }
      
      this.render();
    },

    connectSocket() {
      const token = _getAuthToken();
      if (!token) return;

      if (state.socket) {
        state.socket.disconnect();
      }

      state.socket = io(FRIENDS_API, {
        transports: ['websocket', 'polling'],
        timeout: 10000
      });

      state.socket.on('connect', () => {
        state.isConnected = true;
        console.log('%c🔗 Connected to Friends Server', 'color: #06d6a0; font-weight: bold;');
        state.socket.emit('auth', { userId: token });
      });

      state.socket.on('auth:ok', (data) => {
        console.log('[Friends] Auth OK:', data.userId);
        this.loadMyInfo();
        this.loadData();
      });

      state.socket.on('disconnect', () => {
        state.isConnected = false;
        console.warn('[Friends] Disconnected');
      });

      state.socket.on('connect_error', (err) => {
        state.isConnected = false;
        console.warn('[Friends] Connection error:', err.message);
      });

      // گوش دادن به پیام‌های جدید
      state.socket.on('chat:receive', (data) => {
        this.handleIncomingMessage(data);
      });

      state.socket.on('friend:new_request', (data) => {
        this.loadData();
        _toast('👋 درخواست دوستی', 'یک درخواست دوستی جدید دارید', 'info');
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
    },

    // 🎯 گرفتن کد HK از پروفایل یا سرور
    async loadMyInfo() {
      const token = _getAuthToken();
      if (!token) return;
      
      // اول چک کن توی پروفایل محلی هست یا نه
      const profile = _profile()?.get();
      if (profile && profile.friendCode) {
        state.myFriendCode = profile.friendCode;
        this.render();
      }

      // بعد از سرور بگیر (برای اطمینان)
      try {
        const res = await fetch(`${FRIENDS_API}/api/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          
          if (data.friendCode) {
            state.myFriendCode = data.friendCode;
            
            // ذخیره در پروفایل محلی (فقط اگه تغییر کرده بود)
            if (!profile || profile.friendCode !== data.friendCode) {
              const storage = _storage();
              if (storage) {
                const p = storage.getProfile();
                p.friendCode = data.friendCode;
                p.userId = token;
                storage.setProfile(p);
              }
            }
            
            this.render();
            if (_ui() && _ui().currentScreen === 'profile' && _profile()) {
              _profile().updateUI();
            }
            console.log('%c✅ کد دوست‌یابی از سرور دریافت شد: ' + data.friendCode, 'color: #06d6a0; font-weight: bold;');
          }
        }
      } catch (err) {
        console.warn('[Friends] خطا در دریافت اطلاعات از سرور:', err.message);
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
          this.render();
        }
      } catch (err) {
        console.warn('[Friends] خطا در دریافت لیست دوستان:', err.message);
      }
    },

    async addFriend(code) {
      const token = _getAuthToken();
      if (!token) {
        _toast('خطا', 'برای افزودن دوست ابتدا باید وارد شوید', 'error');
        return;
      }

      if (!code || code.length < 4) {
        _toast('خطا', 'کد دوست‌یابی معتبر نیست', 'error');
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
          _toast('خطا', data.error || 'ارسال ناموفق بود', 'error');
        }
      } catch (err) {
        _toast('خطا', 'ارتباط با سرور برقرار نشد', 'error');
      }
    },

    sendMessage(friendId, text) {
      if (!state.socket || !state.isConnected) {
        _toast('خطا', 'اتصال به سرور برقرار نیست', 'error');
        return;
      }
      
      if (!text.trim()) return;
      
      const senderId = _getAuthToken();
      state.socket.emit('chat:send', {
        senderId: senderId,
        receiverId: friendId,
        text: text.trim()
      });
    },

    render() {
      this.renderFriendCode();
      this.renderFriendsList();
    },

    renderFriendCode() {
      const container = document.getElementById('myFriendCodeDisplay');
      const profileContainer = document.getElementById('profileFriendCode');
      
      let html = '';
      const token = _getAuthToken();
      
      if (token && state.myFriendCode && state.myFriendCode !== '---') {
        html = `
          <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-secondary); border: 1px solid var(--accent); border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">کد دوست‌یابی شما:</div>
            <div style="font-size: 22px; font-weight: 900; color: var(--accent); font-family: var(--font-num); letter-spacing: 0.1em;">${state.myFriendCode}</div>
            <button class="btn btn-outline" style="margin-top: 8px; font-size: 12px; padding: 4px 12px;" onclick="navigator.clipboard.writeText('${state.myFriendCode}'); HokmUI.showToast('کپی شد', 'کد شما کپی شد', 'success');">📋 کپی کد</button>
          </div>
        `;
      } else {
        html = `
          <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 12px; color: var(--text-muted);">
              برای دریافت کد دوست‌یابی، لطفاً از حساب کاربری خود (ایمیل) وارد شوید.
            </div>
          </div>
        `;
      }

      if (container) container.innerHTML = html;
      if (profileContainer) profileContainer.innerHTML = html;
    },

    renderFriendsList() {
      const container = document.getElementById('friendsList');
      if (!container) return;

      const token = _getAuthToken();
      
      if (!token) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-title">برای استفاده از دوستان وارد شوید</div>
            <div class="empty-state-msg">ابتدا از حساب کاربری خود وارد شوید</div>
          </div>
        `;
        return;
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
        `;
      }).join('');
    },

    renderEmpty() {
      const container = document.getElementById('friendsList');
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-title">ارتباط با سرور برقرار نشد</div>
            <div class="empty-state-msg">لطفاً اتصال اینترنت خود را بررسی کنید</div>
          </div>
        `;
      }
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

      state.unreadCounts[friendId] = 0;
      this.renderFriendsList();

      const input = document.getElementById('chatInput');
      const sendBtn = document.getElementById('btnSendChat');

      const send = () => {
        if (input.value.trim()) {
          Friends.sendMessage(friendId, input.value.trim());
          
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
      
      if (state.socket && state.isConnected) {
        state.socket.emit('game:invite', {
          friendId: friendId,
          roomCode: roomCode,
          senderName: _profile()?.get().name || 'دوست شما'
        });
        _toast('🎮 دعوت ارسال شد', 'دعوت‌نامه به دوست شما ارسال شد', 'success');
      } else {
        _toast('خطا', 'اتصال به سرور برقرار نیست', 'error');
      }
    },

    handleIncomingMessage(data) {
      const friendId = data.senderId;
      
      if (!state.chats[friendId]) state.chats[friendId] = [];
      state.chats[friendId].push(data);

      const chatMessagesEl = document.getElementById('chatMessages');
      const modalTitle = document.querySelector('.modal-title');
      
      if (chatMessagesEl && modalTitle && modalTitle.textContent.includes('چت')) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `<div style="display:flex; justify-content:flex-end; margin-bottom:8px;"><div style="background:var(--bg-elevated); padding:8px 12px; border-radius:12px; font-size:13px; max-width: 80%;">${data.text}</div></div>`;
        chatMessagesEl.appendChild(wrapper.firstChild);
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
      } else {
        if (!state.unreadCounts[friendId]) state.unreadCounts[friendId] = 0;
        state.unreadCounts[friendId]++;
        this.renderFriendsList();
        
        _toast('💬 پیام جدید', data.text, 'info');
        if (_audio()) _audio().play('chat');
      }
    },

    bindEvents() {
      const addBtn = document.getElementById('btnAddFriend');
      const input = document.getElementById('friendCodeInput');
      
      if (addBtn && !addBtn.dataset.bound) {
        addBtn.dataset.bound = '1';
        addBtn.onclick = () => {
          const val = input.value.trim().toUpperCase();
          if (val) {
            Friends.addFriend(val);
            input.value = '';
          }
        };
      }
      
      if (input && !input.dataset.bound) {
        input.dataset.bound = '1';
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') addBtn.click();
        });
      }
    }
  };

  global.HokmFriends = Friends;

  // راه‌اندازی خودکار
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => Friends.init(), 1000);
  });

})(typeof window !== 'undefined' ? window : globalThis);