/* ═══════════════════════════════════════════════════════════
   📤 HOKM PRO v6.3.0 — share.js
   اشتراک‌گذاری: تلگرام، ایتا، بله، واتساپ، توییتر، اینستاگرام
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const APP_URL = 'https://amirali-cmyk.github.io/hokm/';
  const APP_NAME = 'حکم حرفه‌ای';
  const APP_VERSION = '6.3';

  const PLATFORMS = {
    telegram:  { fa: 'تلگرام',      icon: '📱', color: '#0088cc' },
    eitaa:     { fa: 'ایتا',        icon: '🟡', color: '#f39c12' },
    bale:      { fa: 'بله',         icon: '🔵', color: '#3498db' },
    whatsapp:  { fa: 'واتساپ',      icon: '💬', color: '#25D366' },
    twitter:   { fa: 'توییتر',      icon: '🐦', color: '#1DA1F2' },
    instagram: { fa: 'اینستاگرام',  icon: '📷', color: '#E4405F' },
    copy:      { fa: 'کپی متن',     icon: '📋', color: '#6b7280' },
    download:  { fa: 'دانلود تصویر', icon: '🖼️', color: '#ffd60a' },
    native:    { fa: 'اشتراک سیستمی', icon: '📤', color: '#06d6a0' }
  };

  function _audio() { return global.HokmAudio; }
  function _ui() { return global.HokmUI; }
  function _profile() { return global.HokmProfile; }

  function _toPersianNumber(n) {
    const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(n).replace(/\d/g, d => fa[+d]);
  }

  function _buildShareText(result) {
    const win = result.win;
    const myScore = result.myScore || 0;
    const opponentScore = result.opponentScore || 0;
    const eloChange = result.eloChange || 0;
    const eloSign = eloChange > 0 ? '+' : '';

    if (win) {
      return `🃏 من توی بازی حکم بردم!\n🏆 امتیاز: ${_toPersianNumber(myScore)} - ${_toPersianNumber(opponentScore)}\n⚡ ELO: ${_toPersianNumber(eloSign + eloChange)}\n🎮 با ${APP_NAME} بازی کن!\n${APP_URL}`;
    } else {
      return `🃏 امروز توی حکم باختم، ولی دفعه بعد می‌برم!\n🏆 امتیاز: ${_toPersianNumber(myScore)} - ${_toPersianNumber(opponentScore)}\n⚡ ELO: ${_toPersianNumber(eloSign + eloChange)}\n🎮 با ${APP_NAME} بازی کن!\n${APP_URL}`;
    }
  }

  const Share = {

    PLATFORMS,

    init() {
      console.log('%c📤 Share system ready (v6.3.0)', 'color: #ffd60a; font-weight: bold;');
      return Share;
    },

    shareResult(result) {
      if (!_ui()) {
        Share._copyToClipboard(_buildShareText(result));
        return;
      }

      const win = result.win;
      const title = win ? '🏆 برد!' : '💔 باخت';

      const html = `
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 48px; margin-bottom: 8px;">${win ? '🏆' : '💔'}</div>
          <h3 class="modal-title" style="color: ${win ? 'var(--color-success)' : 'var(--color-danger)'};">${title}</h3>
        </div>

        <h4 style="font-size: 14px; margin-bottom: 12px; color: var(--text-secondary);">انتخاب پلتفرم:</h4>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; margin-bottom: 16px;">
          ${Object.entries(PLATFORMS).map(([id, p]) => `
            <button class="share-platform-btn" data-platform="${id}" style="
              display: flex; align-items: center; gap: 6px; padding: 10px;
              background: var(--bg-elevated); border: 1px solid var(--border-color);
              border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;
              font-family: var(--font-fa); font-size: 12px; color: var(--text-primary);
            ">
              <span style="font-size: 20px;">${p.icon}</span>
              <span style="font-weight: 600;">${p.fa}</span>
            </button>
          `).join('')}
        </div>
      `;

      _ui().openModal(html);

      setTimeout(() => {
        document.querySelectorAll('.share-platform-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const platform = btn.dataset.platform;
            Share.shareTo(platform, result);
          });
        });
      }, 100);
    },

    shareTo(platform, result) {
      const text = _buildShareText(result);

      switch (platform) {
        case 'telegram':  Share._shareTelegram(text); break;
        case 'eitaa':     Share._shareEitaa(text); break;
        case 'bale':      Share._shareBale(text); break;
        case 'whatsapp':  Share._shareWhatsApp(text); break;
        case 'twitter':   Share._shareTwitter(result); break;
        case 'instagram': Share._shareInstagram(result); break;
        case 'copy':      Share._copyToClipboard(text); break;
        case 'download':  Share._downloadImage(result); break;
        case 'native':    Share.shareNative(result); break;
      }

      if (_audio()) _audio().play('notification');
    },

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
          if (err.name !== 'AbortError') {
            console.warn('Native share failed:', err);
            Share._copyToClipboard(text);
          }
        }
      } else {
        // اگه Web Share API نبود، کپی کن
        if (_ui()) _ui().showToast('ℹ️', 'اشتراک سیستمی پشتیبانی نمی‌شه، متن کپی شد', 'info', 3000);
        Share._copyToClipboard(text);
      }
    },

    _shareTelegram(text) {
      const url = `https://t.me/share/url?url=${encodeURIComponent(APP_URL)}&text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    },

    _shareEitaa(text) {
      // ایتا از پروتکل مشابه تلگرام استفاده می‌کنه
      const url = `https://eitaa.com/share/url?url=${encodeURIComponent(APP_URL)}&text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
      
      // Fallback: کپی
      setTimeout(() => {
        Share._copyToClipboard(text);
        if (_ui()) _ui().showToast('📋', 'متن کپی شد، در ایتا پیست کنید', 'info', 3000);
      }, 500);
    },

    _shareBale(text) {
      // بله هم از پروتکل مشابه استفاده می‌کنه
      const url = `https://ble.ir/share?url=${encodeURIComponent(APP_URL)}&text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
      
      setTimeout(() => {
        Share._copyToClipboard(text);
        if (_ui()) _ui().showToast('📋', 'متن کپی شد، در بله پیست کنید', 'info', 3000);
      }, 500);
    },

    _shareWhatsApp(text) {
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    },

    _shareTwitter(result) {
      const tweet = `${result.win ? '🏆' : '💔'} توی بازی حکم ${result.win ? 'بردم' : 'باختم'}!\n🃏 ${_toPersianNumber(result.myScore || 0)} - ${_toPersianNumber(result.opponentScore || 0)}\n🎮 ${APP_NAME}\n${APP_URL}`;
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`;
      window.open(url, '_blank');
    },

    _shareInstagram(result) {
      Share._downloadImage(result, 'instagram');
      if (_ui()) {
        _ui().showToast('📷 آماده اشتراک', 'تصویر دانلود شد. در استوری اینستاگرام آپلود کن!', 'info', 5000);
      }
    },

    async _copyToClipboard(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
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
        if (_ui()) _ui().showToast('خطا', 'کپی ناموفق', 'error');
        return false;
      }
    },

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

          if (_ui() && source !== 'instagram') {
            _ui().showToast('✅ دانلود شد', 'تصویر نتیجه ذخیره شد', 'success');
          }
        }, 'image/png');
      } catch (err) {
        console.error('Download failed:', err);
      }
    },

    _createResultCanvas(result) {
      const W = 600, H = 900;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');

      const win = result.win;
      const myScore = result.myScore || 0;
      const oppScore = result.opponentScore || 0;
      const eloChange = result.eloChange || 0;
      const profile = _profile()?.get() || { name: 'بازیکن', avatar: '😎', elo: 1000 };

      // پس‌زمینه
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#0d1b2a');
      bgGrad.addColorStop(1, '#0a1420');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // هاله
      const glowGrad = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, W * 0.6);
      glowGrad.addColorStop(0, win ? 'rgba(6, 214, 160, 0.25)' : 'rgba(239, 71, 111, 0.20)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, W, H);

      // حاشیه طلایی
      const goldGrad = ctx.createLinearGradient(0, 0, W, H);
      goldGrad.addColorStop(0, '#ffe97a');
      goldGrad.addColorStop(1, '#b8860b');
      ctx.strokeStyle = goldGrad;
      ctx.lineWidth = 3;
      ctx.strokeRect(15, 15, W - 30, H - 30);

      // عنوان
      ctx.textAlign = 'center';
      ctx.fillStyle = goldGrad;
      ctx.font = 'bold 44px Arial, Tahoma, sans-serif';
      ctx.fillText('حُکم حرفه‌ای', W / 2, 180);
      ctx.fillStyle = 'rgba(224, 225, 221, 0.6)';
      ctx.font = '16px Arial';
      ctx.fillText(`v${APP_VERSION}`, W / 2, 210);

      // نتیجه
      ctx.font = '100px Arial';
      ctx.fillText(win ? '🏆' : '💔', W / 2, 380);

      ctx.fillStyle = win ? '#06d6a0' : '#ef476f';
      ctx.font = 'bold 40px Arial, Tahoma';
      ctx.fillText(win ? 'پیروزی!' : 'باخت', W / 2, 450);

      // امتیاز
      ctx.fillStyle = '#ffd60a';
      ctx.font = 'bold 80px Georgia, serif';
      ctx.fillText(`${_toPersianNumber(myScore)} - ${_toPersianNumber(oppScore)}`, W / 2, 560);

      // ELO
      const eloSign = eloChange > 0 ? '+' : '';
      ctx.fillStyle = eloChange > 0 ? '#06d6a0' : eloChange < 0 ? '#ef476f' : '#a0a8b8';
      ctx.font = 'bold 30px Arial';
      ctx.fillText(`${_toPersianNumber(eloSign + eloChange)} ELO`, W / 2, 640);

      // نام بازیکن
      ctx.fillStyle = '#ffd60a';
      ctx.font = 'bold 26px Arial, Tahoma';
      ctx.fillText(profile.name || 'بازیکن', W / 2, 720);

      // آواتار
      ctx.font = '40px Arial';
      ctx.fillText(profile.avatar || '😎', W / 2, 780);

      // URL
      ctx.fillStyle = 'rgba(255, 214, 10, 0.7)';
      ctx.font = '16px Georgia';
      ctx.fillText('Hokm Pro', W / 2, H - 40);

      return canvas;
    },

    supportsNativeShare() {
      return !!navigator.share;
    }
  };

  global.HokmShare = Share;

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => Share.init(), 300);
  });

})(typeof window !== 'undefined' ? window : globalThis);