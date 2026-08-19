from playwright.sync_api import sync_playwright
import pathlib

out = pathlib.Path("C:/Users/C-Ron/AppData/Local/hermes/audio_cache/home.png")
out.parent.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1366, "height": 900})
    pg.goto("http://localhost:3001", wait_until="networkidle")
    pg.wait_for_timeout(2500)
    pg.screenshot(path=str(out), full_page=False)
    b.close()
    print("SAVED:", out)
