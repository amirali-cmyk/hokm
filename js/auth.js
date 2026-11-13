/* ═══════════════════════════════════════════════════════════
   🔐 HOKM PRO v6.2.0 — auth.js
   مدیریت ثبت‌نام، ورود و اتصال به سرور دوستان (Render)
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // 🎯 آدرس سرور روی Render
  const AUTH_API = 'https://hokm-friends.onrender.com';

  function _ui() { return global.HokmUI; }
  function _profile() { return global.HokmProfile; }
  function _audio() { return global.HokmAudio; }

  function _toast(title, msg, type) {
    if (_ui() && typeof _ui().showToast === 'function') {
      _ui().showToast(title, msg, type || 'info');
    } else {
      console.log(`[Auth] ${type}: ${title} - ${msg}`);
    }
  }

  const Auth = {

    init() {
      this.bindEvents();
      
      // بررسی وضعیت لاگین بودن کاربر در شروع برنامه
      const savedToken = localStorage.getItem('hokm_auth_token');
      if (savedToken) {
        this.fetchMyProfile(savedToken);
      }
    },

    bindEvents() {
      // دکمه «ورود / ثبت‌نام» توی صفحه منو
      const loginBtn = document.getElementById('btnLogin');
      if (loginBtn && !loginBtn.dataset.bound) {
        loginBtn.dataset.bound = '1';
        loginBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (_profile() && _profile().isGuest()) {
            if (_ui()) _ui().navigate('auth');
          } else {
            if (confirm('از حساب خود خارج می‌شوید؟')) {
              localStorage.removeItem('hokm_auth_token');
              localStorage.removeItem('hokm_friend_code');
              location.reload();
            }
          }
        });
      }

      // فرم ثبت‌نام / ورود
      const form = document.getElementById('authForm');
      if (form && !form.dataset.bound) {
        form.dataset.bound = '1';
        
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          
          const activeTab = document.querySelector('.auth-tab.active');
          const isRegister = activeTab?.dataset.auth === 'register';
          
          const nameEl = document.getElementById('authName');
          const emailEl = document.getElementById('authEmail');
          const passEl = document.getElementById('authPassword');

          const name = nameEl ? nameEl.value.trim() : '';
          const email = emailEl ? emailEl.value.trim() : '';
          const password = passEl ? passEl.value : '';

          if (isRegister) {
            this.register(name, email, password);
          } else {
            this.login(email, password);
          }
        });
      }

      // تب‌های ورود/ثبت‌نام
      const authTabs = document.querySelectorAll('.auth-tab');
      authTabs.forEach(tab => {
        if (tab.dataset.bound) return;
        tab.dataset.bound = '1';
        tab.addEventListener('click', () => {
          authTabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const submitBtn = document.getElementById('btnAuthSubmit');
          if (submitBtn) {
            submitBtn.textContent = tab.dataset.auth === 'register' ? 'ثبت‌نام' : 'ورود';
          }
        });
      });

      // دکمه «ادامه به عنوان مهمان»
      const quickPlay = document.getElementById('btnQuickPlay');
      if (quickPlay && !quickPlay.dataset.bound) {
        quickPlay.dataset.bound = '1';
        quickPlay.addEventListener('click', () => {
          if (_ui()) _ui().navigate('menu');
        });
      }
    },

    async register(name, email, password) {
      if (!name || !email || password.length < 6) {
        _toast('خطا', 'همه فیلدها را پر کنید (رمز حداقل ۶ کاراکتر)', 'error');
        return;
      }

      try {
        const btn = document.getElementById('btnAuthSubmit');
        if (btn) { btn.textContent = 'در حال ثبت‌نام...'; btn.disabled = true; }

        const res = await fetch(`${AUTH_API}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();
        
        if (res.ok) {
          // ذخیره توکن
          localStorage.setItem('hokm_auth_token', data.token);
          localStorage.setItem('hokm_friend_code', data.friendCode);
          
          // آپدیت پروفایل محلی
          if (_profile()) {
            _profile().setFromServer({
              name: name,
              email: email,
              userId: data.token,
              friendCode: data.friendCode,
              isGuest: false
            });
          }

          _toast('✅ خوش آمدی!', 'حساب شما ساخته شد', 'success');
          if (_audio()) _audio().play('success');
          if (_ui()) _ui().navigate('menu');
          
          // راه‌اندازی مجدد دوستان با توکن جدید
          if (global.HokmFriends) global.HokmFriends.init();
        } else {
          _toast('خطا در ثبت‌نام', data.error || 'مشکلی پیش آمد', 'error');
        }
      } catch (err) {
        console.error('[Auth] Register error:', err);
        _toast('خطا', 'ارتباط با سرور برقرار نشد (اینترنت را چک کنید)', 'error');
      } finally {
        const btn = document.getElementById('btnAuthSubmit');
        if (btn) { btn.textContent = 'ثبت‌نام'; btn.disabled = false; }
      }
    },

    async login(email, password) {
      if (!email || !password) {
        _toast('خطا', 'ایمیل و رمز را وارد کنید', 'error');
        return;
      }

      try {
        const btn = document.getElementById('btnAuthSubmit');
        if (btn) { btn.textContent = 'در حال ورود...'; btn.disabled = true; }

        const res = await fetch(`${AUTH_API}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        
        if (res.ok) {
          localStorage.setItem('hokm_auth_token', data.token);
          localStorage.setItem('hokm_friend_code', data.user.friendCode);
          
          if (_profile()) {
            _profile().setFromServer({
              name: data.user.name,
              email: email,
              userId: data.token,
              friendCode: data.user.friendCode,
              isGuest: false
            });
          }

          _toast('✅ خوش آمدی!', 'با موفقیت وارد شدید', 'success');
          if (_audio()) _audio().play('success');
          if (_ui()) _ui().navigate('menu');
          
          if (global.HokmFriends) global.HokmFriends.init();
        } else {
          _toast('خطا', data.error || 'ایمیل یا رمز اشتباه است', 'error');
        }
      } catch (err) {
        _toast('خطا', 'ارتباط با سرور برقرار نشد', 'error');
      } finally {
        const btn = document.getElementById('btnAuthSubmit');
        if (btn) { btn.textContent = 'ورود'; btn.disabled = false; }
      }
    },

    async fetchMyProfile(token) {
      try {
        const res = await fetch(`${AUTH_API}/api/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (_profile()) _profile().setFromServer(data.user);
          
          // آپدیت دکمه ورود به خروج
          const loginBtn = document.getElementById('btnLogin');
          if (loginBtn) loginBtn.textContent = 'خروج';
        } else {
          // توکن منقضی شده
          localStorage.removeItem('hokm_auth_token');
          localStorage.removeItem('hokm_friend_code');
        }
      } catch (err) {
        console.warn('Auth check failed:', err.message);
      }
    }
  };

  global.HokmAuth = Auth;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(() => Auth.init(), 800));
    } else {
      setTimeout(() => Auth.init(), 800);
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);