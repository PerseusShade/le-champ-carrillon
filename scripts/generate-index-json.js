import fs from 'fs';
const dir = './assets/img/index';
const files = fs.readdirSync(dir).filter(f => /\.(jpe?g|png|gif)$/i.test(f));
fs.writeFileSync(`${dir}/manifest.json`, JSON.stringify(files, null, 4));
