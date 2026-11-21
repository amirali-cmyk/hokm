
# ⚙️ مستندات فنی و API — Hokm Pro v7.0.0

این سند برای توسعه‌دهندگانی است که می‌خواهند کدهای پروژه را تغییر دهند، باگ‌ها را رفع کنند یا قابلیت‌های جدیدی به بازی اضافه کنند. تمامی ماژول‌ها به صورت `IIFE` (Immediately Invoked Function Expression) نوشته شده‌اند تا از آلودگی فضای نام جهانی (Global Namespace) جلوگیری شود.

---

## 🎮 ماژول بازی (`HokmGame`)

قلب تپنده بازی که در فایل `js/game.js` قرار دارد و قوانین حکم را مدیریت می‌کند.

### توابع عمومی (Public Methods):

- **`HokmGame.start(options)`**
  شروع یک بازی جدید.
  *   `options` (شیء): تنظیمات بازی شامل `playerCount` (تعداد بازیکنان ۲ یا ۴)، `aiLevel` (سطح AI) و `timerSpeed` (سرعت تایمر).

- **`HokmGame.playCard(playerIdx, card)`**
  تلاش برای بازی یک کارت.
  *   خودش بررسی می‌کند که آیا نوبت بازیکن است و آیا کارت طبق قانون «پیروی از خال» مجاز است یا خیر.
  *   در صورت موفقیت `true` و در غیر این صورت `false` برمی‌گرداند.

- **`HokmGame.selectHokm(suit)`**
  انتخاب خال حکم توسط کاربر.
  *   `suit` (رشته): یکی از مقادیر `'spades'`, `'hearts'`, `'diamonds'`, `'clubs'`.

- **`HokmGame.getMyHand()`**
  دریافت آرایه‌ای از کارت‌های دست بازیکن.

- **`HokmGame.getValidCards(playerIdx)`**
  دریافت لیست کارت‌هایی که یک بازیکن مجاز به بازی کردن آن‌هاست.

- **`HokmGame.getState()`**
  دریافت وضعیت کامل بازی (فاز، بازیکنان، امتیازات، دست فعلی).

- **`HokmGame.debug()`**
  نمایش وضعیت کامل بازی در Console (برای دیباگ).

### رویدادها (Custom Events):

شما می‌توانید با `HokmGame.on('eventName', callback)` به این رویدادها گوش دهید:

- **`game:start`**: هنگام شروع بازی.
- **`cards:dealt`**: هنگام توزیع کارت‌ها (۳ بار صدا زده می‌شود: ۵ کارت، ۴ کارت، ۴ کارت).
- **`hokm:selecting`**: هنگام انتخاب حکم‌خوان.
- **`hokm:waitingForUser`**: اگر نوبت کاربر باشد.
- **`hokm:set`**: هنگام مشخص شدن خال حکم.
- **`turn:start`**: هنگام شروع نوبت یک بازیکن.
- **`card:played`**: هنگام بازی شدن یک کارت.
- **`card:invalid`**: اگر کارت غیرمجاز باشد.
- **`trick:completed`**: هنگام تمام شدن یک دست (شامل برنده).
- **`trick:new`**: شروع دست جدید.
- **`score:changed`**: تغییر امتیاز.
- **`game:ended`**: هنگام پایان بازی (شامل نتیجه، ELO و سکه).

---

## 🤖 ماژول هوش مصنوعی (`HokmAI`)

در فایل `js/ai.js` قرار دارد و رفتار بازیکنان کامپیوتری را کنترل می‌کند.

### توابع عمومی:

- **`HokmAI.selectCard(player, gameState, validCards)`**
  انتخاب بهترین کارت برای بازی توسط AI.
  *   بسته به سطح سختی (`easy`, `medium`, `hard`, `master`) متفاوت عمل می‌کند.

- **`HokmAI.selectHokm(player, gameState)`**
  انتخاب بهترین خال برای حکم توسط AI.

- **`HokmAI.recordPlayedCard(playerIdx, card)`**
  ثبت کارت‌های بازی‌شده برای حافظه AI سطح Master.

---

## 👤 ماژول پروفایل (`HokmProfile`)

در فایل `js/profile.js` قرار دارد و مدیریت اطلاعات کاربر، اقتصاد و رتبه‌بندی را بر عهده دارد.

### توابع عمومی:

- **`HokmProfile.get()`**: دریافت اطلاعات کامل پروفایل.
- **`HokmProfile.setName(name)`**: تغییر نام کاربر.
- **`HokmProfile.setAvatar(avatar)`**: تغییر آواتار (مسیر SVG یا ایموجی).
- **`HokmProfile.setAvatarFromFile(file)`**: تغییر آواتار با آپلود فایل.
- **`HokmProfile.addCoins(amount)`**: افزودن سکه.
- **`HokmProfile.spendCoins(amount)`**: کسر سکه (بررسی موجودی).
- **`HokmProfile.applyEloChange(change)`**: اعمال تغییرات ELO.
- **`HokmProfile.calculateElo(opponentElo, expectedWin)`**: محاسبه ELO قبل از اعمال.
- **`HokmProfile.updateUI()`**: بازخوانی و رندر مجدد UI.

### آواتار پیش‌فرض:
مسیر آواتار پیش‌فرض: `assets/svg/avatar-default.svg`

### ۷ سطح رتبه:

| رتبه | آیکون | ELO حداقل |
|------|-------|-----------|
| مبتدی | 🌱 | 0 |
| تازه‌کار | 🥉 | 1000 |
| متوسط | 🥈 | 1200 |
| حرفه‌ای | 🥇 | 1400 |
| استاد | 💎 | 1600 |
| استاد بزرگ | 👑 | 1800 |
| افسانه | 🔥 | 2000 |

---

## 🔊 ماژول صدا (`HokmAudio`)

در فایل `js/audio.js` قرار دارد و با استفاده از `Web Audio API` صداها را به صورت سینتتیک تولید می‌کند (بدون فایل mp3).

- **`HokmAudio.play(soundName)`**: پخش افکت صوتی.
  *   صداهای موجود: `click`, `playCard`, `win`, `lose`, `deal`, `tick`, `error`, `claimHokm`, `turn`, `coin`, `achievement`, `notification`, `chat`, `countdown`, `timeout`, `success`, `shuffle`, `pop`, `swipe`.
- **`HokmAudio.startMusic()`**: پخش موسیقی پس‌زمینه.
- **`HokmAudio.stopMusic()`**: توقف موسیقی.
- **`HokmAudio.setSfxEnabled(enabled)`**: روشن/خاموش کردن افکت‌ها.
- **`HokmAudio.setMusicVolume(vol)`**: تغییر صدای موسیقی (0.0 تا 1.0).
- **`HokmAudio.setSfxVolume(vol)`**: تغییر صدای افکت‌ها (0.0 تا 1.0).

---

## 💾 ماژول ذخیره‌سازی (`HokmStorage`)

در فایل `js/storage.js` قرار دارد و مسئول خواندن/نوشتن در `localStorage` است.

- **`HokmStorage.getProfile()`** / **`HokmStorage.setProfile(data)`**: مدیریت پروفایل.
- **`HokmStorage.getSettings()`** / **`HokmStorage.setSettings(data)`**: مدیریت تنظیمات.
- **`HokmStorage.getStats()`** / **`HokmStorage.recordGame(result)`**: ثبت آمار.
- **`HokmStorage.getHistory()`**: تاریخچه بازی‌ها.
- **`HokmStorage.getAchievements()`** / **`HokmStorage.unlockAchievement(id)`**: مدیریت دستاوردها.
- **`HokmStorage.clearAll()`**: پاک کردن کامل تمام داده‌ها.

### ۶ کلید اصلی localStorage:

```

hokm_profile       → اطلاعات کاربر
hokm_settings      → تنظیمات
hokm_save          → بازی جاری (۷ روز انقضا)
hokm_stats         → آمار تفصیلی
hokm_history       → ۵۰ بازی آخر
hokm_achievements  → دستاوردهای باز‌شده

```

---

## 🎨 ماژول تم‌ها (`HokmThemes`)

در فایل `js/themes.js` قرار دارد.

- **`HokmThemes.setMode(mode)`**: `'dark'`, `'light'`, `'auto'`.
- **`HokmThemes.toggle()`**: چرخش بین Dark و Light.
- **`HokmThemes.setAccent(accent)`**: `'gold'`, `'emerald'`, `'ocean'`, `'royal'`, `'ruby'`.
- **`HokmThemes.setCardTheme(theme)`**: `'classic'`, `'dark'`, `'wooden'`, `'cartoon'`, `'neon'`.
- **`HokmThemes.setBgTheme(theme)`**: `'gradient'`, `'wooden'`, `'checker'`, `'night'`, `'crystal'`.

---

## 🔐 ماژول احراز هویت (`HokmAuth`)

در فایل `js/auth.js` قرار دارد.

- **`HokmAuth.logout()`**: خروج کاربر.
- **`HokmAuth.updateUI()`**: بازخوانی وضعیت لاگین در UI.

---

## 🎨 ماژول رابط کاربری (`HokmUI`)

در فایل `js/ui.js` قرار دارد.

- **`HokmUI.navigate(screenName, options)`**: ناوبری بین صفحات.
- **`HokmUI.showToast(title, message, type, duration)`**: نمایش اعلان.
- **`HokmUI.openModal(html, options)`** / **`HokmUI.closeModal()`**: مدیریت مودال.
- **`HokmUI.startGame(options)`**: شروع بازی.
- **`HokmUI.exitGame()`**: خروج از بازی.
- **`HokmUI.renderGame()`**: رندر کامل میز بازی.
- **`HokmUI.renderHand(cards, gameState)`**: رندر دست بازیکن.
- **`HokmUI.renderSeats(gameState)`**: رندر صندلی‌ها (با آواتار SVG).
- **`HokmUI.renderTrick(trick, gameState)`**: رندر کارت‌های وسط.
- **`HokmUI.showHokmPicker()`**: نمایش پنجره انتخاب حکم.
- **`HokmUI.showGameEnd(result)`**: نمایش مودال پایان.
- **`HokmUI.showReactionButtons()`**: نمایش دکمه‌های ری‌اکشن.
- **`HokmUI.showFloatingReaction(emoji, playerIdx)`**: شناور کردن ایموجی.

---

## 👥 ماژول دوستان (`HokmFriends`)

در فایل `js/friends.js` قرار دارد.

- **`HokmFriends.init()`**: راه‌اندازی اتصال Socket.io.
- **`HokmFriends.loadMyInfo()`**: دریافت کد HK از سرور.
- **`HokmFriends.addFriend(code)`**: ارسال درخواست دوستی.
- **`HokmFriends.sendMessage(friendId, text)`**: ارسال پیام.
- **`HokmFriends.openChat(friendId, friendName)`**: باز کردن چت.

---

## 🌐 ارتباط با سرور (Socket.io)

### سرور بازی (`ServerGame.py` - پورت 8080):

- **`room:create`**: درخواست ساخت اتاق.
- **`room:join`**: ورود به اتاق.
- **`room:update`**: آپدیت وضعیت بازیکنان.
- **`card:play`**: ارسال کارت بازی‌شده.
- **`game:start`**: شروع بازی توسط host.

### سرور دوستان (`ServerFriends.py` - پورت 8081):

- **`auth`**: احراز هویت سوکت.
- **`chat:send`**: ارسال پیام چت.
- **`friend:new_request`**: اطلاع از درخواست دوستی جدید.
- **`game:invite`**: دعوت به بازی.
- **`reaction:send`**: ارسال ری‌اکشن (ایموجی).

### REST API های دوستان:

- **`POST /api/register`**: ثبت‌نام.
- **`POST /api/login`**: ورود.
- **`GET /api/me`**: اطلاعات کاربر (شامل `friendCode`).
- **`GET /api/friends`**: لیست دوستان.
- **`POST /api/friends/add`**: افزودن دوست.

---

## 🃏 آیکون‌های SVG (نسخه ۷.۰)

تمام آیکون‌های بازی از پوشه `assets/svg/` استفاده می‌کنند:

| آیکون | استفاده |
|-------|---------|
| `card-suits.svg` | لوگو + Favicon |
| `coin.svg` | سکه |
| `gem.svg` | جم |
| `crown-vip.svg` | تاج VIP + دستاورد |
| `card-front-frame.svg` | دکمه شروع |
| `card-back.svg` | پشت کارت |
| `settings-gear.svg` | تنظیمات |
| `trophy.svg` | تورنمنت + لیدربورد |
| `medal-icon.svg` | مدال + دستاورد |
| `gift-box.svg` | جایزه |
| `shop-icon.svg` | فروشگاه |
| `clover-icon.svg` | شانس |
| `target-icon.svg` | دوستان + هدف |
| `avatar-default.svg` | آواتار پیش‌فرض |
| `chest-icon.svg` | صندوق گنج |
| `mail-icon.svg` | پیام |
| `chat-icon.svg` | چت |
| `notification-icon.svg` | اعلان |
| `home-icon.svg` | خانه |
| `slot-icon.svg` | چرخ شانس |
| `sound-icon.svg` | صدا |
| `dark-mode-toggle.svg` | تغییر تم |

---

<div align="center">
  <i>ساخته شده با ❤️ توسط امیرعلی کامرانی</i>
</div>