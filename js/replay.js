/* ═══════════════════════════════════════════════════════════
   📼 HOKM PRO v6.0 — replay.js
   پخش مجدد: ذخیره، پخش، کنترل، سرعت، اسلایدر
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     ثابت‌ها
     ───────────────────────────────────────────── */
  const STORAGE_KEY = 'hokm_replays';
  const MAX_REPLAYS = 20;
  const FORMAT_VERSION = 1;

  const SPEEDS = [0.5, 1, 2, 4];

  /* ─────────────────────────────────────────────
     وضعیت
     ───────────────────────────────────────────── */
  const state = {
    replays: [],           // [{id, meta, events, savedAt}]
    current: null,         // رپلی در حال پخش
    playing: false,
    speed: 1,
    currentIndex: 0,
    playTimer: null,
    listeners: [],
    container: null
  };

  /* ─────────────────────────────────────────────
     کمکی‌ها
     ───────────────────────────────────────────── */
  function _storage() { return global.HokmStorage; }
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

  function _formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${_toPersianNumber(mins)}:${_toPersianNumber(String(secs).padStart(2, '0'))}`;
  }

  function _formatDate(timestamp) {
    const d = new Date(timestamp);
    return d.toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function _timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'همین الان';
    if (seconds < 3600) return `${_toPersianNumber(Math.floor(seconds / 60))} دقیقه پیش`;
    if (seconds < 86400) return `${_toPersianNumber(Math.floor(seconds / 3600))} ساعت پیش`;
    if (seconds < 604800) return `${_toPersianNumber(Math.floor(seconds / 86400))} روز پیش`;
    return `${_toPersianNumber(Math.floor(seconds / 604800))} هفته پیش`;
  }

  /* ─────────────────────────────────────────────
     ذخیره/بارگذاری
     ───────────────────────────────────────────── */
  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      state.replays = data.replays || [];
    } catch (e) {
      console.warn('[Replay] Load error:', e);
      state.replays = [];
    }
  }

  function _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: FORMAT_VERSION,
        replays: state.replays.slice(0, MAX_REPLAYS),
        savedAt: Date.now()
      }));
    } catch (e) {
      console.warn('[Replay] Save error:', e);

      // اگر فضا پر بود، قدیمی‌ها را حذف کن
      if (e.name === 'QuotaExceededError') {
        state.replays = state.replays.slice(0, 5);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: FORMAT_VERSION,
            replays: state.replays,
            savedAt: Date.now()
          }));
        } catch (e2) {
          console.error('[Replay] Retry failed');
        }
      }
    }
  }

  /* ─────────────────────────────────────────────
     فشرده‌سازی
     ───────────────────────────────────────────── */
  function _compressEvent(event) {
    // فشرده‌سازی برای صرفه‌جویی در فضا
    return event;
  }

  function _decompressEvent(event) {
    return event;
  }

  /* ─────────────────────────────────────────────
     API عمومی
   ───────────────────────────────────────────── */
  const Replay = {

    SPEEDS,
    FORMAT_VERSION,

    /**
     * راه‌اندازی
     */
    init() {
      _load();
      Replay.render();
      _bindGameEvents();

      console.log(
        `%c📼 Replay: ${state.replays.length} بازی ذخیره‌شده`,
        'color: #118ab2; font-weight: bold;'
      );
      return state;
    },

    /* ─── ذخیره ─── */

    /**
     * شروع ضبط بازی جدید
     */
    startRecording(meta) {
      state.current = {
        id: 'replay_' + Date.now().toString(36),
        meta: {
          playerCount: meta.playerCount || 4,
          aiLevel: meta.aiLevel || 'medium',
          mode: meta.mode || 'ai',
          startTime: Date.now(),
          players: (meta.players || []).map(p => ({
            name: p.name,
            avatar: p.avatar,
            team: p.team,
            isAI: p.isAI
          }))
        },
        events: [],
        result: null,
        savedAt: null
      };

      _emit('recording:started', { id: state.current.id });
      return state.current.id;
    },

    /**
     * ثبت یک رویداد در بازی
     */
    recordEvent(type, data) {
      if (!state.current) return;

      state.current.events.push(_compressEvent({
        t: Date.now() - state.current.meta.startTime,
        type,
        data
      }));

      // محدودیت حافظه
      if (state.current.events.length > 1000) {
        console.warn('[Replay] Too many events, trimming');
        state.current.events = state.current.events.slice(-800);
      }
    },

    /**
     * پایان ضبط
     */
    stopRecording(result) {
      if (!state.current) return null;

      state.current.result = result || null;
      state.current.savedAt = Date.now();
      state.current.meta.duration = Date.now() - state.current.meta.startTime;

      // ذخیره در لیست
      state.replays.unshift(state.current);

      // محدودیت
      if (state.replays.length > MAX_REPLAYS) {
        state.replays = state.replays.slice(0, MAX_REPLAYS);
      }

      const id = state.current.id;
      state.current = null;

      _save();
      Replay.render();

      _emit('recording:stopped', { id });

      return id;
    },

    /**
     * لغو ضبط (بدون ذخیره)
     */
    cancelRecording() {
      state.current = null;
    },

    /* ─── لیست ─── */

    getReplays() {
      return state.replays.slice();
    },

    getReplay(id) {
      return state.replays.find(r => r.id === id) || null;
    },

    deleteReplay(id) {
      const idx = state.replays.findIndex(r => r.id === id);
      if (idx === -1) return false;

      state.replays.splice(idx, 1);
      _save();
      Replay.render();

      _emit('replay:deleted', { id });
      return true;
    },

    clearAll() {
      state.replays = [];
      _save();
      Replay.render();
      _emit('replay:cleared');
      return true;
    },

    /* ─── پخش ─── */

    /**
     * شروع پخش یک رپلی
     */
    async play(replayId) {
      const replay = Replay.getReplay(replayId);
      if (!replay) {
        if (_ui()) _ui().showToast('خطا', 'رپلی یافت نشد', 'error');
        return false;
      }

      // اگر در حال پخش است، متوقف کن
      Replay.stop();

      state.current = replay;
      state.currentIndex = 0;
      state.playing = true;

      _emit('replay:started', { replay });

      // نمایش مودال پخش
      Replay._showPlayerModal(replay);

      // شروع پخش
      setTimeout(() => Replay._playNext(), 500);

      return true;
    },

    /**
     * توقف پخش
     */
    stop() {
      if (state.playTimer) {
        clearTimeout(state.playTimer);
        state.playTimer = null;
      }
      state.playing = false;
      _emit('replay:stopped');
    },

    /**
     * توقف / ادامه
     */
    togglePlay() {
      if (state.playing) {
        Replay.stop();
        _updatePlayerUI();
      } else {
        state.playing = true;
        Replay._playNext();
        _updatePlayerUI();
      }
    },

    /**
     * پخش رویداد بعدی
     */
    _playNext() {
      if (!state.playing || !state.current) return;

      const events = state.current.events;
      if (state.currentIndex >= events.length) {
        // پایان
        state.playing = false;
        _updatePlayerUI();
        _emit('replay:ended');
        if (_ui()) _ui().showToast('پایان', 'پخش مجدد تمام شد', 'info');
        return;
      }

      const event = _decompressEvent(events[state.currentIndex]);

      // اجرای رویداد
      _applyEvent(event);

      // آپدیت UI
      _updatePlayerUI();
      _updateProgress(event);

      state.currentIndex++;

      // تاخیر تا رویداد بعدی
      const nextEvent = events[state.currentIndex];
      let delay = 800 / state.speed;

      if (nextEvent) {
        const diff = nextEvent.t - event.t;
        delay = Math.max(200, Math.min(3000, diff / state.speed));
      }

      state.playTimer = setTimeout(() => Replay._playNext(), delay);
    },

    /**
     * پرش به رویداد
     */
    seekTo(index) {
      if (!state.current) return;

      index = Math.max(0, Math.min(index, state.current.events.length - 1));

      // پاک کردن و اجرا از ابتدا تا index
      state.currentIndex = 0;

      if (_ui() && global.HokmGame) {
        // پاک کردن UI
      }

      // پخش تا index (سریع)
      while (state.currentIndex <= index) {
        const ev = _decompressEvent(state.current.events[state.currentIndex]);
        _applyEvent(ev, true); // silent mode
        state.currentIndex++;
      }

      _updateProgress(state.current.events[index]);
      _emit('replay:seek', { index });
    },

    /**
     * تغییر سرعت
     */
    setSpeed(speed) {
      if (!SPEEDS.includes(speed)) speed = 1;
      state.speed = speed;
      _updatePlayerUI();
      _emit('replay:speed', { speed });
    },

    getSpeed() {
      return state.speed;
    },

    /* ─── رندر لیست ─── */

    render() {
      const container = document.getElementById('replayList');
      if (!container) return;

      if (state.replays.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-title">هیچ بازی ذخیره‌شده‌ای نیست</div>
            <div class="empty-state-msg">بازی‌هایت خودکار ذخیره می‌شوند</div>
          </div>
        `;
        return;
      }

      container.innerHTML = state.replays.map(r => _renderReplayItem(r)).join('');

      _bindListEvents();
    },

    /* ─── رویدادها ─── */

    on(event, handler) {
      const entry = { event, handler };
      state.listeners.push(entry);
      return () => Replay.off(event, handler);
    },

    off(event, handler) {
      state.listeners = state.listeners.filter(
        l => !(l.event === event && l.handler === handler)
      );
    },

    /* ─── Export/Import ─── */

    exportReplay(id) {
      const replay = Replay.getReplay(id);
      if (!replay) return null;
      return JSON.parse(JSON.stringify(replay));
    },

    exportAll() {
      return JSON.parse(JSON.stringify({
        version: FORMAT_VERSION,
        replays: state.replays
      }));
    },

    importReplay(data) {
      if (!data || !data.id || !data.events) return false;
      state.replays.unshift(data);
      if (state.replays.length > MAX_REPLAYS) {
        state.replays = state.replays.slice(0, MAX_REPLAYS);
      }
      _save();
      Replay.render();
      return true;
    },

    /**
     * دانلود به‌صورت فایل .hokm
     */
    downloadReplay(id) {
      const replay = Replay.getReplay(id);
      if (!replay) return false;

      const json = JSON.stringify({
        format: 'hokm-replay',
        version: FORMAT_VERSION,
        replay
      }, null, 2);

      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hokm-replay-${replay.id}.hokm`;
      a.click();

      setTimeout(() => URL.revokeObjectURL(url), 1000);

      if (_ui()) _ui().showToast('✅ دانلود شد', 'فایل .hokm ذخیره شد', 'success');
      return true;
    },

    /* ─── Modal پخش ─── */

    _showPlayerModal(replay) {
      if (!_ui()) return;

      const meta = replay.meta;
      const win = replay.result?.win;
      const scoreA = replay.result?.scoreA || 0;
      const scoreB = replay.result?.scoreB || 0;

      const html = `
        <div style="text-align: center; margin-bottom: 16px;">
          <div style="font-size: 36px; margin-bottom: 6px;">📼</div>
          <h3 class="modal-title">پخش مجدد</h3>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            ${_formatDate(replay.meta.startTime)} · ${_toPersianNumber(meta.playerCount)} نفره · ${meta.aiLevel}
          </p>
          ${replay.result ? `
            <p style="margin-top: 8px;">
              نتیجه:
              <strong style="color: ${win ? 'var(--color-success)' : 'var(--color-danger)'};">
                ${_toPersianNumber(scoreA)} — ${_toPersianNumber(scoreB)}
              </strong>
            </p>
          ` : ''}
        </div>

        <!-- نمایش میز -->
        <div id="replayStage" style="
          background:
            radial-gradient(ellipse at 50% 45%, rgba(6, 90, 70, 0.25) 0%, transparent 65%),
            linear-gradient(180deg, rgba(13, 27, 42, 0.6), rgba(13, 27, 42, 0.9));
          border-radius: var(--radius-md);
          padding: 16px;
          min-height: 180px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        ">
          <div id="replayStatus" style="
            color: var(--text-secondary);
            font-size: 13px;
            text-align: center;
          ">آماده پخش...</div>
          <div id="replayScores" style="
            font-family: var(--font-num);
            font-size: 24px;
            font-weight: 900;
            color: var(--accent);
            display: flex;
            gap: 20px;
          ">
            <span id="replayScoreA">${_toPersianNumber(0)}</span>
            <span style="color: var(--text-muted);">—</span>
            <span id="replayScoreB">${_toPersianNumber(0)}</span>
          </div>
          <div id="replayCard" style="
            min-height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          "></div>
        </div>

        <!-- پیشرفت -->
        <div style="margin-bottom: 12px;">
          <input type="range"
                 id="replaySeek"
                 min="0"
                 max="${replay.events.length - 1}"
                 value="0"
                 class="slider"
                 style="width: 100%;" />
          <div style="
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: var(--text-muted);
            font-family: var(--font-num);
            margin-top: 4px;
          ">
            <span id="replayCurrentTime">۰:۰۰</span>
            <span id="replayTotalEvents">${_toPersianNumber(replay.events.length)} رویداد</span>
            <span id="replayTotalTime">${_formatDuration(meta.duration || 0)}</span>
          </div>
        </div>

        <!-- کنترل‌ها -->
        <div style="
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        ">
          <button class="icon-btn" id="replayRestart" title="از ابتدا" style="width: 42px; height: 42px;">⏮️</button>
          <button class="icon-btn" id="replayBack" title="عقب" style="width: 42px; height: 42px;">⏪</button>
          <button class="icon-btn" id="replayPlayPause"
                  title="پخش / توقف"
                  style="width: 56px; height: 56px; font-size: 24px; background: var(--accent); color: #1a1a1a;">
            ⏸️
          </button>
          <button class="icon-btn" id="replayForward" title="جلو" style="width: 42px; height: 42px;">⏩</button>
          <button class="icon-btn" id="replayEnd" title="پایان" style="width: 42px; height: 42px;">⏭️</button>
        </div>

        <!-- سرعت -->
        <div style="
          display: flex;
          justify-content: center;
          gap: 6px;
          margin-bottom: 16px;
        ">
          ${SPEEDS.map(s => `
            <button class="chip replay-speed-btn ${s === 1 ? 'active' : ''}"
                    data-speed="${s}"
                    style="font-family: var(--font-num);">
              ${_toPersianNumber(s)}x
            </button>
          `).join('')}
        </div>

        <!-- اکشن‌ها -->
        <div class="modal-actions" style="display: flex; gap: 8px;">
          <button class="btn btn-outline" id="replayDownload" style="flex: 1;">
            💾 دانلود
          </button>
          <button class="btn btn-danger" id="replayDelete" style="flex: 1;">
            🗑️ حذف
          </button>
        </div>
      `;

      _ui().openModal(html, { dismissible: true });

      // Bind
      setTimeout(() => _bindPlayerEvents(), 100);
    },

    /* ─── رویدادهای داخلی ─── */

    _playNext: null // placeholder (تعریف شد بالا)
  };

  /* ─────────────────────────────────────────────
     اعمال رویدادها به UI
   ───────────────────────────────────────────── */
  function _applyEvent(event, silent) {
    const statusEl = document.getElementById('replayStatus');
    const cardEl = document.getElementById('replayCard');
    const scoreAEl = document.getElementById('replayScoreA');
    const scoreBEl = document.getElementById('replayScoreB');

    switch (event.type) {
      case 'game:start':
        if (statusEl) statusEl.textContent = '🎬 شروع بازی';
        break;

      case 'hokm:set': {
        const suit = event.data?.suit;
        const symbols = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
        if (statusEl) statusEl.textContent = `👑 حکم: ${symbols[suit] || suit}`;
        break;
      }

      case 'card:played': {
        const card = event.data?.card;
        const playerIdx = event.data?.playerIdx;
        if (statusEl) statusEl.textContent = `🎴 بازیکن ${_toPersianNumber(playerIdx + 1)} یک کارت بازی کرد`;
        if (cardEl && card) {
          cardEl.innerHTML = `
            <div class="card-face ${(card.suit === 'hearts' || card.suit === 'diamonds') ? 'red' : ''}"
                 style="width: 48px; height: 68px; padding: 4px;">
              <div class="card-corner top">
                <span class="card-rank" style="font-size: 14px;">${card.symbol}</span>
              </div>
              <div class="card-suit" style="font-size: 24px;">
                ${{ spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }[card.suit]}
              </div>
            </div>
          `;
        }
        break;
      }

      case 'trick:completed': {
        const winner = event.data?.winner;
        if (statusEl) statusEl.textContent = `🏆 برنده دور: بازیکن ${_toPersianNumber(winner + 1)}`;
        break;
      }

      case 'score:changed': {
        const scores = event.data?.scores;
        if (scores) {
          if (scoreAEl) scoreAEl.textContent = _toPersianNumber(scores.A);
          if (scoreBEl) scoreBEl.textContent = _toPersianNumber(scores.B);
        }
        break;
      }

      case 'game:ended': {
        const result = event.data;
        if (statusEl) statusEl.textContent = result?.win ? '🏆 بردی!' : '💔 باختی';
        break;
      }

      case 'chat': {
        if (statusEl) statusEl.textContent = `💬 ${event.data?.text || ''}`;
        break;
      }
    }
  }

  function _updatePlayerUI() {
    const playBtn = document.getElementById('replayPlayPause');
    if (playBtn) {
      playBtn.textContent = state.playing ? '⏸️' : '▶️';
    }

    // سرعت
    document.querySelectorAll('.replay-speed-btn').forEach(btn => {
      const s = parseFloat(btn.dataset.speed);
      btn.classList.toggle('active', s === state.speed);
    });
  }

  function _updateProgress(event) {
    const seek = document.getElementById('replaySeek');
    const current = document.getElementById('replayCurrentTime');

    if (seek && state.current) {
      seek.value = state.currentIndex;
    }

    if (current && event) {
      current.textContent = _formatDuration(event.t || 0);
    }
  }

  /* ─────────────────────────────────────────────
     Bind رویدادهای پخش
   ───────────────────────────────────────────── */
  function _bindPlayerEvents() {
    // Play / Pause
    const playPause = document.getElementById('replayPlayPause');
    if (playPause) {
      playPause.addEventListener('click', () => {
        Replay.togglePlay();
      });
    }

    // Restart
    const restart = document.getElementById('replayRestart');
    if (restart) {
      restart.addEventListener('click', () => {
        Replay.seekTo(0);
        if (state.playing) {
          Replay._playNext();
        }
      });
    }

    // Back
    const back = document.getElementById('replayBack');
    if (back) {
      back.addEventListener('click', () => {
        Replay.seekTo(Math.max(0, state.currentIndex - 5));
      });
    }

    // Forward
    const forward = document.getElementById('replayForward');
    if (forward) {
      forward.addEventListener('click', () => {
        Replay.seekTo(Math.min(state.current.events.length - 1, state.currentIndex + 5));
      });
    }

    // End
    const endBtn = document.getElementById('replayEnd');
    if (endBtn) {
      endBtn.addEventListener('click', () => {
        Replay.seekTo(state.current.events.length - 1);
      });
    }

    // Seek slider
    const seek = document.getElementById('replaySeek');
    if (seek) {
      seek.addEventListener('input', (e) => {
        const idx = parseInt(e.target.value, 10);
        Replay.seekTo(idx);
      });
    }

    // سرعت
    document.querySelectorAll('.replay-speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed);
        Replay.setSpeed(speed);
        if (_audio()) _audio().play('softClick');
      });
    });

    // دانلود
    const download = document.getElementById('replayDownload');
    if (download) {
      download.addEventListener('click', () => {
        if (state.current) {
          Replay.downloadReplay(state.current.id);
        }
      });
    }

    // حذف
    const del = document.getElementById('replayDelete');
    if (del) {
      del.addEventListener('click', () => {
        if (!state.current) return;
        if (confirm('این رپلی حذف شود؟')) {
          const id = state.current.id;
          Replay.stop();
          Replay.deleteReplay(id);
          if (_ui()) {
            _ui().closeModal();
            _ui().showToast('حذف شد', '', 'info');
          }
        }
      });
    }

    // پاک کردن timer در close
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
      const observer = new MutationObserver(() => {
        if (overlay.classList.contains('hidden')) {
          Replay.stop();
          observer.disconnect();
        }
      });
      observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    }
  }

  /* ─────────────────────────────────────────────
     رندر آیتم لیست
   ───────────────────────────────────────────── */
  function _renderReplayItem(r) {
    const meta = r.meta || {};
    const result = r.result;
    const win = result?.win;

    const icon = win === true ? '🏆' : win === false ? '💔' : '📼';
    const resultColor = win === true
      ? 'var(--color-success)'
      : win === false
        ? 'var(--color-danger)'
        : 'var(--text-muted)';

    const score = result
      ? `${_toPersianNumber(result.scoreA || 0)} - ${_toPersianNumber(result.scoreB || 0)}`
      : '—';

    const duration = meta.duration ? _formatDuration(meta.duration) : '—';

    return `
      <div class="replay-item" data-replay-id="${_escapeHtml(r.id)}">
        <div class="replay-icon">${icon}</div>
        <div class="replay-info">
          <div class="replay-title">
            <span style="color: ${resultColor}; font-weight: 700;">${score}</span>
            — ${_toPersianNumber(meta.playerCount || 4)} نفره (${meta.aiLevel || 'medium'})
          </div>
          <div class="replay-meta">
            ${_timeAgo(r.savedAt || meta.startTime)} · ${_toPersianNumber(r.events.length)} رویداد · ⏱️ ${duration}
          </div>
        </div>
        <div style="display: flex; gap: 4px;">
          <button class="icon-btn replay-play-btn"
                  data-replay-id="${_escapeHtml(r.id)}"
                  title="پخش"
                  style="width: 38px; height: 38px; font-size: 16px;">
            ▶️
          </button>
          <button class="icon-btn replay-menu-btn"
                  data-replay-id="${_escapeHtml(r.id)}"
                  title="گزینه‌ها"
                  style="width: 38px; height: 38px; font-size: 16px;">
            ⋮
          </button>
        </div>
      </div>
    `;
  }

  function _bindListEvents() {
    const container = document.getElementById('replayList');
    if (!container || container.dataset.bound === '1') return;
    container.dataset.bound = '1';

    container.addEventListener('click', (e) => {
      const playBtn = e.target.closest('.replay-play-btn');
      const menuBtn = e.target.closest('.replay-menu-btn');

      if (playBtn) {
        Replay.play(playBtn.dataset.replayId);
        return;
      }

      if (menuBtn) {
        _openReplayMenu(menuBtn.dataset.replayId);
        return;
      }

      // کلیک روی ردیف → پخش
      const row = e.target.closest('.replay-item');
      if (row) {
        Replay.play(row.dataset.replayId);
      }
    });
  }

  function _openReplayMenu(replayId) {
    const replay = Replay.getReplay(replayId);
    if (!replay || !_ui()) return;

    _ui().openModal(`
      <h3 class="modal-title">گزینه‌های رپلی</h3>
      <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 12px;">
        <button class="btn btn-primary" id="rmPlay" style="justify-content: flex-start;">
          ▶️ پخش
        </button>
        <button class="btn btn-ghost" id="rmDownload" style="justify-content: flex-start;">
          💾 دانلود فایل .hokm
        </button>
        <button class="btn btn-danger" id="rmDelete" style="justify-content: flex-start;">
          🗑️ حذف
        </button>
      </div>
    `);

    setTimeout(() => {
      const play = document.getElementById('rmPlay');
      const dl = document.getElementById('rmDownload');
      const rm = document.getElementById('rmDelete');

      if (play) play.addEventListener('click', () => {
        _ui().closeModal();
        setTimeout(() => Replay.play(replayId), 200);
      });

      if (dl) dl.addEventListener('click', () => {
        Replay.downloadReplay(replayId);
        _ui().closeModal();
      });

      if (rm) rm.addEventListener('click', () => {
        if (confirm('حذف شود؟')) {
          Replay.deleteReplay(replayId);
          _ui().closeModal();
          _ui().showToast('حذف شد', '', 'info');
        }
      });
    }, 100);
  }

  /* ─────────────────────────────────────────────
     اتصال به رویدادهای بازی
   ───────────────────────────────────────────── */
  function _bindGameEvents() {
    const game = global.HokmGame;
    if (!game) return;

    // شروع بازی
    game.on('game:start', ({ players }) => {
      const state = game.getState();
      Replay.startRecording({
        playerCount: state.playerCount,
        aiLevel: state.players[1]?.aiLevel || 'medium',
        mode: 'ai',
        players
      });
      Replay.recordEvent('game:start', { players: state.playerCount });
    });

    // حکم تنظیم شد
    game.on('hokm:set', ({ suit }) => {
      Replay.recordEvent('hokm:set', { suit });
    });

    // کارت بازی شد
    game.on('card:played', ({ playerIdx, card }) => {
      Replay.recordEvent('card:played', {
        playerIdx,
        card: {
          suit: card.suit,
          rank: card.rank,
          symbol: card.symbol,
          id: card.id
        }
      });
    });

    // دور تمام
    game.on('trick:completed', ({ winner }) => {
      Replay.recordEvent('trick:completed', { winner });
    });

    // امتیاز عوض شد
    game.on('score:changed', ({ scores, trickCount }) => {
      Replay.recordEvent('score:changed', { scores, trickCount });
    });

    // پایان بازی
    game.on('game:ended', (result) => {
      Replay.recordEvent('game:ended', result);
      Replay.stopRecording(result);
    });

    // خروج
    game.on('game:quit', () => {
      Replay.cancelRecording();
    });
  }

  /* ─────────────────────────────────────────────
     Bootstrap
   ───────────────────────────────────────────── */
  function bootstrap() {
    Replay.init();
  }

  /* ─────────────────────────────────────────────
     Export
     ───────────────────────────────────────────── */
  global.HokmReplay = Replay;

  // Auto-init
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(bootstrap, 250));
    } else {
      setTimeout(bootstrap, 250);
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);