from pathlib import Path
from playwright.sync_api import sync_playwright

profile_dir = Path(__file__).resolve().parent.parent / "wadata"
profile_dir.mkdir(exist_ok=True)

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=str(profile_dir),
        headless=False
    )
    page = context.new_page()
    page.goto("https://web.whatsapp.com/", timeout=0)
    print("WhatsApp chargé, prêt.")
    page.wait_for_event("close", timeout=0)
