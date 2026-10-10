/* ═══════════════════════════════════════════════════════════
   🚀 HOKM PRO v6.0 — main.js (نسخه اضطراری)
   این نسخه حتی اگر بقیه ماژول‌ها خطا داشته باشن، کار می‌کنه
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const VERSION = '6.0.0';

  console.log(
    '%c🃏 HOKM PRO v' + VERSION,
    'color: #ffd60a; font-size: 16px; font-weight: 900;'
  );

  // ═══════════════════════════════════════════
  // ۱. حذف Splash (مهم‌ترین کار)
  // ═══════════════════════════════════════════
  function hideSplash() {
    const splash = document.getElementById('splashScreen');
    const app = document.getElementById('app');

    if (splash) {
      splash.classList.add('hidden');
      splash.style.display = 'none';
    }

    if (app) {
      app.classList.remove('hidden');
    }

    console.log('%c✅ Splash hidden', 'color: #06d6a0; font-weight: bold;');
  }

  // ═══════════════════════════════════════════
  // ۲. رفتن به منو
  // ═══════════════════════════════════════════
  function goToMenu() {
    try {
      // تلاش از طریق UI
      if (global.HokmUI && typeof global.HokmUI.navigate === 'function') {
        global.HokmUI.navigate('menu', { force: true });
        console.log('%c✅ Navigated via HokmUI', 'color: #06d6a0;');
        return;
      }
    } catch (e) {
      console.warn('HokmUI.navigate failed:', e);
    }

    // Fallback: دستی
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.remove('active'));

    const menu = document.getElementById('screen-menu');
    if (menu) {
      menu.classList.add('active');
      console.log('%c✅ Navigated manually', 'color: #06d6a0;');
    }
  }

  // ═══════════════════════════════════════════
  // ۳. اتصال دکمه Skip
  // ═══════════════════════════════════════════
  function bindSkipButton() {
    const skipBtn = document.getElementById('btnSkipSplash');
    if (!skipBtn) return;

    skipBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('%c⏭ Skip clicked', 'color: #ffd60a;');
      hideSplash();
      setTimeout(goToMenu, 100);
    });

    console.log('%c✅ Skip button bound', 'color: #06d6a0;');
  }

  // ═══════════════════════════════════════════
  // ۴. اتصال دکمه شروع بازی
  // ═══════════════════════════════════════════
  function bindStartButton() {
    const startBtn = document.getElementById('btnStartGame');
    if (!startBtn) return;

    startBtn.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('%c🎮 Start game clicked', 'color: #ffd60a;');

      try {
        if (global.HokmUI && typeof global.HokmUI.startGame === 'function') {
          global.HokmUI.startGame();
        } else if (global.HokmGame && typeof global.HokmGame.start === 'function') {
          global.HokmGame.start();
        } else {
          alert('موتور بازی آماده نیست. فایل‌های JS را چک کن.');
        }
      } catch (err) {
        console.error('Start game error:', err);
        alert('خطا در شروع بازی: ' + err.message);
      }
    });

    console.log('%c✅ Start button bound', 'color: #06d6a0;');
  }

  // ═══════════════════════════════════════════
  // ۵. اتصال تب‌ها
  // ═══════════════════════════════════════════
  function bindTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        const name = tab.dataset.tab;
        console.log('%c📑 Tab: ' + name, 'color: #118ab2;');

        try {
          if (global.HokmUI && typeof global.HokmUI.navigate === 'function') {
            if (name === 'game') {
              global.HokmUI.navigate('menu');
            } else {
              global.HokmUI.navigate(name);
            }
          } else {
            // Fallback
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            const screen = document.getElementById('screen-' + (name === 'game' ? 'menu' : name));
            if (screen) screen.classList.add('active');

            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
          }
        } catch (err) {
          console.error('Tab error:', err);
        }
      });
    });

    console.log('%c✅ Tabs bound (' + tabs.length + ')', 'color: #06d6a0;');
  }

  // ═══════════════════════════════════════════
  // ۶. اتصال منو کارت‌ها
  // ═══════════════════════════════════════════
  function bindMenuCards() {
    const cards = document.querySelectorAll('.menu-card');
    cards.forEach(function(card) {
      card.addEventListener('click', function() {
        const action = card.dataset.action;
        console.log('%c🎯 Menu: ' + action, 'color: #9b5de5;');

        try {
          if (global.HokmUI && typeof global.HokmUI.navigate === 'function') {
            global.HokmUI.navigate(action);
          } else {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            const screen = document.getElementById('screen-' + action);
            if (screen) screen.classList.add('active');
          }
        } catch (err) {
          console.error('Menu error:', err);
          alert(action + ': ' + err.message);
        }
      });
    });

    console.log('%c✅ Menu cards bound (' + cards.length + ')', 'color: #06d6a0;');
  }

  // ═══════════════════════════════════════════
  // ۷. نمایش تشخیص ماژول‌ها
  // ═══════════════════════════════════════════
  function reportModules() {
    const modules = {
      'HokmStorage': window.HokmStorage,
      'HokmThemes': window.HokmThemes,
      'HokmAudio': window.HokmAudio,
      'HokmProfile': window.HokmProfile,
      'HokmAchievements': window.HokmAchievements,
      'HokmLeaderboard': window.HokmLeaderboard,
      'HokmFriends': window.HokmFriends,
      'HokmTournament': window.HokmTournament,
      'HokmReplay': window.HokmReplay,
      'HokmShare': window.HokmShare,
      'HokmAI': window.HokmAI,
      'HokmGame': window.HokmGame,
      'HokmUI': window.HokmUI
    };

    console.group('%c📦 Modules Status', 'color: #ffd60a; font-weight: bold;');

    let missing = [];
    for (const name in modules) {
      if (modules[name] && typeof modules[name] === 'object') {
        console.log('%c✓ ' + name, 'color: #06d6a0;');
      } else {
        console.warn('%c✗ ' + name + ' (MISSING)', 'color: #ef476f;');
        missing.push(name);
      }
    }

    console.groupEnd();

    if (missing.length > 0) {
      console.warn(
        '%c⚠️ ' + missing.length + ' ماژول گمشده: ' + missing.join(', '),
        'color: #ef476f; font-weight: bold; font-size: 14px;'
      );
    } else {
      console.log('%c✅ همه ماژول‌ها لود شدند!', 'color: #06d6a0; font-weight: bold; font-size: 14px;');
    }

    return missing;
  }

  // ═══════════════════════════════════════════
  // ۸. اتصال رویدادهای خطا
  // ═══════════════════════════════════════════
  function setupErrorHandler() {
    window.addEventListener('error', function(e) {
      console.error(
        '%c❌ خطا: ' + (e.message || 'unknown') +
        '\n   فایل: ' + (e.filename || '?').split('/').pop() +
        '\n   خط: ' + e.lineno,
        'color: #ef476f; font-weight: bold;'
      );
    });

    window.addEventListener('unhandledrejection', function(e) {
      console.error('%c❌ Promise: ' + e.reason, 'color: #ef476f;');
    });
  }

  // ═══════════════════════════════════════════
  // ۹. تلاش برای راه‌اندازی ماژول‌ها (اختیاری)
  // ═══════════════════════════════════════════
  function tryInitModules() {
    // Storage
    try {
      if (window.HokmStorage && typeof window.HokmStorage.getProfile === 'function') {
        window.HokmStorage.getProfile();
        console.log('%c✓ Storage initialized', 'color: #06d6a0;');
      }
    } catch (e) {
      console.warn('Storage init failed:', e.message);
    }

    // Themes
    try {
      if (window.HokmThemes && typeof window.HokmThemes.init === 'function') {
        window.HokmThemes.init();
        console.log('%c✓ Themes initialized', 'color: #06d6a0;');
      }
    } catch (e) {
      console.warn('Themes init failed:', e.message);
    }
  }

  // ═══════════════════════════════════════════
  // 🚀 BOOTSTRAP
  // ═══════════════════════════════════════════
  function bootstrap() {
    console.log('%c🚀 Bootstrap starting...', 'color: #ffd60a; font-weight: bold;');

    setupErrorHandler();

    // گزارش ماژول‌ها
    setTimeout(reportModules, 500);

    // اتصال رویدادها
    bindSkipButton();
    bindStartButton();
    bindTabs();
    bindMenuCards();

    // تلاش برای init
    setTimeout(tryInitModules, 300);

    // ═══ حذف Splash بعد ۲.۵ ثانیه ═══
    setTimeout(function() {
      console.log('%c⏰ Splash timeout reached', 'color: #ffd60a;');
      hideSplash();
      setTimeout(goToMenu, 200);
    }, 2500);

    // ═══ حذف فوری Splash بعد ۵ ثانیه (در هر صورت) ═══
    setTimeout(function() {
      const splash = document.getElementById('splashScreen');
      if (splash && !splash.classList.contains('hidden')) {
        console.warn('%c⚠️ Emergency splash removal', 'color: #ef476f; font-weight: bold;');
        hideSplash();
        setTimeout(goToMenu, 200);
      }
    }, 5000);

    console.log('%c✅ Bootstrap complete', 'color: #06d6a0; font-weight: bold;');
  }

  // ═══════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════
  global.HokmApp = {
    VERSION: VERSION,
    hideSplash: hideSplash,
    goToMenu: goToMenu,
    reportModules: reportModules,
    reload: function() { window.location.reload(); }
  };

  // ═══════════════════════════════════════════
  // Auto-Start
  // ═══════════════════════════════════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

})(typeof window !== 'undefined' ? window : globalThis);