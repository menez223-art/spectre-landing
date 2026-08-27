const { chromium } = require("playwright");
const { readFileSync } = require("fs");
const { createClient } = require("@supabase/supabase-js");
const { createHash } = require("crypto");
const env = {};
for (const line of readFileSync(".env.local","utf8").split("\n")){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();}
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const setKv=(k,v)=>sb.from("kv").upsert({key:k,value:v,updated_at:new Date().toISOString()},{onConflict:"key"});
(async()=>{
  const crypto=require("crypto");
  const pepper=(r)=>crypto.createHash("sha256").update(r+"|"+env.DEVICE_PEPPER).digest("hex");
  const BASE="https://spectre-tau-five.vercel.app";
  const FP="DIAG_"+Date.now(); const PEP=pepper(FP); const EMAIL=`diag_${Date.now()}@example.com`;
  const acc0=(await (await sb.from("kv").select("value").eq("key","studio-auth/account.json").maybeSingle()).data?.value)??{devices:[]};
  const setKv2=setKv;
  await setKv2(`studio-auth/devices/${PEP}.json`,{fingerprint:PEP,createdAt:new Date().toISOString()});
  await sb.from("kv").upsert({key:"studio-auth/account.json",value:{...acc0,devices:[...new Set([...(acc0.devices??[]),PEP])]},updated_at:new Date().toISOString()},{onConflict:"key"});
  await setKv2(`studio-auth/profiles/${PEP}.json`,{fingerprint:PEP,email:EMAIL,sheetUrl:null,sheetId:null,sheetKey:null,adminVerified:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  await setKv2(`subs/${EMAIL}.json`,{userId:EMAIL,plan:"basic",status:"active",maxProducts:1,maxImages:2,startsAt:new Date().toISOString(),expiresAt:null,reason:null,updatedAt:new Date().toISOString()});

  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:"ar"});
  const p=await ctx.newPage();
  p.on("console",m=>{ if(["error","warning"].includes(m.type())) console.log("[console]",m.type(),m.text().slice(0,150)); });
  p.on("pageerror",e=>console.log("[pageerror]",e.message.slice(0,200)));
  p.on("request",r=>{ if(r.url().includes("/api/")) console.log(">>",r.method(),r.url().replace(BASE,"")); });
  p.on("response",async r=>{ if(r.url().includes("/api/")){ let body=""; try{body=(await r.text()).slice(0,160);}catch{} console.log("<<",r.status(),r.url().replace(BASE,""),body);} });

  await page_flow();
  async function page_flow(){
    await p.route("**/api/auth/login", async route=>{
      try{
        const body = route.request().postDataJSON?.() || {};
        const fpReal = String(body.fingerprint || "");
        if(fpReal && fpReal.length >= 8 && !globalThis.__seeded){
          globalThis.__seeded = true;
          const PEP2 = pepper(fpReal);
          const accX = (await sb.from("kv").select("value").eq("key","studio-auth/account.json").maybeSingle()).data?.value ?? {devices:[]};
          await setKv2(`studio-auth/devices/${PEP2}.json`, {fingerprint:PEP2, createdAt:new Date().toISOString()});
          await sb.from("kv").upsert({key:"studio-auth/account.json", value:{...accX, devices:[...new Set([...(accX.devices??[]), PEP2])]}, updated_at:new Date().toISOString()}, {onConflict:"key"});
          await setKv2(`studio-auth/profiles/${PEP2}.json`, {fingerprint:PEP2, email:EMAIL, sheetUrl:null, sheetId:null, sheetKey:null, adminVerified:true, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()});
          await setKv2(`subs/${EMAIL}.json`, {userId:EMAIL, plan:"basic", status:"active", maxProducts:1, maxImages:2, startsAt:new Date().toISOString(), expiresAt:null, reason:null, updatedAt:new Date().toISOString()});
        }
      }catch(e){ console.log("[seed-err]", e.message); }
      await route.continue();
    });
    await p.goto(BASE+"/studio",{waitUntil:"domcontentloaded",timeout:60000});
    await p.locator("input[autocomplete='username']").first().fill("project");
    await p.locator("input[type='password']").first().fill("SPECTRE");
    await p.getByRole("button",{name:/^(دخول|Sign in)$/i}).first().click();
    await p.getByText(/منتجات الصفحة|Page products/).first().waitFor({timeout:30000});
    console.log("--- المحرر ظاهر ---");
    await p.getByText(/اربط بريدك|Link your email/).first().waitFor({state:"hidden",timeout:25000}).catch(()=>console.log("!! بانر القفل ما زال ظاهراً بعد 25ث"));
    const lockVisible = await p.getByText(/اربط بريدك|Link your email/).first().isVisible().catch(()=>false);
    console.log("بانر القفل ظاهر؟", lockVisible);
    await p.getByPlaceholder(/سماعات لاسلكية برو|e\.g\. Pro wireless/i).first().fill("تشخيص إنتاج");
    await p.locator("input[placeholder='4500']").first().fill("4500");
    await p.getByRole("button",{name:/رابط صورة|Image URL/}).first().click();
    await p.locator("input[placeholder='https://example.com/product.jpg']").first().fill(BASE+"/FB.png");
    await p.getByRole("button",{name:/استخدام الرابط|Use URL/}).first().click();
    await p.waitForTimeout(3000);
    const imgState = await p.evaluate(()=>{
      const imgs=Array.from(document.querySelectorAll("img")).filter(i=>i.src.startsWith("http")&&i.src.includes("FB.png"));
      return imgs.map(i=>({ok:i.complete&&i.naturalWidth>0,w:i.naturalWidth}));
    });
    console.log("صورة FB.png:", JSON.stringify(imgState));
    const pubBtn = p.getByRole("button",{name:/نشر رابط مباشر|Publish direct link/}).first();
    console.log("زر النشر disabled؟", await pubBtn.isDisabled());
    const [resp] = await Promise.allSettled([
      p.waitForResponse(r=>r.url().includes("/api/publish")&&r.request().method()==="POST",{timeout:45000}),
      pubBtn.click(),
    ]);
    if(resp.status==="fulfilled"){ console.log("POST publish ->", resp.value.status()); }
    else {
      console.log("!!! لا استجابة POST خلال المهلة — لقطة حالة:");
      const errText = await p.evaluate(()=>{
        const el=document.querySelector(".border-red-400\\/30, [class*='red-50']");
        return el?(el.textContent||"").slice(0,200):"لا نص خطأ ظاهر";
      });
      console.log("نص الخطأ الظاهر:", errText);
      const btnState = await pubBtn.evaluate(b=>({disabled:b.disabled,text:b.textContent}));
      console.log("زر النشر بعد المحاولة:",JSON.stringify(btnState));
      const publishing = await p.getByText(/جارٍ|Publishing/).count();
      console.log("مؤشر جارٍ النشر ظاهر؟",publishing);
      await p.screenshot({path:"scripts/_diag-fail.png",fullPage:false});
      console.log("لقطة: scripts/_diag-fail.png");
    }
  }

  // تنظيف
  const a2=(await (await sb.from("kv").select("value").eq("key","studio-auth/account.json").maybeSingle()).data?.value)??{devices:[]};
  await sb.from("kv").upsert({key:"studio-auth/account.json",value:{...a2,devices:(a2.devices??[]).filter(d=>d!==PEP)},updated_at:new Date().toISOString()},{onConflict:"key"});
  await sb.from("kv").delete().eq("key",`studio-auth/devices/${PEP}.json`);
  await sb.from("kv").delete().eq("key",`studio-auth/profiles/${PEP}.json`);
  await sb.from("kv").delete().eq("key",`subs/${EMAIL}.json`);
  await b.close();
})().catch(e=>{console.error("FATAL:",e.message.split("\n")[0]);process.exit(1);});
