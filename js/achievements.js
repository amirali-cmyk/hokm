/* ═══════════════════════════════════════════════════════════
   🎖️ HOKM PRO v6.0 — achievements.js
   ۱۲ دستاورد با چک خودکار، پیشرفت، و اعلان
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     ۱۲ دستاورد
     ───────────────────────────────────────────── */
  const ACHIEVEMENTS = [
    {
      id: 'first_game',
      icon: '🎬',
      title: 'شروع سفر',
      desc: 'اولین بازی خود را انجام بده',
      category: 'start',
      check: (ctx) => ctx.stats.gamesPlayed >= 1,
      progress: (ctx) => Math.min(ctx.stats.gamesPlayed, 1),
      target: 1,
      reward: { coins: 50, elo: 0 }
    },
    {
      id: 'first_win',
      icon: '⭐',
      title: 'اولین برد',
      desc: 'اولین بازی خود را ببر',
      category: 'wins',
      check: (ctx) => ctx.stats.wins >= 1,
      progress: (ctx) => Math.min(ctx.stats.wins, 1),
      target: 1,
      reward: { coins: 100, elo: 0 }
    },
    {
      id: 'wins_5',
      icon: '🌟',
      title: '۵ برد',
      desc: 'پنج بازی را ببر',
      category: 'wins',
      check: (ctx) => ctx.stats.wins >= 5,
      progress: (ctx) => Math.min(ctx.stats.wins, 5),
      target: 5,
      reward: { coins: 200, elo: 0 }
    },
    {
      id: 'wins_10',
      icon: '✨',
      title: '۱۰ برد',
      desc: 'ده بازی را ببر',
      category: 'wins',
      check: (ctx) => ctx.stats.wins >= 10,
      progress: (ctx) => Math.min(ctx.stats.wins, 10),
      target: 10,
      reward: { coins: 350, elo: 0 }
    },
    {
      id: 'wins_50',
      icon: '💫',
      title: '۵۰ برد',
      desc: 'پنجاه بازی را ببر',
      category: 'wins',
      check: (ctx) => ctx.stats.wins >= 50,
      progress: (ctx) => Math.min(ctx.stats.wins, 50),
      target: 50,
      reward: { coins: 1000, elo: 0 }
    },
    {
      id: 'streak_3',
      icon: '🔥',
      title: 'آتشین ۳',
      desc: 'سه بازی پیاپی ببر',
      category: 'streak',
      check: (ctx) => ctx.stats.bestStreak >= 3,
      progress: (ctx) => Math.min(ctx.stats.bestStreak, 3),
      target: 3,
      reward: { coins: 150, elo: 0 }
    },
    {
      id: 'streak_5',
      icon: '🔥',
      title: 'آتشین ۵',
      desc: 'پنج بازی پیاپی ببر',
      category: 'streak',
      check: (ctx) => ctx.stats.bestStreak >= 5,
      progress: (ctx) => Math.min(ctx.stats.bestStreak, 5),
      target: 5,
      reward: { coins: 300, elo: 0 }
    },
    {
      id: 'streak_10',
      icon: '🔥',
      title: 'آتشین ۱۰',
      desc: 'ده بازی پیاپی ببر',
      category: 'streak',
      check: (ctx) => ctx.stats.bestStreak >= 10,
      progress: (ctx) => Math.min(ctx.stats.bestStreak, 10),
      target: 10,
      reward: { coins: 750, elo: 0 }
    },
    {
      id: 'elo_1300',
      icon: '🥈',
      title: 'متوسط',
      desc: 'به ELO ۱۳۰۰ برس',
      category: 'elo',
      check: (ctx) => ctx.profile.elo >= 1300,
      progress: (ctx) => Math.max(0, ctx.profile.elo - 1000),
      target: 300,
      reward: { coins: 200, elo: 0 }
    },
    {
      id: 'elo_1500',
      icon: '🥇',
      title: 'حرفه‌ای',
      desc: 'به ELO ۱۵۰۰ برس',
      category: 'elo',
      check: (ctx) => ctx.profile.elo >= 1500,
      progress: (ctx) => Math.max(0, ctx.profile.elo - 1000),
      target: 500,
      reward: { coins: 400, elo: 0 }
    },
    {
      id: 'elo_1800',
      icon: '👑',
      title: 'استاد بزرگ',
      desc: 'به ELO ۱۸۰۰ برس',
      category: 'elo',
      check: (ctx) => ctx.profile.elo >= 1800,
      progress: (ctx) => Math.max(0, ctx.profile.elo - 1000),
      target: 800,
      reward: { coins: 800, elo: 0 }
    },
    {
      id: 'elo_2000',
      icon: '🔥',
      title: 'افسانه',
      desc: 'به ELO ۲۰۰۰ برس',
      category: 'elo',
      check: (ctx) => ctx.profile.elo >= 2000,
      progress: (ctx) => Math.max(0, ctx.profile.elo - 1000),
      target: 1000,
      reward: { coins: 1500, elo: 0 }
    }
  ];

  const CATEGORIES = {
    start: { fa: 'شروع', icon: '🎬' },
    wins:  { fa: 'بردها', icon: '🏆' },
    streak: { fa: 'پیاپی', icon: '🔥' },
    elo:   { fa: 'رتبه', icon: '📊' }
  };

  /* ─────────────────────────────────────────────
     وضعیت
     ───────────────────────────────────────────── */
  const state = {
    data: null,
    listeners: [],
    checkQueue: [],
    isChecking: false,
    recentlyUnlocked: new Set() // جلوگیری از تکرار
  };

  /* ─────────────────────────────────────────────
     کمکی‌ها
     ───────────────────────────────────────────── */
  function _storage() {
    return global.HokmStorage;
  }

  function _emit(event, data) {
    state.listeners.forEach(({ event: e, handler }) => {
      if (e === event || e === '*') {
        try { handler(data); } catch (err) { console.error(err); }
      }
    });
  }

  function _toPersianNumber(n) {
    const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(n).replace(/\d/g, d => fa[+d]);
  }

  function _getContext() {
    const storage = _storage();
    if (!storage) return null;

    return {
      stats: storage.getStats(),
      profile: storage.getProfile(),
      history: storage.getHistory(),
      achievements: storage.getAchievements()
    };
  }

  function _load() {
    const storage = _storage();
    if (!storage) {
      state.data = { unlocked: {}, progress: {} };
      return;
    }
    state.data = storage.getAchievements();
  }

  function _save() {
    const storage = _storage();
    if (!storage) return;
    storage.setAchievements(state.data);
  }

  /* ─────────────────────────────────────────────
     منطق اصلی
     ───────────────────────────────────────────── */

  /**
   * بررسی یک دستاورد خاص
   */
  function _checkSingle(ach) {
    const ctx = _getContext();
    if (!ctx) return null;

    // اگر قبلاً باز شده، نادیده بگیر
    if (state.data.unlocked[ach.id]) {
      return { unlocked: true, alreadyWas: true };
    }

    // بررسی شرط
    const passed = ach.check(ctx);

    // محاسبه پیشرفت
    const progress = ach.progress ? ach.progress(ctx) : 0;
    const target = ach.target || 1;
    const percent = Math.min(100, Math.round((progress / target) * 100));

    if (passed) {
      // باز کردن دستاورد
      const result = _unlock(ach, progress);
      return { unlocked: true, justUnlocked: true, ...result };
    } else {
      // ذخیره پیشرفت
      _saveProgress(ach.id, progress, target);
      return { unlocked: false, progress, target, percent };
    }
  }

  /**
   * باز کردن دستاورد
   */
  function _unlock(ach, progress) {
    state.data.unlocked[ach.id] = {
      unlockedAt: Date.now(),
      progress: progress
    };

    // حذف از پیشرفت
    delete state.data.progress[ach.id];

    _save();

    // پاداش
    _grantReward(ach);

    // جلوگیری از تکرار
    state.recentlyUnlocked.add(ach.id);

    // رویداد
    _emit('achievement:unlocked', {
      id: ach.id,
      achievement: ach,
      unlockedAt: state.data.unlocked[ach.id].unlockedAt
    });

    // اعلان
    _notifyUnlock(ach);

    return { achievement: ach };
  }

  /**
   * ذخیره پیشرفت
   */
  function _saveProgress(achId, progress, target) {
    if (!state.data.progress) state.data.progress = {};

    const old = state.data.progress[achId];
    if (!old || old.progress !== progress || old.target !== target) {
      state.data.progress[achId] = {
        progress,
        target,
        updatedAt: Date.now()
      };
      _save();
    }
  }

  /**
   * اعطای پاداش
   */
  function _grantReward(ach) {
    const reward = ach.reward;
    if (!reward) return;

    if (reward.coins && global.HokmProfile) {
      global.HokmProfile.addCoins(reward.coins);
    }

    if (reward.elo && global.HokmProfile) {
      global.HokmProfile.applyEloChange(reward.elo);
    }
  }

  /**
   * اعلان باز شدن
   */
  function _notifyUnlock(ach) {
    // صدا
    if (global.HokmAudio) {
      global.HokmAudio.play('achievement');
    }

    // Toast
    if (global.HokmUI && typeof global.HokmUI.showToast === 'function') {
      global.HokmUI.showToast(
        '🎖️ دستاورد جدید!',
        `${ach.icon} ${ach.title} — ${ach.desc}`,
        'achievement',
        5000
      );
    } else {
      // fallback
      _fallbackToast(ach);
    }

    // انیمیشن ویژه
    _animateUnlock(ach);
  }

  /**
   * Toast دستی (اگر HokmUI نبود)
   */
  function _fallbackToast(ach) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast toast-achievement';
    toast.innerHTML = `
      <div class="toast-icon">${ach.icon}</div>
      <div class="toast-body">
        <div class="toast-title">🎖️ دستاورد جدید!</div>
        <div class="toast-msg">${ach.title} — ${ach.desc}</div>
      </div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  /**
   * انیمیشن ویژه باز شدن
   */
  function _animateUnlock(ach) {
    // انیمیشن confetti سبک
    if (global.HokmAudio) {
      // بعد از صدا، انیمیشن بصری
    }

    // ذرات طلایی اگر تابع موجود بود
    if (global.HokmParticles && typeof global.HokmParticles.burst === 'function') {
      global.HokmParticles.burst({
        count: 20,
        color: '#ffd60a'
      });
    }
  }

  /* ─────────────────────────────────────────────
     API عمومی
     ───────────────────────────────────────────── */
  const Achievements = {

    /**
     * راه‌اندازی
     */
    init() {
      _load();
      Achievements.renderPage();

      console.log(
        `%c🎖️ Achievements loaded: ${Object.keys(state.data.unlocked || {}).length}/${ACHIEVEMENTS.length}`,
        'color: #9b5de5; font-weight: bold;'
      );
      return state.data;
    },

    /**
     * چک کردن همه دستاوردها
     */
    checkAll() {
      const newlyUnlocked = [];

      ACHIEVEMENTS.forEach(ach => {
        if (state.data.unlocked[ach.id]) return;

        const result = _checkSingle(ach);
        if (result && result.justUnlocked) {
          newlyUnlocked.push(ach);
        }
      });

      if (newlyUnlocked.length > 0) {
        _emit('achievements:batch-unlocked', newlyUnlocked);
      }

      return newlyUnlocked;
    },

    /**
     * چک بعد از رویداد (مثلاً بعد از یک بازی)
     */
    checkAfterGame(gameResult) {
      // ذخیره‌سازی نتیجه فعلی برای context موقت
      // (اختیاری — فعلاً همان checkAll کافیه)
      return Achievements.checkAll();
    },

    /**
     * باز کردن دستی یک دستاورد (برای دیباگ/تست)
     */
    forceUnlock(achId) {
      const ach = ACHIEVEMENTS.find(a => a.id === achId);
      if (!ach) return false;
      if (state.data.unlocked[achId]) return false;

      _unlock(ach, ach.target || 1);
      Achievements.renderPage();
      return true;
    },

    /**
     * بررسی باز بودن
     */
    isUnlocked(achId) {
      return !!state.data.unlocked[achId];
    },

    /**
     * تعداد باز شده
     */
    getUnlockedCount() {
      return Object.keys(state.data.unlocked || {}).length;
    },

    /**
     * تعداد کل
     */
    getTotalCount() {
      return ACHIEVEMENTS.length;
    },

    /**
     * درصد پیشرفت کلی
     */
    getProgress() {
      const total = ACHIEVEMENTS.length;
      const unlocked = Achievements.getUnlockedCount();
      return {
        unlocked,
        total,
        percent: Math.round((unlocked / total) * 100)
      };
    },

    /**
     * لیست همه دستاوردها با وضعیت
     */
    getAll() {
      return ACHIEVEMENTS.map(ach => {
        const unlockedData = state.data.unlocked[ach.id];
        const progressData = state.data.progress ? state.data.progress[ach.id] : null;

        return {
          ...ach,
          unlocked: !!unlockedData,
          unlockedAt: unlockedData ? unlockedData.unlockedAt : null,
          progress: progressData ? progressData.progress : 0,
          target: ach.target || 1,
          percent: progressData
            ? Math.min(100, Math.round((progressData.progress / (ach.target || 1)) * 100))
            : 0
        };
      });
    },

    /**
     * لیست بر اساس دسته
     */
    getByCategory(category) {
      return Achievements.getAll().filter(a => a.category === category);
    },

    /**
     * لیست دسته‌بندی‌ها
     */
    getCategories() {
      return Object.entries(CATEGORIES).map(([key, val]) => ({
        key,
        ...val,
        count: ACHIEVEMENTS.filter(a => a.category === key).length
      }));
    },

    /**
     * دریافت یک دستاورد
     */
    get(achId) {
      return ACHIEVEMENTS.find(a => a.id === achId) || null;
    },

    /* ─── رندر ─── */

    /**
     * رندر صفحه اختصاصی دستاوردها
     */
    renderPage() {
      const grid = document.getElementById('achievementsGrid');
      const progressText = document.getElementById('achProgressText');
      const progressFill = document.getElementById('achProgressFill');

      if (progressText) {
        const { unlocked, total } = Achievements.getProgress();
        progressText.textContent = `${_toPersianNumber(unlocked)} از ${_toPersianNumber(total)}`;
      }

      if (progressFill) {
        const { percent } = Achievements.getProgress();
        progressFill.style.width = `${percent}%`;
      }

      if (!grid) return;

      const all = Achievements.getAll();

      // مرتب‌سازی: باز شده‌ها اول، بعد بر اساس پیشرفت
      all.sort((a, b) => {
        if (a.unlocked !== b.unlocked) return b.unlocked ? 1 : -1;
        return b.percent - a.percent;
      });

      grid.innerHTML = all.map(a => _renderCard(a)).join('');
    },

    /**
     * رندر یک کارت دستاورد
     */
    renderCard(achId) {
      const el = document.querySelector(`[data-ach-id="${achId}"]`);
      if (!el) return;
      const ach = Achievements.get(achId);
      if (!ach) return;
      el.outerHTML = _renderCard({ ...ach, ..._getAchStatus(ach) });
    },

    /* ─── رویدادها ─── */

    on(event, handler) {
      const entry = { event, handler };
      state.listeners.push(entry);
      return () => Achievements.off(event, handler);
    },

    off(event, handler) {
      state.listeners = state.listeners.filter(
        l => !(l.event === event && l.handler === handler)
      );
    },

    /* ─── Reset ─── */

    reset() {
      state.data = { unlocked: {}, progress: {} };
      _save();
      Achievements.renderPage();
      _emit('achievements:reset');
      return true;
    },

    /* ─── Export/Import ─── */

    export() {
      return JSON.parse(JSON.stringify(state.data));
    },

    import(data) {
      if (!data || typeof data !== 'object') return false;
      state.data = {
        unlocked: data.unlocked || {},
        progress: data.progress || {}
      };
      _save();
      Achievements.renderPage();
      return true;
    }
  };

  /* ─────────────────────────────────────────────
     رندر کارت
     ───────────────────────────────────────────── */
  function _getAchStatus(ach) {
    const unlockedData = state.data.unlocked[ach.id];
    const progressData = state.data.progress ? state.data.progress[ach.id] : null;

    return {
      unlocked: !!unlockedData,
      unlockedAt: unlockedData ? unlockedData.unlockedAt : null,
      progress: progressData ? progressData.progress : 0,
      target: ach.target || 1,
      percent: progressData
        ? Math.min(100, Math.round((progressData.progress / (ach.target || 1)) * 100))
        : (unlockedData ? 100 : 0)
    };
  }

  function _renderCard(ach) {
    const unlocked = ach.unlocked;
    const percent = ach.percent || 0;
    const unlockedDate = ach.unlockedAt
      ? new Date(ach.unlockedAt).toLocaleDateString('fa-IR')
      : null;

    return `
      <div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}"
           data-ach-id="${ach.id}"
           title="${unlocked ? 'باز شده ' + (unlockedDate || '') : ach.desc}">
        <div class="ach-icon">${ach.icon}</div>
        <div class="ach-info">
          <div class="ach-title">${ach.title}</div>
          <div class="ach-desc">${ach.desc}</div>
          ${!unlocked && ach.target > 1 ? `
            <div class="progress" style="margin-top: 6px; height: 4px;">
              <div class="progress-fill" style="width: ${percent}%"></div>
            </div>
            <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;">
              ${_toPersianNumber(ach.progress || 0)} / ${_toPersianNumber(ach.target)}
            </div>
          ` : ''}
          ${unlocked && unlockedDate ? `
            <div style="font-size: 10px; color: var(--accent); margin-top: 4px;">
              ✓ ${unlockedDate}
            </div>
          ` : ''}
        </div>
        ${!unlocked ? `<div class="ach-lock-badge">🔒</div>` : ''}
      </div>
    `;
  }

  /* ─────────────────────────────────────────────
     اتصال به رویدادها
     ───────────────────────────────────────────── */
  function _bindEvents() {
    const storage = _storage();
    if (!storage) return;

    // بعد از هر بازی، چک کن
    storage.on('game:recorded', () => {
      // کمی تأخیر تا آمار ذخیره بشه
      setTimeout(() => {
        Achievements.checkAll();
      }, 100);
    });

    // بعد از تغییر پروفایل (مثلاً ELO)، چک کن
    storage.on('profile:changed', () => {
      Achievements.checkAll();
    });

    // Cross-tab
    storage.on('cross-tab:stats', () => {
      Achievements.renderPage();
    });

    storage.on('cross-tab:achievements', () => {
      _load();
      Achievements.renderPage();
    });
  }

  /* ─────────────────────────────────────────────
     Bootstrap
     ───────────────────────────────────────────── */
  function bootstrap() {
    Achievements.init();
    _bindEvents();

    // چک اولیه بعد ۱ ثانیه
    setTimeout(() => {
      Achievements.checkAll();
    }, 1000);

    // به‌روزرسانی خودکار هر ۳۰ ثانیه (برای ELO)
    setInterval(() => {
      Achievements.checkAll();
    }, 30000);
  }

  /* ─────────────────────────────────────────────
     Export
     ───────────────────────────────────────────── */
  Achievements.LIST = ACHIEVEMENTS;
  Achievements.CATEGORIES = CATEGORIES;

  global.HokmAchievements = Achievements;

  // Auto-init
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(bootstrap, 100));
    } else {
      setTimeout(bootstrap, 100);
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);