/* ═══════════════════════════════════════════════════════════
   📢 HOKM PRO v6.1.1 — ads.js
   سیستم تبلیغات Tapsell
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     تنظیمات Tapsell
     ═══════════════════════════════════════════════════════════
     ⚠️ مهم: این Zone ID ها رو از پنل Tapsell بگیر و جایگزین کن!
     ───────────────────────────────────────────── */
  const TAPSELL_CONFIG = {
    // شناسه‌های Zone (از پنل tapsell.ir)
    ZONES: {
      interstitial: 'YOUR_INTERSTITIAL_ZONE_ID',  // تبلیغ بین‌صفحه‌ای
      rewarded:     'YOUR_REWARDED_ZONE_ID',      // تبلیغ پاداش‌دار
      native:       'YOUR_NATIVE_ZONE_ID'         // تبلیغ بومی (اختیاری)
    },

    // تنظیمات نمایش
    SHOW_INTERSTITIAL_EVERY_N_GAMES: 3,  // هر چند بازی یه تبلیغ
    MIN_TIME_BETWEEN_ADS: 60 * 1000,     // حداقل ۱ دقیقه بین تبلیغات
    ENABLE_INTERSTITIAL: true,
    ENABLE_REWARDED: true,

    // حالت تست
    DEBUG: false
  };

  /* ─────────────────────────────────────────────
     وضعیت
     ───────────────────────────────────────────── */
  const state = {
    initialized: false,
    sdkAvailable: false,
    lastAdTime: 0,
    gameCount: 0,
    adShownCount: 0,
    adFailedCount: 0,
    isShowing: false,
    pendingCallback: null,
    listeners: []
  };

  /* ─────────────────────────────────────────────
     لاگ
     ───────────────────────────────────────────── */
  function _log(msg, type = 'info') {
    if (!TAPSELL_CONFIG.DEBUG) return;

    const colors = {
      info: '#118ab2',
      success: '#06d6a0',
      error: '#ef476f',
      warning: '#f4a259'
    };

    console.log(
      `%c[Ads] ${msg}`,
      `color: ${colors[type] || colors.info}; font-weight: 600;`
    );
  }

  function _emit(event, data) {
    state.listeners.forEach(({ event: e, handler }) => {
      if (e === event || e === '*') {
        try { handler(data); } catch (err) { console.error(err); }
      }
    });
  }

  /* ─────────────────────────────────────────────
     بررسی پشتیبانی SDK
     ───────────────────────────────────────────── */
  function _checkSDK() {
    // حالت ۱: Tapsell Web SDK
    if (typeof global.Tapsell !== 'undefined') {
      state.sdkAvailable = true;
      _log('✅ Tapsell Web SDK detected', 'success');
      return 'web';
    }

    // حالت ۲: JavaScript Bridge (Android WebView)
    if (global.Android && typeof global.Android.showTapsellAd === 'function') {
      state.sdkAvailable = true;
      _log('✅ Android Bridge detected', 'success');
      return 'android';
    }

    // حالت ۳: Median.co / GoNative Bridge
    if (global.median && typeof global.median.tapsell === 'object') {
      state.sdkAvailable = true;
      _log('✅ Median Bridge detected', 'success');
      return 'median';
    }

    // حالت ۴: WebViewGold Bridge
    if (global.webviewgold && typeof global.webviewgold.tapsell === 'function') {
      state.sdkAvailable = true;
      _log('✅ WebViewGold Bridge detected', 'success');
      return 'wvgold';
    }

    _log('⚠️ هیچ SDK یا Bridge ای پیدا نشد — تبلیغات غیرفعال', 'warning');
    return null;
  }

  /* ─────────────────────────────────────────────
     نمایش تبلیغ بین‌صفحه‌ای (Interstitial)
     ───────────────────────────────────────────── */
  function _showInterstitialSDK() {
    // Tapsell Web SDK
    if (typeof global.Tapsell !== 'undefined') {
      try {
        const zoneId = TAPSELL_CONFIG.ZONES.interstitial;

        if (!zoneId || zoneId.startsWith('YOUR_')) {
          _log('⚠️ Zone ID تنظیم نشده — از پنل Tapsell بگیر', 'warning');
          return false;
        }

        global.Tapsell.requestInterstitialAd(
          zoneId,
          (ad) => {
            _log('✅ Interstitial ad ready', 'success');
            global.Tapsell.showAd(ad);
            state.adShownCount++;
            state.lastAdTime = Date.now();

            if (state.pendingCallback) {
              state.pendingCallback();
              state.pendingCallback = null;
            }
          },
          (err) => {
            _log(`❌ Interstitial failed: ${err}`, 'error');
            state.adFailedCount++;
            state.isShowing = false;

            if (state.pendingCallback) {
              state.pendingCallback();
              state.pendingCallback = null;
            }
          }
        );

        return true;
      } catch (err) {
        _log(`❌ SDK error: ${err.message}`, 'error');
        return false;
      }
    }

    // Android Bridge
    if (global.Android && typeof global.Android.showTapsellAd === 'function') {
      try {
        global.Android.showTapsellAd('interstitial');
        state.adShownCount++;
        state.lastAdTime = Date.now();

        if (state.pendingCallback) {
          state.pendingCallback();
          state.pendingCallback = null;
        }
        return true;
      } catch (err) {
        _log(`❌ Android bridge error: ${err.message}`, 'error');
        return false;
      }
    }

    // Median Bridge
    if (global.median && global.median.tapsell) {
      try {
        global.median.tapsell.showInterstitial();
        state.adShownCount++;
        state.lastAdTime = Date.now();

        if (state.pendingCallback) {
          state.pendingCallback();
          state.pendingCallback = null;
        }
        return true;
      } catch (err) {
        _log(`❌ Median bridge error: ${err.message}`, 'error');
        return false;
      }
    }

    // WebViewGold Bridge
    if (global.webviewgold && typeof global.webviewgold.tapsell === 'function') {
      try {
        global.webviewgold.tapsell('interstitial');
        state.adShownCount++;
        state.lastAdTime = Date.now();

        if (state.pendingCallback) {
          state.pendingCallback();
          state.pendingCallback = null;
        }
        return true;
      } catch (err) {
        _log(`❌ WVG bridge error: ${err.message}`, 'error');
        return false;
      }
    }

    return false;
  }

  /* ─────────────────────────────────────────────
     نمایش تبلیغ پاداش‌دار (Rewarded)
     ───────────────────────────────────────────── */
  function _showRewardedSDK(onReward, onFail) {
    if (typeof global.Tapsell !== 'undefined') {
      try {
        const zoneId = TAPSELL_CONFIG.ZONES.rewarded;

        if (!zoneId || zoneId.startsWith('YOUR_')) {
          _log('⚠️ Rewarded Zone ID تنظیم نشده', 'warning');
          if (onFail) onFail('no_zone');
          return false;
        }

        global.Tapsell.requestRewardedAd(
          zoneId,
          (ad) => {
            _log('✅ Rewarded ad ready', 'success');
            global.Tapsell.showAd(ad);

            // ⚠️ نکته: rewarded رو باید native SDK بگه کی تموم شده
            // اینجا فقط بعد از display فرض می‌کنیم کاربر دید
            setTimeout(() => {
              if (onReward) onReward();
            }, 1000);

            state.adShownCount++;
            state.lastAdTime = Date.now();
          },
          (err) => {
            _log(`❌ Rewarded failed: ${err}`, 'error');
            state.adFailedCount++;
            if (onFail) onFail(err);
          }
        );

        return true;
      } catch (err) {
        _log(`❌ SDK error: ${err.message}`, 'error');
        if (onFail) onFail(err.message);
        return false;
      }
    }

    // Android Bridge
    if (global.Android && typeof global.Android.showTapsellAd === 'function') {
      try {
        global.Android.showTapsellAd('rewarded');

        // منتظر پاداش (فرض می‌کنیم SDK native بعد ۵ ثانیه پاداش می‌ده)
        setTimeout(() => {
          if (onReward) onReward();
        }, 5000);

        return true;
      } catch (err) {
        if (onFail) onFail(err.message);
        return false;
      }
    }

    // Fallback
    if (onFail) onFail('no_bridge');
    return false;
  }

  /* ─────────────────────────────────────────────
     API عمومی
     ───────────────────────────────────────────── */
  const Ads = {

    /**
     * راه‌اندازی
     */
    init() {
      _log('🚀 Ads initializing...');

      const type = _checkSDK();
      state.initialized = true;

      // اتصال به رویدادهای بازی
      _bindGameEvents();

      _log(`✅ Ads ready (mode: ${type || 'disabled'})`, 'success');
      return state.sdkAvailable;
    },

    /**
     * نمایش تبلیغ بین‌صفحه‌ای
     * @param {Function} onClose - بعد از بسته شدن
     * @param {boolean} force - بدون چک زمان
     */
    showInterstitial(onClose, force = false) {
      if (!TAPSELL_CONFIG.ENABLE_INTERSTITIAL) {
        _log('Interstitial disabled');
        if (onClose) onClose();
        return false;
      }

      if (state.isShowing) {
        _log('⚠️ Ad already showing');
        if (onClose) onClose();
        return false;
      }

      // چک فاصله زمانی
      if (!force) {
        const timeSinceLast = Date.now() - state.lastAdTime;
        if (timeSinceLast < TAPSELL_CONFIG.MIN_TIME_BETWEEN_ADS) {
          _log(`⏳ Too soon (${Math.round(timeSinceLast / 1000)}s ago)`);
          if (onClose) onClose();
          return false;
        }
      }

      state.isShowing = true;
      state.pendingCallback = () => {
        state.isShowing = false;
        if (onClose) onClose();
      };

      const ok = _showInterstitialSDK();

      if (!ok) {
        state.isShowing = false;
        if (onClose) onClose();
        return false;
      }

      return true;
    },

    /**
     * نمایش تبلیغ پاداش‌دار
     * @param {Function} onReward - کاربر پاداش می‌گیره
     * @param {Function} onFail - تبلیغ نمایش داده نشد
     */
    showRewarded(onReward, onFail) {
      if (!TAPSELL_CONFIG.ENABLE_REWARDED) {
        _log('Rewarded disabled');
        if (onFail) onFail('disabled');
        return false;
      }

      return _showRewardedSDK(onReward, onFail);
    },

    /**
     * ثبت پایان بازی — شمارش برای نمایش تبلیغ
     */
    onGameEnded() {
      state.gameCount++;
      _log(`🎮 Game ended (${state.gameCount})`);

      const every = TAPSELL_CONFIG.SHOW_INTERSTITIAL_EVERY_N_GAMES;

      if (state.gameCount % every === 0) {
        _log(`📢 Showing ad (every ${every} games)`);

        // کمی تأخیر تا انیمیشن پایان تموم بشه
        setTimeout(() => {
          Ads.showInterstitial();
        }, 2000);
      }
    },

    /**
     * بررسی SDK
     */
    isAvailable() {
      return state.sdkAvailable;
    },

    isInitialized() {
      return state.initialized;
    },

    /**
     * آمار
     */
    getStats() {
      return {
        sdkAvailable: state.sdkAvailable,
        gameCount: state.gameCount,
        adShown: state.adShownCount,
        adFailed: state.adFailedCount,
        lastAdTime: state.lastAdTime
      };
    },

    /**
     * تغییر تنظیمات
     */
    setConfig(key, value) {
      if (key in TAPSELL_CONFIG) {
        TAPSELL_CONFIG[key] = value;
        _log(`⚙️ Config: ${key} = ${value}`);
        return true;
      }
      return false;
    },

    /**
     * فعال/غیرفعال
     */
    enable() {
      TAPSELL_CONFIG.ENABLE_INTERSTITIAL = true;
      TAPSELL_CONFIG.ENABLE_REWARDED = true;
      _log('✅ Ads enabled', 'success');
    },

    disable() {
      TAPSELL_CONFIG.ENABLE_INTERSTITIAL = false;
      TAPSELL_CONFIG.ENABLE_REWARDED = false;
      _log('❌ Ads disabled', 'warning');
    },

    /* ─── رویدادها ─── */

    on(event, handler) {
      state.listeners.push({ event, handler });
      return () => Ads.off(event, handler);
    },

    off(event, handler) {
      state.listeners = state.listeners.filter(
        l => !(l.event === event && l.handler === handler)
      );
    }
  };

  /* ─────────────────────────────────────────────
     اتصال به رویدادهای بازی
     ───────────────────────────────────────────── */
  function _bindGameEvents() {
    // صبر برای لود شدن HokmGame
    setTimeout(() => {
      if (!global.HokmGame) {
        _log('⚠️ HokmGame not found', 'warning');
        return;
      }

      // بعد از پایان هر بازی
      global.HokmGame.on('game:ended', () => {
        Ads.onGameEnded();
      });

      _log('✅ Bound to game events', 'success');
    }, 2000);
  }

  /* ─────────────────────────────────────────────
     Bootstrap
     ───────────────────────────────────────────── */
  function bootstrap() {
    // صبر تا همه چیز لود بشه
    setTimeout(() => {
      Ads.init();
    }, 2500);
  }

  /* ─────────────────────────────────────────────
     Export
     ───────────────────────────────────────────── */
  global.HokmAds = Ads;
  global.HokmAdsConfig = TAPSELL_CONFIG;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
      bootstrap();
    }
  }

  _log('📢 ads.js loaded');

})(typeof window !== 'undefined' ? window : globalThis);