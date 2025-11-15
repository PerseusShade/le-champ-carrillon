const fs = require('fs');
const path = require('path');

const BASE_DIR = process.env.BASE_DIR || process.cwd();

const DIR = path.join(BASE_DIR, 'assets', 'img', 'index');
const MANIFEST_PATH = path.join(DIR, 'manifest.json');
const IMAGE_REGEX = /\.(jpe?g|png|gif)$/i;

if (!fs.existsSync(DIR) || !fs.statSync(DIR).isDirectory()) {
    throw new Error(`Le dossier ${DIR} n'existe pas ou n'est pas un répertoire.`);
}

function walkDirectory(base) {
    const results = [];
    const entries = fs.readdirSync(base, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(base, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkDirectory(full));
        } else if (entry.isFile() && IMAGE_REGEX.test(entry.name)) {
            const rel = path.relative(DIR, full).split(path.sep).join('/');
            results.push(rel);
        }
    }
    return results;
}

const files = walkDirectory(DIR).sort();
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(files, null, 4), 'utf8');
console.log(`Manifest écrit (${files.length} images) : ${MANIFEST_PATH}`);
