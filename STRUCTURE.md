# بنية Vortex Core

- `client/src/App.tsx`: shell React وحالة الشاشات والواجهة.
- `client/src/game/VortexEngine.ts`: مشهد Three.js، Bloom، الحلقة الزمنية، الحواجز، البلورات، الجسيمات، الإدخال والصوت.
- `client/src/pages/Home.tsx`: واجهة HUD، القائمة، المتجر، التعليمات، الصدارة، نهاية اللعبة.
- `client/src/index.css`: الهوية البصرية، scanlines، glitch، responsive HUD.
- `client/public` لا يحتوي أصولاً كبيرة؛ الأصول البصرية تستخدم `/manus-storage/*`.

## تدفق الحالة
React يملك `screen` وبيانات التقدم/النتيجة، بينما `VortexEngine` يملك محاكاة Three.js ويصدر الأحداث (`score`, `crystal`, `gameover`). يتم فصل الإدخال عن قواعد اللعب عبر callbacks.
