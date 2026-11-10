/* ═══════════════════════════════════════════════════════════
   🔐 HOKM PRO v6.2.0 — auth.js
   مدیریت ورود، ثبت‌نام و اتصال به سرور دوستان (Render)
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const AUTH_API = 'https://hokm-friends.onrender.com'; // آدرس سرور روی Render

  function _ui() { return global.HokmUI; }
  function _profile() { return global.HokmProfile; }
  function _storage() { return global.HokmStorage; }

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
      const form = document.getElementById('authForm');
      if (form && !form.dataset.bound) {
        form.dataset.bound = '1';
        
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const isRegister = document.querySelector('.auth-tab[data-auth="register"]').classList.contains('active');
          
          const name = document.getElementById('authName').value.trim();
          const email = document.getElementById('authEmail').value.trim();
          const password = document.getElementById('authPassword').value;

          if (isRegister) {
            this.register(name, email, password);
          } else {
            this.login(email, password);
          }
        });
      }
    },

    async register(name, email, password) {
      try {
        const btn = document.getElementById('btnAuthSubmit');
        btn.textContent = 'در حال ثبت‌نام...';
        btn.disabled = true;

        const res = await fetch(`${AUTH_API}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();
        
        if (res.ok) {
          // ذخیره توکن و اطلاعات
          localStorage.setItem('hokm_auth_token', data.token);
          localStorage.setItem('hokm_friend_code', data.friendCode);
          
          // آپدیت پروفایل محلی
          _profile().setFromServer({
            name: name,
            email: email,
            userId: data.token,
            friendCode: data.friendCode,
            isGuest: false
          });

          if (_ui()) _ui().showToast('✅ خوش آمدی!', 'حساب شما ساخته شد', 'success');
          _ui().navigate('menu');
          
          // راه‌اندازی مجدد دوستان با توکن جدید
          if (global.HokmFriends) global.HokmFriends.init();
        } else {
          _ui().showToast('خطا در ثبت‌نام', data.error, 'error');
        }
      } catch (err) {
        _ui().showToast('خطا', 'ارتباط با سرور برقرار نشد', 'error');
      } finally {
        const btn = document.getElementById('btnAuthSubmit');
        btn.textContent = 'ثبت‌نام';
        btn.disabled = false;
      }
    },

    async login(email, password) {
      // (چون در سرور فعلی API لاگین پیاده‌سازی نشده، فعلاً فقط از ثبت‌نام استفاده می‌کنیم. 
      // در نسخه بعدی می‌تونیم API لاگین رو هم اضافه کنیم)
      _ui().showToast('توجه', 'برای ورود، لطفاً ابتدا ثبت‌نام کنید', 'info');
      document.querySelector('.auth-tab[data-auth="register"]').click();
    },

    async fetchMyProfile(token) {
      try {
        const res = await fetch(`${AUTH_API}/api/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          _profile().setFromServer(data.user);
          
          // آپدیت وضعیت دکمه ورود به خروج
          const loginBtn = document.getElementById('btnLogin');
          if (loginBtn) {
            loginBtn.textContent = 'خروج';
            loginBtn.onclick = () => {
              localStorage.removeItem('hokm_auth_token');
              localStorage.removeItem('hokm_friend_code');
              location.reload();
            };
          }
        }
      } catch (err) {
        console.warn('Auth check failed:', err.message);
      }
    }
  };

  global.HokmAuth = Auth;

  // راه‌اندازی پس از لود DOM
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(() => Auth.init(), 500));
    } else {
      setTimeout(() => Auth.init(), 500);
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);