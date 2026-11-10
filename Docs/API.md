# ⚙️ مستندات فنی و API — Hokm Pro

این سند برای توسعه‌دهندگانی است که می‌خواهند کدهای پروژه را تغییر دهند، باگ‌ها را رفع کنند یا قابلیت‌های جدیدی به بازی اضافه کنند. تمامی ماژول‌ها به صورت `IIFE` (Immediately Invoked Function Expression) نوشته شده‌اند تا از آلودگی فضای نام جهانی (Global Namespace) جلوگیری شود.

---

## 🎮 ماژول بازی (`HokmGame`)

قلب تپنده بازی که در فایل `js/game.js` قرار دارد و قوانین حکم را مدیریت می‌کند.

### توابع عمومی (Public Methods):

- **`HokmGame.start(options)`**
  شروع یک بازی جدید.
  *   `options` (شیء): تنظیمات بازی شامل `playerCount` (تعداد بازیکنان ۲ یا ۴) و `aiLevel` (سطح هوش مصنوعی).
  
- **`HokmGame.playCard(playerIdx, card)`**
  تلاش برای بازی یک کارت توسط بازیکن.
  *   این تابع خودش بررسی می‌کند که آیا نوبت بازیکن است و آیا کارت طبق قانون «پیروی از خال» مجاز است یا خیر.
  *   در صورت موفقیت `true` و در غیر این صورت `false` برمی‌گرداند.

- **`HokmGame.selectHokm(suit)`**
  انتخاب خال حکم توسط کاربر (زمانی که حکم‌خوان است).
  *   `suit` (رشته): یکی از مقادیر `'spades'`, `'hearts'`, `'diamonds'`, `'clubs'`.

- **`HokmGame.getMyHand()`**
  دریافت آرایه‌ای از کارت‌های موجود در دست بازیکن.

- **`HokmGame.getValidCards(playerIdx)`**
  دریافت لیست کارت‌هایی که یک بازیکن خاص طبق قوانین مجاز به بازی کردن آن‌هاست.

### رویدادها (Custom Events):
شما می‌توانید با `HokmGame.on('eventName', callback)` به این رویدادها گوش دهید:

- **`game:start`**: هنگام شروع بازی (قبل از توزیع کارت‌ها).
- **`cards:dealt`**: هنگام توزیع کارت‌ها (شامل دست هر بازیکن).
- **`hokm:selecting`**: هنگام انتخاب حکم‌خوان (شامل ایندکس و نام بازیکن).
- **`hokm:set`**: هنگام مشخص شدن خال حکم.
- **`turn:start`**: هنگام شروع نوبت یک بازیکن.
- **`card:played`**: هنگام بازی شدن یک کارت روی میز.
- **`trick:completed`**: هنگام تمام شدن یک دست (شامل برنده دست).
- **`game:ended`**: هنگام پایان بازی (شامل نتیجه، تغییرات ELO و سکه).

---

## 🤖 ماژول هوش مصنوعی (`HokmAI`)

در فایل `js/ai.js` قرار دارد و رفتار بازیکنان کامپیوتری را کنترل می‌کند.

### توابع عمومی:

- **`HokmAI.selectCard(player, gameState, validCards)`**
  انتخاب بهترین کارت برای بازی توسط هوش مصنوعی.
  *   الگوریتم این تابع بسته به سطح سختی (Easy, Medium, Hard, Master) متفاوت عمل می‌کند (از انتخاب تصادفی تا تحلیل حافظه و بلوف).

- **`HokmAI.selectHokm(player, gameState)`**
  انتخاب بهترین خال برای حکم توسط هوش مصنوعی (بر اساس قدرت کارت‌های دست).

---

## 👤 ماژول پروفایل (`HokmProfile`)

در فایل `js/profile.js` قرار دارد و مدیریت اطلاعات کاربر، اقتصاد و رتبه‌بندی را بر عهده دارد.

### توابع عمومی:

- **`HokmProfile.get()`**: دریافت اطلاعات کامل پروفایل.
- **`HokmProfile.addCoins(amount)`**: افزودن سکه به حساب کاربر.
- **`HokmProfile.spendCoins(amount)`**: کسر سکه از حساب (مثلاً برای ثبت‌نام در تورنمنت).
- **`HokmProfile.applyEloChange(change)`**: اعمال تغییرات رتبه (ELO) پس از هر بازی.
- **`HokmProfile.calculateElo(opponentElo, expectedWin)`**: محاسبه تغییرات ELO قبل از اعمال.

---

## 🔊 ماژول صدا (`HokmAudio`)

در فایل `js/audio.js` قرار دارد و با استفاده از `Web Audio API` صداها را به صورت سینتتیک تولید می‌کند (بدون نیاز به فایل‌های mp3).

- **`HokmAudio.play(soundName)`**: پخش افکت صوتی. صداهای موجود عبارتند از: `click`, `playCard`, `win`, `lose`, `deal`, `tick`, `error` و ...
- **`HokmAudio.startMusic()`**: پخش موسیقی پس‌زمینه (Ambient).
- **`HokmAudio.stopMusic()`**: توقف موسیقی پس‌زمینه.
- **`HokmAudio.setSfxEnabled(enabled)`**: روشن/خاموش کردن افکت‌های صوتی.

---

## 💾 ماژول ذخیره‌سازی (`HokmStorage`)

در فایل `js/storage.js` قرار دارد و مسئول خواندن/نوشتن در حافظه مرورگر (LocalStorage) است.

- **`HokmStorage.getProfile()`** / **`HokmStorage.setProfile(data)`**: مدیریت اطلاعات پروفایل.
- **`HokmStorage.getSettings()`** / **`HokmStorage.setSettings(data)`**: مدیریت تنظیمات.
- **`HokmStorage.getStats()`** / **`HokmStorage.recordGame(result)`**: ثبت آمار و نتایج بازی‌ها.
- **`HokmStorage.clearAll()`**: پاک کردن کامل تمام داده‌های ذخیره شده (Factory Reset).

---

## 🌐 ارتباط با سرور (Socket.io)

در صورت اتصال به سرور آنلاین (فایل `server.py`)، رویدادهای زیر بین کلاینت (مرورگر) و سرور رد و بدل می‌شوند:

- **`room:create`**: درخواست ساخت اتاق جدید.
- **`room:join`**: درخواست ورود به یک اتاق با کد.
- **`room:update`**: آپدیت شدن وضعیت بازیکنان در اتاق.
- **`card:play`**: ارسال کارت بازی‌شده به سرور برای همگام‌سازی.
- **`chat:send`**: ارسال پیام چت در اتاق.