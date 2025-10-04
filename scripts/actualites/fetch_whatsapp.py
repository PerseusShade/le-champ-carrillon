from pathlib import Path
import re, json, base64, time
from playwright.sync_api import sync_playwright
from datetime import datetime, timedelta
from bs4 import BeautifulSoup, NavigableString, Tag

TARGET_CHAT_NAME = "Le Champ Carrillon"
NOMBRE_MESSAGES  = 2

BASE_DIR    = Path(__file__).resolve().parent.parent.parent
PROFILE_DIR = BASE_DIR / "scripts" / "wadata"
OUTPUT_BASE = BASE_DIR / "assets" / "actualites"
PROFILE_DIR.mkdir(exist_ok=True, parents=True)
OUTPUT_BASE.mkdir(exist_ok=True, parents=True)

def resolve_whatsapp_date_label(label: str) -> str:
    label = label.lower().strip()
    if "aujourd" in label:
        return datetime.now().strftime("%Y_%m_%d")
    if "hier" in label:
        return (datetime.now() - timedelta(days=1)).strftime("%Y_%m_%d")
    weekdays = ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"]
    for i, day in enumerate(weekdays):
        if day in label:
            delta = (datetime.now().weekday() - i) % 7 or 7
            return (datetime.now() - timedelta(days=delta)).strftime("%Y_%m_%d")
    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", label)
    if m:
        d, mo, ye = m.groups()
        ye = "20"+ye if len(ye)==2 else ye
        return datetime(int(ye),int(mo),int(d)).strftime("%Y_%m_%d")
    return "unknown_date"

def extract_date(msg):
    labels = msg.locator('xpath=preceding::div[contains(@class,"x1n2onr6")]//span')
    for i in range(labels.count()-1, max(labels.count()-6, -1), -1):
        raw = labels.nth(i).inner_text().strip()
        if raw and not any(w in raw.lower() for w in ("admin","vous êtes","désormais")):
            dr = resolve_whatsapp_date_label(raw)
            if dr != "unknown_date":
                return dr
    return datetime.now().strftime("%Y_%m_%d")

def save_image(src: str, path: Path, page) -> None:
    if src.startswith("data:"):
        header,b64 = src.split(",",1)
        ext = header.split("/")[1].split(";")[0]
        path.with_suffix("."+ext).write_bytes(base64.b64decode(b64))
    elif src.startswith("blob:"):
        arr = page.evaluate(
            """async url => {
                const r = await fetch(url);
                const b = await r.arrayBuffer();
                return Array.from(new Uint8Array(b));
            }""", src
        )
        path.with_suffix(".png").write_bytes(bytearray(arr))
    else:
        r = page.request.get(src)
        ext = src.split(".")[-1].split("?")[0]
        path.with_suffix("."+ext).write_bytes(r.body())

def is_deleted_message(msg) -> bool:
    if msg.locator('svg[title="recalled"]').count() > 0:
        return True
    deleted_text = msg.locator("div._akbu")
    if deleted_text.count() > 0:
        text = deleted_text.first.inner_text().strip().lower()
        if "supprimé" in text:
            return True
    return False

def is_empty_message(msg) -> bool:
    has_text = msg.locator("span.selectable-text").count() > 0
    has_image = msg.locator('img[src^="blob:"], img[src^="https://"]').count() > 0
    return not (has_text or has_image)


with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR),
        headless=False,
        args=["--window-position=0,0"]
    )
    page = ctx.new_page()
    page.goto("https://web.whatsapp.com/")
    input("WhatsApp chargé, prêt ; continue ?")
    page.locator("div[aria-label=\"Liste des discussions\"]").first.wait_for(state="visible", timeout=60000)
    page.click(f"span[title=\"{TARGET_CHAT_NAME}\"]")
    page.wait_for_timeout(2000)

    msgs = page.locator("div.message-in, div.message-out")
    to_proc = min(msgs.count(), NOMBRE_MESSAGES)

    processed = 0
    offset = -1
    while processed < NOMBRE_MESSAGES:
        msg = msgs.nth(offset)
        if is_deleted_message(msg) or is_empty_message(msg):
            offset -= 1
            continue
        date = extract_date(msg)

        idx = 0
        while (OUTPUT_BASE/f"{date}_{idx}").exists():
            idx += 1
        out_dir = OUTPUT_BASE/f"{date}_{idx}"
        (out_dir/"image").mkdir(parents=True)

        expanded = False
        for sel in ('.read-more-button', 'text=Voir plus', 'text=See more'):
            btn = msg.locator(sel)
            if btn.count() > 0:
                try:
                    btn.first.click()
                    try:
                        btn.first.wait_for(state="detached", timeout=2000)
                    except Exception:
                        page.wait_for_timeout(150)
                except Exception:
                    pass
                expanded = True
                break

        if expanded:
            page.wait_for_timeout(150)


        txt = msg.locator("span.selectable-text")
        if txt.count():
            raw_html = txt.first.inner_html().strip()
            soup = BeautifulSoup(raw_html, "html.parser")
            allowed = {"ul","li","strong","em","code","br"}
            for tag in soup.find_all(True):
                if tag.name in allowed: tag.attrs = {}
                else: tag.unwrap()
            new_soup = BeautifulSoup("", "html.parser")
            for elem in soup.contents:
                if isinstance(elem, NavigableString):
                    for para in re.split(r'\n\s*\n', elem.strip()):
                        if para.strip():
                            p = new_soup.new_tag("p")
                            p.string = para.strip()
                            new_soup.append(p)
                else:
                    new_soup.append(elem)
            while new_soup.contents:
                fe = new_soup.contents[0]
                if isinstance(fe, Tag) and fe.get_text(strip=True):
                    t = fe.get_text(strip=True).lower()
                    jours = "lundi mardi mercredi jeudi vendredi samedi dimanche".split()
                    if any(t.startswith(j) for j in jours) and re.search(r"\d{1,2} .* \d{4}", t):
                        fe.extract()
                        continue
                    break
                if isinstance(fe, NavigableString) and not fe.strip(): fe.extract()
                elif isinstance(fe, Tag) and fe.name == "br": fe.extract()
                else: break
            (out_dir/"texte.html").write_text(str(new_soup), "utf-8")

        visible = msg.locator('img[src^="blob:"], img[src^="https://"]').count()
        plus    = msg.locator('xpath=.//span[starts-with(normalize-space(.), "+")]')
        extra   = int(plus.first.inner_text().lstrip("+")) if plus.count() else 0
        total   = visible + extra
        saved   = 0

        if extra:
            msg.locator('img[src^="blob:"], img[src^="https://"]').nth(0).click()
            page.locator('div[role="list"][aria-label="Liste des médias"]').wait_for(state="visible", timeout=5000)
            page.locator('img[draggable="true"][src^="blob:"]').first.focus()

            for rel in range(1, total):
                modal = page.locator('img[draggable="true"][src^="blob:"]').first
                modal.wait_for(state="visible", timeout=10000)
                hd_src = modal.get_attribute("src")
                save_image(hd_src, out_dir/"image"/f"{rel:02d}", page)
                saved += 1

                if rel < total-1:
                    page.keyboard.press("ArrowRight")

                    old_src = hd_src
                    timeout = 10.0
                    interval = 0.2
                    elapsed = 0.0
                    while elapsed < timeout:
                        new_src = modal.get_attribute("src")
                        if new_src != old_src:
                            break
                        time.sleep(interval)
                        elapsed += interval
                    else:
                        raise RuntimeError("Le src de l'image n'a pas changé après 10 s")

            page.locator('button[aria-label="Fermer"]').first.click()
            page.locator('div[role="list"][aria-label="Liste des médias"]').wait_for(state="detached", timeout=2000)

        else:
            imgs = msg.locator('img[src^="blob:"], img[src^="https://"]')
            for j in range(visible):
                src = imgs.nth(j).get_attribute("src") or ""
                if src and not src.lower().endswith(".gif"):
                    save_image(src, out_dir/"image"/f"{j+1:02d}", page)
                    saved += 1

        (out_dir/"json.txt").write_text(json.dumps({"image_count": saved}, indent=2), "utf-8")
        print(f"{out_dir.name} → {saved} images")

        processed += 1
        offset -= 1

    print("Terminé")
    ctx.close()
