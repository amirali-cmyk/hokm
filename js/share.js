/* ═══════════════════════════════════════════════════════════
   📤 HOKM PRO v6.0 — share.js
   اشتراک‌گذاری: تلگرام، واتساپ، توییتر، اینستاگرام + Canvas
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     ثابت‌ها
     ───────────────────────────────────────────── */
  const APP_URL = 'https://hokm-pro.app';
  const APP_NAME = 'حکم حرفه‌ای';
  const APP_VERSION = '6.0';

  const PLATFORMS = {
    telegram:  { fa: 'تلگرام',    icon: '📱', color: '#0088cc' },
    whatsapp:  { fa: 'واتساپ',    icon: '💬', color: '#25D366' },
    twitter:   { fa: 'توییتر',    icon: '🐦', color: '#1DA1F2' },
    instagram: { fa: 'اینستاگرام', icon: '📷', color: '#E4405F' },
    copy:      { fa: 'کپی متن',   icon: '📋', color: '#6b7280' },
    download:  { fa: 'دانلود تصویر', icon: '🖼️', color: '#ffd60a' },
    native:    { fa: 'اشتراک سیستمی', icon: '📤', color: '#06d6a0' }
  };

  /* ─────────────────────────────────────────────
     وضعیت
     ───────────────────────────────────────────── */
  const state = {
    listeners: [],
    lastShared: null
  };

  /* ─────────────────────────────────────────────
     کمکی‌ها
     ───────────────────────────────────────────── */
  function _audio() { return global.HokmAudio; }
  function _ui() { return global.HokmUI; }
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

  /* ─────────────────────────────────────────────
     ساخت متن اشتراک‌گذاری
   ───────────────────────────────────────────── */
  function _buildShareText(result) {
    const win = result.win;
    const myScore = result.myScore || 0;
    const opponentScore = result.opponentScore || 0;
    const eloChange = result.eloChange || 0;
    const eloSign = eloChange > 0 ? '+' : '';

    if (win) {
      return `🃏 من توی بازی حکم بردم!
🏆 امتیاز: ${_toPersianNumber(myScore)} - ${_toPersianNumber(opponentScore)}
⚡ ELO: ${_toPersianNumber(eloSign + eloChange)}
🎮 با ${APP_NAME} بازی کن!
${APP_URL}`;
    } else {
      return `🃏 امروز توی حکم باختم، ولی دفعه بعد می‌برم!
🏆 امتیاز: ${_toPersianNumber(myScore)} - ${_toPersianNumber(opponentScore)}
⚡ ELO: ${_toPersianNumber(eloSign + eloChange)}
🎮 با ${APP_NAME} بازی کن!
${APP_URL}`;
    }
  }

  /**
   * متن کوتاه برای توییتر
   */
  function _buildTweet(result) {
    const win = result.win;
    const emoji = win ? '🏆' : '💔';
    return `${emoji} توی بازی حکم ${win ? 'بردم' : 'باختم'}!
🃏 ${_toPersianNumber(result.myScore || 0)} - ${_toPersianNumber(result.opponentScore || 0)}
🎮 ${APP_NAME}
${APP_URL}`;
  }

  /* ─────────────────────────────────────────────
     اشتراک‌گذاری
   ───────────────────────────────────────────── */
  const Share = {

    PLATFORMS,

    /**
     * راه‌اندازی
     */
    init() {
      console.log(
        '%c📤 Share system ready',
        'color: #ffd60a; font-weight: bold;'
      );
      return Share;
    },

    /**
     * اشتراک‌گذاری نتیجه بازی (نمایش modal)
     */
    shareResult(result) {
      state.lastShared = result;

      if (!_ui()) {
        Share.shareNative(result);
        return;
      }

      const win = result.win;
      const title = win ? '🏆 برد!' : '💔 باخت';
      const myScore = result.myScore || 0;
      const oppScore = result.opponentScore || 0;

      const html = `
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 48px; margin-bottom: 8px;">
            ${win ? '🏆' : '💔'}
          </div>
          <h3 class="modal-title" style="color: ${win ? 'var(--color-success)' : 'var(--color-danger)'};">
            ${title}
          </h3>
          <p style="color: var(--text-secondary); font-size: 13px; margin-top: 6px;">
            نتیجه: ${_toPersianNumber(myScore)} — ${_toPersianNumber(oppScore)}
          </p>
        </div>

        <h4 style="font-size: 14px; margin-bottom: 12px; color: var(--text-secondary);">
          انتخاب پلتفرم:
        </h4>

        <div style="
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 8px;
          margin-bottom: 16px;
        ">
          ${Object.entries(PLATFORMS).map(([id, p]) => `
            <button class="share-platform-btn"
                    data-platform="${id}"
                    style="
                      display: flex;
                      align-items: center;
                      gap: 8px;
                      padding: 12px;
                      background: var(--bg-elevated);
                      border: 1px solid var(--border-color);
                      border-radius: var(--radius-md);
                      cursor: pointer;
                      transition: all 0.2s;
                      font-family: var(--font-fa);
                      font-size: 13px;
                      color: var(--text-primary);
                    "
                    onmouseover="this.style.borderColor='${p.color}';this.style.transform='translateY(-2px)'"
                    onmouseout="this.style.borderColor='var(--border-color)';this.style.transform='translateY(0)'">
              <span style="font-size: 22px;">${p.icon}</span>
              <span style="font-weight: 600;">${p.fa}</span>
            </button>
          `).join('')}
        </div>

        <!-- پیش‌نمایش تصویر -->
        <div style="
          padding: 12px;
          background: var(--bg-secondary);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          margin-bottom: 12px;
        ">
          <p style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
            🖼️ پیش‌نمایش کارت امتیاز:
          </p>
          <div id="sharePreview" style="
            display: flex;
            justify-content: center;
            overflow-x: auto;
          "></div>
        </div>
      `;

      _ui().openModal(html);

      // Bind دکمه‌ها
      setTimeout(() => {
        Share._bindPlatformButtons(result);
        Share._renderPreview(result);
      }, 100);
    },

    _bindPlatformButtons(result) {
      document.querySelectorAll('.share-platform-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const platform = btn.dataset.platform;
          Share.shareTo(platform, result);
        });
      });
    },

    /**
     * اشتراک‌گذاری به پلتفرم خاص
     */
    shareTo(platform, result) {
      const text = _buildShareText(result);
      const tweet = _buildTweet(result);

      switch (platform) {
        case 'telegram':
          Share._shareTelegram(text);
          break;

        case 'whatsapp':
          Share._shareWhatsApp(text);
          break;

        case 'twitter':
          Share._shareTwitter(tweet);
          break;

        case 'instagram':
          Share._shareInstagram(result);
          break;

        case 'copy':
          Share._copyToClipboard(text);
          break;

        case 'download':
          Share._downloadImage(result);
          break;

        case 'native':
          Share.shareNative(result);
          break;
      }

      if (_audio()) _audio().play('notification');
      _emit('shared', { platform, result });
    },

    /**
     * اشتراک سیستمی (Web Share API)
     */
    async shareNative(result) {
      const text = _buildShareText(result);

      if (navigator.share) {
        try {
          await navigator.share({
            title: APP_NAME,
            text: text,
            url: APP_URL
          });

          if (_ui()) _ui().showToast('✅', 'اشتراک‌گذاری شد', 'success');
          return true;
        } catch (err) {
          if (err.name === 'AbortError') {
            // کاربر لغو کرد
            return false;
          }
          console.warn('Native share failed:', err);
        }
      }

      // Fallback: کپی
      return Share._copyToClipboard(text);
    },

    /* ─── پلتفرم‌ها ─── */

    _shareTelegram(text) {
      const url = `https://t.me/share/url?url=${encodeURIComponent(APP_URL)}&text=${encodeURIComponent(text)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    },

    _shareWhatsApp(text) {
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    },

    _shareTwitter(tweet) {
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    },

    _shareInstagram(result) {
      // اینستاگرام لینک مستقیم نداره، پس تصویر رو دانلود می‌کنیم
      Share._downloadImage(result, 'instagram');

      if (_ui()) {
        _ui().showToast(
          '📷 آماده اشتراک',
          'تصویر دانلود شد. در استوری اینستاگرام آپلود کن!',
          'info',
          5000
        );
      }
    },

    async _copyToClipboard(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          // Fallback قدیمی
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }

        if (_ui()) _ui().showToast('📋 کپی شد', 'متن در کلیپ‌بورد', 'success');
        return true;
      } catch (err) {
        console.warn('Copy failed:', err);
        if (_ui()) _ui().showToast('خطا', 'کپی ناموفق', 'error');
        return false;
      }
    },

    /* ─── پیش‌نمایش ─── */

    _renderPreview(result) {
      const container = document.getElementById('sharePreview');
      if (!container) return;

      const canvas = Share._createResultCanvas(result);
      canvas.style.maxWidth = '100%';
      canvas.style.height = 'auto';
      canvas.style.borderRadius = '12px';
      canvas.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';

      container.innerHTML = '';
      container.appendChild(canvas);
    },

    /**
     * ساخت تصویر نتیجه با Canvas
     */
    _createResultCanvas(result) {
      const W = 600;
      const H = 900;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;

      const ctx = canvas.getContext('2d');

      const win = result.win;
      const myScore = result.myScore || 0;
      const oppScore = result.opponentScore || 0;
      const eloChange = result.eloChange || 0;
      const profile = _profile()?.get() || { name: 'بازیکن', avatar: '😎', elo: 1000 };

      // ─── پس‌زمینه گرادیانت ───
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#0d1b2a');
      bgGrad.addColorStop(0.5, '#152138');
      bgGrad.addColorStop(1, '#0a1420');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // ─── هاله درخشش ───
      const glowGrad = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, W * 0.6);
      const glowColor = win ? 'rgba(6, 214, 160, 0.25)' : 'rgba(239, 71, 111, 0.20)';
      glowGrad.addColorStop(0, glowColor);
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, W, H);

      // ─── الگوی نقطه‌ای ───
      ctx.fillStyle = 'rgba(255, 214, 10, 0.06)';
      for (let x = 20; x < W; x += 40) {
        for (let y = 20; y < H; y += 40) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ─── حاشیه طلایی ───
      const goldGrad = ctx.createLinearGradient(0, 0, W, H);
      goldGrad.addColorStop(0, '#ffe97a');
      goldGrad.addColorStop(0.5, '#ffd60a');
      goldGrad.addColorStop(1, '#b8860b');

      ctx.strokeStyle = goldGrad;
      ctx.lineWidth = 3;
      ctx.strokeRect(15, 15, W - 30, H - 30);

      // ─── لوگو (کارت بالای صفحه) ───
      // کارت سفید
      ctx.save();
      ctx.translate(W / 2, 140);
      ctx.rotate(-0.05);

      const cardW = 120;
      const cardH = 170;
      const cardX = -cardW / 2;
      const cardY = -cardH / 2;

      // سایه کارت
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 25;
      ctx.shadowOffsetY = 10;

      // کارت
      ctx.fillStyle = '#fffdf7';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(cardX, cardY, cardW, cardH, 14);
      } else {
        ctx.rect(cardX, cardY, cardW, cardH);
      }
      ctx.fill();

      // ریست سایه
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // حاشیه طلایی کارت
      ctx.strokeStyle = '#ffd60a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(cardX, cardY, cardW, cardH, 14);
      } else {
        ctx.rect(cardX, cardY, cardW, cardH);
      }
      ctx.stroke();

      // A در گوشه
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 36px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('A', 0, -30);

      // ♠ وسط
      ctx.font = '64px Arial, sans-serif';
      ctx.fillStyle = '#1a1a1a';
      ctx.fillText('♠', 0, 35);

      ctx.restore();

      // ─── عنوان ───
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';

      // عنوان اصلی: حکم حرفه‌ای
      const titleGrad = ctx.createLinearGradient(0, 260, 0, 310);
      titleGrad.addColorStop(0, '#ffe97a');
      titleGrad.addColorStop(0.5, '#ffd60a');
      titleGrad.addColorStop(1, '#b8860b');

      ctx.fillStyle = titleGrad;
      ctx.font = 'bold 44px Arial, Tahoma, sans-serif';
      ctx.fillText('حُکم حرفه‌ای', W / 2, 300);

      // نسخه
      ctx.fillStyle = 'rgba(224, 225, 221, 0.6)';
      ctx.font = '500 16px Arial, sans-serif';
      ctx.fillText(`Hokm Pro v${APP_VERSION}`, W / 2, 330);

      // ─── نتیجه (برد/باخت) ───
      const resultY = 420;

      // دایره نتیجه
      const circleRadius = 70;
      const circleGrad = ctx.createRadialGradient(W / 2, resultY, 0, W / 2, resultY, circleRadius);
      if (win) {
        circleGrad.addColorStop(0, 'rgba(6, 214, 160, 0.4)');
        circleGrad.addColorStop(1, 'rgba(6, 214, 160, 0.05)');
      } else {
        circleGrad.addColorStop(0, 'rgba(239, 71, 111, 0.4)');
        circleGrad.addColorStop(1, 'rgba(239, 71, 111, 0.05)');
      }

      ctx.fillStyle = circleGrad;
      ctx.beginPath();
      ctx.arc(W / 2, resultY, circleRadius, 0, Math.PI * 2);
      ctx.fill();

      // emoji نتیجه
      ctx.font = '80px Arial, sans-serif';
      ctx.fillText(win ? '🏆' : '💔', W / 2, resultY + 28);

      // متن نتیجه
      ctx.fillStyle = win ? '#06d6a0' : '#ef476f';
      ctx.font = 'bold 32px Arial, Tahoma, sans-serif';
      ctx.fillText(win ? 'پیروزی!' : 'باخت', W / 2, resultY + 110);

      // ─── امتیاز ───
      const scoreY = 610;

      // کارت امتیاز
      ctx.fillStyle = 'rgba(30, 45, 69, 0.6)';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(60, scoreY - 60, W - 120, 120, 16);
      } else {
        ctx.rect(60, scoreY - 60, W - 120, 120);
      }
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 214, 10, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(60, scoreY - 60, W - 120, 120, 16);
      } else {
        ctx.rect(60, scoreY - 60, W - 120, 120);
      }
      ctx.stroke();

      // امتیاز تیم‌ها
      ctx.fillStyle = '#ffd60a';
      ctx.font = 'bold 64px Georgia, serif';

      // امتیاز من
      ctx.fillText(_toPersianNumber(myScore), W / 2 - 80, scoreY + 20);

      // خط تیره
      ctx.fillStyle = 'rgba(224, 225, 221, 0.4)';
      ctx.font = 'bold 44px Georgia, serif';
      ctx.fillText('—', W / 2, scoreY + 15);

      // امتیاز حریف
      ctx.fillStyle = '#ffd60a';
      ctx.font = 'bold 64px Georgia, serif';
      ctx.fillText(_toPersianNumber(oppScore), W / 2 + 80, scoreY + 20);

      // لیبل‌ها
      ctx.fillStyle = 'rgba(224, 225, 221, 0.5)';
      ctx.font = '500 13px Arial, Tahoma, sans-serif';
      ctx.fillText('من', W / 2 - 80, scoreY + 45);
      ctx.fillText('حریف', W / 2 + 80, scoreY + 45);

      // ─── ELO Change ───
      const eloY = 700;
      const eloSign = eloChange > 0 ? '+' : '';
      const eloColor = eloChange > 0 ? '#06d6a0' : eloChange < 0 ? '#ef476f' : '#a0a8b8';

      ctx.fillStyle = eloColor;
      ctx.font = 'bold 26px Arial, Tahoma, sans-serif';
      ctx.fillText(`${_toPersianNumber(eloSign + eloChange)} ELO`, W / 2, eloY);

      // ELO فعلی
      ctx.fillStyle = 'rgba(224, 225, 221, 0.6)';
      ctx.font = '500 15px Arial, sans-serif';
      ctx.fillText(`ELO: ${_toPersianNumber(profile.elo)}`, W / 2, eloY + 26);

      // ─── نام بازیکن ───
      const nameY = 780;

      ctx.fillStyle = 'rgba(30, 45, 69, 0.5)';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(W / 2 - 150, nameY - 32, 300, 64, 32);
      } else {
        ctx.rect(W / 2 - 150, nameY - 32, 300, 64);
      }
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 214, 10, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(W / 2 - 150, nameY - 32, 300, 64, 32);
      } else {
        ctx.rect(W / 2 - 150, nameY - 32, 300, 64);
      }
      ctx.stroke();

      ctx.fillStyle = '#ffd60a';
      ctx.font = 'bold 22px Arial, Tahoma, sans-serif';
      ctx.fillText(profile.name || 'بازیکن', W / 2 + 15, nameY + 8);

      // آواتار (emoji)
      ctx.font = '32px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(profile.avatar || '😎', W / 2 + 30, nameY + 12);
      ctx.textAlign = 'center';

      // ─── تاریخ ───
      const dateStr = new Date().toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      ctx.fillStyle = 'rgba(224, 225, 221, 0.4)';
      ctx.font = '500 13px Arial, sans-serif';
      ctx.fillText(dateStr, W / 2, H - 60);

      // ─── URL ───
      ctx.fillStyle = 'rgba(255, 214, 10, 0.7)';
      ctx.font = '500 14px Georgia, serif';
      ctx.fillText(APP_URL, W / 2, H - 35);

      return canvas;
    },

    /**
     * دانلود تصویر نتیجه
     */
    _downloadImage(result, source) {
      const canvas = Share._createResultCanvas(result);

      try {
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `hokm-result-${Date.now()}.png`;
          a.click();

          setTimeout(() => URL.revokeObjectURL(url), 1000);

          if (_ui()) {
            _ui().showToast(
              '✅ دانلود شد',
              source === 'instagram'
                ? 'تصویر برای استوری ذخیره شد'
                : 'تصویر نتیجه ذخیره شد',
              'success'
            );
          }
        }, 'image/png');
      } catch (err) {
        console.error('Download failed:', err);
        if (_ui()) _ui().showToast('خطا', 'دانلود ناموفق', 'error');
      }
    },

    /**
     * اشتراک‌گذاری دعوت به بازی
     */
    shareInvite() {
      const code = Share._generateInviteCode();
      const text = `🎮 بیا یه دست حکم بزنیم!
کد دعوت من: ${code}
با ${APP_NAME}:
${APP_URL}`;

      if (navigator.share) {
        navigator.share({
          title: `دعوت به ${APP_NAME}`,
          text: text,
          url: APP_URL
        }).catch(() => {
          Share._copyToClipboard(text);
        });
      } else {
        Share._copyToClipboard(text);
      }
    },

    /**
     * اشتراک دستاورد
     */
    shareAchievement(ach) {
      const text = `🎖️ دستاورد جدید در حکم حرفه‌ای!
${ach.icon} ${ach.title}
${ach.desc}
🎮 با ${APP_NAME}:
${APP_URL}`;

      if (navigator.share) {
        navigator.share({
          title: 'دستاورد جدید',
          text: text
        }).catch(() => {
          Share._copyToClipboard(text);
        });
      } else {
        Share._copyToClipboard(text);
      }
    },

    _generateInviteCode() {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      return code;
    },

    /* ─── رویدادها ─── */

    on(event, handler) {
      const entry = { event, handler };
      state.listeners.push(entry);
      return () => Share.off(event, handler);
    },

    off(event, handler) {
      state.listeners = state.listeners.filter(
        l => !(l.event === event && l.handler === handler)
      );
    },

    /* ─── Helpers ─── */

    /**
     * بررسی پشتیبانی Web Share
     */
    supportsNativeShare() {
      return !!navigator.share;
    },

    getLastShared() {
      return state.lastShared;
    }
  };

  /* ─────────────────────────────────────────────
     Bootstrap
   ───────────────────────────────────────────── */
  function bootstrap() {
    Share.init();
  }

  /* ─────────────────────────────────────────────
     Export
     ───────────────────────────────────────────── */
  global.HokmShare = Share;

  // Auto-init
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(bootstrap, 300));
    } else {
      setTimeout(bootstrap, 300);
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);