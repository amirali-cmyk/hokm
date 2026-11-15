/* ═══════════════════════════════════════════════════════════
   🔐 HOKM PRO v6.2.0 — auth.js
   سیستم ثبت‌نام، ورود و مدیریت توکن (متصل به Render)
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // 🎯 آدرس سرور دوستان و احراز هویت
  const AUTH_API = 'https://hokm-friends.onrender.com';

  function _storage() { return global.HokmStorage; }
  function _profile() { return global.HokmProfile; }
  function _ui() { return global.HokmUI; }
  function _audio() { return global.HokmAudio; }
  
  function _toast(title, msg, type) { if (_ui()) _ui().showToast(title, msg, type); }

  function _getAuthToken() {
    return localStorage.getItem('hokm_auth_token');
  }

  function _setAuthToken(token) {
    localStorage.setItem('hokm_auth_token', token);
  }

  function _clearAuthToken() {
    localStorage.removeItem('hokm_auth_token');
  }

  const Auth = {

    init() {
      this.bindEvents();
      this.updateUI();
    },

    bindEvents() {
      const form = document.getElementById('authForm');
      const tabs = document.querySelectorAll('.auth-tab');
      const loginBtn = document.getElementById('btnLogin');
      const quickPlayBtn = document.getElementById('btnQuickPlay');
      
      let currentMode = 'login'; // login | register

      // تغییر بین تب ورود و ثبت‌نام
      if (tabs.length > 0) {
        tabs.forEach(tab => {
          tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMode = tab.dataset.auth;
            
            const submitBtn = document.getElementById('btnAuthSubmit');
            if (submitBtn) {
              submitBtn.textContent = currentMode === 'register' ? 'ثبت‌نام' : 'ورود';
            }
            
            // در حالت ورود، فیلد نام کاربری رو مخفی یا غیرفعال نمی‌کنیم، 
            // ولی چون بک‌اند ما با ایمیل لاگین می‌کنه، پس فقط ایمیل و رمز مهمن.
            // برای سادگی، ما هر دو رو نگه می‌داریم.
            const nameInput = document.getElementById('authName');
            if (nameInput) {
              nameInput.style.display = currentMode === 'register' ? 'block' : 'none';
              nameInput.required = currentMode === 'register';
            }
          });
        });
      }

      // ارسال فرم ثبت‌نام/ورود
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const name = document.getElementById('authName')?.value.trim();
          const email = document.getElementById('authEmail')?.value.trim();
          const password = document.getElementById('authPassword')?.value;

          if (!email || !password) {
            _toast('خطا', 'ایمیل و رمز عبور الزامی است', 'error');
            return;
          }

          const submitBtn = document.getElementById('btnAuthSubmit');
          const originalText = submitBtn.textContent;
          submitBtn.textContent = 'لطفاً صبر کنید...';
          submitBtn.disabled = true;

          try {
            const endpoint = currentMode === 'register' ? '/api/register' : '/api/login';
            const payload = { email, password };
            if (currentMode === 'register' && name) payload.name = name;

            const res = await fetch(`${AUTH_API}${endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
              _setAuthToken(data.token);
              
              // آپدیت پروفایل محلی
              const storage = _storage();
              if (storage) {
                const p = storage.getProfile();
                p.name = data.user?.name || name || p.name;
                p.userId = data.user?.userId || data.token;
                p.friendCode = data.user?.friendCode || data.friendCode || p.friendCode;
                p.isGuest = false;
                storage.setProfile(p);
              }
              
              if (_profile()) _profile().updateUI();
              if (global.HokmFriends) global.HokmFriends.loadMyInfo();
              
              _toast('✅ خوش آمدی!', 'با موفقیت وارد شدی', 'success');
              if (_audio()) _audio().play('success');
              
              this.updateUI();
              if (_ui()) _ui().navigate('menu');
              
            } else {
              _toast('خطا', data.error || 'مشکلی پیش آمد', 'error');
            }
          } catch (err) {
            _toast('خطا', 'ارتباط با سرور برقرار نشد', 'error');
            console.error(err);
          } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
          }
        });
      }

      // دکمه ورود در منو/پروفایل
      if (loginBtn) {
        loginBtn.addEventListener('click', () => {
          if (_getAuthToken()) {
            // لاگ‌اوت
            if (confirm('از حساب خود خارج می‌شوید؟')) {
              this.logout();
            }
          } else {
            if (_ui()) _ui().navigate('auth');
          }
        });
      }

      // دکمه ادامه به عنوان مهمان
      if (quickPlayBtn) {
        quickPlayBtn.addEventListener('click', () => {
          if (_ui()) _ui().navigate('menu');
        });
      }
    },

    updateUI() {
      const token = _getAuthToken();
      const isLoggedIn = !!token;

      const loginBtn = document.getElementById('btnLogin');
      if (loginBtn) {
        if (isLoggedIn) {
          loginBtn.textContent = 'خروج از حساب';
          loginBtn.classList.add('logout');
        } else {
          loginBtn.textContent = 'ورود / ثبت‌نام';
          loginBtn.classList.remove('logout');
        }
      }
    },

    logout() {
      _clearAuthToken();
      // پاک کردن اطلاعات کاربر از پروفایل
      const storage = _storage();
      if (storage) {
        const p = storage.getProfile();
        p.isGuest = true;
        p.userId = null;
        p.friendCode = null;
        storage.setProfile(p);
      }
      this.updateUI();
      if (_profile()) _profile().updateUI();
      _toast('خارج شدی', 'با موفقیت از حساب خارج شدی', 'info');
    }
  };

  global.HokmAuth = Auth;

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => Auth.init(), 800);
  });

})(typeof window !== 'undefined' ? window : globalThis);