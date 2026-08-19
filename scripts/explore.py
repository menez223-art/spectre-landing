from playwright.sync_api import sync_playwright
import pathlib

OUT_DIR = pathlib.Path("C:/Users/C-Ron/AppData/Local/hermes/audio_cache/test_run")
OUT_DIR.mkdir(parents=True, exist_ok=True)

def shot(page, name):
    path = OUT_DIR / f"{name}.png"
    page.screenshot(path=str(path), full_page=True)
    print(f"📸 {name}: {path}")
    return path

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False, slow_mo=500)
    page = browser.new_page(viewport={"width": 1366, "height": 900})
    
    print("🚀 Starting exploratory test...")
    
    # 1. Home page
    page.goto("http://localhost:3001", wait_until="networkidle")
    page.wait_for_timeout(2000)
    shot(page, "01_home")
    
    # 2. Click "Create new page" -> Studio
    page.click('a[href="/studio"]')
    page.wait_for_url("**/studio**")
    page.wait_for_timeout(3000)
    shot(page, "02_studio_landing")
    
    # 3. Explore studio page - dump all interactive elements
    print("\n=== Studio Page Elements ===")
    inputs = page.locator('input, textarea, select, button, a').all()
    for i, el in enumerate(inputs[:30]):
        try:
            tag = el.evaluate("el => el.tagName.toLowerCase()")
            typ = el.get_attribute("type") or ""
            ph = el.get_attribute("placeholder") or ""
            name = el.get_attribute("name") or ""
            txt = el.inner_text()[:50] if tag in ['button', 'a'] else ""
            print(f"  [{i}] <{tag} type={typ} name={name} placeholder={ph}> {txt}")
        except:
            pass
    
    # Also check for file inputs
    file_inputs = page.locator('input[type="file"]').all()
    print(f"\nFile inputs found: {len(file_inputs)}")
    
    # 4. Check page content
    content = page.content()
    with open(OUT_DIR / "studio_html.html", "w", encoding="utf-8") as f:
        f.write(content)
    print(f"\nHTML saved to {OUT_DIR / 'studio_html.html'}")
    
    browser.close()
    print("✅ Exploration complete!")