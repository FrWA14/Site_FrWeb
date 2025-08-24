// assets/script/nav-bar.js
import fs from 'fs';
import path from 'path';

const ROOT_DIR = './contenu';
const OUTPUT_FILE = './assets/json/nav.json';

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const children = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subTree = scanDirectory(fullPath);
      if (subTree.length > 0) {
        children.push({
          type: 'folder',
          name: entry.name,
          children: subTree
        });
      }
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      children.push({
        type: 'file',
        name: entry.name,
        path: fullPath.replace(/\\/g, '/')
      });
    }
  }

  return children;
}

const tree = scanDirectory(ROOT_DIR);
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(tree, null, 2));
console.log('✅ nav.json généré.');
