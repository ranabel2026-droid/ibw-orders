# IBW Orders

تطبيق ويب تقدّمي PWA عربي RTL لوساطة طلبات سلال **SHEIN**. تصميم أسود/أبيض بلمسة أخضر هادئ، خط Cairo محلي، واجهة موبايل، دون كتالوج أو أقسام. **خدمة مستقلة غير تابعة رسمياً لـ SHEIN.**

## تشغيل محلي

يتطلب Node.js 22 أو أحدث (24 موصى به)، npm. SQLite مضمّن عبر better-sqlite3 محلياً؛ عند ضبط DATABASE_URL تُستخدم PostgreSQL عبر pg بدلاً منه. عند عدم توفر binary جاهز قد تحتاج Python و make و g++.

```bash
npm ci
cp .env.example .env
npm start
```

- افتح `http://localhost:3000`، والإدارة `http://localhost:3000/admin`.
- محلياً في وضع SQLite: كلمة مرور الإدارة تؤخذ من `ADMIN_PASSWORD`، أو تُولّد تلقائياً في `ADMIN_PASSWORD.txt` داخل مجلد البيانات. لا تُطبع في السجلات. احتفظ بها سريّة وغيّرها للإنتاج.
- البيانات افتراضياً في مجلد المشروع `/workspace/shein-orders` في هذه النسخة؛ يمكن تغييرها بمتغير `DATA_DIR`.
- تغيير اسم العلامة ووصفها ونص حساب شام كاش في `config.js`. تخصيص ألوان التصميم في `public/styles.css`. ملف manifest يقرأ الاسم منه. أيقونات IBW PNG جاهزة في `public/icons`.
- الاختبارات: شغّل الخادم أولاً ثم `npm test`. تُستخدم curl وبيانات وهمية، وتُحفظ طلبات الاختبار دائماً، لا تُحذف. `npm run test:ui` يختبر شاشات التطبيق في DOM افتراضي، وليس اختبار متصفح بصرياً.

## وظائف العميل

إنشاء حساب بريد وكلمة مرور (bcrypt cost 12)، دخول وخروج، cookie جلسة httpOnly و SameSite، حماية CSRF وتحديد محاولات الدخول. يلزم الدخول لإرسال الطلب. نموذج الاسم الكامل، الهاتف مع رمز البلد، عنوان متعدد الأسطر، رابط HTTPS من نطاقات شي إن المعتمدة (ومنها `shein.com` و `m.shein.com` و `onelink.shein.com` و `api-shein.shein.com`)، **اسم المسوّقة يُكتب حصراً بواسطة العميلة، دون روابط خاصة أو تعبئة من URL**، وملاحظات اختيارية. **اختيار طريقة الدفع إجباري** ببطاقتين: «شام كاش» أو «كاش عند الاستلام». هذه خيارات تسجيل فقط ولا تنفّذ دفعاً إلكترونياً. عند اختيار شام كاش تظهر رسالة أن الفريق سيتواصل بتفاصيل الدفع. نص الحساب/الرقم اختياري من `shamCashDetails` في `config.js`، فارغ افتراضياً ولا توجد بيانات دفع مخترعة. يتم تعبئة الاسم والهاتف والعنوان فقط من آخر طلب. صفحة نجاح برقم الطلب وصفحة «طلباتي» تعرض طلبات الحساب نفسه وحالاتها فقط.

لا تُفتح السلة آلياً ولا تُسحب تفاصيل منتجاتها. صلاحية الرابط أو قدرته على عرض سلة حقيقية تحتاج التحقق من المسوّقة. الرابط التجريبي في الاختبارات غير حقيقي. لا دفع إلكتروني ولا شراء آلي ولا تسعير تلقائي.

## البريد والتحقق واستعادة كلمة المرور

دون `SMTP_HOST` و `SMTP_FROM`: الحساب متاح فور التسجيل، التحقق يُتجاوز حسب التصميم، واستعادة كلمة المرور غير متاحة. لا تُطبع رموز في console ولا تُعرض للمستخدم.

للتفعيل اضبط متغيرات SMTP في `.env.example`: المضيف والمنفذ واسم المستخدم وكلمة المرور والمرسل. `SMTP_SECURE=true` غالباً للمنفذ 465، و false مع STARTTLS للمنفذ 587. استخدم مزود بريد موثوقاً وأضف SPF/DKIM لنطاق المرسل. عندها يجب تأكيد البريد برمز من 6 أرقام، صالح 10 دقائق وخمس محاولات، مع إعادة إرسال. استعادة كلمة المرور تستخدم رمزاً مشابهاً وتلغي جلسات العميل القديمة. تم اختبار SMTP والتحقق وإعادة التعيين وإلغاء الجلسات مع خادم بريد وهمي محلي لا يرسل خارج الجهاز (`npm run test:smtp`). لم يتم اختبار توصيل البريد مع مزوّد حقيقي لأن بيانات SMTP غير متاحة.

## الإدارة والسجل الدائم

الإدارة `/admin` محمية بكلمة مرور، الجلسة server-side في SQLite منفصل محلياً أو في جدول sessions داخل PostgreSQL عند ضبط DATABASE_URL، ولا يوجد حساب إدارة مع كلمة مرور مضمنة في الكود. الطلبات الأحدث أولاً، تصفية بالمسوّقة والحالة وطريقة الدفع، روابط سلة واتصال وواتساب، وتصدير CSV عربي يتضمن المسوّقة والبريد وكل بيانات الطلب (مع حماية من صيغ CSV الخبيثة).

الحالات: جديد / قيد التنفيذ / تم الشحن / تم التسليم / ملغي.

حالة الدفع مستقلة: **غير مدفوع / مدفوع**، تغيّرها المديرة ويُسجّل كل تغيير في سجل التدقيق مع الوقت. تظهر الطريقة والحالة في «طلباتي» وتفاصيل الطلب والإدارة وCSV. طريقة الدفع نفسها لقطة ثابتة لا يمكن تعديلها بعد الإرسال. الطلبات القديمة قبل إضافة خيار الدفع تظهر «غير محدد — طلب سابق» دون تغيير معلوماتها.

**الطلب لقطة ثابتة لا تتبدّل**: وقت الإرسال يُحفظ الاسم والهاتف والعنوان ورابط السلة واسم المسوّقة والملاحظات وبريد العميل وطريقة الدفع في جدول `orders` مستقل عن بيانات حسابه. Database triggers تمنع تعديل هذه التفاصيل أو حذف الطلب. لا يوجد delete endpoint. الإلغاء تغيير حالة فقط. جدول `order_history` يسجّل الإنشاء وكل تغيير حالة مع الزمن والفاعل، بآلية trigger على قاعدة البيانات؛ ويمنع تعديل أو حذف السجل. عرض «التفاصيل والسجل» في الإدارة يعرض كل التغييرات. الأزمنة مخزنة UTC، وتُعرض بحسب المنطقة الزمنية لمتصفح المستخدم.

## PostgreSQL / Neon: تخزين دائم دون قرص Render

عند وجود **`DATABASE_URL`** تُخزّن كل الجداول في PostgreSQL: `users`, `sessions`, `orders` (اللقطات الثابتة بكل معلومات العميلة والدفع), `order_history`, `codes`, و`schema_migrations`. دون المتغير يبقى وضع SQLite المحلي كما هو. لا يوجد fallback صامت إلى ملفات محلية عند فشل PostgreSQL؛ يتوقف بدء التشغيل لتجنّب ضياع الطلبات في قرص مؤقت.

- استخدم رابط **Neon pooled connection** الذي يحمل عادة `-pooler` في اسم المضيف. `pg.Pool` يستخدم حتى 5 اتصالات افتراضياً (`PG_POOL_MAX` للتخصيص)، مع TLS إلزامي والتحقق من شهادة الخادم. لا تستخدم `sslmode=disable` أو `rejectUnauthorized=false`. معاملات SSL داخل URL لا يمكنها تخفيف التحقق. عند شهادة خاصة موثوقة فقط، يمكن ضبط `NODE_EXTRA_CA_CERTS` لملف CA؛ لا يحتاج Neon هذا عادة.
- `ADMIN_PASSWORD` و`SESSION_SECRET` إلزاميان وثابتان في وضع PostgreSQL. لا تعتمد على ملفات أسرار محلية في Render. طالما لم يتغير SESSION_SECRET ولم تنتهِ cookie، تبقى جلسات العميلات والإدارة بعد إعادة التشغيل لأن البيانات في DB، لا في memory. تغيير السر عمداً يُبطل توقيع cookies القديمة.
- تُنشأ الجداول والمهاجرات تلقائياً **وقت بدء الخادم وقبل الاستماع للطلبات**، داخل transaction وقفل advisory متوافق مع connection pool. إعادة البدء لا تمسح البيانات.
- PostgreSQL triggers تمنع DELETE وTRUNCATE للطلبات وسجل التدقيق، وتمنع تغيير snapshot. تغيير حالة الطلب أو الدفع وحده مسموح ويضيف audit في نفس transaction. مستخدم DB الإداري قادر نظرياً على تغيير schema؛ احمِ بيانات الاتصال ولا توزعها على العميلات.
- تبديل DATABASE_URL **لا ينقل بيانات SQLite القديمة تلقائياً إلى Neon**. تبقى البيانات المحلية محفوظة. النقل، إن لزم، عملية مستقلة يجب تحضيرها ومراجعتها قبل بدء استقبال طلبات حقيقية؛ لا تخلط قاعدة اختبار جديدة مع السجل المحلي.
- `npm run test:postgres` يتحقق من عقد adapter وsession store والتصدير وSQL grammar بمحاكاة pool، **ليس اختبار PostgreSQL حيّاً**. محاولة تثبيت الخادم المحلي تعذرت بسبب HTTP 500 من مستودع apt وعدم وجود server binaries. يلزم تشغيل اختبار اتصال Neon وطلب تجريبي وتحقق جلسات/تدقيق بعد ربط الحسابات وقبل الإطلاق الحقيقي.

### النسخ الاحتياطية المحلية (SQLite فقط)

- ملف البيانات الأساسي `orders.sqlite`؛ يشمل الحسابات والطلبات والتاريخ ورموز التحقق، ولا يشمل جلسات الدخول الموجودة في `sessions.sqlite`.
- نسخة متسقة بواجهة SQLite online backup عند بدء الخادم، وأخرى **يومياً عند منتصف الليل حسب توقيت الخادم/TZ أثناء تشغيل العملية**.
- المسار الافتراضي `/workspace/shein-orders/backups/`، أو `$DATA_DIR/backups/`. اسم كل نسخة يحوي التاريخ والوقت. **لا تُحذف أي نسخة تلقائياً**.
- زر **«نسخة احتياطية»** في الإدارة ينشئ نسخة جديدة على القرص وينزّلها للمديرة. التنزيل محمي بالجلسة وCSRF.
- لو توقف الخادم لا تعمل المؤقتات؛ عند إعادة التشغيل تؤخذ نسخة جديدة فوراً. للإنتاج استعمل تشغيل خدمة دائم ومراقبة أخطاء `BACKUP FAILED` والمساحة الحرة.
- الاحتفاظ للأبد على مستوى التطبيق **ليس ضماناً ضد تعطل القرص أو حذف الخدمة أو نفاد التخزين**. وسّع القرص مع نمو الملفات، واحتفظ بنسخ مشفّرة خارج الخادم وفق صلاحياتك. النسخ تحتوي بيانات شخصية و hashes كلمات المرور؛ لا ترفعها إلى مستودع عام.
- لاستعادة نسخة: أوقف الخدمة أولاً، واحتفظ بنسخة أمان من مجلد البيانات كاملاً؛ انقل ملفات قاعدة البيانات الحالية وملفات WAL/SHM إلى مجلد أرشيف آمن؛ انسخ النسخة المطلوبة إلى `orders.sqlite` داخل `DATA_DIR` واضبط ملكيتها وصلاحياتها ثم شغّل الخدمة. لا تستبدل قاعدة مفتوحة، ولا تنسخ ملف SQLite الحي يدوياً دون WAL؛ استخدم زر النسخ المتسق. الاستعادة إلى نسخة أقدم تفقد ما أُضيف بعدها، فلا تفعلها دون مراجعة.
- متطلبات الاحتفاظ القانونية وخصوصية العملاء تختلف حسب البلد. راجع سياسة الخصوصية وفترة الاحتفاظ المشروعة قبل استقبال بيانات حقيقية.

### النسخ والتاريخ في PostgreSQL / Neon

في وضع PostgreSQL لا ينشئ التطبيق نسخاً يومية على قرص Render؛ قرص الخطة المجانية مؤقت ولا يصلح كأرشيف. زر **«نسخة احتياطية»** ينزّل JSON متسقاً لكل الجداول (بما فيها hashes كلمات المرور، رموز التحقق المَجزّأة، sessions وسجل الحالات) داخل transaction قراءة repeatable-read. لا يُخزّن ملف التصدير على قرص الخدمة. زر CSV المنفصل يصدّر الطلبات المفلترة وكل حقولها، وليس كل الجداول. ينزّل المتصفح الامتداد الصحيح `.json` مع PostgreSQL و`.sqlite` مع SQLite.

**ملف JSON حساس جداً** لأنه يشمل معرفات جلسات قد تكون ما زالت صالحة: احفظيه مشفراً وبصلاحيات مقيدة ولا تضعيه في Git أو بريد عام. JSON تصدير أرشيفي قابل للمعالجة وليس ملف pg_dump ولا يمكن تمريره مباشرة إلى pg_restore. للاستعادة الاحترافية استخدم نسخ `pg_dump`/`pg_restore` أو Neon PITR بإجراء مُراجع؛ لا توجد واجهة استيراد تلقائي في التطبيق.

Neon يحتفظ بتاريخ point-in-time restore وفق خطة وحجم نافذة history. التوثيق الحالي يذكر **حتى 6 ساعات في Free، 7 أيام في Launch، و30 يوماً في Scale**، وهذه نافذة تعافٍ محدودة **وليست نسخة احتياطية إلى الأبد**. راجعي إعداد history في حساب Neon وحدوده الحالية. لضمان احتفاظ طويل الأمد، احتفظي بتصديرات/نسخ pg_dump مشفرة خارج مزود الاستضافة، وراقبي حصة التخزين والسياسات. وجود DB دائمة لا يلغي مخاطر حذف المشروع أو تجاوز حدود الخدمة.

المصدر: https://neon.com/docs/manage/backups

## النشر الآمن: Render / Railway / VPS

هذه حزمة قابلة للنشر، **لم تُنشر على استضافة عامة بعد**. الرابط المحلي ليس رابطاً يمكن فتحه من هاتف آخر. المالك وافق على مسار Render المجاني مع Neon، لكن هذه المهمة تجهّز الشيفرة فقط ولا تنفّذ النشر أو ربط الحسابات. النفق التجريبي، إن أُنشئ لاحقاً بموافقة، مؤقت وغير مناسب للعمل الحقيقي.

### Render Free + Neon (المسار المُجهّز)

ملف `render.yaml` يحدد web service بـ `plan: free`, `runtime: node`, build `npm ci`, start `npm start`, وhealth check `/healthz`. **لا يحتوي Render Postgres ولا قرصاً مدفوعاً**. لم يتم إنشاء خدمة أو حساب أو رفع ملفات في هذه المهمة؛ الربط والنشر سيقوم به المنسّق لاحقاً بعد توصيل الحسابات.

1. أنشئ/اختر مشروع Neon مجانياً وخذ رابط الاتصال **المجمّع pooled** إلى قاعدة المشروع. لا تختَر Render Free Postgres كبديل «دائم» لأنه ينتهي بعد 30 يوماً بحسب توثيق Render.
2. اربط مستودع المشروع بـ Render واستخدم Blueprint `render.yaml`. `autoDeployTrigger: off` يوقف النشر التلقائي لكل commit لاحق؛ إنشاء الخدمة الأول قد ينشرها عند تنفيذك إعداد Blueprint.
3. أدخل **DATABASE_URL** في dashboard (sync:false، لا يوضع في Git). يولّد Render **ADMIN_PASSWORD** و**SESSION_SECRET** تلقائياً بقيم عشوائية إذا لم تكن موجودة. احتفظ بسر الجلسة دون تغييره بين النشرات. كلمة الإدارة تُقرأ من إعدادات Render الآمنة، لا يوجد ADMIN_PASSWORD.txt معتمد عليه هناك.
4. المتغيرات المضبوطة بالملف: `NODE_VERSION=24`, `NODE_ENV=production`, `TRUST_PROXY=1`, `SECURE_COOKIES=true`, `REQUIRE_POSTGRES=true` (يرفض التشغيل إن كان DATABASE_URL ناقصاً، حتى لا يعمل SQLite مؤقتاً بالخطأ). Render يحدد **PORT** تلقائياً؛ التطبيق يستمع على `0.0.0.0` وعلى هذه القيمة. لا تضع DATA_DIR/SQLite على Render Free.
5. متغيرات SMTP اختيارية ومذكورة sync:false؛ اترك **SMTP_HOST وSMTP_FROM فارغين/غير مضبوطين** إذا لم تُفعّل البريد. **Render Free يمنع خروج SMTP على المنافذ 25 و465 و587**، لذلك لا تفعّل تحقق البريد بإعدادات لن تستطيع إرسال الرمز. واجهة إرسال عبر HTTPS يمكن إضافتها لاحقاً بشكل مستقل (غير موجودة حالياً). لا تُفعّل إعداداً يحبس تسجيل العميلات دون توصيل بريد مُختبر.
6. اختبر `/healthz`، ثم حساباً وطلباً وهميين، ظهور الطلب بالإدارة، تغيير الحالات والتاريخ، تنزيل JSON وCSV، ثم أعد تشغيل الخدمة وتأكد من بقاء الدخول والطلبات. قم بذلك قبل استقبال بيانات حقيقية؛ مسار PostgreSQL لم يُختبر على خادم حي في جلسة البناء بسبب تعذر تثبيت خادم اختبار محلي.

**حدود المجاني:** Render ينام بعد 15 دقيقة دون طلبات، وقد يستغرق الاستيقاظ قرابة دقيقة. قد يُعاد تشغيله في أي وقت؛ هذا لا يحذف Neon أو جلسات DB، لكن قد يتأخر فتح الصفحة. توجد حدود شهرية للساعات والباندويث والبناء والتخزين وقيود للخطة؛ لا يوجد ضمان تشغيل مستمر مجاني للأبد. Render ينصح بعدم استخدام Free لتطبيقات إنتاج حرجة. راقب حدود Neon وRender، ولا تضف طريقة دفع أو ترقية مدفوعة دون موافقتك.

المصادر: https://render.com/docs/blueprint-spec و https://render.com/docs/free

لو اخترت مستقبلاً SQLite على Render بدلاً من Neon، يلزم **خطة تدعم Persistent Disk** مع `DATA_DIR=/var/data` والقرص عند `/var/data`؛ لا تستخدم SQLite على Render Free.

### Railway

استورد الحزمة/مستودعك بعد الموافقة، أو استخدم Dockerfile. أضف **Volume** واربطه `/var/data` مع `DATA_DIR=/var/data`، واضبط نفس متغيرات الأمان وHTTPS. الـ volume يُركب وقت التشغيل لا أثناء build. نسخة تشغيل واحدة. إذا واجهت صلاحيات Docker volume مع مستخدم node، اضبط ملكية مجلد البيانات؛ توثيق Railway يذكر `RAILWAY_RUN_UID=0` عند الحاجة لكن التشغيل غير root مع ملكية صحيحة أفضل.

المصدر: https://docs.railway.com/guides/volumes (تمت مراجعته أثناء البناء).

### VPS

شغّل Node 24 تحت systemd/مدير عمليات يعيد التشغيل تلقائياً، بمستخدم خدمة غير root. اجعل `DATA_DIR=/var/lib/ibw-orders` على قرص دائم يملكه المستخدم. مرّر المنفذ عبر Nginx أو Caddy مع شهادة TLS. عند proxy واحد فعّل `TRUST_PROXY=1` و`SECURE_COOKIES=true`، وامنع الوصول المباشر للمنفذ من الإنترنت. احتفظ بأسرار env خارج المستودع، وطبّق صلاحيات 600 عليها. راقب امتلاء القرص، النسخ الاحتياطية، وتنبيهات توقف الخدمة. لا تستخدم عدة replicas/عمليات كتابة مستقلة على أقراص مختلفة؛ انتقل لاحقاً إلى قاعدة مدارة عند الحاجة للتوسع.

Docker محلياً: ابنِ الصورة، واربط volume دائم `/var/data`، ومرّر env آمنة. لا تشغّل production بلا HTTPS لأن cookie الآمنة لن تعمل عبر HTTP.

## التثبيت على الهاتف وحدود النسخة

PWA فيها manifest وأيقونات PNG وmaskable وservice worker وشاشة بداية، وتُثبّت عبر Chrome على Android أو Safari → مشاركة → إضافة للشاشة الرئيسية على iPhone. يتطلب التثبيت HTTPS (localhost مستثنى محلياً). تُخزّن ملفات الواجهة والخطوط فقط للعمل بلا إنترنت؛ لا تُخزّن طلبات أو API أو بيانات شخصية في cache. إرسال الطلب ومتابعته يحتاجان اتصالاً؛ لا يوجد إرسال خلفي للطلبات.

ليست APK ولا تطبيقاً منشوراً على App Store/Google Play. النشر هناك يحتاج حسابات مطور، استضافة ونطاق HTTPS دائمين، سياسة خصوصية ووسائل دعم، تقييم متطلبات حذف الحساب والبيانات وسياسة الاحتفاظ، تغليف مناسب مثل Capacitor أو Trusted Web Activity، build وتوقيع واختبار فعلي على الأجهزة ومراجعة المتجر. لا تدعم النسخة الحالية حذف الحساب عبر الواجهة، لذلك يجب معالجة هذا المتطلب قبل نشر تطبيق متجر. لا يوجد إشعارات push أو رسائل واتساب آلية أو دفع إلكتروني.

## الاختبارات والصور والحزمة

`npm test`: اختبارات HTTP فعلية بواسطة curl: التسجيل، الدخول، الجلسات وCSRF، تحقق الحقول، إرسال طلب، فصل بيانات العملاء، تعبئة آخر طلب، حماية الإدارة، تصفية، تحديث الحالة وسجلها، CSV، تنزيل backup، منع الحذف وتعديل snapshot، bcrypt وmanifest. بيانات الاختبار وهمية وتبقى محفوظة.

`npm run test:smtp`: اختبار SMTP محلي على المنفذين 3001 و2525 مع قاعدة مؤقتة للحسابات فقط؛ لا يرسل أي بريد خارج الجهاز.

`npm run test:ui`: اختبارات DOM محلية باستخدام jsdom، لا تعتبر بديلاً عن اختبار هاتف/متصفح حقيقي.

مجلد `screenshots/` يحتوي صوراً أضافتها مراجعة بصرية لاحقة من الوكيل المنسّق. هذه الصور تسبق آخر تحسينات مساحة شريط التنقل وحجم النصوص وبانر الدخول؛ لم تُلتقط صور جديدة بعد هذه التعديلات. `npm run test:layout` يتحقق من قواعد التخطيط والنصوص في DOM، لكنه ليس بديلاً عن مراجعة متصفح بصرية. يوصى قبل النشر باختبار Chrome وSafari فعليين بعرض 390×844 وتصوير الدخول والتسجيل والنموذج والنجاح وطلباتي والإدارة.

الحزمة `/workspace/shein-orders.zip` ومستودع Git المحلي يستثنيان node_modules والبيانات الحية والنسخ الاحتياطية وكلمة مرور الإدارة وملف الجلسة السري وصور الشاشات التي قد تحتوي معلومات عميلات. تبقى الصور المحلية إن وُجدت خارج Git. عند فكها يتم إنشاء قاعدة جديدة فارغة، فلا تخلطها مع نسخة احتياطية من الطلبات. ملف `package-lock.json` موجود لإعادة تثبيت مطابق. خط Cairo مرفق مع رخصة SIL OFL في `public/fonts/OFL.txt`.

---

## English quick start

**IBW Orders** is an Arabic RTL, mobile-first installable PWA for forwarding SHEIN cart links. No catalog, no payment, no official SHEIN affiliation. Node 22+ (24 recommended), Express, SQLite locally or verified-TLS PostgreSQL via pg.Pool when DATABASE_URL is set, bcrypt, database-backed sessions, CSRF, rate limiting. Run `npm ci && npm start`; `/admin` uses `ADMIN_PASSWORD` or the generated private file. Set `SMTP_HOST` and `SMTP_FROM` plus SMTP credentials to enable email verification and reset; without SMTP verification is skipped.

Orders are immutable snapshots. SQLite triggers forbid deletion or changing submitted details and append a permanent status audit. Consistent backups run at startup and daily while the server runs; admin can create/download one. **Render Free + Neon:** use render.yaml, supply the pooled DATABASE_URL; ADMIN_PASSWORD and SESSION_SECRET are generated by Render and must remain stable. TLS is always verified. All tables and sessions live in Postgres; no filesystem backups are relied on. Admin downloads a consistent full JSON export; CSV is orders-only. Neon PITR is plan-limited (currently up to 6 hours on Free), not forever. For SQLite hosting instead, a persistent disk/volume and DATA_DIR are mandatory. Use HTTPS, secure cookies, trusted proxy settings, monitoring and encrypted off-host backups. Render Free sleeps after 15 minutes and blocks common SMTP ports; keep SMTP disabled unless delivery is verified. PostgreSQL schema/adapter/session contracts were tested with a mock and SQL parser, NOT a live server: apt repositories returned HTTP 500. A live Neon smoke test is required before launch. Existing SQLite data is not automatically imported into Neon. Unlimited retention requires ongoing storage capacity; no software can promise physical storage forever. This is a PWA, not an App Store/Play Store release. Public hosting, real-device visual tests, SMTP delivery validation, privacy policy, and store-specific account/deletion requirements still need completion. `npm test` uses curl and retains synthetic test orders. No public tunnel was created without explicit publication approval.
