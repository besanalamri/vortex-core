# Vortex Core — نواة الدوامة

لعبة ركض لانهائي ثلاثية الأبعاد مبنية بـ React وThree.js، بأسلوب Sci‑Fi/Synthwave، مع نفق نيون، Unreal Bloom، جسيمات، صوت مولد برمجياً، تحكم لمس ولوحة مفاتيح، متجر ترقيات، بلورات طاقة، ولوحة صدارة محلية.

## التشغيل المحلي

```bash
pnpm install
pnpm dev
```

لفحص TypeScript وبناء نسخة الإنتاج:

```bash
pnpm check
pnpm build
```

## النشر

المستودع يتضمن workflow جاهزاً لـ **GitHub Pages** في `.github/workflows/deploy.yml`. بعد تفعيل Pages من إعدادات المستودع واختيار **GitHub Actions**، سيتم بناء مجلد `dist` ونشره تلقائياً عند الدفع إلى `main`.

كما يمكن نشر المشروع على Netlify أو Vercel باستخدام:

```bash
pnpm install
pnpm run build:static
```

ومجلد الإخراج هو `dist/public`.

## عناصر التحكم

على الكمبيوتر: استخدم `A / D` أو الأسهم يميناً ويساراً. على الهاتف: اسحب يميناً ويساراً على مساحة اللعب. تبدأ الموسيقى والمؤثرات بعد أول تفاعل مع اللعبة.

## التخزين

يستخدم الإصدار الحالي `localStorage` لحفظ البلورات، الدرع، المضاعف، المظاهر، وأفضل 10 نتائج. يمكن استبداله لاحقاً بـ Firebase Firestore دون تغيير واجهة اللعب.

## البنية

- `client/src/game/VortexEngine.ts`: محرك Three.js وحلقة اللعب.
- `client/src/pages/Home.tsx`: شاشات اللعبة والـ HUD والمتجر والصدارة.
- `client/src/index.css`: الهوية البصرية والاستجابة والحركات.
- `client/public/assets`: الأصول الفنية اللازمة للنشر المستقل.
