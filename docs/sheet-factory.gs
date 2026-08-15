/************************************************************
 * Sheet Factory — استوديو صفحات الهبوط
 * سكريبت مستقل (Standalone) يُنشر كـ Web App:
 *   Deploy ← New deployment ← Web app
 *   Execute as: Me   ·   Who has access: Anyone
 *
 * ⚙️ قبل النشر: قيمة SECRET أدناه هي نفسها FACTORY_SECRET
 *    على Vercel. لا تغيّرها بعد النشر ما لم تحدّث الطرفين.
 *
 * الوظائف:
 *   1) إنشاء جدول مستقل تمامًا لكل بريد يدخله مستخدم
 *      (بترويسة الأعمدة العشر) ومشاركته مع البريد.
 *   2) تسجيل طلبات كل مستخدم في جدوله عبر ?key=...
 *   3) عمود "اسم المنتج" يُملأ تلقائيًا من إعدادات الصفحة.
 ************************************************************/

var SECRET = "664a8e25d3cd0c916c023dec821d39830112daa3fdfd9c779f7c018dcd9c78fc";

var ANNOUNCE_ENDPOINT = "https://spectre-tau-five.vercel.app/api/sheet/announce";

var HEADERS = [
  "الاسم (Name)",
  "رقم الهاتف (Phone)",
  "الولاية (State)",
  "البلدية (City)",
  "الكمية (Quantity)",
  "مكان الاستلام (Delivery Method)",
  "السعر الإجمالي (Total Price)",
  "حالة الطلبية (Order Status)",
  "تاريخ ووقت (Date & Time)",
  "اسم المنتج (Product Name)"
];

// عمود الطابع الزمني (يُملأ تلقائيًا عند كل إدخال جديد)
var DATE_HEADER = "تاريخ ووقت (Date & Time)";

// عمود اسم المنتج (يُملأ تلقائيًا من إعدادات الصفحة — دون إدخال يدوي)
var PRODUCT_HEADER = "اسم المنتج (Product Name)";

// يتأكد من وجود عمود في الرأس — يُلحقه نهاية الصف إن كان الجدول قديمًا
function ensureColumn(sh, header) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) return;
  for (var c = 1; c <= lastCol; c++) {
    if (sh.getRange(1, c).getValue() === header) return; // موجود مسبقًا
  }
  sh.getRange(1, lastCol + 1).setValue(header);
}

function timestampNow() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}

function doGet(e) {
  announceSelf();
  return textOut("Factory OK");
}

function doPost(e) {
  try {
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        return errOut("bad_json");
      }
    }
    if (data.action === "create_sheet") return createSheet(data);
    if (data.action === "lookup") return lookupSheet(data);
    announceSelf();
    return logOrder(e, data);
  } catch (err) {
    return errOut("err:" + err.message);
  }
}

// ── إنشاء جدول مستقل للبريد — يرد المفتاح نفسه عند التكرار ──
function createSheet(data) {
  if (data.secret !== SECRET) return errOut("bad_secret");
  var email = String(data.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return errOut("bad_email");

  var props = PropertiesService.getScriptProperties();
  var existingRaw = props.getProperty("email:" + email);
  if (existingRaw) {
    var existing = JSON.parse(existingRaw);
    return jsonOut({ ok: true, key: existing.key, sheetId: existing.sheetId, url: existing.url });
  }

  var key = Utilities.getUuid();
  var ss = SpreadsheetApp.create("Studio — " + email);
  var sheet = ss.getSheetByName("Sheet1") || ss.insertSheet("Sheet1");
  sheet.setName("Orders");
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  ensureColumn(sheet, DATE_HEADER);
  ensureColumn(sheet, PRODUCT_HEADER);
  try {
    ss.addEditor(email); // مشاركة الجدول مع صاحب البريد
  } catch (ignore) {}

  var url = ScriptApp.getService().getUrl() + "?key=" + encodeURIComponent(key);
  props.setProperty("key:" + key, JSON.stringify({ email: email, sheetId: ss.getId() }));
  props.setProperty("email:" + email, JSON.stringify({ key: key, sheetId: ss.getId(), url: url }));

  return jsonOut({ ok: true, key: key, sheetId: ss.getId(), url: url });
}

// ── حلّ رابط الجدول الحيّ بناءً على الهوية الثابتة ──
function lookupSheet(data) {
  if (data.secret !== SECRET) return errOut("bad_secret");

  var props = PropertiesService.getScriptProperties();
  var rec = null;
  if (data.key) {
    var byKey = props.getProperty("key:" + data.key);
    if (byKey) rec = JSON.parse(byKey);
  } else if (data.email) {
    var email = String(data.email).trim().toLowerCase();
    var byEmail = props.getProperty("email:" + email);
    if (byEmail) rec = JSON.parse(byEmail);
  }
  if (!rec) return errOut("not_found");

  var url = ScriptApp.getService().getUrl();
  if (rec.key) url += "?key=" + encodeURIComponent(rec.key);
  return jsonOut({ ok: true, key: rec.key, sheetId: rec.sheetId, url: url });
}

// ── تسجيل طلب في جدول صاحبه عبر المفتاح الموجود في الرابط ──
function logOrder(e, data) {
  var key = (e && e.parameter && e.parameter.key) || data.key || "";
  if (!key) return errOut("bad_key");

  var props = PropertiesService.getScriptProperties();
  var recRaw = props.getProperty("key:" + key);
  if (!recRaw) return errOut("bad_key");
  var rec = JSON.parse(recRaw);

  var target = SpreadsheetApp.openById(rec.sheetId);
  var sh = target.getSheetByName("Orders") || target.getSheetByName("Sheet1");
  if (!sh) sh = target.insertSheet("Orders");
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  ensureColumn(sh, DATE_HEADER);
  ensureColumn(sh, PRODUCT_HEADER);

  sh.appendRow([
    str(data.name),
    str(data.phone),
    str(data.wilaya),
    str(data.commune),
    str(data.quantity),
    str(data.deliveryType),
    str(data.totalPrice),
    str(data.status) || "جديد",
    timestampNow(),
    str(data.product)
  ]);
  return textOut("OK");
}

function str(v) {
  return v !== undefined && v !== null ? String(v) : "";
}

function announceSelf() {
  try {
    var endpoint = ANNOUNCE_ENDPOINT;
    if (!endpoint) return;
    var url = ScriptApp.getService().getUrl();
    var payload = JSON.stringify({ secret: SECRET, url: url });
    var opts = {
      method: "post",
      contentType: "application/json",
      payload: payload,
      muteHttpExceptions: true
    };
    UrlFetchApp.fetch(endpoint, opts);
  } catch (ignore) {
    // فشل الإعلان لا يجب أن يكسر تسجيل الطلب
  }
}

function textOut(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT);
}
function jsonOut(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function errOut(msg) {
  return textOut("ERR " + msg);
}
