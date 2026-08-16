// سكربت حرق رابط احتياطي (GitHub Pages): يجلب SHA للملف ثم يحذفه (DELETE)
// عبر GitHub Contents API — لتصبح الصفحة 404 فوراً. لا يطبع أي سرّ.
const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || "main";
const slug = "c9c4f343a0";
const path = `p/${slug}.html`;
const url = `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(path)}`;

const get = await fetch(url, {
  headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" },
});
console.log("get_status", get.status);
if (!get.ok) {
  console.log("result", "file_not_found_or_unreachable");
  process.exit(0);
}
const j = await get.json();
const sha = j.sha;
console.log("has_sha", Boolean(sha));

const del = await fetch(url, {
  method: "DELETE",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ message: `burn fallback link ${slug}`, sha, branch: BRANCH }),
});
console.log("delete_status", del.status);
const body = await del.text().catch(() => "");
console.log("result", del.ok ? "burned" : "failed:" + body.slice(0, 90));
