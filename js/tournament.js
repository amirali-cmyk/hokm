/* ═══════════════════════════════════════════════════════════
   🏆 HOKM PRO v6.0 — tournament.js
   تورنمنت هفتگی: ثبت‌نام، حذفی، جدول، جوایز
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     ثابت‌ها
     ───────────────────────────────────────────── */
  const STORAGE_KEY = 'hokm_tournament';

  const FORMATS = {
    '8':  { fa: '۸ نفره',  rounds: 3, icon: '🎯' },  // QF → SF → F
    '16': { fa: '۱۶ نفره', rounds: 4, icon: '🏅' }   // R16 → QF → SF → F
  };

  const PRIZES = {
    1: { fa: 'قهرمان',     icon: '🥇', elo: 500, coins: 1000, medal: 'gold' },
    2: { fa: 'نایب‌قهرمان', icon: '🥈', elo: 300, coins: 500,  medal: 'silver' },
    3: { fa: 'سوم',         icon: '🥉', elo: 150, coins: 250,  medal: 'bronze' }
  };

  const ENTRY_FEE = 100; // سکه
  const TOURNAMENT_DAY = 6; // شنبه (۰=یکشنبه)
  const TOURNAMENT_HOUR = 20; // ۲۰:۰۰
  const TOURNAMENT_MINUTE = 0;
  const REGISTRATION_WINDOW = 24 * 60 * 60 * 1000; // ۲۴ ساعت قبل

  const STATUS = {
    UPCOMING: 'upcoming',     // در انتظار
    REGISTRATION: 'registration', // ثبت‌نام باز
    ONGOING: 'ongoing',       // در حال اجرا
    FINISHED: 'finished',     // تمام شده
    CANCELLED: 'cancelled'    // لغو شده
  };

  /* ─────────────────────────────────────────────
     وضعیت
     ───────────────────────────────────────────── */
  const state = {
    current: null,       // تورنمنت فعلی
    history: [],         // تورنمنت‌های گذشته
    myRegistration: null,// ثبت‌نام من
    listeners: [],
    countdownTimer: null,
    usingServer: false
  };

  /* ─────────────────────────────────────────────
     کمکی‌ها
     ───────────────────────────────────────────── */
  function _storage() { return global.HokmStorage; }
  function _profile() { return global.HokmProfile; }
  function _audio() { return global.HokmAudio; }
  function _ui() { return global.HokmUI; }

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

  function _padZero(n) {
    return String(n).padStart(2, '0');
  }

  /**
   * محاسبه زمان تورنمنت بعدی
   */
  function _getNextTournamentTime() {
    const now = new Date();
    const result = new Date(now);

    // روز بعد را حساب کن
    const currentDay = now.getDay();
    let daysUntil = (TOURNAMENT_DAY - currentDay + 7) % 7;

    // اگر امروز شنبه است ولی ساعت گذشته، برو هفته بعد
    if (daysUntil === 0) {
      const todayTarget = new Date(now);
      todayTarget.setHours(TOURNAMENT_HOUR, TOURNAMENT_MINUTE, 0, 0);
      if (now >= todayTarget) {
        daysUntil = 7;
      }
    }

    result.setDate(now.getDate() + daysUntil);
    result.setHours(TOURNAMENT_HOUR, TOURNAMENT_MINUTE, 0, 0);

    return result;
  }

  /**
   * محاسبه زمان باقی‌مانده
   */
  function _getTimeRemaining(targetTime) {
    const now = Date.now();
    const diff = targetTime - now;

    if (diff <= 0) {
      return { past: true, days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
    }

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return { past: false, days, hours, minutes, seconds, total: diff };
  }

  /**
   * فرمت زمان
   */
  function _formatCountdown(remaining) {
    if (remaining.past) return 'شروع شد!';
    if (remaining.days > 0) {
      return `${_toPersianNumber(remaining.days)} روز و ${_toPersianNumber(remaining.hours)} ساعت`;
    }
    if (remaining.hours > 0) {
      return `${_toPersianNumber(remaining.hours)}:${_toPersianNumber(_padZero(remaining.minutes))}:${_toPersianNumber(_padZero(remaining.seconds))}`;
    }
    return `${_toPersianNumber(remaining.minutes)}:${_toPersianNumber(_padZero(remaining.seconds))}`;
  }

  /**
   * تعیین وضعیت تورنمنت
   */
  function _getTournamentStatus(tournament) {
    if (!tournament) return STATUS.UPCOMING;

    const now = Date.now();
    const startTime = tournament.startTime;
    const regStart = tournament.registrationStart || (startTime - REGISTRATION_WINDOW);

    if (tournament.cancelled) return STATUS.CANCELLED;
    if (tournament.finished) return STATUS.FINISHED;
    if (now >= startTime && !tournament.finished) return STATUS.ONGOING;
    if (now >= regStart && now < startTime) return STATUS.REGISTRATION;

    return STATUS.UPCOMING;
  }

  /* ─────────────────────────────────────────────
     ذخیره/بارگذاری
     ───────────────────────────────────────────── */
  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        _createNewTournament();
        return;
      }

      const data = JSON.parse(raw);
      state.current = data.current || null;
      state.history = data.history || [];
      state.myRegistration = data.myRegistration || null;

      // اگر تورنمنت فعلی گذشته، یکی جدید بساز
      if (state.current && Date.now() > state.current.startTime + 6 * 60 * 60 * 1000) {
        state.history.unshift(state.current);
        _createNewTournament();
      }

      // اگر null بود، بساز
      if (!state.current) {
        _createNewTournament();
      }
    } catch (e) {
      console.warn('[Tournament] Load error:', e);
      _createNewTournament();
    }
  }

  function _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        current: state.current,
        history: state.history.slice(0, 10),
        myRegistration: state.myRegistration,
        savedAt: Date.now()
      }));
    } catch (e) {
      console.warn('[Tournament] Save error:', e);
    }
  }

  /**
   * ساخت تورنمنت جدید
   */
  function _createNewTournament() {
    const startTime = _getNextTournamentTime().getTime();
    const format = Math.random() < 0.5 ? '8' : '16';
    const size = parseInt(format, 10);

    // بازیکنان نمونه
    const demoPlayers = _generateDemoPlayers(size);

    state.current = {
      id: 'tourn_' + Date.now().toString(36),
      format,
      size,
      startTime,
      registrationStart: startTime - REGISTRATION_WINDOW,
      entryFee: ENTRY_FEE,
      prizePool: size * ENTRY_FEE,
      players: demoPlayers,
      bracket: null,
      finished: false,
      cancelled: false,
      createdAt: Date.now(),
      currentRound: 0
    };

    state.myRegistration = null;
    _save();
    return state.current;
  }

  /**
   * ساخت بازیکنان دمو
   */
  function _generateDemoPlayers(count) {
    const names = [
      'پادشاه', 'شکارچی', 'آتشین', 'ماه', 'توفان',
      'ستاره', 'عقاب', 'قلب‌سنگی', 'شاهین', 'پلنگ',
      'سایه', 'کوهنورد', 'خوش‌شانس', 'صاعقه', 'برف',
      'آسمان', 'دریا', 'کوه', 'جنگل', 'کویر'
    ];

    const avatars = ['👑', '🦁', '🔥', '🌙', '⚡', '⭐', '🦅', '💎', '🦊', '🐯', '🎭', '🐺', '🍀', '⚔️', '❄️', '☁️', '🌊', '🏔️', '🌲', '🏜️'];

    const players = [];
    const used = new Set();

    for (let i = 0; i < count; i++) {
      let idx;
      do {
        idx = Math.floor(Math.random() * names.length);
      } while (used.has(idx) && used.size < names.length);
      used.add(idx);

      players.push({
        id: 'demo_tp_' + i + '_' + Math.random().toString(36).slice(2, 6),
        name: names[idx],
        avatar: avatars[idx],
        elo: 1000 + Math.floor(Math.random() * 1200),
        isBot: true,
        seed: i + 1
      });
    }

    // shuffle
    return players.sort(() => Math.random() - 0.5);
  }

  /* ─────────────────────────────────────────────
     API عمومی
     ───────────────────────────────────────────── */
  const Tournament = {

    FORMATS,
    PRIZES,
    STATUS,
    ENTRY_FEE,

    /**
     * راه‌اندازی
     */
    init() {
      _load();
      _startCountdown();
      Tournament.render();

      console.log(
        `%c🏆 Tournament: ${state.current?.format} نفره — ${state.current?.players.length} بازیکن`,
        'color: #ffd60a; font-weight: bold;'
      );
      return state;
    },

    /* ─── Getterها ─── */

    getCurrent() {
      return state.current ? { ...state.current } : null;
    },

    getHistory() {
      return state.history.slice();
    },

    getStatus() {
      return _getTournamentStatus(state.current);
    },

    getTimeRemaining() {
      if (!state.current) return null;
      return _getTimeRemaining(state.current.startTime);
    },

    getPrizePool() {
      if (!state.current) return 0;
      return state.current.prizePool;
    },

    isRegistered() {
      return !!state.myRegistration;
    },

    getMyRegistration() {
      return state.myRegistration;
    },

    getPlayerCount() {
      return state.current?.players?.length || 0;
    },

    getMaxPlayers() {
      return state.current?.size || 8;
    },

    /* ─── ثبت‌نام ─── */

    /**
     * ثبت‌نام در تورنمنت
     */
    register() {
      if (!state.current) {
        return { ok: false, error: 'تورنمنتی موجود نیست' };
      }

      const status = _getTournamentStatus(state.current);

      if (status === STATUS.FINISHED) {
        return { ok: false, error: 'تورنمنت تمام شده' };
      }
      if (status === STATUS.ONGOING) {
        return { ok: false, error: 'تورنمنت شروع شده' };
      }
      if (state.myRegistration) {
        return { ok: false, error: 'قبلاً ثبت‌نام کرده‌ای' };
      }
      if (state.current.players.length >= state.current.size) {
        return { ok: false, error: 'ظرفیت پر است' };
      }

      // چک سکه
      const profile = _profile();
      if (!profile) {
        return { ok: false, error: 'پروفایل یافت نشد' };
      }

      const myCoins = profile.getCoins ? profile.getCoins() : 100;
      if (myCoins < state.current.entryFee) {
        return { ok: false, error: `سکه کافی نداری (نیاز: ${state.current.entryFee})` };
      }

      // پرداخت
      if (profile.spendCoins) {
        const paid = profile.spendCoins(state.current.entryFee);
        if (!paid) {
          return { ok: false, error: 'پرداخت ناموفق' };
        }
      }

      // ثبت‌نام
      const me = profile.get ? profile.get() : { name: 'تو', avatar: '😎' };

      const myEntry = {
        id: 'me_' + Date.now(),
        name: me.name || 'تو',
        avatar: me.avatar || '😎',
        elo: me.elo || 1000,
        isMe: true,
        registeredAt: Date.now()
      };

      state.current.players.push(myEntry);
      state.myRegistration = myEntry;

      _save();
      Tournament.render();

      if (_audio()) _audio().play('coin');

      _emit('tournament:registered', { tournament: state.current, me: myEntry });

      return { ok: true, entry: myEntry };
    },

    /**
     * لغو ثبت‌نام
     */
    cancelRegistration() {
      if (!state.myRegistration) {
        return { ok: false, error: 'ثبت‌نامی نیست' };
      }

      const status = _getTournamentStatus(state.current);
      if (status === STATUS.ONGOING || status === STATUS.FINISHED) {
        return { ok: false, error: 'دیگر قابل لغو نیست' };
      }

      // حذف از لیست
      const idx = state.current.players.findIndex(p => p.isMe);
      if (idx !== -1) {
        state.current.players.splice(idx, 1);
      }

      // بازگشت سکه
      const profile = _profile();
      if (profile && profile.addCoins) {
        profile.addCoins(state.current.entryFee);
      }

      state.myRegistration = null;
      _save();
      Tournament.render();

      _emit('tournament:cancelled-registration');

      return { ok: true };
    },

    /* ─── Bracket (شبیه‌سازی) ─── */

    /**
     * ساخت جدول حذفی (دمو)
     */
    generateBracket() {
      const players = state.current?.players || [];
      if (players.length < 2) return null;

      const shuffled = players.slice().sort(() => Math.random() - 0.5);
      const rounds = [];

      // Round 1
      const round1 = [];
      for (let i = 0; i < shuffled.length; i += 2) {
        round1.push({
          p1: shuffled[i],
          p2: shuffled[i + 1] || null,
          winner: null
        });
      }
      rounds.push(round1);

      state.current.bracket = rounds;
      _save();

      return rounds;
    },

    /* ─── رندر ─── */

    render() {
      const container = document.querySelector('.tournament-container');
      if (!container) return;

      if (!state.current) {
        _renderEmpty();
        return;
      }

      const status = _getTournamentStatus(state.current);
      const remaining = _getTimeRemaining(state.current.startTime);
      const registered = Tournament.isRegistered();
      const prizePool = Tournament.getPrizePool();
      const maxPlayers = state.current.size;
      const currentPlayers = state.current.players.length;
      const formatInfo = FORMATS[state.current.format] || FORMATS['8'];

      const statusMap = {
        upcoming:     { fa: 'در انتظار',    color: 'var(--text-muted)',     icon: '⏳' },
        registration: { fa: 'ثبت‌نام باز',   color: 'var(--color-success)', icon: '✅' },
        ongoing:      { fa: 'در حال اجرا',   color: 'var(--color-warning)', icon: '🎮' },
        finished:     { fa: 'تمام شده',      color: 'var(--text-muted)',    icon: '🏁' },
        cancelled:    { fa: 'لغو شده',       color: 'var(--color-danger)',  icon: '❌' }
      };

      const statusInfo = statusMap[status] || statusMap.upcoming;

      container.innerHTML = `
        <h2 class="screen-title">🏆 تورنمنت هفتگی</h2>

        <div class="tournament-card">
          <div class="tournament-header">
            <span class="tournament-badge">
              ${formatInfo.icon} حذفی ${formatInfo.fa}
            </span>
            <span class="tournament-time" style="color: ${statusInfo.color};">
              ${statusInfo.icon} ${statusInfo.fa}
            </span>
          </div>

          <div style="
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            gap: 12px;
            margin: 16px 0;
          ">
            <div class="stat-card">
              <div class="stat-value">${_toPersianNumber(currentPlayers)}/${_toPersianNumber(maxPlayers)}</div>
              <div class="stat-label">بازیکنان</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: var(--accent);">
                ${_toPersianNumber(prizePool)}
              </div>
              <div class="stat-label">🪙 جایزه کل</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="font-size: 18px;">
                ${formatInfo.rounds === 3 ? '۳' : '۴'}
              </div>
              <div class="stat-label">مرحله</div>
            </div>
          </div>

          <!-- Countdown -->
          <div style="
            text-align: center;
            padding: 16px;
            background: var(--bg-secondary);
            border-radius: var(--radius-md);
            border: 1px solid var(--border-color);
            margin-bottom: 16px;
          ">
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">
              ${remaining.past ? 'زمان شروع' : 'شروع تا'}
            </div>
            <div id="tournamentCountdown" style="
              font-family: var(--font-num);
              font-size: 22px;
              font-weight: 900;
              color: var(--accent);
              letter-spacing: 0.02em;
            ">${_formatCountdown(remaining)}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">
              📅 هر شنبه ساعت ۲۰:۰۰
            </div>
          </div>

          <!-- Prizes -->
          <ul class="tournament-prizes">
            ${Object.entries(PRIZES).map(([rank, prize]) => `
              <li>
                <span style="font-size: 20px;">${prize.icon}</span>
                <span style="flex: 1;">${prize.fa}</span>
                <span style="color: var(--accent); font-weight: 700;">
                  +${_toPersianNumber(prize.elo)} ELO
                </span>
                <span style="color: var(--text-muted); font-size: 11px;">
                  🪙 ${_toPersianNumber(prize.coins)}
                </span>
              </li>
            `).join('')}
          </ul>

          <!-- Actions -->
          <div id="tournamentActions" style="margin-top: 16px;">
            ${_renderActions(status, registered)}
          </div>

          <!-- Players list -->
          ${currentPlayers > 0 ? `
            <details style="margin-top: 16px;">
              <summary style="
                cursor: pointer;
                font-size: 13px;
                color: var(--text-secondary);
                padding: 8px 0;
                user-select: none;
              ">
                👥 مشاهده بازیکنان (${_toPersianNumber(currentPlayers)})
              </summary>
              <div style="
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                gap: 8px;
                margin-top: 12px;
              ">
                ${state.current.players.map(p => _renderPlayerChip(p)).join('')}
              </div>
            </details>
          ` : ''}
        </div>

        ${state.history.length > 0 ? `
          <h3 class="section-title" style="margin-top: 24px;">📜 تورنمنت‌های گذشته</h3>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${state.history.slice(0, 5).map(t => _renderHistoryItem(t)).join('')}
          </div>
        ` : ''}
      `;

      _bindActions(status, registered);
    },

    /* ─── رویدادها ─── */

    on(event, handler) {
      const entry = { event, handler };
      state.listeners.push(entry);
      return () => Tournament.off(event, handler);
    },

    off(event, handler) {
      state.listeners = state.listeners.filter(
        l => !(l.event === event && l.handler === handler)
      );
    },

    /* ─── Reset ─── */

    reset() {
      localStorage.removeItem(STORAGE_KEY);
      state.current = null;
      state.history = [];
      state.myRegistration = null;
      _createNewTournament();
      Tournament.render();
    }
  };

  /* ─────────────────────────────────────────────
     رندر اجزا
     ───────────────────────────────────────────── */
  function _renderActions(status, registered) {
    if (registered) {
      if (status === STATUS.ONGOING) {
        return `
          <button class="btn btn-primary btn-large btn-block" id="btnPlayTournament">
            🎮 ورود به مسابقه
          </button>
        `;
      }
      if (status === STATUS.FINISHED) {
        return `
          <div style="text-align: center; padding: 12px; color: var(--text-muted);">
            🏁 این تورنمنت به پایان رسید
          </div>
        `;
      }
      return `
        <button class="btn btn-danger btn-block" id="btnCancelTournament">
          ❌ لغو ثبت‌نام (بازگشت ${_toPersianNumber(state.current.entryFee)} سکه)
        </button>
      `;
    }

    if (status === STATUS.FINISHED) {
      return `
        <div style="text-align: center; padding: 12px; color: var(--text-muted);">
          🏁 این تورنمنت تمام شد
        </div>
        <button class="btn btn-outline btn-block" id="btnNewTournament" style="margin-top: 8px;">
          ✨ تورنمنت بعدی
        </button>
      `;
    }

    if (status === STATUS.ONGOING) {
      return `
        <div style="text-align: center; padding: 12px; color: var(--color-warning);">
          🎮 تورنمنت در حال اجراست — بعدی را از دست نده
        </div>
      `;
    }

    return `
      <button class="btn btn-primary btn-large btn-block" id="btnJoinTournament">
        💰 ثبت‌نام با ${_toPersianNumber(state.current.entryFee)} سکه
      </button>
    `;
  }

  function _renderPlayerChip(p) {
    const isMe = p.isMe;
    return `
      <div style="
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: ${isMe ? 'var(--accent-soft)' : 'var(--bg-elevated)'};
        border: 1px solid ${isMe ? 'var(--accent)' : 'var(--border-color)'};
        border-radius: var(--radius-sm);
        font-size: 12px;
      ">
        <span style="font-size: 16px;">${_escapeHtml(p.avatar || '👤')}</span>
        <span style="font-weight: 600;">${_escapeHtml(p.name)}</span>
        ${isMe ? '<span class="badge badge-accent" style="font-size: 9px;">تو</span>' : ''}
      </div>
    `;
  }

  function _renderHistoryItem(t) {
    const date = new Date(t.startTime).toLocaleDateString('fa-IR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <div class="list-item" style="cursor: default;">
        <div class="replay-icon">🏆</div>
        <div class="list-item-content">
          <div class="list-item-title">${t.format} نفره — حذفی</div>
          <div class="list-item-sub">${date} · ${_toPersianNumber(t.players.length)} بازیکن</div>
        </div>
        <span class="badge">🏁 تمام</span>
      </div>
    `;
  }

  function _renderEmpty() {
    const container = document.querySelector('.tournament-container');
    if (!container) return;

    container.innerHTML = `
      <h2 class="screen-title">🏆 تورنمنت هفتگی</h2>
      <div class="empty-state">
        <div class="empty-state-title">هنوز تورنمنتی نیست</div>
        <button class="btn btn-primary" id="btnCreateTournament" style="margin-top: 16px;">
          ✨ ساخت تورنمنت جدید
        </button>
      </div>
    `;

    const btn = document.getElementById('btnCreateTournament');
    if (btn) {
      btn.addEventListener('click', () => {
        _createNewTournament();
        Tournament.render();
      });
    }
  }

  /* ─────────────────────────────────────────────
     Bind اکشن‌ها
   ───────────────────────────────────────────── */
  function _bindActions(status, registered) {
    // ثبت‌نام
    const joinBtn = document.getElementById('btnJoinTournament');
    if (joinBtn) {
      joinBtn.addEventListener('click', () => {
        const result = Tournament.register();

        if (result.ok) {
          if (_ui()) _ui().showToast(
            '✅ ثبت‌نام موفق!',
            'در تورنمنت ثبت‌نام شدی',
            'success',
            3000
          );
        } else {
          if (_ui()) _ui().showToast('خطا', result.error, 'error');
        }
      });
    }

    // لغو
    const cancelBtn = document.getElementById('btnCancelTournament');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (confirm('لغو ثبت‌نام؟ سکه‌ات بازگردانده می‌شود.')) {
          const result = Tournament.cancelRegistration();
          if (result.ok) {
            if (_ui()) _ui().showToast('لغو شد', 'سکه‌ات بازگشت', 'info');
          }
        }
      });
    }

    // ورود به مسابقه
    const playBtn = document.getElementById('btnPlayTournament');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (_ui()) _ui().showToast(
          '🎮 ورود به مسابقه',
          'به‌زودی: رابط مسابقه',
          'info'
        );
      });
    }

    // تورنمنت بعدی
    const newBtn = document.getElementById('btnNewTournament');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        state.history.unshift(state.current);
        _createNewTournament();
        _save();
        Tournament.render();
        if (_ui()) _ui().showToast('✨ تورنمنت جدید', 'ثبت‌نام باز شد', 'success');
      });
    }
  }

  /* ─────────────────────────────────────────────
     شمارش معکوس
   ───────────────────────────────────────────── */
  function _startCountdown() {
    if (state.countdownTimer) {
      clearInterval(state.countdownTimer);
    }

    state.countdownTimer = setInterval(() => {
      const el = document.getElementById('tournamentCountdown');
      if (!el || !state.current) return;

      const remaining = _getTimeRemaining(state.current.startTime);
      el.textContent = _formatCountdown(remaining);

      // اگر گذشته، رنگ قرمز
      if (remaining.past) {
        el.style.color = 'var(--color-success)';
      } else if (remaining.total < 60 * 60 * 1000) {
        // کمتر از ۱ ساعت → نارنجی
        el.style.color = 'var(--color-warning)';
      } else {
        el.style.color = 'var(--accent)';
      }
    }, 1000);
  }

  /* ─────────────────────────────────────────────
     Bootstrap
   ───────────────────────────────────────────── */
  function bootstrap() {
    Tournament.init();

    // فقط یک بار bind شود
    if (global._tournamentBootstrapped) return;
    global._tournamentBootstrapped = true;

    // پاکسازی
    window.addEventListener('beforeunload', () => {
      if (state.countdownTimer) {
        clearInterval(state.countdownTimer);
      }
    });
  }

  /* ─────────────────────────────────────────────
     Export
     ───────────────────────────────────────────── */
  global.HokmTournament = Tournament;

  // Auto-init
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(bootstrap, 200));
    } else {
      setTimeout(bootstrap, 200);
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);