const fs = require('fs');
const path = require('path');

const BASE_DIR = process.env.BASE_DIR || process.cwd();

const SOURCE_DIR = path.join(BASE_DIR, 'assets', 'img', 'full');
const OUTPUT_DIR  = path.join(BASE_DIR, 'assets', 'img', 'galerie');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'manifest.json');

const EXTENSIONS = /\.(jpe?g|png|gif)$/i;

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function walkDir(dir, fileList = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (let entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            walkDir(fullPath, fileList);
        } else if (entry.isFile() && EXTENSIONS.test(entry.name)) {
            const relPath = path.relative(OUTPUT_DIR, fullPath).split(path.sep).join('/');
            fileList.push(relPath);
        }
    }
    return fileList;
}

try {
    const images = walkDir(SOURCE_DIR).sort();
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(images, null, 4), 'utf-8');
    console.log(`${images.length} images listées dans ${OUTPUT_FILE}`);
} catch (err) {
    console.error('Erreur lors de la génération du manifest :', err);
}
