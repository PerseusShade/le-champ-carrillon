import json
from pathlib import Path
from datetime import datetime

try:
    from babel.dates import format_date
    BABEL_AVAILABLE = True
except Exception:
    BABEL_AVAILABLE = False

REPO_ROOT = Path(__file__).resolve().parents[1]
INPUT_BASE = REPO_ROOT / "assets" / "actualites"
MANIFEST_PATH = REPO_ROOT / "assets" / "img" / "actualite" / "manifest.json"

def human_date_from_str(yyyy_mm_dd: str) -> str:
    try:
        dt = datetime.strptime(yyyy_mm_dd, "%Y_%m_%d")
        if BABEL_AVAILABLE:
            return format_date(dt, "EEEE d MMMM y", locale="fr_FR").capitalize()
        else:
            return dt.strftime("%d/%m/%Y")
    except Exception:
        return yyyy_mm_dd

def collect_entries():
    entries = []
    if not INPUT_BASE.exists():
        return entries
    folders = sorted([p for p in INPUT_BASE.iterdir() if p.is_dir()], reverse=True)
    for folder in folders:
        parts = folder.name.split("_")
        if len(parts) < 3:
            date_label = folder.name
        else:
            date_label = "_".join(parts[:3])
        texte_path = folder / "texte.html"
        texte_rel = str(texte_path.relative_to(REPO_ROOT)).replace("\\", "/") if texte_path.exists() else ""
        img_dir = folder / "image"
        images = []
        if img_dir.exists():
            for img in sorted(img_dir.glob("*.*")):
                images.append(str(img.relative_to(REPO_ROOT)).replace("\\", "/"))
        date_human = human_date_from_str(date_label)
        entry = {
            "id": folder.name,
            "date": date_label,
            "date_human": date_human,
            "texte": texte_rel,
            "images": images,
        }
        entries.append(entry)
    return entries

def main():
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    entries = collect_entries()
    MANIFEST_PATH.write_text(json.dumps(entries, ensure_ascii=False, indent=4), encoding="utf-8")
    print(f"Manifest generated -> {MANIFEST_PATH} (entries={len(entries)})")

if __name__ == "__main__":
    main()
