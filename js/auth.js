/* ═══════════════════════════════════════════════════════════
   🔐 HOKM PRO v6.2.0 — auth.js
   مدیریت ورود، ثبت‌نام و اتصال به سرور دوستان (Render)
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const AUTH_API = 'https://hokm-friends.onrender.com'; // آدرس سرور روی Render
  let isRegisterMode = false; // وضعیت فرم: ورود یا ثبت‌نام

  function _ui() { return global.HokmUI; }
  function _profile() { return global.HokmProfile; }

  const Auth = {

    init() {
      this.bindTabs();   // اتصال تب‌های ورود/ثبت‌نام
      this.bindForm();   // اتصال فرم
      
      // بررسی وضعیت لاگین بودن کاربر در شروع برنامه
      const savedToken = localStorage.getItem('hokm_auth_token');
      if (savedToken) {
        this.fetchMyProfile(savedToken);
      }
    },

    // اتصال دکمه‌های بالای فرم (ورود / ثبت‌نام)
    bindTabs() {
      const tabs = document.querySelectorAll('.auth-tab');
      tabs.forEach(tab => {
        if (tab.dataset.bound) return;
        tab.dataset.bound = '1';
        
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          
          isRegisterMode = tab.dataset.auth === 'register';
          
          const submitBtn = document.getElementById('btnAuthSubmit');
          if (submitBtn) {
            submitBtn.textContent = isRegisterMode ? 'ثبت‌نام' : 'ورود';
          }
        });
      });
    },

    // اتصال فرم
    bindForm() {
      const form = document.getElementById('authForm');
      if (!form || form.dataset.bound) return;
      form.dataset.bound = '1';
      
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('authName').value.trim();
        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;

        if (isRegisterMode) {
          if (!name) {
            _ui().showToast('خطا', 'لطفاً نام کاربری را وارد کنید', 'error');
            return;
          }
          this.register(name, email, password);
        } else {
          this.login(email, password);
        }
      });
    },

    async register(name, email, password) {
      const btn = document.getElementById('btnAuthSubmit');
      const originalText = btn.textContent;
      
      try {
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

          if (_ui()) {
            _ui().showToast('✅ خوش آمدی!', 'حساب شما با موفقیت ساخته شد', 'success');
            _ui().navigate('menu');
          }
          
          // راه‌اندازی مجدد دوستان با توکن جدید
          if (global.HokmFriends) global.HokmFriends.init();
        } else {
          _ui().showToast('خطا در ثبت‌نام', data.error || 'مشکلی پیش آمد', 'error');
        }
      } catch (err) {
        _ui().showToast('خطا', 'ارتباط با سرور برقرار نشد', 'error');
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    },

    async login(email, password) {
      // چون API لاگین هنوز توی سرور پیاده‌سازی نشده، فعلاً پیام می‌دیم
      if (_ui()) {
        _ui().showToast(
          'توجه', 
          'در حال حاضر امکان ورود با ایمیل وجود ندارد. لطفاً یک حساب جدید ثبت‌نام کنید.', 
          'info', 
          4000
        );
      }
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