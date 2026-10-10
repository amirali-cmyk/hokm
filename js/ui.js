/* ═══════════════════════════════════════════════════════════
   🎨 HOKM PRO v6.0 — ui.js
   ناوبری + رندر کامل بازی + Modal + Toast + انیمیشن
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     ثابت‌ها
     ───────────────────────────────────────────── */
  const SUIT_SYMBOLS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
  const SUIT_FA = { spades: 'پیک', hearts: 'دل', diamonds: 'خشت', clubs: 'گشنیز' };

  const SCREENS = {
    menu: 'screen-menu',
    game: 'screen-game',
    profile: 'screen-profile',
    settings: 'screen-settings',
    help: 'screen-help',
    leaderboard: 'screen-leaderboard',
    achievements: 'screen-achievements',
    friends: 'screen-friends',
    tournament: 'screen-tournament',
    replay: 'screen-replay',
    online: 'screen-online',
    auth: 'screen-auth'
  };

  const TAB_SCREENS = ['menu', 'profile', 'settings', 'help'];

  /* ─────────────────────────────────────────────
     وضعیت
     ───────────────────────────────────────────── */
  const state = {
    currentScreen: 'menu',
    previousScreen: 'menu',
    inGame: false,
    modalOpen: false,
    listeners: []
  };

  /* ─────────────────────────────────────────────
     کمکی‌ها
     ───────────────────────────────────────────── */
  function _game() { return global.HokmGame; }
  function _audio() { return global.HokmAudio; }
  function _profile() { return global.HokmProfile; }

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

  function _$(id) { return document.getElementById(id); }
  function _$$(sel) { return document.querySelectorAll(sel); }

  /* ─────────────────────────────────────────────
     ناوبری
     ───────────────────────────────────────────── */
  const UI = {

    /**
     * رفتن به یک صفحه
     */
    navigate(screenName, options = {}) {
      if (!SCREENS[screenName]) {
        console.warn('[UI] Unknown screen:', screenName);
        return;
      }

      // اگر در بازی هستیم و داریم به صفحه غیر از game می‌ریم
      if (state.inGame && screenName !== 'game' && !options.force) {
        if (confirm('از بازی خارج می‌شوید؟')) {
          UI.exitGame();
        } else {
          return;
        }
      }

      state.previousScreen = state.currentScreen;
      state.currentScreen = screenName;

      // پنهان کردن همه
      _$$('.screen').forEach(el => el.classList.remove('active'));

      // نمایش جدید
      const screenEl = _$(SCREENS[screenName]);
      if (screenEl) {
        screenEl.classList.add('active');
        // اسکرول به بالا
        screenEl.scrollTop = 0;
      }

      // آپدیت تب‌ها (فقط برای tab screens)
      UI.updateTabs(screenName);

      // منطق مخصوص هر صفحه
      _onScreenEnter(screenName);

      _emit('navigate', { screen: screenName, previous: state.previousScreen });
      return true;
    },

    /**
     * رفتن به صفحه قبل
     */
    back() {
      UI.navigate(state.previousScreen);
    },

    /**
     * آپدیت تب‌های Top Bar
     */
    updateTabs(activeTab) {
      _$$('.tab').forEach(tab => {
        const tabName = tab.dataset.tab;
        const isActive =
          (tabName === 'game' && (activeTab === 'menu' || activeTab === 'game')) ||
          (tabName === activeTab);
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
      });
    },

    getCurrentScreen() {
      return state.currentScreen;
    },

    /* ─── Toast ─── */

    /**
     * نمایش Toast
     */
    showToast(title, message = '', type = 'info', duration = 3500) {
      const container = _$('toastContainer');
      if (!container) return null;

      const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️',
        achievement: '🎖️'
      };

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.setAttribute('role', 'alert');
      toast.innerHTML = `
        <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
        <div class="toast-body">
          <div class="toast-title">${_escapeHtml(title)}</div>
          ${message ? `<div class="toast-msg">${_escapeHtml(message)}</div>` : ''}
        </div>
      `;

      container.appendChild(toast);

      // انیمیشن حذف
      setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
      }, duration);

      return toast;
    },

    /* ─── Modal ─── */

    openModal(html, options = {}) {
      const overlay = _$('modalOverlay');
      const content = _$('modalContent');
      if (!overlay || !content) return;

      content.innerHTML = html;
      overlay.classList.remove('hidden');
      state.modalOpen = true;

      if (_audio()) _audio().play('modalOpen');

      // رویداد بستن
      const closeBtn = _$('modalClose');
      if (closeBtn && !closeBtn.dataset.bound) {
        closeBtn.dataset.bound = '1';
        closeBtn.addEventListener('click', UI.closeModal);
      }

      // بستن با کلیک روی overlay
      if (!overlay.dataset.bound) {
        overlay.dataset.bound = '1';
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay && options.dismissible !== false) {
            UI.closeModal();
          }
        });
      }

      // بستن با Escape
      if (!state.escHandler) {
        state.escHandler = (e) => {
          if (e.key === 'Escape' && state.modalOpen) {
            UI.closeModal();
          }
        };
        document.addEventListener('keydown', state.escHandler);
      }
    },

    closeModal() {
      const overlay = _$('modalOverlay');
      if (!overlay) return;

      overlay.classList.add('hidden');
      state.modalOpen = false;

      if (_audio()) _audio().play('modalClose');
    },

    /* ═══════════════════════════════════════════
       بازی — شروع و خروج
       ═══════════════════════════════════════════ */

    /**
     * شروع بازی از UI
     */
    async startGame(options = {}) {
      if (!_game()) {
        UI.showToast('خطا', 'موتور بازی در دسترس نیست', 'error');
        return;
      }

      try {
        state.inGame = true;

        // رفتن به صفحه بازی
        UI.navigate('game', { force: true });

        // نمایش‌های اولیه
        UI.resetGameView();

        // دکمه بازگشت
        const backBtn = _$('btnBackFromGame');
        if (backBtn) backBtn.classList.remove('hidden');

        // شروع
        await _game().start(options);

        // Bind رویدادها
        _bindGameEvents();

      } catch (err) {
        console.error('[UI] Start game error:', err);
        UI.showToast('خطا', 'بازی شروع نشد', 'error');
        state.inGame = false;
      }
    },

    /**
     * خروج از بازی
     */
    exitGame() {
      if (_game()) {
        _game().quit();
      }

      state.inGame = false;

      // پاک کردن صفحه
      UI.resetGameView();

      // دکمه بازگشت
      const backBtn = _$('btnBackFromGame');
      if (backBtn) backBtn.classList.add('hidden');

      // بازگشت به منو
      UI.navigate('menu', { force: true });
    },

    /**
     * ریست نمای بازی
     */
    resetGameView() {
      // کارت‌های دست
      const hand = _$('playerHand');
      if (hand) hand.innerHTML = '';

      // کارت‌های وسط
      const trickCenter = _$('trickCenter');
      if (trickCenter) trickCenter.innerHTML = '';

      // کارت‌های روی میز
      ['Top', 'Left', 'Right', 'Bottom'].forEach(pos => {
        const slot = _$('played' + pos);
        if (slot) slot.innerHTML = '';
      });

      // امتیازات
      _setText('scoreA', _toPersianNumber(0));
      _setText('scoreB', _toPersianNumber(0));
      _setText('roundNumber', _toPersianNumber(1));
      _setText('hokmSuit', '—');

      // تایمر
      const timerFill = _$('timerFill');
      if (timerFill) {
        timerFill.style.width = '100%';
        timerFill.classList.remove('warning', 'danger');
      }

      // پنهان کردن پنجره حکم
      const picker = _$('hokmPicker');
      if (picker) picker.classList.add('hidden');

      // پنهان کردن دکمه‌های اقدام
      const actions = _$('actionButtons');
      if (actions) actions.style.display = 'none';
    },

    /* ═══════════════════════════════════════════
       رندر بازی
       ═══════════════════════════════════════════ */

    /**
     * رندر کامل میز
     */
    renderGame() {
      if (!_game()) return;
      const s = _game().getState();

      // امتیازات
      UI.updateScores(s.scores, s.trickCount);

      // حکم
      if (s.hokm) {
        UI.updateHokmDisplay(s.hokm);
      }

      // دست من
      UI.renderHand(s.players[0]?.hand || [], s);

      // صندلی‌های بازیکنان
      UI.renderSeats(s);

      // کارت‌های دور فعلی
      UI.renderTrick(s.trick, s);

      // نوبت فعال
      UI.highlightCurrentPlayer(s.currentPlayer);
    },

    /**
     * رندر دست بازیکن
     */
    renderHand(cards, gameState) {
      const hand = _$('playerHand');
      if (!hand) return;

      const valid = _game().getValidCards(0);
      const validIds = new Set(valid.map(c => c.id));
      const isMyTurn = gameState.currentPlayer === 0 &&
                       gameState.phase === 'playing';

      hand.innerHTML = cards.map((card, i) => {
        const isValid = validIds.has(card.id);
        const playable = isMyTurn && isValid;
        const disabled = isMyTurn && !isValid;

        return _renderCardHTML(card, {
          playable,
          disabled,
          index: i,
          onclick: playable ? `HokmUI.handleCardClick('${card.id}')` : ''
        });
      }).join('');
    },

    /**
     * رندر صندلی‌های بازیکنان
     */
    renderSeats(gameState) {
      const seats = ['Bottom', 'Left', 'Top', 'Right'];
      const players = gameState.players;

      // Bottom = خودم، Left = هم‌تیمی/بعدی، Top = روبرو، Right = قبلی
      const seatMap = {
        Bottom: players[0],
        Left: players[1],
        Top: players[2],
        Right: players[3]
      };

      Object.entries(seatMap).forEach(([pos, p]) => {
        if (!p) {
          // پنهان کردن صندلی خالی
          const seat = _$('seat' + pos);
          if (seat) seat.style.display = 'none';
          return;
        }

        const seat = _$('seat' + pos);
        if (seat) seat.style.display = '';

        _setText('name' + pos, p.name);
        _setText('cards' + pos, _toPersianNumber(p.hand.length));

        const avatarEl = _$('avatar' + pos);
        if (avatarEl) {
          if (typeof p.avatar === 'string' && p.avatar.startsWith('data:image')) {
            avatarEl.innerHTML = `<img src="${p.avatar}" alt="" />`;
          } else {
            avatarEl.textContent = p.avatar || '🤖';
          }
        }
      });
    },

    /**
     * رندر کارت‌های وسط میز
     */
    renderTrick(trick, gameState) {
      const center = _$('trickCenter');
      if (!center) return;

      // پاک کردن
      center.innerHTML = '';

      // هر کارت به سمت بازیکنش
      trick.forEach(({ playerIdx, card }) => {
        const el = document.createElement('div');
        el.className = 'card-face card-played-anim';
        el.dataset.cardId = card.id;
        el.style.setProperty('--play-from-x', _getFromX(playerIdx));
        el.style.setProperty('--play-from-y', _getFromY(playerIdx));
        el.innerHTML = _cardInnerHTML(card);

        // تعیین موقعیت بر اساس بازیکن
        const positions = ['bottom', 'left', 'top', 'right'];
        const pos = positions[playerIdx] || 'bottom';
        el.dataset.pos = pos;

        center.appendChild(el);
      });
    },

    /**
     * به‌روزرسانی امتیازات
     */
    updateScores(scores, trickCount) {
      _setText('scoreA', _toPersianNumber(scores.A));
      _setText('scoreB', _toPersianNumber(scores.B));
      _setText('roundNumber', _toPersianNumber(trickCount + 1));
    },

    /**
     * نمایش حکم
     */
    updateHokmDisplay(suit) {
      const el = _$('hokmSuit');
      if (!el) return;
      const symbol = SUIT_SYMBOLS[suit] || '—';
      const isRed = suit === 'hearts' || suit === 'diamonds';
      el.textContent = symbol;
      el.style.color = isRed ? 'var(--color-danger)' : 'var(--accent)';
    },

    /**
     * هایلایت بازیکن نوبت
     */
    highlightCurrentPlayer(playerIdx) {
      ['Top', 'Left', 'Right', 'Bottom'].forEach((pos, i) => {
        const seat = _$('seat' + pos);
        if (!seat) return;
        seat.classList.toggle('active', i === playerIdx);
      });
    },

    /**
     * نمایش انتخاب حکم به کاربر
     */
    showHokmPicker() {
      const picker = _$('hokmPicker');
      if (!picker) return;
      picker.classList.remove('hidden');

      // Bind دکمه‌های suit
      picker.querySelectorAll('.suit-btn').forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
          const suit = btn.dataset.suit;
          UI.handleHokmSelect(suit);
        });
      });
    },

    hideHokmPicker() {
      const picker = _$('hokmPicker');
      if (picker) picker.classList.add('hidden');
    },

    /* ═══════════════════════════════════════════
       رویدادهای کاربر
       ═══════════════════════════════════════════ */

    /**
     * کلیک روی کارت
     */
    handleCardClick(cardId) {
      if (!_game()) return;

      const hand = _game().getMyHand();
      const card = hand.find(c => c.id === cardId);
      if (!card) return;

      // بررسی نوبت
      if (!_game().isMyTurn()) {
        UI.showToast('نوبت تو نیست', '', 'warning', 1500);
        if (_audio()) _audio().play('error');
        return;
      }

      // بررسی اعتبار
      const valid = _game().getValidCards(0);
      const isValid = valid.some(c => c.id === cardId);

      if (!isValid) {
        UI.showToast('باید از خال جاری بازی کنی!', '', 'warning', 1800);
        if (_audio()) _audio().play('error');

        // انیمیشن لرزش
        const el = document.querySelector(`[data-card-id="${cardId}"]`);
        if (el) {
          el.classList.add('card-invalid');
          setTimeout(() => el.classList.remove('card-invalid'), 400);
        }
        return;
      }

      // بازی
      _game().playCard(0, card);
    },

    /**
     * انتخاب حکم
     */
    handleHokmSelect(suit) {
      if (!_game()) return;
      const ok = _game().selectHokm(suit);
      if (ok) {
        UI.hideHokmPicker();
        if (_audio()) _audio().play('claimHokm');
      }
    },

    /**
     * پاس (در حالت‌های خاص)
     */
    handlePass() {
      if (!_game()) return;
      // در حکم پاس → انتخاب تصادفی
      UI.showToast('باید حکم تعیین کنی', '', 'warning', 2000);
    },

    /* ═══════════════════════════════════════════
       تایمر
       ═══════════════════════════════════════════ */

    updateTimer(remaining, duration) {
      const fill = _$('timerFill');
      if (!fill) return;

      const percent = Math.max(0, (remaining / duration) * 100);
      fill.style.width = `${percent}%`;

      fill.classList.remove('warning', 'danger');
      if (remaining <= 10) {
        fill.classList.add('danger');
      } else if (remaining <= duration * 0.4) {
        fill.classList.add('warning');
      }
    },

    resetTimer() {
      const fill = _$('timerFill');
      if (fill) {
        fill.style.width = '100%';
        fill.classList.remove('warning', 'danger');
      }
    },

    /* ═══════════════════════════════════════════
       پایان بازی
       ═══════════════════════════════════════════ */

    showGameEnd(result) {
      const win = result.win;
      const myScore = result.myScore;
      const opponentScore = result.opponentScore;
      const eloChange = result.eloChange || 0;
      const eloSign = eloChange >= 0 ? '+' : '';
      const eloColor = eloChange > 0
        ? 'var(--color-success)'
        : eloChange < 0
          ? 'var(--color-danger)'
          : 'var(--text-muted)';

      const duration = result.durationMs || 0;
      const mins = Math.floor(duration / 60000);
      const secs = Math.floor((duration % 60000) / 1000);

      // نتیجه
      const title = win ? '🏆 بردی!' : '💔 باختی';
      const titleColor = win ? 'var(--color-success)' : 'var(--color-danger)';

      const html = `
        <div style="text-align:center;">
          <div style="font-size:72px; margin-bottom: 8px; ${win ? 'animation: victoryBounce 0.8s var(--ease-bounce);' : 'animation: defeatShake 0.7s;'}">
            ${win ? '🏆' : '💔'}
          </div>
          <h2 class="modal-title" style="color: ${titleColor}; font-size: 26px;">
            ${title}
          </h2>
          <p style="color: var(--text-secondary); margin: 8px 0 20px;">
            نتیجه نهایی: <strong style="font-family: var(--font-num);">${_toPersianNumber(myScore)}</strong>
            —
            <strong style="font-family: var(--font-num);">${_toPersianNumber(opponentScore)}</strong>
          </p>
        </div>

        <div style="
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        ">
          <div class="stat-card">
            <div class="stat-value" style="color: ${eloColor};">
              ${_toPersianNumber(eloSign + eloChange)}
            </div>
            <div class="stat-label">تغییر ELO</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${_toPersianNumber(Math.floor(duration / 1000))}s</div>
            <div class="stat-label">مدت بازی</div>
          </div>
        </div>

        <div class="modal-actions" style="display: flex; flex-direction: column; gap: 10px;">
          <button class="btn btn-primary btn-large btn-block" id="btnPlayAgain">
            🎮 بازی مجدد
          </button>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-outline" style="flex:1;" id="btnShareResult">
              📤 اشتراک‌گذاری
            </button>
            <button class="btn btn-ghost" style="flex:1;" id="btnBackToMenu">
              🏠 منو
            </button>
          </div>
        </div>
      `;

      UI.openModal(html, { dismissible: false });

      // Bind
      const playAgain = _$('btnPlayAgain');
      if (playAgain) {
        playAgain.addEventListener('click', () => {
          UI.closeModal();
          setTimeout(() => {
            UI.startGame({
              playerCount: _game()?.getState().playerCount,
              aiLevel: _game()?.getState().players[1]?.aiLevel
            });
          }, 300);
        });
      }

      const backBtn = _$('btnBackToMenu');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          UI.closeModal();
          UI.exitGame();
        });
      }

      const shareBtn = _$('btnShareResult');
      if (shareBtn) {
        shareBtn.addEventListener('click', () => {
          if (global.HokmShare && typeof global.HokmShare.shareResult === 'function') {
            global.HokmShare.shareResult(result);
          } else {
            UI.showToast('اشتراک‌گذاری', 'به‌زودی در دسترس خواهد بود', 'info');
          }
        });
      }

      // جشن
      if (win) {
        UI.celebrateWin();
      }
    },

    /**
     * انیمیشن جشن برد
     */
    celebrateWin() {
      // کاغذرنگی
      const colors = ['#ffd60a', '#06d6a0', '#ef476f', '#118ab2', '#9b5de5'];
      for (let i = 0; i < 60; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = Math.random() * 100 + 'vw';
        c.style.background = colors[Math.floor(Math.random() * colors.length)];
        c.style.animationDuration = (2 + Math.random() * 2) + 's';
        c.style.animationDelay = Math.random() * 0.5 + 's';
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 5000);
      }

      // صدا
      if (_audio()) _audio().play('achievement');
    },

    /* ─── رویدادها ─── */

    on(event, handler) {
      const entry = { event, handler };
      state.listeners.push(entry);
      return () => UI.off(event, handler);
    },

    off(event, handler) {
      state.listeners = state.listeners.filter(
        l => !(l.event === event && l.handler === handler)
      );
    }
  };

  /* ─────────────────────────────────────────────
     رندر HTML کارت
     ───────────────────────────────────────────── */
  function _renderCardHTML(card, opts = {}) {
    const classes = ['card-face'];
    if (card.suit === 'hearts' || card.suit === 'diamonds') {
      classes.push('red');
    }
    if (opts.playable) classes.push('playable');
    if (opts.disabled) classes.push('disabled');
    if (opts.selected) classes.push('selected');

    const onclick = opts.onclick ? ` onclick="${opts.onclick}"` : '';

    return `
      <div class="${classes.join(' ')}"
           data-card-id="${card.id}"
           data-rank="${card.rank}"
           data-suit="${card.suit}"
           ${onclick}>
        ${_cardInnerHTML(card)}
      </div>
    `;
  }

  function _cardInnerHTML(card) {
    const symbol = SUIT_SYMBOLS[card.suit] || '?';
    const rank = card.symbol || card.rank;

    return `
      <div class="card-corner top">
        <span class="card-rank">${rank}</span>
        <span class="card-suit-small">${symbol}</span>
      </div>
      <div class="card-suit">${symbol}</div>
      <div class="card-corner bottom">
        <span class="card-rank">${rank}</span>
        <span class="card-suit-small">${symbol}</span>
      </div>
    `;
  }

  /* ─────────────────────────────────────────────
     موقعیت شروع کارت‌ها
     ───────────────────────────────────────────── */
  function _getFromX(playerIdx) {
    const positions = { 0: '0px', 1: '-300px', 2: '0px', 3: '300px' };
    return positions[playerIdx] || '0px';
  }

  function _getFromY(playerIdx) {
    const positions = { 0: '300px', 1: '0px', 2: '-300px', 3: '0px' };
    return positions[playerIdx] || '0px';
  }

  /* ─────────────────────────────────────────────
     اتصال رویدادهای game.js
     ───────────────────────────────────────────── */
  function _bindGameEvents() {
    const game = _game();
    if (!game) return;

    // فقط یک بار bind کن
    if (game._uiBound) return;
    game._uiBound = true;

    // ─── شروع بازی ───
    game.on('game:start', ({ players }) => {
      UI.renderGame();
    });

    // ─── توزیع کارت ───
    game.on('cards:dealt', ({ hands }) => {
      UI.renderHand(hands[0], game.getState());
    });

    // ─── انتخاب حکم ───
    game.on('hokm:waitingForUser', () => {
      UI.showHokmPicker();
    });

    game.on('hokm:set', ({ suit }) => {
      UI.updateHokmDisplay(suit);
      UI.hideHokmPicker();
    });

    // ─── نوبت ───
    game.on('turn:start', ({ playerIdx }) => {
      UI.highlightCurrentPlayer(playerIdx);
      UI.resetTimer();
      UI.renderHand(game.getMyHand(), game.getState());

      // اگر نوبت من است، دکمه‌های اقدام
      const actions = _$('actionButtons');
      if (actions) {
        actions.style.display = playerIdx === 0 ? 'flex' : 'none';
      }

      // صدای نوبت
      if (playerIdx === 0 && _audio()) {
        _audio().play('turn');
      }
    });

    // ─── کارت بازی شد ───
    game.on('card:played', ({ playerIdx, card, trick }) => {
      // ثبت در حافظه AI
      if (global.HokmAI) {
        global.HokmAI.recordPlayedCard(playerIdx, card);
      }

      // رندر مجدد
      UI.renderHand(game.getMyHand(), game.getState());
      UI.renderTrick(trick, game.getState());
      UI.renderSeats(game.getState());
    });

    // ─── پایان دور ───
    game.on('trick:completed', ({ winner }) => {
      // هایلایت برنده
      const seatPositions = ['Bottom', 'Left', 'Top', 'Right'];
      const winnerPos = seatPositions[winner];
      const seat = _$('seat' + winnerPos);
      if (seat) {
        seat.classList.add('winner-glow');
        setTimeout(() => seat.classList.remove('winner-glow'), 1500);
      }

      // هایلایت کارت‌های برنده
      const cards = document.querySelectorAll('#trickCenter .card-face');
      cards.forEach(c => c.classList.add('winner'));
    });

    // ─── دور جدید ───
    game.on('trick:new', () => {
      setTimeout(() => {
        UI.renderTrick([], game.getState());
        UI.updateScores(game.getScores(), game.getState().trickCount);
      }, 1200);
    });

    // ─── امتیاز عوض شد ───
    game.on('score:changed', ({ scores, trickCount }) => {
      UI.updateScores(scores, trickCount);
    });

    // ─── تایمر ───
    game.on('timer:start', ({ duration }) => {
      UI.resetTimer();
    });

    game.on('timer:tick', ({ remaining, duration }) => {
      UI.updateTimer(remaining, duration);
    });

    game.on('timer:stop', () => {
      UI.resetTimer();
    });

    // ─── پایان بازی ───
    game.on('game:ended', (result) => {
      state.inGame = false;

      // مخفی کردن دکمه بازگشت
      const backBtn = _$('btnBackFromGame');
      if (backBtn) backBtn.classList.add('hidden');

      // نمایش مودال
      setTimeout(() => {
        UI.showGameEnd(result);
      }, 1500);
    });

    // ─── کارت نامعتبر ───
    game.on('card:invalid', () => {
      // خود game.js صدای error پخش می‌کنه
    });

    // ─── تایم‌اوت ───
    game.on('turn:timeout', ({ playerIdx }) => {
      if (playerIdx === 0) {
        UI.showToast('وقتت تموم شد!', 'یک کارت تصادفی بازی شد', 'warning');
      }
    });
  }

  /* ─────────────────────────────────────────────
     ورود به هر صفحه — رفتار خاص
     ───────────────────────────────────────────── */
  function _onScreenEnter(screenName) {
    switch (screenName) {
      case 'profile':
        if (_profile() && typeof _profile().updateUI === 'function') {
          _profile().updateUI();
        }
        break;

      case 'leaderboard':
        if (global.HokmLeaderboard && typeof global.HokmLeaderboard.load === 'function') {
          global.HokmLeaderboard.load();
        }
        break;

      case 'achievements':
        if (global.HokmAchievements && typeof global.HokmAchievements.renderPage === 'function') {
          global.HokmAchievements.renderPage();
        }
        break;

      case 'friends':
        if (global.HokmFriends && typeof global.HokmFriends.render === 'function') {
          global.HokmFriends.render();
        }
        break;

      case 'replay':
        if (global.HokmReplay && typeof global.HokmReplay.render === 'function') {
          global.HokmReplay.render();
        }
        break;
    }
  }

  /* ─────────────────────────────────────────────
     Bind رویدادهای عمومی UI
     ───────────────────────────────────────────── */
  function _bindGlobalEvents() {
    // تب‌ها
    _$$('.tab').forEach(tab => {
      if (tab.dataset.bound) return;
      tab.dataset.bound = '1';
      tab.addEventListener('click', () => {
        const name = tab.dataset.tab;
        if (name === 'game') {
          UI.navigate('menu');
        } else {
          UI.navigate(name);
        }
      });
    });

    // منو کارت‌ها
    _$$('.menu-card').forEach(card => {
      if (card.dataset.bound) return;
      card.dataset.bound = '1';
      card.addEventListener('click', () => {
        const action = card.dataset.action;
        _handleMenuAction(action);
      });
    });

    // دکمه شروع بزرگ
    const startBtn = _$('btnStartGame');
    if (startBtn && !startBtn.dataset.bound) {
      startBtn.dataset.bound = '1';
      startBtn.addEventListener('click', () => {
        UI.startGame();
      });
    }

    // دکمه بازگشت از بازی
    const backBtn = _$('btnBackFromGame');
    if (backBtn && !backBtn.dataset.bound) {
      backBtn.dataset.bound = '1';
      backBtn.addEventListener('click', () => {
        if (confirm('از بازی خارج می‌شوید؟ پیشرفت شما ذخیره می‌شود.')) {
          UI.exitGame();
        }
      });
    }

    // دکمه‌های اقدام
    const passBtn = _$('btnPass');
    if (passBtn && !passBtn.dataset.bound) {
      passBtn.dataset.bound = '1';
      passBtn.addEventListener('click', () => UI.handlePass());
    }

    // ورود / ثبت‌نام
    const authTabs = _$$('.auth-tab');
    authTabs.forEach(tab => {
      if (tab.dataset.bound) return;
      tab.dataset.bound = '1';
      tab.addEventListener('click', () => {
        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const mode = tab.dataset.auth;
        const submitBtn = _$('btnAuthSubmit');
        if (submitBtn) {
          submitBtn.textContent = mode === 'register' ? 'ثبت‌نام' : 'ورود';
        }
      });
    });

    // دکمه ورود سریع
    const quickPlay = _$('btnQuickPlay');
    if (quickPlay && !quickPlay.dataset.bound) {
      quickPlay.dataset.bound = '1';
      quickPlay.addEventListener('click', () => {
        UI.navigate('menu');
      });
    }

    // دکمه‌های آنلاین
    const createRoom = _$('btnCreateRoom');
    if (createRoom && !createRoom.dataset.bound) {
      createRoom.dataset.bound = '1';
      createRoom.addEventListener('click', () => {
        if (global.HokmOnline && typeof global.HokmOnline.createRoom === 'function') {
          global.HokmOnline.createRoom();
        } else {
          UI.showToast('آنلاین', 'به‌زودی در دسترس خواهد بود', 'info');
        }
      });
    }

    const joinRoom = _$('btnJoinRoom');
    if (joinRoom && !joinRoom.dataset.bound) {
      joinRoom.dataset.bound = '1';
      joinRoom.addEventListener('click', () => {
        const input = _$('roomCodeInput');
        const code = input?.value?.trim();
        if (!code || code.length !== 6) {
          UI.showToast('خطا', 'کد اتاق باید ۶ رقم باشد', 'error');
          return;
        }
        if (global.HokmOnline && typeof global.HokmOnline.joinRoom === 'function') {
          global.HokmOnline.joinRoom(code);
        } else {
          UI.showToast('آنلاین', 'به‌زودی در دسترس خواهد بود', 'info');
        }
      });
    }

    // شورتکات‌ها
    document.addEventListener('keydown', _handleKeyboard);

    // بازگشت با Esc (فقط اگر modal باز نباشه)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !state.modalOpen) {
        if (state.currentScreen !== 'menu' && state.currentScreen !== 'game') {
          UI.navigate('menu');
        }
      }
    });
  }

  /* ─────────────────────────────────────────────
     منوی کارت‌ها
     ───────────────────────────────────────────── */
  function _handleMenuAction(action) {
    if (!action) return;

    switch (action) {
      case 'online':
        UI.navigate('online');
        break;
      case 'tournament':
        UI.navigate('tournament');
        break;
      case 'leaderboard':
        UI.navigate('leaderboard');
        break;
      case 'achievements':
        UI.navigate('achievements');
        break;
      case 'friends':
        UI.navigate('friends');
        break;
      case 'replay':
        UI.navigate('replay');
        break;
    }
  }

  /* ─────────────────────────────────────────────
     شورتکات‌های کیبورد
     ───────────────────────────────────────────── */
  function _handleKeyboard(e) {
    const isInGame = state.currentScreen === 'game';

    // Alt+key
    if (e.altKey) {
      switch (e.key.toLowerCase()) {
        case 'm': e.preventDefault(); UI.navigate('menu'); break;
        case 'p': e.preventDefault(); UI.navigate('profile'); break;
        case 's': e.preventDefault(); UI.navigate('settings'); break;
        case 'h': e.preventDefault(); UI.navigate('help'); break;
        case 't':
          e.preventDefault();
          if (global.HokmThemes) global.HokmThemes.toggle();
          break;
      }
      return;
    }

    // در بازی
    if (isInGame) {
      // Esc
      if (e.key === 'Escape' && !state.modalOpen) {
        if (confirm('از بازی خارج می‌شوید؟')) {
          UI.exitGame();
        }
        return;
      }

      // اعداد ۱-۹ برای انتخاب کارت
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        const hand = _game()?.getMyHand() || [];
        if (hand[idx]) {
          UI.handleCardClick(hand[idx].id);
        }
        return;
      }

      // P برای پاس (اگر فعال)
      if (e.key.toLowerCase() === 'p') {
        UI.handlePass();
        return;
      }
    }
  }

  /* ─────────────────────────────────────────────
     setText کمکی
     ───────────────────────────────────────────── */
  function _setText(id, text) {
    const el = _$(id);
    if (el) el.textContent = text;
  }

  /* ─────────────────────────────────────────────
     Bootstrap
     ───────────────────────────────────────────── */
  function bootstrap() {
    _bindGlobalEvents();

    // بارگذاری بازی ذخیره‌شده در startup (پیشنهاد)
    setTimeout(() => {
      if (_game() && _game().hasSavedGame()) {
        const resume = confirm('بازی قبلی ذخیره شده. ادامه می‌دهید؟');
        if (resume) {
          UI.startGame();
          setTimeout(() => {
            _game().loadSaved();
            UI.renderGame();
          }, 500);
        } else {
          _game().clearSaved();
        }
      }
    }, 2000);

    console.log(
      '%c🎨 UI ready',
      'color: #118ab2; font-weight: bold;'
    );
  }

  /* ─────────────────────────────────────────────
     Export
     ───────────────────────────────────────────── */
  UI.SCREENS = SCREENS;

  global.HokmUI = UI;

  // Auto-init
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
      bootstrap();
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);