/* ═══════════════════════════════════════════════════════════
   🎨 HOKM PRO v6.1.1 — ui.js
   ناوبری + رندر کامل بازی + Modal + Toast + انیمیشن + آنلاین
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
    stats: 'screen-stats',
    leaderboard: 'screen-leaderboard',
    achievements: 'screen-achievements',
    friends: 'screen-friends',
    tournament: 'screen-tournament',
    replay: 'screen-replay',
    online: 'screen-online',
    auth: 'screen-auth'
  };

  const SEAT_MAP = {
    Bottom: 0,
    Left:   1,
    Top:    2,
    Right:  3
  };

  const SEAT_POSITIONS = ['Bottom', 'Left', 'Top', 'Right'];

  /* ─────────────────────────────────────────────
     وضعیت
     ───────────────────────────────────────────── */
  const state = {
    currentScreen: 'menu',
    previousScreen: 'menu',
    inGame: false,
    isOnlineGame: false,
    modalOpen: false,
    hokmPickerBound: false,
    listeners: [],
    onlineData: {
      mySeat: 0,
      currentTurnSeat: 0,
      hokm: null,
      myCards: []
    }
  };

  /* ─────────────────────────────────────────────
     کمکی‌ها
     ───────────────────────────────────────────── */
  function _game() { return global.HokmGame; }
  function _online() { return global.HokmOnline; }
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

    navigate(screenName, options = {}) {
      if (!SCREENS[screenName]) return;

      if (state.inGame && screenName !== 'game' && !options.force) {
        if (confirm('از بازی خارج می‌شوید؟')) {
          UI.exitGame();
        } else {
          return;
        }
      }

      state.previousScreen = state.currentScreen;
      state.currentScreen = screenName;

      _$$('.screen').forEach(el => el.classList.remove('active'));

      const screenEl = _$(SCREENS[screenName]);
      if (screenEl) {
        screenEl.classList.add('active');
        screenEl.scrollTop = 0;
      }

      UI.updateTabs(screenName);
      _onScreenEnter(screenName);

      _emit('navigate', { screen: screenName });
      return true;
    },

    back() {
      UI.navigate(state.previousScreen);
    },

    updateTabs(activeTab) {
      _$$('.tab').forEach(tab => {
        const tabName = tab.dataset.tab;
        const isActive =
          (tabName === 'game' && (activeTab === 'menu' || activeTab === 'game')) ||
          tabName === activeTab;
        tab.classList.toggle('active', isActive);
      });
    },

    getCurrentScreen() {
      return state.currentScreen;
    },

    /* ─── Toast ─── */
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
      toast.innerHTML = `
        <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
        <div class="toast-body">
          <div class="toast-title">${_escapeHtml(title)}</div>
          ${message ? `<div class="toast-msg">${_escapeHtml(message)}</div>` : ''}
        </div>
      `;

      container.appendChild(toast);

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

      const closeBtn = _$('modalClose');
      if (closeBtn && !closeBtn.dataset.bound) {
        closeBtn.dataset.bound = '1';
        closeBtn.addEventListener('click', UI.closeModal);
      }

      if (!overlay.dataset.bound) {
        overlay.dataset.bound = '1';
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay && options.dismissible !== false) {
            UI.closeModal();
          }
        });
      }

      if (!state.escHandler) {
        state.escHandler = (e) => {
          if (e.key === 'Escape' && state.modalOpen) UI.closeModal();
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

    async startGame(options = {}) {
      if (!_game()) {
        UI.showToast('خطا', 'موتور بازی در دسترس نیست', 'error');
        return;
      }

      try {
        state.inGame = true;
        state.isOnlineGame = false;

        UI.navigate('game', { force: true });
        UI.resetGameView();

        const backBtn = _$('btnBackFromGame');
        if (backBtn) backBtn.classList.remove('hidden');

        await _game().start(options);
        _bindGameEvents();

      } catch (err) {
        console.error('[UI] Start game error:', err);
        UI.showToast('خطا', 'بازی شروع نشد', 'error');
        state.inGame = false;
      }
    },

    exitGame() {
      if (state.isOnlineGame) {
        if (_online()) _online().leaveRoom();
      } else {
        if (_game()) _game().quit();
      }

      state.inGame = false;
      state.isOnlineGame = false;

      UI.resetGameView();

      const backBtn = _$('btnBackFromGame');
      if (backBtn) backBtn.classList.add('hidden');

      UI.navigate('menu', { force: true });
    },

    resetGameView() {
      const hand = _$('playerHand');
      if (hand) hand.innerHTML = '';

      const trickCenter = _$('trickCenter');
      if (trickCenter) trickCenter.innerHTML = '';

      ['Top', 'Left', 'Right', 'Bottom'].forEach(pos => {
        const slot = _$('played' + pos);
        if (slot) slot.innerHTML = '';
      });

      _setText('scoreA', _toPersianNumber(0));
      _setText('scoreB', _toPersianNumber(0));
      _setText('roundNumber', _toPersianNumber(1));
      _setText('hokmSuit', '—');

      const timerFill = _$('timerFill');
      if (timerFill) {
        timerFill.style.width = '100%';
        timerFill.classList.remove('warning', 'danger');
      }

      const picker = _$('hokmPicker');
      if (picker) picker.classList.add('hidden');

      const actions = _$('actionButtons');
      if (actions) actions.style.display = 'none';

      document.querySelectorAll('.player-seat.hokm-caller').forEach(s => {
        s.classList.remove('hokm-caller');
      });

      // ریست آنلاین
      state.onlineData = {
        mySeat: 0,
        currentTurnSeat: 0,
        hokm: null,
        myCards: []
      };
    },

    /* ═══════════════════════════════════════════
       رندر آفلاین
       ═══════════════════════════════════════════ */

    renderGame() {
      if (!_game()) return;
      const s = _game().getState();

      UI.updateScores(s.scores, s.trickCount);
      if (s.hokm) UI.updateHokmDisplay(s.hokm);

      UI.renderHand(s.players[0]?.hand || [], s);
      UI.renderSeats(s);
      UI.renderTrick(s.trick, s);
      UI.highlightCurrentPlayer(s.currentPlayer);
    },

    renderHand(cards, gameState) {
      const hand = _$('playerHand');
      if (!hand) return;

      const valid = _game().getValidCards(0);
      const validIds = new Set(valid.map(c => c.id));
      const isMyTurn = gameState.currentPlayer === 0 && gameState.phase === 'playing';

      hand.innerHTML = cards.map((card, i) => {
        const isValid = validIds.has(card.id);
        const playable = isMyTurn && isValid;
        const disabled = isMyTurn && !isValid;

        return _renderCardHTML(card, {
          playable,
          disabled,
          onclick: playable ? `HokmUI.handleCardClick('${card.id}')` : ''
        });
      }).join('');
    },

    renderSeats(gameState) {
      const players = gameState.players;
      const seatMap = {
        Bottom: players[0],
        Left: players[1],
        Top: players[2],
        Right: players[3]
      };

      Object.entries(seatMap).forEach(([pos, p]) => {
        if (!p) {
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
            avatarEl.innerHTML = `<img src="${p.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
          } else {
            avatarEl.textContent = p.avatar || '🤖';
          }
        }
      });
    },

    renderTrick(trick, gameState) {
      const center = _$('trickCenter');
      if (!center) return;

      center.innerHTML = '';
      const positionMap = ['bottom', 'left', 'top', 'right'];

      trick.forEach(({ playerIdx, card }) => {
        const el = document.createElement('div');
        el.className = 'card-face';
        el.dataset.cardId = card.id;
        el.dataset.pos = positionMap[playerIdx] || 'bottom';
        el.innerHTML = _cardInnerHTML(card);
        center.appendChild(el);
      });
    },

    updateScores(scores, trickCount) {
      _setText('scoreA', _toPersianNumber(scores.A));
      _setText('scoreB', _toPersianNumber(scores.B));
      _setText('roundNumber', _toPersianNumber(trickCount + 1));
    },

    updateHokmDisplay(suit) {
      const el = _$('hokmSuit');
      if (!el) return;
      const symbol = SUIT_SYMBOLS[suit] || '—';
      const isRed = suit === 'hearts' || suit === 'diamonds';
      el.textContent = symbol;
      el.style.color = isRed ? 'var(--color-danger)' : 'var(--accent)';
    },

    highlightCurrentPlayer(playerIdx) {
      ['Top', 'Left', 'Right', 'Bottom'].forEach((pos) => {
        const seat = _$('seat' + pos);
        if (!seat) return;
        seat.classList.toggle('active', SEAT_MAP[pos] === playerIdx);
      });
    },

    /* ═══════════════════════════════════════════
       رندر آنلاین
       ═══════════════════════════════════════════ */

    renderOnlineHand(cards) {
      state.onlineData.myCards = cards;
      const hand = _$('playerHand');
      if (!hand) return;

      const isMyTurn = state.onlineData.currentTurnSeat === state.onlineData.mySeat;

      hand.innerHTML = cards.map((card, i) => {
        return _renderCardHTML(card, {
          playable: isMyTurn,
          disabled: false,
          onclick: isMyTurn ? `HokmUI.handleOnlineCardClick(${i})` : ''
        });
      }).join('');
    },

    handleOnlineCardClick(index) {
      const card = state.onlineData.myCards[index];
      if (!card) return;

      if (state.onlineData.currentTurnSeat !== state.onlineData.mySeat) {
        UI.showToast('نوبت تو نیست', '', 'warning', 1500);
        return;
      }

      if (_online()) {
        _online().playCard(card);
      }
    },

    handleOnlineHokmSelect(suit) {
      if (_online()) {
        _online().setHokm(suit);
        UI.hideHokmPicker();
      }
    },

    /* ═══════════════════════════════════════════
       حکم‌خوانی
       ═══════════════════════════════════════════ */

    showHokmPicker() {
      const picker = _$('hokmPicker');
      if (!picker) return;

      picker.classList.remove('hidden');

      if (state.hokmPickerBound) return;
      state.hokmPickerBound = true;

      picker.querySelectorAll('.suit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const suit = btn.dataset.suit;
          if (!suit) return;
          
          if (state.isOnlineGame) {
            UI.handleOnlineHokmSelect(suit);
          } else {
            UI.handleHokmSelect(suit);
          }
        });
      });
    },

    hideHokmPicker() {
      const picker = _$('hokmPicker');
      if (picker) picker.classList.add('hidden');
    },

    handleHokmSelect(suit) {
      if (!_game()) return;
      const ok = _game().selectHokm(suit);

      if (ok) {
        UI.hideHokmPicker();
        if (_audio()) _audio().play('claimHokm');
        UI.showToast('👑 حکم انتخابی', `${SUIT_SYMBOLS[suit]} ${SUIT_FA[suit] || suit}`, 'success', 2500);
      }
    },

    /* ═══════════════════════════════════════════
       رویدادهای کاربر
       ═══════════════════════════════════════════ */

    handleCardClick(cardId) {
      if (!_game()) return;
      const hand = _game().getMyHand();
      const card = hand.find(c => c.id === cardId);
      if (!card) return;

      if (!_game().isMyTurn()) {
        UI.showToast('نوبت تو نیست', '', 'warning', 1500);
        if (_audio()) _audio().play('error');
        return;
      }

      const valid = _game().getValidCards(0);
      const isValid = valid.some(c => c.id === cardId);

      if (!isValid) {
        UI.showToast('باید از خال جاری بازی کنی!', '', 'warning', 1800);
        if (_audio()) _audio().play('error');

        const el = document.querySelector(`[data-card-id="${cardId}"]`);
        if (el) {
          el.classList.add('card-invalid');
          setTimeout(() => el.classList.remove('card-invalid'), 400);
        }
        return;
      }

      _game().playCard(0, card);
    },

    handlePass() {
      if (!_game()) return;
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
      const coinsReward = result.coinsReward || 0;
      const eloSign = eloChange >= 0 ? '+' : '';
      const eloColor = eloChange > 0 ? 'var(--color-success)' : eloChange < 0 ? 'var(--color-danger)' : 'var(--text-muted)';
      const duration = result.durationMs || 0;
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
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 20px;">
          <div class="stat-card">
            <div class="stat-value" style="color: ${eloColor};">${_toPersianNumber(eloSign + eloChange)}</div>
            <div class="stat-label">تغییر ELO</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color: var(--accent);">🪙 ${_toPersianNumber(coinsReward)}</div>
            <div class="stat-label">سکه</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${_toPersianNumber(Math.floor(duration / 1000))}s</div>
            <div class="stat-label">مدت بازی</div>
          </div>
        </div>
        <div class="modal-actions" style="display: flex; flex-direction: column; gap: 10px;">
          <button class="btn btn-primary btn-large btn-block" id="btnPlayAgain">🎮 بازی مجدد</button>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-outline" style="flex:1;" id="btnShareResult">📤 اشتراک‌گذاری</button>
            <button class="btn btn-ghost" style="flex:1;" id="btnBackToMenu">🏠 منو</button>
          </div>
        </div>
      `;

      UI.openModal(html, { dismissible: false });

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

      if (win) UI.celebrateWin();
    },

    celebrateWin() {
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
      if (_audio()) _audio().play('achievement');
    },

    /* ─── رویدادها ─── */
    on(event, handler) {
      const entry = { event, handler };
      state.listeners.push(entry);
      return () => UI.off(event, handler);
    },

    off(event, handler) {
      state.listeners = state.listeners.filter(l => !(l.event === event && l.handler === handler));
    }
  };

  /* ─────────────────────────────────────────────
     رندر HTML کارت
     ───────────────────────────────────────────── */
  function _renderCardHTML(card, opts = {}) {
    const classes = ['card-face'];
    if (card.suit === 'hearts' || card.suit === 'diamonds') classes.push('red');
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
      <div class="card-corner top"><span class="card-rank">${rank}</span></div>
      <div class="card-suit">${symbol}</div>
      <div class="card-corner bottom"><span class="card-rank">${rank}</span></div>
    `;
  }

  /* ─────────────────────────────────────────────
     اتصال رویدادهای game.js (آفلاین)
     ───────────────────────────────────────────── */
  function _bindGameEvents() {
    const game = _game();
    if (!game || game._uiBound) return;
    game._uiBound = true;

    game.on('game:start', () => UI.renderGame());
    game.on('cards:dealt', ({ hands }) => UI.renderHand(hands[0], game.getState()));
    
    game.on('hokm:selecting', ({ callerIdx, player }) => {
      document.querySelectorAll('.player-seat.hokm-caller').forEach(s => s.classList.remove('hokm-caller'));
      const pos = SEAT_POSITIONS[callerIdx];
      const seat = _$('seat' + pos);
      if (seat) seat.classList.add('hokm-caller');
      
      if (callerIdx === 0) {
        UI.showToast('👑 نوبت توئه!', 'یه خال رو انتخاب کن', 'info', 3000);
      } else {
        UI.showToast('👑 حکم‌خوان', player.name + ' داره حکم انتخاب می‌کنه...', 'info', 2500);
      }
    });

    game.on('hokm:waitingForUser', () => UI.showHokmPicker());

    game.on('hokm:set', ({ suit }) => {
      UI.updateHokmDisplay(suit);
      UI.hideHokmPicker();
      document.querySelectorAll('.player-seat.hokm-caller').forEach(s => s.classList.remove('hokm-caller'));
    });

    game.on('turn:start', ({ playerIdx }) => {
      UI.highlightCurrentPlayer(playerIdx);
      UI.resetTimer();
      UI.renderHand(game.getMyHand(), game.getState());
      const actions = _$('actionButtons');
      if (actions) actions.style.display = playerIdx === 0 ? 'flex' : 'none';
      if (playerIdx === 0 && _audio()) _audio().play('turn');
    });

    game.on('card:played', ({ playerIdx, card, trick }) => {
      UI.renderHand(game.getMyHand(), game.getState());
      UI.renderTrick(trick, game.getState());
      UI.renderSeats(game.getState());
    });

    game.on('trick:completed', ({ winner }) => {
      const winnerPos = SEAT_POSITIONS[winner];
      const seat = _$('seat' + winnerPos);
      if (seat) {
        seat.classList.add('winner-glow');
        setTimeout(() => seat.classList.remove('winner-glow'), 1500);
      }
    });

    game.on('trick:new', () => {
      setTimeout(() => {
        UI.renderTrick([], game.getState());
        UI.updateScores(game.getScores(), game.getState().trickCount);
      }, 1200);
    });

    game.on('score:changed', ({ scores, trickCount }) => UI.updateScores(scores, trickCount));
    game.on('timer:start', () => UI.resetTimer());
    game.on('timer:tick', ({ remaining, duration }) => UI.updateTimer(remaining, duration));
    game.on('timer:stop', () => UI.resetTimer());

    game.on('game:ended', (result) => {
      state.inGame = false;
      const backBtn = _$('btnBackFromGame');
      if (backBtn) backBtn.classList.add('hidden');
      setTimeout(() => UI.showGameEnd(result), 1500);
    });
  }

  /* ─────────────────────────────────────────────
     اتصال رویدادهای آنلاین
     ───────────────────────────────────────────── */
  function _bindOnlineEvents() {
    const online = _online();
    if (!online || online._uiBound) return;
    online._uiBound = true;

    online.on('connected', () => {
      UI.showToast('🌐 متصل شد', 'به سرور آنلاین وصل شدی', 'success');
    });

    online.on('disconnected', () => {
      UI.showToast('⚠️ قطع شد', 'اتصال به سرور قطع شد', 'warning');
    });

    // ⚠️ از این به بعد رویدادهای Socket در online.js خودش رندر می‌کنه
  }

  /* ─────────────────────────────────────────────
     ورود به هر صفحه
     ───────────────────────────────────────────── */
  function _onScreenEnter(screenName) {
    switch (screenName) {
      case 'profile':
        if (_profile() && typeof _profile().updateUI === 'function') _profile().updateUI();
        break;
      case 'stats':
        _renderStats();
        break;
      case 'leaderboard':
        if (global.HokmLeaderboard && typeof global.HokmLeaderboard.load === 'function') global.HokmLeaderboard.load();
        break;
      case 'achievements':
        if (global.HokmAchievements && typeof global.HokmAchievements.renderPage === 'function') global.HokmAchievements.renderPage();
        break;
      case 'friends':
        if (global.HokmFriends && typeof global.HokmFriends.render === 'function') global.HokmFriends.render();
        break;
      case 'replay':
        if (global.HokmReplay && typeof global.HokmReplay.render === 'function') global.HokmReplay.render();
        break;
    }
  }

  /* ─── رندر آمار ─── */
  function _renderStats() {
    if (!global.HokmStorage) return;
    const stats = global.HokmStorage.getStats();
    const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
    set('statsTotalGames', _toPersianNumber(stats.gamesPlayed || 0));
    set('statsTotalWins', _toPersianNumber(stats.wins || 0));
    set('statsTotalRounds', _toPersianNumber(stats.roundsWon || 0));
    set('statsHokmClaimed', _toPersianNumber(stats.hokmClaimed || 0));
    set('statsBestStreak', _toPersianNumber(stats.bestStreak || 0));
    set('statsPlayTime', _toPersianNumber(Math.floor((stats.totalTimePlayed || 0) / 60000)));
  }

  /* ─────────────────────────────────────────────
     Bind رویدادهای عمومی
     ───────────────────────────────────────────── */
  function _bindGlobalEvents() {
    _$$('.tab').forEach(tab => {
      if (tab.dataset.bound) return;
      tab.dataset.bound = '1';
      tab.addEventListener('click', () => {
        const name = tab.dataset.tab;
        UI.navigate(name === 'game' ? 'menu' : name);
      });
    });

    _$$('.menu-card').forEach(card => {
      if (card.dataset.bound) return;
      card.dataset.bound = '1';
      card.addEventListener('click', () => _handleMenuAction(card.dataset.action));
    });

    const startBtn = _$('btnStartGame');
    if (startBtn && !startBtn.dataset.bound) {
      startBtn.dataset.bound = '1';
      startBtn.addEventListener('click', () => UI.startGame());
    }

    const backBtn = _$('btnBackFromGame');
    if (backBtn && !backBtn.dataset.bound) {
      backBtn.dataset.bound = '1';
      backBtn.addEventListener('click', () => {
        if (confirm('از بازی خارج می‌شوید؟')) UI.exitGame();
      });
    }

    const passBtn = _$('btnPass');
    if (passBtn && !passBtn.dataset.bound) {
      passBtn.dataset.bound = '1';
      passBtn.addEventListener('click', () => UI.handlePass());
    }

    // ساخت اتاق
    const createRoomBtn = _$('btnCreateRoom');
    if (createRoomBtn && !createRoomBtn.dataset.bound) {
      createRoomBtn.dataset.bound = '1';
      createRoomBtn.addEventListener('click', () => {
        if (_online()) _online().createRoom();
        else UI.showToast('خطا', 'ماژول آنلاین لود نشده', 'error');
      });
    }

    // ورود به اتاق
    const joinRoomBtn = _$('btnJoinRoom');
    if (joinRoomBtn && !joinRoomBtn.dataset.bound) {
      joinRoomBtn.dataset.bound = '1';
      joinRoomBtn.addEventListener('click', () => {
        const input = _$('roomCodeInput');
        const code = input?.value?.trim().toUpperCase();
        if (!code || code.length !== 6) {
          UI.showToast('خطا', 'کد اتاق باید ۶ رقم باشد', 'error');
          return;
        }
        if (_online()) _online().joinRoom(code);
      });
    }

    document.addEventListener('keydown', _handleKeyboard);
  }

  function _handleMenuAction(action) {
    if (!action) return;
    switch (action) {
      case 'online': UI.navigate('online'); break;
      case 'tournament': UI.navigate('tournament'); break;
      case 'leaderboard': UI.navigate('leaderboard'); break;
      case 'achievements': UI.navigate('achievements'); break;
      case 'friends': UI.navigate('friends'); break;
      case 'replay': UI.navigate('replay'); break;
    }
  }

  function _handleKeyboard(e) {
    if (e.altKey) {
      switch (e.key.toLowerCase()) {
        case 'm': e.preventDefault(); UI.navigate('menu'); break;
        case 'p': e.preventDefault(); UI.navigate('profile'); break;
        case 's': e.preventDefault(); UI.navigate('settings'); break;
      }
    }
  }

  function _setText(id, text) {
    const el = _$(id);
    if (el) el.textContent = text;
  }

  /* ─────────────────────────────────────────────
     Bootstrap
     ───────────────────────────────────────────── */
  function bootstrap() {
    _bindGlobalEvents();
    _bindOnlineEvents();

    setTimeout(() => {
      if (_game() && _game().hasSavedGame()) {
        const resume = confirm('بازی قبلی ذخیره شده. ادامه می‌دهید؟');
        if (resume) {
          UI.startGame();
          setTimeout(() => { _game().loadSaved(); UI.renderGame(); }, 500);
        } else {
          _game().clearSaved();
        }
      }
    }, 2000);

    console.log('%c🎨 UI ready (v6.1.1 — Online support)', 'color: #118ab2; font-weight: bold;');
  }

  /* ─────────────────────────────────────────────
     Export
     ───────────────────────────────────────────── */
  UI.SCREENS = SCREENS;
  UI.SEAT_MAP = SEAT_MAP;
  UI.SEAT_POSITIONS = SEAT_POSITIONS;

  global.HokmUI = UI;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
    else bootstrap();
  }

})(typeof window !== 'undefined' ? window : globalThis);