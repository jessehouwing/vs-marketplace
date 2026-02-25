#!/usr/bin/env node

import { createWriteStream, promises as fs } from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const vswhereLatest = 'https://github.com/Microsoft/vswhere/releases/latest/download/vswhere.exe';

const targets = [
  path.join(rootDir, 'tools'),
  path.join(rootDir, 'packages/azdo-task/tools'),
  path.join(rootDir, 'packages/core/tools'),
];

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destination);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        file.close();
        download(response.headers.location, destination).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(destination).catch(() => {});
      reject(err);
    });
    
    file.on('error', (err) => {
      file.close();
      fs.unlink(destination).catch(() => {});
      reject(err);
    });
  });
}

async function downloadVswhere() {
  console.log('Downloading vswhere.exe...');
  
  try {
    // Create temp directory if it doesn't exist
    const tempDir = path.join(rootDir, '.temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempFile = path.join(tempDir, 'vswhere.exe');
    
    // Download vswhere.exe
    await download(vswhereLatest, tempFile);
    console.log('✓ Downloaded vswhere.exe');
    
    // Copy to all target directories
    for (const target of targets) {
      await fs.mkdir(target, { recursive: true });
      const targetFile = path.join(target, 'vswhere.exe');
      await fs.copyFile(tempFile, targetFile);
      console.log(`✓ Copied to ${path.relative(rootDir, targetFile)}`);
    }
    
    // Clean up temp file
    await fs.unlink(tempFile);
    
    console.log('✓ vswhere.exe setup complete');
  } catch (error) {
    console.error('Failed to download vswhere.exe:', error.message);
    process.exit(1);
  }
}

downloadVswhere();
