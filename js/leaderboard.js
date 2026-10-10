/* ═══════════════════════════════════════════════════════════
   🏆 HOKM PRO v6.0 — leaderboard.js
   جدول امتیازات با Top 100 + 3 فیلتر + کش + fallback
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     ثابت‌ها
     ───────────────────────────────────────────── */
  const FILTERS = {
    weekly:  { fa: 'هفتگی',   icon: '📅', duration: 7 * 24 * 60 * 60 * 1000 },
    monthly: { fa: 'ماهانه',  icon: '📆', duration: 30 * 24 * 60 * 60 * 1000 },
    all:     { fa: 'کل',       icon: '🏆', duration: Infinity }
  };

  const API_BASE = '/api';
  const FETCH_TIMEOUT = 8000; // 8 ثانیه
  const MAX_ENTRIES = 100;

  /* ─────────────────────────────────────────────
     وضعیت
     ───────────────────────────────────────────── */
  const state = {
    filter: 'all',
    entries: [],
    loading: false,
    error: null,
    lastFetch: 0,
    listeners: [],
    usingFallback: false
  };

  /* ─────────────────────────────────────────────
     کمکی‌ها
     ───────────────────────────────────────────── */
  function _storage() {
    return global.HokmStorage;
  }

  function _profile() {
    return global.HokmProfile;
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

  function _escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _timeAgo(timestamp) {
    if (!timestamp) return '';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'همین الان';
    if (seconds < 3600) return `${_toPersianNumber(Math.floor(seconds / 60))} دقیقه پیش`;
    if (seconds < 86400) return `${_toPersianNumber(Math.floor(seconds / 3600))} ساعت پیش`;
    if (seconds < 604800) return `${_toPersianNumber(Math.floor(seconds / 86400))} روز پیش`;
    return `${_toPersianNumber(Math.floor(seconds / 604800))} هفته پیش`;
  }

  /**
   * fetch با timeout
   */
  function _fetchWithTimeout(url, options = {}) {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        reject(new Error('Timeout'));
      }, FETCH_TIMEOUT);

      fetch(url, {
        ...options,
        signal: controller.signal
      })
        .then(res => {
          clearTimeout(timeout);
          resolve(res);
        })
        .catch(err => {
          clearTimeout(timeout);
          reject(err);
        });
    });
  }

  /* ─────────────────────────────────────────────
     فیلتر منطقی
     ───────────────────────────────────────────── */
  function _filterEntries(entries, filter) {
    if (filter === 'all') return entries;
    const info = FILTERS[filter];
    if (!info || info.duration === Infinity) return entries;

    const cutoff = Date.now() - info.duration;
    return entries.filter(e => (e.updatedAt || e.timestamp || 0) >= cutoff);
  }

  /* ─────────────────────────────────────────────
     Fallback محلی — از آمار خودمان
     ───────────────────────────────────────────── */
  function _buildLocalFallback() {
    const storage = _storage();
    const profile = _profile();

    if (!storage || !profile) return [];

    const myProfile = profile.get();
    const myStats = storage.getStats();

    // لیست پایه
    const entries = [];

    // خودم
    if (myStats.gamesPlayed > 0) {
      entries.push({
        userId: myProfile.userId || 'me',
        name: myProfile.name,
        avatar: myProfile.avatar,
        elo: myProfile.elo,
        wins: myStats.wins,
        losses: myStats.losses,
        games: myStats.gamesPlayed,
        winRate: myStats.winRate || 0,
        streak: myStats.bestStreak || 0,
        isMe: true,
        updatedAt: myStats.lastGameAt || Date.now()
      });
    }

    // داده‌های نمونه (برای اینکه جدول خالی نباشه)
    const sampleNames = [
      { name: 'پادشاه',    avatar: '👑', elo: 2150, wins: 128, losses: 32, streak: 12 },
      { name: 'استاد بزرگ', avatar: '🔥', elo: 2010, wins: 110, losses: 40, streak: 8 },
      { name: 'شکارچی',    avatar: '🦁', elo: 1875, wins: 95,  losses: 45, streak: 6 },
      { name: 'ماه',        avatar: '🌙', elo: 1720, wins: 78,  losses: 52, streak: 5 },
      { name: 'توفان',     avatar: '⚡', elo: 1650, wins: 72,  losses: 55, streak: 4 },
      { name: 'ستاره',     avatar: '⭐', elo: 1590, wins: 65,  losses: 58, streak: 3 },
      { name: 'عقاب',      avatar: '🦅', elo: 1520, wins: 58,  losses: 60, streak: 5 },
      { name: 'آتشین',     avatar: '🔥', elo: 1480, wins: 55,  losses: 62, streak: 2 },
      { name: 'شاهین',     avatar: '🦊', elo: 1420, wins: 50,  losses: 65, streak: 3 },
      { name: 'قلب‌سنگی',  avatar: '💎', elo: 1360, wins: 45,  losses: 68, streak: 2 },
      { name: 'پلنگ',      avatar: '🐯', elo: 1310, wins: 42,  losses: 70, streak: 4 },
      { name: 'سایه',      avatar: '🎭', elo: 1240, wins: 38,  losses: 75, streak: 1 },
      { name: 'کوهنورد',   avatar: '🐺', elo: 1180, wins: 34,  losses: 78, streak: 3 },
      { name: 'خوش‌شانس',  avatar: '🍀', elo: 1110, wins: 30,  losses: 82, streak: 2 },
      { name: 'مبتدی',     avatar: '🌱', elo: 1020, wins: 22,  losses: 88, streak: 1 }
    ];

    sampleNames.forEach((s, i) => {
      const now = Date.now();
      const offset = Math.floor(Math.random() * 5 * 24 * 60 * 60 * 1000);
      entries.push({
        userId: 'sample_' + i,
        name: s.name,
        avatar: s.avatar,
        elo: s.elo,
        wins: s.wins,
        losses: s.losses,
        games: s.wins + s.losses,
        winRate: Math.round((s.wins / (s.wins + s.losses)) * 100),
        streak: s.streak,
        isMe: false,
        isSample: true,
        updatedAt: now - offset
      });
    });

    // مرتب‌سازی
    entries.sort((a, b) => b.elo - a.elo);

    // شماره رتبه
    entries.forEach((e, i) => { e.rank = i + 1; });

    return entries.slice(0, MAX_ENTRIES);
  }

  /* ─────────────────────────────────────────────
     Fetch از سرور
     ───────────────────────────────────────────── */
  async function _fetchFromServer(filter) {
    const token = _storage()?.getAuthToken();

    const headers = {
      'Accept': 'application/json'
    };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    const url = `${API_BASE}/leaderboard?filter=${encodeURIComponent(filter)}&limit=${MAX_ENTRIES}`;

    const res = await _fetchWithTimeout(url, { headers });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    if (!data || !Array.isArray(data.entries)) {
      throw new Error('Invalid response');
    }

    return data.entries;
  }

  /* ─────────────────────────────────────────────
     پردازش داده
     ───────────────────────────────────────────── */
  function _processEntries(entries) {
    const myProfile = _profile()?.get();
    const myUserId = myProfile?.userId || null;
    const myName = myProfile?.name || null;

    // محاسبه winRate
    let processed = entries.map((e, i) => {
      const games = e.games || (e.wins || 0) + (e.losses || 0);
      const winRate = e.winRate != null
        ? e.winRate
        : (games > 0 ? Math.round((e.wins / games) * 100) : 0);

      const isMe = (myUserId && e.userId === myUserId) ||
                   (!myUserId && myName && e.name === myName && e.isMe !== false);

      return {
        ...e,
        games,
        winRate,
        isMe,
        rank: i + 1
      };
    });

    // مرتب‌سازی بر اساس ELO
    processed.sort((a, b) => (b.elo || 0) - (a.elo || 0));

    // شماره رتبه مجدد
    processed.forEach((e, i) => { e.rank = i + 1; });

    return processed;
  }

  /* ─────────────────────────────────────────────
     API عمومی
     ───────────────────────────────────────────── */
  const Leaderboard = {

    /* ─── راه‌اندازی ─── */
    init() {
      _bindEvents();
      // بارگذاری اولیه
      Leaderboard.load(state.filter).catch(() => {});

      console.log(
        '%c🏆 Leaderboard ready',
        'color: #ffd60a; font-weight: bold;'
      );
      return Leaderboard;
    },

    /* ─── بارگذاری ─── */

    /**
     * بارگذاری داده‌ها (با کش)
     */
    async load(filter = state.filter, options = {}) {
      const { force = false, showLoading = true } = options;

      if (!FILTERS[filter]) filter = 'all';
      state.filter = filter;

      // چک کش
      if (!force) {
        const cached = _getFromCache(filter);
        if (cached) {
          state.entries = cached;
          state.usingFallback = false;
          Leaderboard.render();
          _emit('leaderboard:loaded', { entries: cached, fromCache: true });
          return cached;
        }
      }

      if (showLoading) {
        state.loading = true;
        state.error = null;
        _renderLoading();
      }

      try {
        // تلاش برای سرور
        const raw = await _fetchFromServer(filter);
        const processed = _processEntries(raw);

        state.entries = processed;
        state.usingFallback = false;
        state.error = null;

        // ذخیره در کش
        _setToCache(filter, processed);

        Leaderboard.render();
        _emit('leaderboard:loaded', { entries: processed, fromCache: false });

        return processed;

      } catch (err) {
        console.warn('[Leaderboard] Server fetch failed:', err.message);

        // Fallback محلی
        const local = _buildLocalFallback();
        const filtered = _filterEntries(local, filter);

        state.entries = filtered;
        state.usingFallback = true;
        state.error = 'حالت آفلاین — داده‌های محلی';

        Leaderboard.render();
        _emit('leaderboard:loaded', { entries: filtered, fallback: true });

        return filtered;

      } finally {
        state.loading = false;
      }
    },

    /**
     * بارگذاری مجدد (بدون کش)
     */
    async refresh() {
      if (global.HokmAudio) global.HokmAudio.play('click');
      return Leaderboard.load(state.filter, { force: true });
    },

    /* ─── فیلتر ─── */

    setFilter(filter) {
      if (!FILTERS[filter]) return false;
      if (state.filter === filter) return true;

      state.filter = filter;
      _updateFilterUI();

      // بارگذاری از کش
      const cached = _getFromCache(filter);
      if (cached) {
        state.entries = cached;
        Leaderboard.render();
      } else {
        Leaderboard.load(filter);
      }

      _emit('filter:changed', { filter });
      return true;
    },

    getFilter() {
      return state.filter;
    },

    /* ─── داده ─── */

    getEntries() {
      return state.entries.slice();
    },

    getTop(n = 3) {
      return state.entries.slice(0, n);
    },

    /**
     * رتبه من در جدول
     */
    getMyEntry() {
      return state.entries.find(e => e.isMe) || null;
    },

    getMyRank() {
      const me = Leaderboard.getMyEntry();
      return me ? me.rank : null;
    },

    /* ─── رندر ─── */

    render() {
      const container = document.getElementById('leaderboardList');
      if (!container) return;

      if (state.loading) {
        _renderLoading();
        return;
      }

      if (state.entries.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-title">جدول خالی است</div>
            <div class="empty-state-msg">اولین بازیکن باش که وارد لیست می‌شود!</div>
          </div>
        `;
        return;
      }

      // اطلاعات آماری
      const totalEntries = state.entries.length;
      const myRank = Leaderboard.getMyRank();

      let html = '';

      // هدر اطلاعات
      html += `
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          margin-bottom: 12px;
          background: var(--bg-elevated);
          border-radius: var(--radius-sm);
          font-size: 12px;
          color: var(--text-secondary);
        ">
          <span>📊 ${_toPersianNumber(totalEntries)} بازیکن</span>
          ${myRank ? `
            <span style="color: var(--accent); font-weight: 700;">
              رتبه تو: #${_toPersianNumber(myRank)}
            </span>
          ` : ''}
          <button
            id="lbRefreshBtn"
            class="chip"
            style="padding: 4px 10px; font-size: 11px;"
          >🔄 بروزرسانی</button>
        </div>
      `;

      // اگر fallback هست، هشدار بده
      if (state.usingFallback) {
        html += `
          <div style="
            padding: 8px 12px;
            margin-bottom: 12px;
            background: rgba(244, 162, 89, 0.1);
            border: 1px solid var(--color-warning);
            border-radius: var(--radius-sm);
            font-size: 11.5px;
            color: var(--color-warning);
          ">
            ⚠️ حالت آفلاین — داده‌های نمونه نمایش داده می‌شود
          </div>
        `;
      }

      // ردیف‌ها
      html += state.entries.map(e => _renderRow(e)).join('');

      container.innerHTML = html;

      // Bind رویدادها
      _bindContainerEvents();
    },

    /* ─── رویدادها ─── */

    on(event, handler) {
      const entry = { event, handler };
      state.listeners.push(entry);
      return () => Leaderboard.off(event, handler);
    },

    off(event, handler) {
      state.listeners = state.listeners.filter(
        l => !(l.event === event && l.handler === handler)
      );
    },

    /* ─── Reset ─── */

    reset() {
      state.entries = [];
      state.error = null;
      _clearCache();
      Leaderboard.render();
      _emit('leaderboard:reset');
    },

    /* ─── Helpers ─── */

    getFilters() {
      return Object.entries(FILTERS).map(([key, val]) => ({
        key,
        ...val
      }));
    }
  };

  /* ─────────────────────────────────────────────
     رندر ردیف
     ───────────────────────────────────────────── */
  function _renderRow(e) {
    const rank = e.rank || 0;
    const isTop3 = rank <= 3 && rank >= 1;
    const rankClass = rank === 1 ? 'top-1' : rank === 2 ? 'top-2' : rank === 3 ? 'top-3' : '';
    const rowClass = e.isMe ? 'self' : '';

    // مدال برای ۳ نفر اول
    const medalIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
    const rankContent = medalIcon || _toPersianNumber(rank);

    // آواتار
    const avatarHtml = typeof e.avatar === 'string' && e.avatar.startsWith('data:image')
      ? `<img src="${e.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`
      : (e.avatar || '🌱');

    // زیرنویس
    const subParts = [];
    if (e.wins != null) subParts.push(`✅ ${_toPersianNumber(e.wins)} برد`);
    if (e.losses != null) subParts.push(`❌ ${_toPersianNumber(e.losses)} باخت`);
    if (e.winRate != null) subParts.push(`⚡ ${_toPersianNumber(e.winRate)}٪`);
    const subText = subParts.join(' · ');

    // بج "تو"
    const meBadge = e.isMe
      ? `<span class="badge badge-accent" style="margin-right:6px;">تو</span>`
      : '';

    return `
      <div class="leaderboard-row ${rowClass}" data-user-id="${_escapeHtml(e.userId || '')}">
        <div class="lb-rank ${rankClass}">${rankContent}</div>
        <div class="lb-avatar">${avatarHtml}</div>
        <div class="lb-info">
          <div class="lb-name">${_escapeHtml(e.name || 'ناشناس')}${meBadge}</div>
          <div class="lb-stats">${subText}</div>
        </div>
        <div class="lb-elo">${_toPersianNumber(e.elo || 0)}</div>
      </div>
    `;
  }

  /* ─────────────────────────────────────────────
     رندر Loading
     ───────────────────────────────────────────── */
  function _renderLoading() {
    const container = document.getElementById('leaderboardList');
    if (!container) return;

    let html = '';
    for (let i = 0; i < 8; i++) {
      html += `
        <div class="leaderboard-row" style="opacity: 0.6;">
          <div class="lb-rank skeleton" style="width:40px;height:40px;border-radius:50%;"></div>
          <div class="lb-avatar skeleton" style="width:40px;height:40px;border-radius:50%;"></div>
          <div class="lb-info">
            <div class="skeleton" style="width: 40%; height: 14px; margin-bottom: 6px;"></div>
            <div class="skeleton" style="width: 70%; height: 11px;"></div>
          </div>
          <div class="skeleton" style="width: 50px; height: 18px;"></div>
        </div>
      `;
    }
    container.innerHTML = html;
  }

  /* ─────────────────────────────────────────────
     کش
     ───────────────────────────────────────────── */
  const CACHE_DURATION = 60 * 60 * 1000; // ۱ ساعت
  const cacheKey = (filter) => `hokm_lb_cache_${filter}`;

  function _getFromCache(filter) {
    // اول storage کش
    const storage = _storage();
    if (storage && filter === 'all') {
      const cached = storage.getLeaderboardCache();
      if (cached && cached.entries && cached.entries.length > 0) {
        return cached.entries;
      }
    }

    // بعد localStorage مستقیم
    try {
      const raw = localStorage.getItem(cacheKey(filter));
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data.cachedAt || (Date.now() - data.cachedAt) > CACHE_DURATION) {
        localStorage.removeItem(cacheKey(filter));
        return null;
      }
      return data.entries || null;
    } catch (e) {
      return null;
    }
  }

  function _setToCache(filter, entries) {
    try {
      localStorage.setItem(cacheKey(filter), JSON.stringify({
        entries,
        cachedAt: Date.now()
      }));
    } catch (e) {
      // ignore
    }

    const storage = _storage();
    if (storage && filter === 'all') {
      try {
        storage.setLeaderboardCache({ entries });
      } catch (e) { /* ignore */ }
    }
  }

  function _clearCache() {
    Object.keys(FILTERS).forEach(f => {
      try { localStorage.removeItem(cacheKey(f)); } catch (e) {}
    });
  }

  /* ─────────────────────────────────────────────
     UI Binding
     ───────────────────────────────────────────── */
  function _updateFilterUI() {
    const segments = document.querySelectorAll('#lbFilter button');
    segments.forEach(btn => {
      const active = btn.dataset.filter === state.filter;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function _bindContainerEvents() {
    // دکمه بروزرسانی
    const refreshBtn = document.getElementById('lbRefreshBtn');
    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = '1';
      refreshBtn.addEventListener('click', () => Leaderboard.refresh());
    }
  }

  function _bindEvents() {
    // Segmented فیلتر
    const filterEl = document.getElementById('lbFilter');
    if (filterEl && !filterEl.dataset.bound) {
      filterEl.dataset.bound = '1';
      filterEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-filter]');
        if (!btn) return;
        const filter = btn.dataset.filter;
        if (filter) {
          if (global.HokmAudio) global.HokmAudio.play('softClick');
          Leaderboard.setFilter(filter);
        }
      });
    }

    // به‌روزرسانی خودکار بعد از هر بازی
    const storage = _storage();
    if (storage) {
      storage.on('game:recorded', () => {
        // بعد از ۲ ثانیه، جدول رو رفرش کن
        setTimeout(() => {
          if (!state.loading) Leaderboard.refresh();
        }, 2000);
      });
    }

    // آپدیت UI فیلتر
    _updateFilterUI();

    // Cross-tab
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('hokm_lb_cache_')) {
        // کش تغییر کرد
        const filter = e.key.replace('hokm_lb_cache_', '');
        if (filter === state.filter) {
          const cached = _getFromCache(filter);
          if (cached) {
            state.entries = cached;
            Leaderboard.render();
          }
        }
      }
    });
  }

  /* ─────────────────────────────────────────────
     Bootstrap
     ───────────────────────────────────────────── */
  function bootstrap() {
    Leaderboard.init();
  }

  /* ─────────────────────────────────────────────
     Export
     ───────────────────────────────────────────── */
  Leaderboard.FILTERS = FILTERS;
  Leaderboard.MAX_ENTRIES = MAX_ENTRIES;

  global.HokmLeaderboard = Leaderboard;

  // Auto-init
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(bootstrap, 150));
    } else {
      setTimeout(bootstrap, 150);
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);