from playwright.sync_api import sync_playwright
import pathlib
import time

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
    
    print("🚀 Starting comprehensive test...")
    
    # 1. Home page
    page.goto("http://localhost:3001", wait_until="networkidle")
    page.wait_for_timeout(2000)
    shot(page, "01_home")
    
    # 2. Click "Create new page" -> Studio
    page.click('a[href="/studio"]')
    page.wait_for_url("**/studio**")
    page.wait_for_timeout(2000)
    shot(page, "02_studio_landing")
    
    # 3. Studio page - fill product form
    # Wait for form to load
    page.wait_for_selector('input[name="productName"], input[placeholder*="product"], input[placeholder*="منتج"], textarea', timeout=10000)
    
    # Fill product details
    page.fill('input[name="productName"], input[placeholder*="product" i], input[placeholder*="منتج" i]', "حذاء رياضي ذكي")
    page.wait_for_timeout(500)
    
    # Price
    page.fill('input[name="price"], input[placeholder*="price" i], input[placeholder*="سعر" i]', "4500")
    page.wait_for_timeout(500)
    
    # Description
    page.fill('textarea[name="description"], textarea[placeholder*="description" i], textarea[placeholder*="وصف" i]', "حذاء رياضي بتقنية ذكية يتتبع خطواتك ويحلل أداءك")
    page.wait_for_timeout(500)
    
    shot(page, "03_studio_filled")
    
    # 4. Upload image - find file input
    # Create a test image
    import base64
    test_img = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
    # Actually let's skip file upload for now and use a URL or skip
    
    # 5. Click Generate/Create button
    page.click('button:has-text("Generate"), button:has-text("Create"), button:has-text("إنشاء"), button[type="submit"]')
    page.wait_for_timeout(3000)
    shot(page, "04_after_generate")
    
    # 6. Check if landing page generated - navigate to it
    # Look for preview link or generated page
    page.goto("http://localhost:3001/studio", wait_until="networkidle")
    page.wait_for_timeout(2000)
    shot(page, "05_studio_after")
    
    # 7. Test Admin login if exists
    page.goto("http://localhost:3001/admin", wait_until="networkidle")
    page.wait_for_timeout(2000)
    shot(page, "06_admin_page")
    
    # 8. Test Products catalog
    page.goto("http://localhost:3001/#catalog", wait_until="networkidle")
    page.wait_for_timeout(2000)
    shot(page, "07_catalog")
    
    # 9. Test dark mode toggle
    page.goto("http://localhost:3001", wait_until="networkidle")
    page.click('button[aria-label*="ليلي"], button[title*="ليلي"], button:has-text("ليلي")')
    page.wait_for_timeout(1000)
    shot(page, "08_dark_mode")
    
    # 10. Test RTL/Language toggle
    page.click('button:has-text("عربي")')
    page.wait_for_timeout(1000)
    shot(page, "09_arabic_toggle")
    
    browser.close()
    print("✅ Test complete!")