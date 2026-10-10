/* ═══════════════════════════════════════════════════════════
   🎨 HOKM PRO v6.0 — themes.js
   مدیریت تم‌ها: Dark/Light + ۵ Accent + ۵ Card + ۵ Background
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     ثابت‌ها
     ───────────────────────────────────────────── */
  const THEMES = {
    DARK: 'dark',
    LIGHT: 'light',
    AUTO: 'auto'
  };

  const ACCENTS = {
    gold:    { fa: 'طلایی',         icon: '🥇', color: '#ffd60a' },
    emerald: { fa: 'سبز زمرد',      icon: '💚', color: '#06d6a0' },
    ocean:   { fa: 'آبی اقیانوس',   icon: '💙', color: '#118ab2' },
    royal:   { fa: 'بنفش سلطنتی',   icon: '💜', color: '#9b5de5' },
    ruby:    { fa: 'قرمز یاقوت',    icon: '❤️', color: '#ef476f' }
  };

  const CARD_THEMES = {
    classic: { fa: 'کلاسیک',  icon: '🃏' },
    dark:    { fa: 'تاریک',   icon: '🌑' },
    wooden:  { fa: 'چوبی',    icon: '🪵' },
    cartoon: { fa: 'کارتونی', icon: '🎨' },
    neon:    { fa: 'نئون',    icon: '💡' }
  };

  const BG_THEMES = {
    gradient: { fa: 'گرادیانت', icon: '🌈' },
    wooden:   { fa: 'چوبی',     icon: '🪵' },
    checker:  { fa: 'شطرنجی',   icon: '♟️' },
    night:    { fa: 'شبانه',    icon: '🌌' },
    crystal:  { fa: 'کریستالی', icon: '💎' }
  };

  const THEME_COLORS = {
    dark:  '#0d1b2a',
    light: '#f5f0e8'
  };

  /* ─────────────────────────────────────────────
     وضعیت فعلی
     ───────────────────────────────────────────── */
  const state = {
    mode: THEMES.AUTO,           // 'auto' | 'dark' | 'light'
    effective: THEMES.DARK,      // آنچه در نهایت اعمال شده
    accent: 'gold',
    cardTheme: 'classic',
    bgTheme: 'gradient',
    systemPrefersDark: false,
    listeners: []
  };

  /* ─────────────────────────────────────────────
     کمکی‌ها
     ───────────────────────────────────────────── */
  function _getStorage() {
    return global.HokmStorage || null;
  }

  function _loadFromStorage() {
    const storage = _getStorage();
    if (!storage) return;

    const settings = storage.getSettings();

    if (settings.theme) state.mode = settings.theme;
    if (settings.accent) state.accent = settings.accent;
    if (settings.cardTheme) state.cardTheme = settings.cardTheme;
    if (settings.bgTheme) state.bgTheme = settings.bgTheme;
  }

  function _saveToStorage() {
    const storage = _getStorage();
    if (!storage) return;

    storage.updateSettings({
      theme: state.mode,
      accent: state.accent,
      cardTheme: state.cardTheme,
      bgTheme: state.bgTheme
    });
  }

  function _getSystemPrefersDark() {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function _detectEffective() {
    if (state.mode === THEMES.AUTO) {
      return state.systemPrefersDark ? THEMES.DARK : THEMES.LIGHT;
    }
    return state.mode;
  }

  function _emit(event, data) {
    state.listeners.forEach(({ event: e, handler }) => {
      if (e === event || e === '*') {
        try {
          handler(data);
        } catch (err) {
          console.error('[Themes] Listener error:', err);
        }
      }
    });
  }

  /* ─────────────────────────────────────────────
     اعمال روی DOM
     ───────────────────────────────────────────── */
  function _applyTheme(animate) {
    const html = document.documentElement;
    const body = document.body;

    const effective = _detectEffective();
    state.effective = effective;

    // اگر تغییر واقعی، کلاس theme-changing برای ضد پرش
    const changed = body.dataset.theme !== effective;

    if (changed && animate) {
      body.classList.add('theme-changing');
    }

    // اعمال theme اصلی روی html و body
    html.dataset.theme = effective;
    body.dataset.theme = effective;

    // Accent
    body.dataset.accent = state.accent;

    // Card theme
    body.dataset.cardTheme = state.cardTheme;

    // Background
    body.dataset.bg = state.bgTheme;

    // همگام‌سازی meta theme-color
    _updateMetaThemeColor(effective);

    // حذف کلاس ضد پرش
    if (changed && animate) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          body.classList.remove('theme-changing');
        }, 50);
      });
    }

    // ذخیره
    _saveToStorage();

    // رویداد
    if (changed) {
      _emit('theme:changed', {
        mode: state.mode,
        effective,
        accent: state.accent,
        cardTheme: state.cardTheme,
        bgTheme: state.bgTheme
      });
    }
  }

  function _updateMetaThemeColor(effective) {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = THEME_COLORS[effective] || THEME_COLORS.dark;
    meta.setAttribute('data-theme', effective);
  }

  /* ─────────────────────────────────────────────
     API عمومی
     ───────────────────────────────────────────── */
  const Themes = {

    /* ─── تم شب/روز ─── */

    /**
     * تنظیم حالت تم: 'auto' | 'dark' | 'light'
     */
    setMode(mode) {
      if (!['auto', 'dark', 'light'].includes(mode)) {
        console.warn('[Themes] Invalid mode:', mode);
        return false;
      }
      state.mode = mode;
      _applyTheme(true);

      // انیمیشن rotate روی دکمه
      _animateToggleButton();

      return true;
    },

    getMode() {
      return state.mode;
    },

    getEffective() {
      return state.effective;
    },

    /**
     * چرخش بین dark و light (برای دکمه)
     */
    toggle() {
      const current = _detectEffective();
      const next = current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
      Themes.setMode(next);
      return next;
    },

    /**
     * تنظیم صریح dark یا light
     */
    set(theme) {
      return Themes.setMode(theme);
    },

    isDark() {
      return state.effective === THEMES.DARK;
    },

    isLight() {
      return state.effective === THEMES.LIGHT;
    },

    /* ─── تم Accent ─── */

    setAccent(accent) {
      if (!ACCENTS[accent]) {
        console.warn('[Themes] Invalid accent:', accent);
        return false;
      }
      state.accent = accent;
      _applyTheme(false);

      // انیمیشن ripple
      document.body.classList.add('accent-changed');
      setTimeout(() => document.body.classList.remove('accent-changed'), 700);

      // آپدیت Picker
      _updateAccentPicker();

      _emit('accent:changed', { accent });
      return true;
    },

    getAccent() {
      return state.accent;
    },

    getAccentInfo(accent) {
      return ACCENTS[accent || state.accent] || null;
    },

    listAccents() {
      return Object.keys(ACCENTS).map(key => ({
        key,
        ...ACCENTS[key]
      }));
    },

    /* ─── تم کارت ─── */

    setCardTheme(cardTheme) {
      if (!CARD_THEMES[cardTheme]) {
        console.warn('[Themes] Invalid cardTheme:', cardTheme);
        return false;
      }
      state.cardTheme = cardTheme;
      _applyTheme(false);
      _emit('card-theme:changed', { cardTheme });
      return true;
    },

    getCardTheme() {
      return state.cardTheme;
    },

    listCardThemes() {
      return Object.keys(CARD_THEMES).map(key => ({
        key,
        ...CARD_THEMES[key]
      }));
    },

    /* ─── تم پس‌زمینه ─── */

    setBgTheme(bgTheme) {
      if (!BG_THEMES[bgTheme]) {
        console.warn('[Themes] Invalid bgTheme:', bgTheme);
        return false;
      }
      state.bgTheme = bgTheme;
      _applyTheme(false);
      _emit('bg-theme:changed', { bgTheme });
      return true;
    },

    getBgTheme() {
      return state.bgTheme;
    },

    listBgThemes() {
      return Object.keys(BG_THEMES).map(key => ({
        key,
        ...BG_THEMES[key]
      }));
    },

    /* ─── وضعیت کامل ─── */

    getState() {
      return {
        mode: state.mode,
        effective: state.effective,
        accent: state.accent,
        cardTheme: state.cardTheme,
        bgTheme: state.bgTheme
      };
    },

    /**
     * بازنشانی به پیش‌فرض
     */
    reset() {
      state.mode = THEMES.AUTO;
      state.accent = 'gold';
      state.cardTheme = 'classic';
      state.bgTheme = 'gradient';
      _applyTheme(true);
      _emit('theme:reset');
      return true;
    },

    /* ─── رویدادها ─── */

    on(event, handler) {
      const entry = { event, handler };
      state.listeners.push(entry);
      return () => Themes.off(event, handler);
    },

    off(event, handler) {
      state.listeners = state.listeners.filter(
        l => !(l.event === event && l.handler === handler)
      );
    },

    /* ─── مقداردهی اولیه ─── */

    init() {
      state.systemPrefersDark = _getSystemPrefersDark();

      // ذخیره تنظیمات
      _loadFromStorage();

      // اعمال روی DOM
      _applyTheme(false);

      // آپدیت دکمه‌ها
      _updateAccentPicker();
      _updateThemeToggleButton();

      // Listener برای تغییرات سیستم
      _attachSystemListener();

      // Listener برای تغییرات از تب دیگر
      _attachCrossTabListener();

      console.log(
        `%c🎨 Themes ready: ${state.effective} + ${state.accent}`,
        'color: #06d6a0; font-weight: bold;'
      );

      return state;
    }
  };

  /* ─────────────────────────────────────────────
     Listener برای تغییرات سیستم
     ───────────────────────────────────────────── */
  function _attachSystemListener() {
    if (!window.matchMedia) return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = (e) => {
      state.systemPrefersDark = e.matches;

      // اگر کاربر روی 'auto' باشه، خودکار تغییر کن
      if (state.mode === THEMES.AUTO) {
        _applyTheme(true);
        _updateThemeToggleButton();
        _emit('system:changed', { prefersDark: e.matches });
      }
    };

    // پشتیبانی از مرورگرهای قدیمی
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
    } else if (mq.addListener) {
      mq.addListener(handler);
    }
  }

  /* ─────────────────────────────────────────────
     Listener برای تغییرات بین تب‌ها
     ───────────────────────────────────────────── */
  function _attachCrossTabListener() {
    const storage = _getStorage();
    if (!storage) return;

    storage.on('cross-tab:settings', () => {
      _loadFromStorage();
      _applyTheme(true);
      _updateThemeToggleButton();
      _updateAccentPicker();
    });
  }

  /* ─────────────────────────────────────────────
     آپدیت UI
     ───────────────────────────────────────────── */
  function _updateAccentPicker() {
    const dots = document.querySelectorAll('.accent-dot');
    dots.forEach(dot => {
      const isActive = dot.dataset.accent === state.accent;
      dot.classList.toggle('active', isActive);
      dot.setAttribute('aria-pressed', String(isActive));
    });
  }

  function _updateThemeToggleButton() {
    const btn = document.getElementById('btnThemeToggle');
    if (!btn) return;

    const isDark = state.effective === THEMES.DARK;
    btn.textContent = isDark ? '🌙' : '☀️';
    btn.setAttribute(
      'aria-label',
      isDark ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'
    );
    btn.dataset.mode = state.mode;

    // اگر auto هست، آیکون متفاوت
    if (state.mode === THEMES.AUTO) {
      btn.title = 'حالت خودکار — کلیک برای تغییر دستی';
    } else {
      btn.title = isDark ? 'حالت تاریک' : 'حالت روشن';
    }
  }

  function _animateToggleButton() {
    const btn = document.getElementById('btnThemeToggle');
    if (!btn) return;

    btn.classList.add('rotating');
    _updateThemeToggleButton();

    setTimeout(() => {
      btn.classList.remove('rotating');
    }, 600);
  }

  /* ─────────────────────────────────────────────
     اتصال خودکار به DOM
     ───────────────────────────────────────────── */
  function _attachToDOM() {
    // دکمه toggle شب/روز
    const toggleBtn = document.getElementById('btnThemeToggle');
    if (toggleBtn && !toggleBtn.dataset.bound) {
      toggleBtn.dataset.bound = '1';
      toggleBtn.addEventListener('click', () => {
        Themes.toggle();
      });
    }

    // Picker تم Accent
    const picker = document.getElementById('accentPicker');
    if (picker && !picker.dataset.bound) {
      picker.dataset.bound = '1';
      picker.addEventListener('click', (e) => {
        const dot = e.target.closest('.accent-dot');
        if (!dot) return;
        const accent = dot.dataset.accent;
        if (accent) Themes.setAccent(accent);
      });
    }

    // انتخاب تم کارت
    const cardSelect = document.getElementById('cardThemeSelect');
    if (cardSelect && !cardSelect.dataset.bound) {
      cardSelect.dataset.bound = '1';
      cardSelect.addEventListener('change', (e) => {
        Themes.setCardTheme(e.target.value);
      });
    }

    // انتخاب تم پس‌زمینه
    const bgSelect = document.getElementById('bgThemeSelect');
    if (bgSelect && !bgSelect.dataset.bound) {
      bgSelect.dataset.bound = '1';
      bgSelect.addEventListener('change', (e) => {
        Themes.setBgTheme(e.target.value);
      });
    }
  }

  /* ─────────────────────────────────────────────
     Startup
     ───────────────────────────────────────────── */
  function bootstrap() {
    Themes.init();
    _attachToDOM();
  }

  /* ─────────────────────────────────────────────
     Export
     ───────────────────────────────────────────── */
  global.HokmThemes = Themes;

  // Auto-init
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
      bootstrap();
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);