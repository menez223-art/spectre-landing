// فاحص العينات — تشغيل: node design-samples/check.mjs file1.html file2.html ...
// يفحص: لا روابط خارجية · تكافؤ data-en/data-ar · لا إيموجي · الأصول والأزرار موجودة.
import { readFileSync } from "node:fs";

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{FE0F}\u{20E3}]/gu;
const SYMBOLS = /[\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{2190}-\u{21FF}\u{221E}\u{200D}]/gu;
const ASSETS = ["assets/css/fontawesome.css", "assets/css/fonts.css", "assets/css/tokens.css", "assets/js/shared.js"];

let allPass = true;
const files = process.argv.slice(2);
if (!files.length) { console.log("usage: node design-samples/check.mjs <file.html> ..."); process.exit(2); }

for (const f of files) {
  const html = readFileSync(f, "utf8");
  const errors = [], warnings = [];

  // 1) روابط خارجية
  const ext = html.match(/(?:src|href)\s*=\s*["']https?:\/\/[^"']+/gi) || [];
  const extCss = html.match(/url\(\s*["']?https?:\/\/[^)]+/gi) || [];
  if (ext.length || extCss.length) errors.push(`external refs: ${[...ext, ...extCss].slice(0, 5).join(" | ")}`);

  // 2) تكافؤ data-en / data-ar على نفس الوسم
  const tags = html.match(/<[^>]+>/g) || [];
  let mismatch = 0;
  for (const t of tags) {
    const en = /\bdata-en\s*=/.test(t), ar = /\bdata-ar\s*=/.test(t);
    const enPh = /\bdata-en-ph\s*=/.test(t), arPh = /\bdata-ar-ph\s*=/.test(t);
    if (en !== ar) mismatch++;
    if (enPh !== arPh) mismatch++;
  }
  if (mismatch) errors.push(`data-en/data-ar mismatch on ${mismatch} tag(s)`);

  // 3) إيموجي
  const emo = html.match(EMOJI) || [];
  if (emo.length) errors.push(`emoji found: ${[...new Set(emo)].join(" ")}`);

  // 4) رموز (تحذير — قد تكون أسهماً نصية مقصودة)
  const sym = html.match(SYMBOLS) || [];
  if (sym.length) warnings.push(`symbols (review): ${[...new Set(sym)].join(" ")}`);

  // 5) الأصول المطلوبة
  for (const a of ASSETS) if (!html.includes(a)) errors.push(`missing asset ref: ${a}`);

  // 6) أزرار التحكم
  if (!/id\s*=\s*["']themeBtn["']/.test(html)) errors.push("missing #themeBtn");
  if (!/id\s*=\s*["']langBtn["']/.test(html)) errors.push("missing #langBtn");
  if (!/<title>/.test(html)) errors.push("missing <title>");

  const pass = errors.length === 0;
  if (!pass) allPass = false;
  console.log(`${pass ? "PASS" : "FAIL"}  ${f}`);
  for (const e of errors) console.log(`   ERROR: ${e}`);
  for (const w of warnings) console.log(`   WARN:  ${w}`);
}
console.log(allPass ? "\nALL PASS" : "\nSOME FAILED");
process.exit(allPass ? 0 : 1);
