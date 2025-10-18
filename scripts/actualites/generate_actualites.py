import locale
from pathlib import Path
from datetime import datetime
from babel.dates import format_date

BASE_DIR    = Path(__file__).resolve().parent.parent.parent
INPUT_BASE  = BASE_DIR / "assets" / "actualites"
OUTPUT_FILE = BASE_DIR / "actualites" / "index.html"

locale.setlocale(locale.LC_TIME, "fr_FR.UTF-8")

def human_date(yyyy_mm_dd: str) -> str:
    dt = datetime.strptime(yyyy_mm_dd, "%Y_%m_%d")
    return format_date(dt, "EEEE d MMMM y", locale="fr_FR").capitalize()

posts = []
for dossier in sorted(INPUT_BASE.iterdir(), reverse=True):
    if not dossier.is_dir():
        continue

    parts = dossier.name.split("_")
    if len(parts) < 3:
        date_label = dossier.name
    else:
        date_label = "_".join(parts[:3])

    try:
        date_humain = human_date(date_label)
    except Exception:
        date_humain = date_label

    texte_file = dossier / "texte.html"
    texte = texte_file.read_text(encoding="utf-8") if texte_file.exists() else ""

    img_dir = dossier / "image"
    imgs = sorted(img_dir.glob("*.*"))
    rel_imgs = [ "/" + str(p.relative_to(BASE_DIR)).replace("\\","/") for p in imgs ]

    posts.append({
        "date":  date_humain,
        "texte": texte,
        "images": rel_imgs,
    })

OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
with OUTPUT_FILE.open("w", encoding="utf-8") as f:
    f.write("""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>Actualités — Le Champ Carillon</title>
    <link rel="stylesheet" href="../assets/css/header.css">
    <link rel="stylesheet" href="../assets/css/layout.css">
    <link rel="stylesheet" href="../assets/css/actualites.css">
    <link rel="stylesheet" href="../assets/css/overlay.css">
</head>
<body>
    <div id="header"></div>
    <script src="../assets/js/loadHeader.js" defer></script>
    <div class="scroll-container">
        <main class="actualites">
            <h1 class="actualites-title fade-in">Actualités</h1>
""")
    for post in posts:
        has_photos = bool(post["images"])
        f.write(f'''
        <section class="post fade-in">
            <header class="post-header">{post["date"]}</header>
            <div class="post-body{' has-images' if has_photos else ''}">
                <div class="post-text">
                    {post["texte"]}
                </div>''')
        if has_photos:
            f.write('''
                <div class="post-photos">
                    <div class="photos-grid">''')
            for src in post["images"]:
                f.write(f'''
                        <img src="..{src}" alt="">''')
            f.write("""
                    </div>
                </div>""")
        f.write("""
            </div>
        </section>""")
    f.write('''
        <div class="see-more-wrapper">
            <a class="see-more-btn" href="https://chat.whatsapp.com/JiTMwsPDkHAHEIB7ULJ0HK" target="_blank" rel="noopener noreferrer">Voir plus</a>
        </div>
    ''')
    f.write("""
        </main>
    </div>
    <script src="../assets/js/actualites.js" defer></script>
    <script src="../assets/js/overlay.js" defer></script>
</body>
</html>
""")

print(f"Généré -> {OUTPUT_FILE}")
