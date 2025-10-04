import os
import sys
import json
from pathlib import Path

base = Path(__file__).resolve().parent.parent / "assets" / "img" / "plan" / "points"
points_file = base / "points.json"

if not points_file.is_file():
    print(f"Erreur: {points_file} introuvable")
    sys.exit(1)

with open(points_file, "r", encoding="utf-8") as f:
    data = json.load(f)

for point in data:
    pid = point.get("id")
    if not pid:
        point["images"] = []
        continue
    folder = os.path.join(base, pid)
    if not os.path.isdir(folder):
        point["images"] = []
        continue
    files = [fn for fn in os.listdir(folder) if os.path.isfile(os.path.join(folder, fn)) and not fn.startswith(".")]
    files.sort()
    point["images"] = [f"/{pid}/{fn}" for fn in files]

with open(points_file, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=4)

print("points.json mis à jour.")
