const fs = require('fs');
const path = require('path');

const dir = './assets/img/index';
const manifestPath = path.join(dir, 'manifest.json');
const imageRegex = /\.(jpe?g|png|gif)$/i;

if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Le dossier ${dir} n'existe pas ou n'est pas un répertoire.`);
}

function walkDirectory(base) {
    const results = [];
    const entries = fs.readdirSync(base, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(base, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkDirectory(full));
        } else if (entry.isFile() && imageRegex.test(entry.name)) {
            const rel = path.relative(dir, full).split(path.sep).join('/');
            results.push(rel);
        }
    }
    return results;
}

const files = walkDirectory(dir).sort();
fs.writeFileSync(manifestPath, JSON.stringify(files, null, 4), 'utf8');
console.log(`Manifest écrit (${files.length} images) : ${manifestPath}`);
