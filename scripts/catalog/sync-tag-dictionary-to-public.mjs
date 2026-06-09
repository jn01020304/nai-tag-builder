import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '../../');
const SOURCE_DIR = path.join(ROOT_DIR, 'resource/catalog/generated/tag-dictionary');
const DEST_DIR = path.join(ROOT_DIR, 'public/catalog/tag-dictionary');

function copyDirRecursiveSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Syncing Tag Dictionary to public directory...');
console.log(`Source: ${SOURCE_DIR}`);
console.log(`Destination: ${DEST_DIR}`);

try {
  if (!fs.existsSync(SOURCE_DIR)) {
    const existingManifest = path.join(DEST_DIR, 'manifest.json');
    if (fs.existsSync(existingManifest)) {
      console.log(`Source directory not found; keeping existing public catalog: ${DEST_DIR}`);
      process.exit(0);
    }

    console.error(`Source directory not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  if (fs.existsSync(DEST_DIR)) {
    fs.rmSync(DEST_DIR, { recursive: true, force: true });
  }
  
  copyDirRecursiveSync(SOURCE_DIR, DEST_DIR);
  console.log('Sync complete.');
} catch (error) {
  console.error('Error during sync:', error);
  process.exit(1);
}
