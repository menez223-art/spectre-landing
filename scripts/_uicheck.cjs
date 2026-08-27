const { chromium } = require("playwright");
const { readFileSync } = require("fs");
const { createClient } = require("@supabase/supabase-js");
const { createHash } = require("crypto");
const env = {};
for (const line of readFileSync(".env.local","utf8").split("\n")){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const pepper=(r)=>createHash("sha256").update(r+"|"+env.DEVICE_PEPPER).digest("hex");
(async()=>{
  const FP="UISEC_"+Date.now(); const PEP=pepper(FP); const EMAIL=`uisek_${Date.now()}@example.com`;
  const acc0=(await (await sb.from("kv").select("value").eq("key","studio-auth/account.json").maybeSingle()).data?.value)??{devices:[]};
  const setKv=(k,v)=>sb.from("kv").upsert({key:k,value:v,updated_at:new Date().toISOString()},{onConflict:"key"});
  await setKv(`studio-auth/devices/${PEP}.json`,{fingerprint:PEP,createdAt:new Date().toISOString()});
  await sb.from("kv").upsert({key:"studio-auth/account.json",value:{...acc0,devices:[...new Set([...(acc0.devices??[]),PEP])]},updated_at:new Date().toISOString()},{onConflict:"key"});
  await setKv(`studio-auth/profiles/${PEP}.json`,{fingerprint:PEP,email:EMAIL,sheetUrl:null,sheetId:null,sheetKey:null,pixelId:null,whatsapp:null,storeName:null,adminVerified:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  await setKv(`subs/${EMAIL}.json`,{userId:EMAIL,plan:"gold",status:"active",maxProducts:10,maxImages:10,startsAt:new Date().toISOString(),expiresAt:null,reason:null,updatedAt:new Date().toISOString()});

  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:"ar"});
  const p=await ctx.newPage();
  p.on("pageerror",e=>console.log("[pageerror]",e.message.slice(0,150)));
  await p.goto("http://localhost:3000/studio",{waitUntil:"domcontentloaded",timeout:60000});
  await p.locator("input[autocomplete='username']").first().fill("project");
  await p.locator("input[type='password']").first().fill("SPECTRE");
  await p.getByRole("button",{name:/^(دخول|Sign in)$/i}).first().click();
  await p.getByText(/منتجات الصفحة|Page products/).first().waitFor({timeout:30000});
  console.log("✓ داخل الاستوديو");
  // افتح الإعدادات ⚙
  await p.getByRole("button",{name:/الإعدادات|settings/i}).first().click();
  await p.waitForTimeout(1500);
  const dlg = p.locator("[role='dialog'][aria-modal='true']").first();
  console.log("الإعدادات مفتوحة:", await dlg.count() > 0 ? "نعم" : "لا");
  // ابحث عن أقسام التسويق
  const mkt = await dlg.getByText(/التسويق \(اختياري\)|Marketing \(optional\)/).count();
  const pix = await dlg.getByText(/Meta Pixel/).count();
  const waField = await dlg.getByText(/واتساب استلام الطلبات|WhatsApp number for orders/).count();
  const storeNm = await dlg.getByText(/اسم متجرك|Your store name/).count();
  const saveBtn = await dlg.getByRole("button",{name:/حفظ|Save/i}).count();
  console.log(`قسم التسويق=${mkt} | خانة البيكسل=${pix} | خانة الواتساب=${waField} | خانة اسم المتجر=${storeNm} | زر حفظ=${saveBtn}`);
  await p.screenshot({path:"scripts/_settings-view.png",fullPage:false});
  console.log("لقطة: scripts/_settings-view.png");
  await b.close();
  // تنظيف
  const a2=(await (await sb.from("kv").select("value").eq("key","studio-auth/account.json").maybeSingle()).data?.value)??{devices:[]};
  await sb.from("kv").upsert({key:"studio-auth/account.json",value:{...a2,devices:(a2.devices??[]).filter(d=>d!==PEP)},updated_at:new Date().toISOString()},{onConflict:"key"});
  await sb.from("kv").delete().eq("key",`studio-auth/devices/${PEP}.json`);
  await sb.from("kv").delete().eq("key",`studio-auth/profiles/${PEP}.json`);
  await sb.from("kv").delete().eq("key",`subs/${EMAIL}.json`);
  console.log("تنظيف: تم");
})().catch(e=>{console.error("FATAL:",e.message.split("\n")[0]);process.exit(1);});
