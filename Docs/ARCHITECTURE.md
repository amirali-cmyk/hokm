
# 🏗️ معماری پروژه (Architecture) — Hokm Pro v7.0.0

این سند توضیح می‌دهد که اجزای مختلف بازی «حکم حرفه‌ای» چگونه در کنار هم کار می‌کنند. معماری این پروژه بر پایه‌ی **جداسازی مسئولیت‌ها (Separation of Concerns)** بنا شده است؛ یعنی منطق بازی (Game Logic) کاملاً از رابط کاربری (UI) و مدیریت داده‌ها جدا است.

---

## 📁 نمای کلی ساختار پروژه

```text
hokm-pro/
├── index.html              # نقطه ورود برنامه (Single Page Application)
├── 404.html                # صفحه خطای سفارشی
├── ServerGame.py           # سرور Flask برای بازی آنلاین
├── ServerFriends.py        # سرور Flask برای دوستان و چت
├── requirements.txt        # وابستگی‌های پایتون
│
├── assets/
│   ├── logo.svg
│   ├── favicon.svg
│   ├── tutorial/           # تصاویر آموزشی (۴ فایل)
│   └── svg/                # ۲۲ آیکون SVG لوکس
│
├── css/
│   ├── base.css            # ریست، متغیرها، فونت‌ها
│   ├── themes.css          # ۵ تم Accent، کارت، پس‌زمینه
│   ├── components.css      # دکمه‌ها، کارت‌ها، مودال‌ها
│   ├── screens.css         # چیدمان اختصاصی هر صفحه
│   ├── animations.css      # ۵۰+ کیفریم
│   ├── responsive.css      # ۱۲ بریک‌پوینت
│   └── luxury.css          # 🆕 افکت‌های ویژه نسخه ۷.۰
│
├── js/
│   ├── storage.js          # localStorage
│   ├── themes.js           # مدیریت تم‌ها
│   ├── audio.js            # موتور صدا (Web Audio API)
│   ├── auth.js             # احراز هویت
│   ├── profile.js          # پروفایل، ELO، سکه
│   ├── achievements.js     # ۱۲ دستاورد
│   ├── leaderboard.js      # جدول امتیازات
│   ├── friends.js          # دوستان و چت
│   ├── tournament.js       # تورنمنت
│   ├── replay.js           # پخش مجدد
│   ├── share.js            # اشتراک‌گذاری
│   ├── ai.js               # هوش مصنوعی ۴ سطح
│   ├── game.js             # قلب بازی (منطق حکم)
│   ├── online.js           # اتاق‌های آنلاین
│   ├── ui.js               # رابط کاربری
│   ├── settings.js         # تنظیمات
│   └── main.js             # راه‌انداز
│
└── docs/
    ├── README.md
    ├── ARCHITECTURE.md
    ├── API.md
    ├── CHANGELOG.md
    ├── PRIVACY.md
    └── CONTRIBUTING.md
```

---

🎯 لایه‌های معماری (Architecture Layers)

پروژه از سه لایه اصلی تشکیل شده است:

۱. لایه داده (Data Layer)

· فایل‌ها: storage.js
· وظیفه: ذخیره و بازیابی اطلاعات در localStorage. این لایه تضمین می‌کند که اگر کاربر مرورگر را ببندد، پیشرفت او (سکه، آمار، تنظیمات) حفظ شود.

۲. لایه منطق (Logic Layer)

· فایل‌ها: game.js, ai.js, profile.js, achievements.js, auth.js
· وظیفه: هیچ کاری با DOM ندارد. فقط قوانین بازی، محاسبات ریاضی (مثل ELO) و رفتار هوش مصنوعی را مدیریت می‌کند. این جداسازی باعث می‌شود اگر بخواهیم بعداً بازی را به اپ نیتیو تبدیل کنیم، از همین منطق استفاده کنیم.

۳. لایه نمایش (Presentation Layer)

· فایل‌ها: ui.js, css/*
· وظیفه: نمایش کارت‌ها، مدیریت کلیک‌ها، انیمیشن‌ها و تغییر صفحات.

---

🎨 لایه طراحی نسخه ۷.۰ (Design System)

در نسخه ۷.۰.۰، یک سیستم طراحی لوکس (Luxury Design System) روی پروژه اضافه شد:

۳.۱. فایل luxury.css (جدید)

این فایل شامل افکت‌های ویژه است که در فایل‌های دیگر تعریف نشده‌اند:

افکت کاربرد
Velvet Texture بافت مخملی پس‌زمینه
Luxury Glass کارت‌های شیشه‌ای
Gold Glow Border حاشیه طلایی درخشان
Avatar Glow Ring هاله دور آواتار
Gradient Border Card کارت با حاشیه گرادیانت چرخان
Spotlight BG پس‌زمینه نور نقطه‌ای
Burst Particles ذرات انفجاری
Shimmer Button درخشش روی دکمه‌ها

۳.۲. پالت رنگی نسخه ۷.۰

```css
/* پس‌زمینه مخملی */
--bg-velvet-1: #0a1512;
--bg-velvet-2: #122620;
--bg-velvet-3: #1a3028;

/* طلایی */
--gold-bright: #ffd700;
--gold-shine:  #fff3b0;
--gold-dark:   #b8860b;

/* رنگ‌های ویژه */
--orange-bright: #ff9f00;
--blue-bright:   #3a7bd5;
--ruby-bright:   #ef476f;
--emerald-bright: #06d6a0;
--purple-bright: #9b5de5;
```

۳.۳. آیکون‌های SVG (نسخه ۷.۰)

تمام آیکون‌های UI از ایموجی به SVG اختصاصی تبدیل شدند:

· محل: assets/svg/
· تعداد: ۲۲ فایل
· استفاده در: index.html، ui.js، profile.js

---

🔄 چرخه حیات بازی (Game Flow)

1. کاربر وارد index.html می‌شود.
2. main.js تمام ماژول‌های JS را بررسی و راه‌اندازی می‌کند.
3. کاربر روی «شروع بازی» کلیک می‌کند.
4. ui.js به game.js سیگنال می‌دهد که بازی جدید شروع شود.
5. game.js به ترتیب:
   · ۵ کارت به هر بازیکن می‌دهد.
   · ۸ ثانیه توقف می‌کند تا کارت‌ها دیده شوند.
   · حکم‌خوان را انتخاب می‌کند.
   · بعد از اعلام حکم، ۴ کارت و سپس ۴ کارت دیگر می‌دهد.
   · ۵ ثانیه توقف نهایی می‌کند.
6. نوبت‌ها به صورت ساعتگرد (0 → 1 → 2 → 3) می‌چرخند.
7. در پایان بازی:
   · profile.js سکه و ELO را محاسبه می‌کند.
   · storage.js نتایج را ذخیره می‌کند.
   · ui.js مودال پایان بازی را نمایش می‌دهد.

---

🌐 معماری سرورها (Backend Architecture)

بازی از دو سرور مستقل استفاده می‌کند:

۴.۱. ServerGame.py (بازی آنلاین)

· پورت: 8080
· کاربرد: مدیریت اتاق‌های بازی آنلاین
· تکنولوژی: Flask + Flask-SocketIO
· رویدادها: room:create, room:join, card:play, trick:won

۴.۲. ServerFriends.py (دوستان و چت)

· پورت: 8081
· کاربرد: سیستم دوستان، چت و احراز هویت
· تکنولوژی: Flask + Flask-SocketIO + bcrypt
· رویدادها: chat:send, friend:new_request, game:invite

چرا جدا؟

· جداسازی مسئولیت‌ها (Separation of Concerns)
· اگر یکی خراب شود، دیگری کار می‌کند
· مقیاس‌پذیری بهتر

---

📡 ارتباط بین اجزا (Communication)

```
┌─────────────────┐
│   index.html    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│      ui.js      │ ←── رابط کاربری
└────────┬────────┘
         │
    ┌────┴────┬─────────┬──────────┐
    ▼         ▼         ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│game.js │ │ai.js   │ │profile │ │friends │
└────┬───┘ └────────┘ └────┬───┘ └────┬───┘
     │                     │          │
     ▼                     ▼          ▼
┌─────────────────┐ ┌──────────┐ ┌─────────────┐
│  storage.js     │ │sockets   │ │ServerFriends│
└─────────────────┘ └──────────┘ └─────────────┘
     │
     ▼
┌─────────────────┐
│  localStorage   │
└─────────────────┘
```

---

🚀 Performance Optimizations

· CSS Grid و Flexbox برای چیدمان بهینه
· transform و opacity در انیمیشن‌ها (به جای top/left)
· will-change برای عناصر متحرک
· Lazy Loading برای آیکون‌های SVG
· Debouncing در رویدادهای اسکرول
· prefers-reduced-motion برای کاربران حساس

---

🧪 تست و دیباگ

· debug.html: صفحه عیب‌یابی سیستم دوستان
· HokmGame.debug(): نمایش وضعیت کامل بازی در کنسول
· HokmApp.test(): تست کامل ۶ ماژول اصلی

---

📌 قوانین کدنویسی

1. Vanilla JavaScript (بدون فریم‌ورک)
2. جداسازی ماژول‌ها با IIFE
3. کامنت‌گذاری فارسی برای توابع مهم
4. متغیرها و توابع: camelCase
5. کلاس‌ها: PascalCase
6. فایل‌ها: kebab-case

---

<div align="center">
  <i>ساخته شده با ❤️ توسط امیرعلی کامرانی</i>
</div>