/* ═══════════════════════════════════════════════════════════
   🚀 HOKM PRO v6.1.1 — main.js
   راه‌انداز نهایی: Bootstrap + Splash + آمار + راهنما
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const VERSION = '6.1.1';
  const BUILD = '2026.10';
  const SPLASH_DURATION = 2500;
  const SPLASH_MIN_DURATION = 1200;

  const state = {
    bootStartTime: Date.now(),
    ready: false,
    errors: [],
    splashSkipped: false,
    splashTimeout: null
  };

  /* ─────────────────────────────────────────────
     لاگ‌ها
     ───────────────────────────────────────────── */
  function _log(msg, color) {
    color = color || '#06d6a0';
    console.log('%c' + msg, 'color: ' + color + '; font-weight: 600; font-size: 12px;');
  }

  function _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* ─────────────────────────────────────────────
     بررسی ماژول‌ها
     ───────────────────────────────────────────── */
  function _checkModules() {
    const modules = [
      'HokmStorage', 'HokmThemes', 'HokmAudio', 'HokmProfile',
      'HokmAchievements', 'HokmLeaderboard', 'HokmFriends',
      'HokmTournament', 'HokmReplay', 'HokmShare', 'HokmAI',
      'HokmGame', 'HokmUI', 'HokmSettings'
    ];

    let ok = 0;
    let missing = [];

    console.groupCollapsed('%c📦 Modules', 'color: #ffd60a; font-weight: 700;');
    modules.forEach(name => {
      if (global[name] && typeof global[name] === 'object') {
        console.log('%c✓ ' + name, 'color: #06d6a0; font-weight: 600;');
        ok++;
      } else {
        console.warn('%c✗ ' + name, 'color: #ef476f; font-weight: 600;');
        missing.push(name);
      }
    });
    console.groupEnd();

    return { ok, total: modules.length, missing };
  }

  /* ─────────────────────────────────────────────
     Splash
     ───────────────────────────────────────────── */
  function _initSplash() {
    const splash = document.getElementById('splashScreen');
    const skipBtn = document.getElementById('btnSkipSplash');

    if (!splash) return;

    if (skipBtn && !skipBtn.dataset.bound) {
      skipBtn.dataset.bound = '1';
      skipBtn.addEventListener('click', () => {
        state.splashSkipped = true;
        _hideSplash();
      });
    }

    state.splashTimeout = setTimeout(() => {
      if (!state.splashSkipped) _hideSplash();
    }, SPLASH_DURATION);

    _log('🎬 Splash initialized', '#ffd60a');
  }

  function _hideSplash() {
    const splash = document.getElementById('splashScreen');
    const app = document.getElementById('app');

    if (state.splashTimeout) {
      clearTimeout(state.splashTimeout);
      state.splashTimeout = null;
    }

    if (!splash) return;

    const elapsed = Date.now() - state.bootStartTime;
    const remaining = Math.max(0, SPLASH_MIN_DURATION - elapsed);

    setTimeout(() => {
      splash.classList.add('hidden');

      setTimeout(() => {
        splash.style.display = 'none';
      }, 600);

      if (app) app.classList.remove('hidden');

      setTimeout(() => {
        try {
          if (global.HokmUI && typeof global.HokmUI.navigate === 'function') {
            global.HokmUI.navigate('menu', { force: true });
          }
        } catch (err) {
          console.warn('Navigate error:', err);
          var menu = document.getElementById('screen-menu');
          if (menu) {
            document.querySelectorAll('.screen').forEach(function(s) {
              s.classList.remove('active');
            });
            menu.classList.add('active');
          }
        }
      }, 100);

      _log('✅ Splash hidden', '#06d6a0');
      _emitReady();
    }, remaining);
  }

  function _emitReady() {
    state.ready = true;

    try {
      document.dispatchEvent(new CustomEvent('hokm:ready', {
        detail: { version: VERSION }
      }));
    } catch (e) {}

    _log('🎉 Hokm Pro v' + VERSION + ' ready!', '#ffd60a');
  }

  /* ─────────────────────────────────────────────
     Error Handler
     ───────────────────────────────────────────── */
  function _setupGlobalErrorHandler() {
    window.addEventListener('error', function(e) {
      console.error('[Global Error]', e.error || e.message);
      state.errors.push(e.message || 'Unknown error');
    });

    window.addEventListener('unhandledrejection', function(e) {
      console.error('[Unhandled Promise]', e.reason);
    });
  }

  /* ─────────────────────────────────────────────
     Device Detection
     ───────────────────────────────────────────── */
  function _detectDevice() {
    const html = document.documentElement;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    html.dataset.isMobile = String(isMobile);

    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    html.dataset.hasTouch = String(hasTouch);
  }

  /* ─────────────────────────────────────────────
     Keyboard Helpers
     ───────────────────────────────────────────── */
  function _setupKeyboardHelpers() {
    document.addEventListener('keydown', function(e) {
      if (e.key === 'F1') {
        e.preventDefault();
        if (global.HokmUI) global.HokmUI.navigate('help');
      }
    });
  }

  /* ─────────────────────────────────────────────
     🆕 اتصال تب آمار (Stats Tab)
     ───────────────────────────────────────────── */
  function _bindStatsTab() {
    const statsTab = document.querySelector('.tab[data-tab="stats"]');

    if (!statsTab) {
      console.warn('[Main] تب آمار پیدا نشد');
      return;
    }

    if (statsTab.dataset.bound) return;
    statsTab.dataset.bound = '1';

    statsTab.addEventListener('click', () => {
      console.log('%c📊 رفتن به صفحه آمار', 'color: #118ab2; font-weight: bold;');

      if (global.HokmUI && typeof global.HokmUI.navigate === 'function') {
        global.HokmUI.navigate('stats');
      } else {
        var screens = document.querySelectorAll('.screen');
        for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
        var screen = document.getElementById('screen-stats');
        if (screen) screen.classList.add('active');

        var allTabs = document.querySelectorAll('.tab');
        for (var j = 0; j < allTabs.length; j++) allTabs[j].classList.remove('active');
        statsTab.classList.add('active');
      }

      _renderStatsPage();
    });

    _log('✅ تب آمار فعال شد', '#06d6a0');
  }

  /* ─────────────────────────────────────────────
     🆕 اتصال دکمه راهنما (Help Modal)
     ───────────────────────────────────────────── */
  function _bindHelpButton() {
    const helpBtn = document.getElementById('btnOpenHelp');

    if (!helpBtn) {
      console.warn('[Main] دکمه راهنما پیدا نشد');
      return;
    }

    if (helpBtn.dataset.bound) return;
    helpBtn.dataset.bound = '1';

    helpBtn.addEventListener('click', () => {
      console.log('%c📖 باز کردن مودال راهنما', 'color: #ffd60a; font-weight: bold;');

      if (global.HokmUI && typeof global.HokmUI.openHelpModal === 'function') {
        global.HokmUI.openHelpModal();
      } else if (global.HokmUI) {
        global.HokmUI.openModal(`
          <h2 class="modal-title">📖 راهنمای بازی حکم</h2>
          <div style="display:flex; flex-direction:column; gap:16px; margin-top:16px;">
            <div>
              <h3 style="color:var(--accent); font-size:16px;">🎯 هدف بازی</h3>
              <p style="color:var(--text-secondary); font-size:13px;">۴ بازیکن در ۲ تیم روبه‌روی هم. باید ۷ دست از ۱۳ دست رو ببرید.</p>
            </div>
            <div>
              <h3 style="color:var(--accent); font-size:16px;">🃏 ترتیب کارت‌ها</h3>
              <p style="color:var(--text-secondary); font-size:13px;">A (14) > K (13) > Q (12) > J (11) > 10 > ... > 2</p>
            </div>
            <div>
              <h3 style="color:var(--accent); font-size:16px;">👑 حکم‌خوانی</h3>
              <p style="color:var(--text-secondary); font-size:13px;">یک نفر حکم تعیین می‌کند. خال حکم بر همه چیز برتری دارد.</p>
            </div>
            <div>
              <h3 style="color:var(--accent); font-size:16px;">⚖️ قوانین طلایی</h3>
              <p style="color:var(--text-secondary); font-size:13px;">پیروی از خال الزامی است. اگر کارت هم‌خال داری، باید همون رو بازی کنی.</p>
            </div>
          </div>
          <div class="modal-actions" style="margin-top:20px;">
            <button class="btn btn-primary btn-block" onclick="HokmUI.closeModal()">فهمیدم ✅</button>
          </div>
        `);
      }
    });

    _log('✅ دکمه راهنما فعال شد', '#06d6a0');
  }

  /* ─────────────────────────────────────────────
     🆕 رندر صفحه آمار
     ───────────────────────────────────────────── */
  function _renderStatsPage() {
    if (!global.HokmStorage) return;

    const stats = global.HokmStorage.getStats();
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    const fa = (n) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);

    set('statsTotalGames', fa(stats.gamesPlayed || 0));
    set('statsTotalWins', fa(stats.wins || 0));
    set('statsTotalRounds', fa(stats.roundsWon || 0));
    set('statsHokmClaimed', fa(stats.hokmClaimed || 0));
    set('statsBestStreak', fa(stats.bestStreak || 0));
    set('statsPlayTime', fa(Math.floor((stats.totalTimePlayed || 0) / 60000)));
  }

  /* ─────────────────────────────────────────────
     🆕 راه‌اندازی قابلیت‌های جدید
     ───────────────────────────────────────────── */
  function _initNewFeatures() {
    setTimeout(() => {
      _bindStatsTab();
      _bindHelpButton();
      _log('✅ New features initialized (Stats + Help)', '#9b5de5');
    }, 1000);
  }

  /* ─────────────────────────────────────────────
     Bootstrap
     ───────────────────────────────────────────── */
  async function bootstrap() {
    state.bootStartTime = Date.now();

    console.log(
      '%c🃏 HOKM PRO v' + VERSION + '\n%cBoot starting...',
      'color: #ffd60a; font-size: 16px; font-weight: 900;',
      'color: #06d6a0; font-size: 12px;'
    );

    _setupGlobalErrorHandler();
    _detectDevice();
    _setupKeyboardHelpers();

    _initSplash();

    await _delay(100);

    const result = _checkModules();

    if (result.missing.length > 0) {
      console.warn('%c⚠️ ماژول‌های گمشده:', 'color: #f4a259; font-weight: 700;', result.missing);
    }

    _initNewFeatures();

    const loadTime = Date.now() - state.bootStartTime;
    _log('✅ Bootstrap done in ' + loadTime + 'ms', '#06d6a0');

    document.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab[data-tab="stats"]');
      if (tab) {
        setTimeout(_renderStatsPage, 100);
      }
    });
  }

  /* ─────────────────────────────────────────────
     Public API
     ───────────────────────────────────────────── */
  const App = {
    VERSION: VERSION,
    BUILD: BUILD,

    getStatus() {
      return {
        version: VERSION,
        build: BUILD,
        ready: state.ready,
        modules: _checkModules(),
        errors: state.errors.slice(),
        loadTime: Date.now() - state.bootStartTime
      };
    },

    factoryReset() {
      if (!confirm('⚠️ همه داده‌ها پاک می‌شود؟')) return false;
      if (global.HokmStorage) global.HokmStorage.clearAll();
      try { sessionStorage.clear(); } catch (e) {}
      setTimeout(function() { window.location.reload(); }, 300);
      return true;
    },

    reload() {
      window.location.reload();
    },

    test() {
      const modules = ['HokmStorage', 'HokmThemes', 'HokmAudio', 'HokmProfile', 'HokmGame', 'HokmUI', 'HokmSettings'];
      const results = [];
      
      modules.forEach(function(m) {
        const ok = !!(global[m] && typeof global[m] === 'object');
        console.log((ok ? '%c✓ ' : '%c✗ ') + m, 'color: ' + (ok ? '#06d6a0' : '#ef476f') + '; font-weight: 600;');
        results.push({ name: m, ok: ok });
      });
      
      return results;
    }
  };

  global.HokmApp = App;

  /* ─────────────────────────────────────────────
     Auto-Bootstrap
     ───────────────────────────────────────────── */
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
      setTimeout(bootstrap, 0);
    }
  }

  /* ─────────────────────────────────────────────
     Easter Egg
     ───────────────────────────────────────────── */
  setTimeout(function() {
    if (state.ready) {
      console.log(
        '%c🃏 دستورات مفید:\n' +
        '%c  HokmApp.test()      — تست سیستم\n' +
        '%c  HokmApp.getStatus() — وضعیت کامل\n' +
        '%c  HokmGame.debug()    — وضعیت بازی جاری',
        'color: #ffd60a; font-size: 14px; font-weight: 900;',
        'color: #06d6a0; font-family: monospace;',
        'color: #06d6a0; font-family: monospace;',
        'color: #06d6a0; font-family: monospace;'
      );
    }
  }, 3000);

})(typeof window !== 'undefined' ? window : globalThis);