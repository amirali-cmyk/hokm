/* ═══════════════════════════════════════════════════════════
   🚀 HOKM PRO v6.0 — main.js
   راه‌انداز نهایی: Bootstrap همه ماژول‌ها + Splash + Init
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     اطلاعات نسخه
     ───────────────────────────────────────────── */
  const VERSION = '6.0.0';
  const BUILD = '2025.01';
  const SPLASH_DURATION = 2500; // ۲.۵ ثانیه
  const SPLASH_MIN_DURATION = 1200; // حداقل زمان نمایش

  /* ─────────────────────────────────────────────
     وضعیت
     ───────────────────────────────────────────── */
  const state = {
    bootStartTime: 0,
    modulesLoaded: {
      storage: false,
      themes: false,
      audio: false,
      profile: false,
      achievements: false,
      leaderboard: false,
      ai: false,
      game: false,
      ui: false
    },
    ready: false,
    errors: [],
    splashSkipped: false,
    splashTimeout: null
  };

  /* ─────────────────────────────────────────────
     کمکی‌ها
     ───────────────────────────────────────────── */
  function _toPersianNumber(n) {
    const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(n).replace(/\d/g, d => fa[+d]);
  }

  function _log(message, color = '#06d6a0') {
    console.log(
      `%c${message}`,
      `color: ${color}; font-weight: 600; font-size: 12px;`
    );
  }

  function _logGroup(title) {
    console.groupCollapsed(
      `%c${title}`,
      'color: #ffd60a; font-weight: 700; font-size: 13px;'
    );
  }

  function _logEnd() {
    console.groupEnd();
  }

  /* ─────────────────────────────────────────────
     بررسی ماژول‌ها
     ───────────────────────────────────────────── */
  function _checkModules() {
    const checks = [
      { name: 'storage',       global: global.HokmStorage,      color: '#06d6a0' },
      { name: 'themes',        global: global.HokmThemes,       color: '#9b5de5' },
      { name: 'audio',         global: global.HokmAudio,        color: '#118ab2' },
      { name: 'profile',       global: global.HokmProfile,      color: '#ef476f' },
      { name: 'achievements',  global: global.HokmAchievements, color: '#ffd60a' },
      { name: 'leaderboard',   global: global.HokmLeaderboard,  color: '#f4a259' },
      { name: 'ai',            global: global.HokmAI,           color: '#9b5de5' },
      { name: 'game',          global: global.HokmGame,         color: '#ef476f' },
      { name: 'ui',            global: global.HokmUI,           color: '#118ab2' }
    ];

    _logGroup('📦 Modules');

    checks.forEach(c => {
      const loaded = !!c.global;
      state.modulesLoaded[c.name] = loaded;

      if (loaded) {
        console.log(`%c✓ ${c.name}`, `color: ${c.color}; font-weight: 600;`);
      } else {
        console.warn(`%c✗ ${c.name} (گمشده)`, 'color: #ef476f; font-weight: 600;');
        state.errors.push(`ماژول ${c.name} لود نشده`);
      }
    });

    _logEnd();

    return checks.every(c => c.global);
  }

  /* ─────────────────────────────────────────────
     Splash Screen
     ───────────────────────────────────────────── */
  function _initSplash() {
    const splash = document.getElementById('splashScreen');
    const fill = document.getElementById('splashFill');
    const skipBtn = document.getElementById('btnSkipSplash');

    if (!splash) return;

    // نمایش progress
    if (fill) {
      // انیمیشن خودکار در CSS، فقط اجازه بده تکمیل شود
    }

    // Skip button
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        state.splashSkipped = true;
        _hideSplash();
      });
    }

    // Auto-hide after duration
    state.splashTimeout = setTimeout(() => {
      if (!state.splashSkipped) {
        _hideSplash();
      }
    }, SPLASH_DURATION);

    // Preconnect: هیچ کاری نیاز نیست، همه چیز محلیه

    _log(`🎬 Splash initialized (${SPLASH_DURATION}ms)`, '#ffd60a');
  }

  function _hideSplash() {
    const splash = document.getElementById('splashScreen');
    const app = document.getElementById('app');

    if (state.splashTimeout) {
      clearTimeout(state.splashTimeout);
      state.splashTimeout = null;
    }

    if (!splash) return;

    // محاسبه زمان باقی‌مانده
    const elapsed = Date.now() - state.bootStartTime;
    const remaining = Math.max(0, SPLASH_MIN_DURATION - elapsed);

    setTimeout(() => {
      splash.classList.add('hidden');

      // نمایش App
      if (app) {
        app.classList.remove('hidden');
      }

      // حذف بعد انیمیشن
      setTimeout(() => {
        splash.style.display = 'none';

        // نمایش منو
        if (global.HokmUI) {
          global.HokmUI.navigate('menu', { force: true });
        }
      }, 600);

      _log('✅ Splash hidden — App ready', '#06d6a0');
      _emitReady();

    }, remaining);
  }

  /* ─────────────────────────────────────────────
     رویداد آماده بودن
     ───────────────────────────────────────────── */
  function _emitReady() {
    state.ready = true;

    document.dispatchEvent(new CustomEvent('hokm:ready', {
      detail: { version: VERSION, build: BUILD }
    }));

    _log(`🎉 Hokm Pro v${VERSION} ready!`, '#ffd60a');

    // بررسی آیا نیاز به warn هست
    if (state.errors.length > 0) {
      console.warn(
        `%c⚠️ ${state.errors.length} خطا در بارگذاری`,
        'color: #ef476f; font-weight: 700; font-size: 13px;'
      );
      state.errors.forEach(e => console.warn(' - ' + e));
    }
  }

  /* ─────────────────────────────────────────────
     Global Error Handler
     ───────────────────────────────────────────── */
  function _setupGlobalErrorHandler() {
    window.addEventListener('error', (e) => {
      console.error('[Global Error]', e.error || e.message);
      state.errors.push(e.message);

      // نمایش Toast در صورت آماده بودن UI
      if (state.ready && global.HokmUI) {
        global.HokmUI.showToast(
          'خطای غیرمنتظره',
          e.message || 'مشکلی پیش آمد',
          'error',
          4000
        );
      }
    });

    window.addEventListener('unhandledrejection', (e) => {
      console.error('[Unhandled Promise]', e.reason);
      state.errors.push(String(e.reason));
    });
  }

  /* ─────────────────────────────────────────────
     Global Events
     ───────────────────────────────────────────── */
  function _setupGlobalEvents() {
    // Prevent context menu on game screen
    document.addEventListener('contextmenu', (e) => {
      const screen = global.HokmUI?.getCurrentScreen();
      if (screen === 'game') {
        e.preventDefault();
      }
    });

    // Prevent double-tap zoom on mobile
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });

    // Save on visibility change (بازی)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // ذخیره بازی جاری
        if (global.HokmGame && global.HokmGame.getPhase() === 'playing') {
          global.HokmGame.pause();
        }
      } else {
        // ادامه بازی
        if (global.HokmGame && global.HokmGame.getPhase() === 'playing') {
          global.HokmGame.resume();
        }
      }
    });

    // Before unload — هشدار در صورت بازی
    window.addEventListener('beforeunload', (e) => {
      if (global.HokmGame && global.HokmGame.getPhase() === 'playing') {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    });

    // Online/Offline
    window.addEventListener('online', () => {
      _log('🌐 متصل شد', '#06d6a0');
      if (global.HokmUI && state.ready) {
        global.HokmUI.showToast('اتصال', 'اینترنت متصل شد', 'success', 2000);
      }
    });

    window.addEventListener('offline', () => {
      _log('📴 قطع شد', '#ef476f');
      if (global.HokmUI && state.ready) {
        global.HokmUI.showToast('اتصال', 'حالت آفلاین', 'warning', 3000);
      }
    });

    // Detect device type
    _detectDevice();

    _log('🌍 Global events bound', '#118ab2');
  }

  /* ─────────────────────────────────────────────
     تشخیص دستگاه
     ───────────────────────────────────────────── */
  function _detectDevice() {
    const html = document.documentElement;

    // موبایل؟
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
      .test(navigator.userAgent);
    html.dataset.isMobile = String(isMobile);

    // تاچ؟
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    html.dataset.hasTouch = String(hasTouch);

    // iOS؟
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !window.MSStream;
    html.dataset.isIOS = String(isIOS);

    // Retina؟
    const isRetina = window.devicePixelRatio > 1;
    html.dataset.isRetina = String(isRetina);

    // Orientation
    _updateOrientation();
    window.addEventListener('orientationchange', _updateOrientation);

    _log(
      `📱 Device: ${isMobile ? 'Mobile' : 'Desktop'}, ` +
      `Touch: ${hasTouch}, iOS: ${isIOS}, Retina: ${isRetina}`,
      '#9b5de5'
    );
  }

  function _updateOrientation() {
    const orientation = window.innerWidth > window.innerHeight
      ? 'landscape'
      : 'portrait';
    document.documentElement.dataset.orientation = orientation;
  }

  /* ─────────────────────────────────────────────
     Keyboard Shortcuts Helper
     ───────────────────────────────────────────── */
  function _setupKeyboardHelpers() {
    // F1 → راهنما
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        if (global.HokmUI) global.HokmUI.navigate('help');
      }
    });

    // Ctrl/Cmd + S → ذخیره بازی
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (global.HokmGame && global.HokmGame.getPhase() === 'playing') {
          global.HokmGame.pause();
          if (global.HokmUI) {
            global.HokmUI.showToast('ذخیره', 'بازی ذخیره شد', 'success');
          }
        }
      }
    });
  }

  /* ─────────────────────────────────────────────
     Performance Monitoring
     ───────────────────────────────────────────── */
  function _setupPerformance() {
    if (!window.performance || !performance.now) return;

    // FPS Monitoring (lightweight)
    let lastFrame = performance.now();
    let frames = 0;
    let fpsCheckTime = 0;

    function checkFPS(now) {
      frames++;
      const delta = now - lastFrame;

      if (delta >= 1000) {
        const fps = Math.round((frames * 1000) / delta);
        fpsCheckTime = now;

        if (fps < 30 && state.ready) {
          console.warn(`[Performance] Low FPS: ${fps}`);
        }

        frames = 0;
        lastFrame = now;
      }

      requestAnimationFrame(checkFPS);
    }

    // اجرا فقط بعد از ready
    document.addEventListener('hokm:ready', () => {
      requestAnimationFrame(checkFPS);
    });
  }

  /* ─────────────────────────────────────────────
     ذخیره خودکار
     ───────────────────────────────────────────── */
  function _setupAutoSave() {
    // هر ۳۰ ثانیه در حین بازی
    setInterval(() => {
      if (global.HokmGame && global.HokmGame.getPhase() === 'playing') {
        // Autosave در game.js هم هست، این یک بکاپ اضافیست
        if (global.HokmStorage) {
          // ذخیره تنظیمات
          // (خودکار از طریق themes و profile)
        }
      }
    }, 30000);
  }

  /* ─────────────────────────────────────────────
     Bootstrap اصلی
     ───────────────────────────────────────────── */
  async function bootstrap() {
    state.bootStartTime = Date.now();

    // ─── شروع ───
    console.log(
      `%c🃏 HOKM PRO v${VERSION} (build ${BUILD})\n` +
      `%cBoot starting...`,
      'color: #ffd60a; font-size: 16px; font-weight: 900;',
      'color: #06d6a0; font-size: 12px;'
    );

    // ─── Setup Global Handlers ───
    _setupGlobalErrorHandler();
    _setupGlobalEvents();
    _setupKeyboardHelpers();
    _setupPerformance();

    // ─── Init Splash ───
    _initSplash();

    // ─── صبر برای لود ماژول‌ها ───
    await _delay(100);

    // ─── بررسی ماژول‌ها ───
    const allLoaded = _checkModules();

    if (!allLoaded) {
      console.warn(
        '%c⚠️ بعضی ماژول‌ها لود نشده‌اند — برنامه با محدودیت ادامه می‌دهد',
        'color: #f4a259; font-weight: 700;'
      );
    }

    // ─── تاخیر کوچک برای پایداری ───
    await _delay(200);

    // ─── Setup AutoSave ───
    _setupAutoSave();

    // ─── Log نهایی ───
    const loadTime = Date.now() - state.bootStartTime;
    _logGroup('✅ Bootstrap complete');
    console.log(`%cزمان بارگذاری: ${_toPersianNumber(loadTime)}ms`, 'color: #06d6a0; font-weight: 700;');
    console.log(`%cنسخه: ${VERSION}`, 'color: #ffd60a; font-weight: 700;');
    _logEnd();

    // ─── اگر splash سریع‌تر از موعد تموم شد ───
    // splash خودش با timeout مدیریت می‌شه

    // ─── پیام خوش‌آمد بعد از آماده شدن ───
    document.addEventListener('hokm:ready', () => {
      _showWelcomeIfFirstTime();
    }, { once: true });
  }

  function _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* ─────────────────────────────────────────────
     پیام خوش‌آمد برای اولین بار
     ───────────────────────────────────────────── */
  function _showWelcomeIfFirstTime() {
    if (!global.HokmStorage) return;

    const key = 'hokm_welcome_shown';
    const storage = global.HokmStorage;

    if (storage.getRaw(key)) return;

    setTimeout(() => {
      const isGuest = global.HokmProfile?.isGuest();

      if (isGuest) {
        global.HokmUI?.showToast(
          '👋 خوش آمدی!',
          'برای شروع روی دکمه سبز بزرگ کلیک کن',
          'info',
          5000
        );
      } else {
        const name = global.HokmProfile?.getName() || 'کاربر';
        global.HokmUI?.showToast(
          `👋 سلام ${name}!`,
          'آماده بازی هستی؟',
          'success',
          4000
        );
      }

      storage.setRaw(key, '1');
    }, 500);
  }

  /* ─────────────────────────────────────────────
     API عمومی
     ───────────────────────────────────────────── */
  const App = {
    VERSION,
    BUILD,

    /**
     * دریافت وضعیت
     */
    getStatus() {
      return {
        version: VERSION,
        build: BUILD,
        ready: state.ready,
        modules: { ...state.modulesLoaded },
        errors: state.errors.slice(),
        loadTime: Date.now() - state.bootStartTime
      };
    },

    /**
     * ریست کامل برنامه (factory reset)
     */
    factoryReset() {
      if (!confirm('⚠️ تمام داده‌های شما پاک می‌شود. مطمئن هستید؟')) {
        return false;
      }

      if (global.HokmStorage) {
        global.HokmStorage.clearAll();
      }

      sessionStorage.clear();

      _log('🗑️ Factory reset — reloading', '#ef476f');

      setTimeout(() => {
        window.location.reload();
      }, 500);

      return true;
    },

    /**
     * بازگشایی رابط کاربری پس از هر اتفاق
     */
    reload() {
      window.location.reload();
    },

    /**
     * نسخه‌ی کامل
     */
    version() {
      return `${VERSION} (build ${BUILD})`;
    },

    /**
     * تست کامل سیستم
     */
    async test() {
      _logGroup('🧪 Running system test...');

      const results = [];

      // تست Storage
      try {
        const s = global.HokmStorage?.getProfile();
        results.push({ name: 'Storage', ok: !!s });
      } catch (e) {
        results.push({ name: 'Storage', ok: false, error: e.message });
      }

      // تست Themes
      try {
        const mode = global.HokmThemes?.getMode();
        results.push({ name: 'Themes', ok: !!mode });
      } catch (e) {
        results.push({ name: 'Themes', ok: false, error: e.message });
      }

      // تست Audio
      try {
        global.HokmAudio?.play('softClick');
        results.push({ name: 'Audio', ok: true });
      } catch (e) {
        results.push({ name: 'Audio', ok: false, error: e.message });
      }

      // تست Profile
      try {
        const p = global.HokmProfile?.get();
        results.push({ name: 'Profile', ok: !!p });
      } catch (e) {
        results.push({ name: 'Profile', ok: false, error: e.message });
      }

      // تست Game
      try {
        const phase = global.HokmGame?.getPhase();
        results.push({ name: 'Game', ok: !!phase });
      } catch (e) {
        results.push({ name: 'Game', ok: false, error: e.message });
      }

      // تست UI
      try {
        const screen = global.HokmUI?.getCurrentScreen();
        results.push({ name: 'UI', ok: !!screen });
      } catch (e) {
        results.push({ name: 'UI', ok: false, error: e.message });
      }

      // نمایش
      results.forEach(r => {
        if (r.ok) {
          console.log(`%c✓ ${r.name}`, 'color: #06d6a0; font-weight: 600;');
        } else {
          console.warn(`%c✗ ${r.name}: ${r.error || 'unknown'}`, 'color: #ef476f;');
        }
      });

      _logEnd();

      return results;
    }
  };

  /* ─────────────────────────────────────────────
     Export
     ───────────────────────────────────────────── */
  global.HokmApp = App;

  /* ─────────────────────────────────────────────
     Auto-Bootstrap
     ───────────────────────────────────────────── */
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
      // اگر DOM آماده است، بعد از یک tick شروع کن
      setTimeout(bootstrap, 0);
    }
  }

  /* ─────────────────────────────────────────────
     Service Worker (اختیاری — برای PWA)
     ───────────────────────────────────────────── */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          _log('📦 Service Worker registered', '#06d6a0');
        })
        .catch(err => {
          // بی‌صدا نادیده بگیر (SW ممکنه نباشه)
        });
    });
  }

  /* ─────────────────────────────────────────────
     Console Easter Egg
     ───────────────────────────────────────────── */
  setTimeout(() => {
    if (state.ready) {
      console.log(
        `%c🃏 می‌خوای تقلب کنی؟ 😏\n` +
        `%cاز این دستورات استفاده کن:\n` +
        `%c  HokmApp.test()       %c— تست کامل سیستم\n` +
        `%c  HokmGame.getState()  %c— وضعیت بازی جاری\n` +
        `%c  HokmProfile.get()    %c— اطلاعات پروفایل\n` +
        `%c  HokmAudio.testAll()  %c— تست صداها`,
        'color: #ffd60a; font-size: 16px; font-weight: 900;',
        'color: #a0a8b8; font-size: 12px;',
        'color: #06d6a0; font-family: monospace;',
        'color: #a0a8b8;',
        'color: #06d6a0; font-family: monospace;',
        'color: #a0a8b8;',
        'color: #06d6a0; font-family: monospace;',
        'color: #a0a8b8;',
        'color: #06d6a0; font-family: monospace;',
        'color: #a0a8b8;'
      );
    }
  }, 3000);

})(typeof window !== 'undefined' ? window : globalThis);