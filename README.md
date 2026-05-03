# عاجل - Ajel Delivery Platform

منصة توصيل متعددة الواجهات:
- واجهة مطعم
- واجهة سائق
- واجهة أدمن

الواجهة مبنية بـ React، والخادم بـ Node.js/Express، وقاعدة البيانات MySQL، مع Socket.io للتحديثات اللحظية.

## تشغيل سريع (Local)

### 1) تشغيل الخادم
```powershell
cd G:\react\fawri\server
npm install
npm run dev
```

### 2) تشغيل الواجهة
```powershell
cd G:\react\fawri
npm install
npm start
```

### 3) الروابط
- Frontend: `http://localhost:3000`
- API Health: `http://localhost:5000/api/health`

## توثيق المشروع

كل التوثيق المفصل موجود داخل:
- [docs/00-INDEX.md](G:\react\fawri\docs\00-INDEX.md)

## ملاحظات مهمة

- المشروع يعتمد صلاحيات صارمة حسب نوع المستخدم (`admin` / `restaurant` / `driver`).
- الطلبات والتنبيهات تتحدث لحظيا عبر Socket.io.
- الحسابات الجديدة للمطاعم والسائقين تدخل حالة `pending` حتى موافقة الأدمن.
- ترميز الملفات يجب أن يبقى `UTF-8` لتفادي مشاكل ظهور العربية.
# ajel
