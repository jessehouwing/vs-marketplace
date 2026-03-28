#!/usr/bin/env node
/**
 * Idempotent version update script for release automation.
 *
 * Updates version references across the entire repository:
 * - package.json files (root + workspace packages)
 * - vss-extension.json
 * - packages/azdo-task/task.json (Major/Minor/Patch)
 * - packages/azdo-package-task/task.json (Major/Minor/Patch)
 * - action.yml (GitHub Action reference)
 *
 * Usage: node Scripts/update-version.mjs <version>
 * Example: node Scripts/update-version.mjs 6.1.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: node Scripts/update-version.mjs <version>');
  console.error('Version must be in format x.y.z (e.g., 6.1.0)');
  process.exit(1);
}

const [major, minor, patch] = version.split('.').map(Number);
let updatedCount = 0;
let skippedCount = 0;

async function updateJsonFile(relativePath, updater) {
  const filePath = path.join(rootDir, relativePath);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const content = JSON.parse(raw);
    updater(content);
    await fs.writeFile(filePath, JSON.stringify(content, null, 2) + '\n');
    console.log(`✓ ${relativePath}`);
    updatedCount++;
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log(`⊘ ${relativePath} (not found, skipped)`);
      skippedCount++;
    } else {
      throw e;
    }
  }
}

// 1. Update package.json files
const packageJsonPaths = [
  'package.json',
  'packages/core/package.json',
  'packages/azdo-task/package.json',
  'packages/azdo-package-task/package.json',
  'packages/github-action/package.json',
];

for (const p of packageJsonPaths) {
  await updateJsonFile(p, (content) => {
    content.version = version;
  });
}

// 2. Update vss-extension.json
await updateJsonFile('vss-extension.json', (content) => {
  content.version = version;
});

// 3. Update task.json files (Major/Minor/Patch fields)
const taskJsonPaths = [
  'packages/azdo-task/task.json',
  'packages/azdo-package-task/task.json',
];

for (const p of taskJsonPaths) {
  await updateJsonFile(p, (content) => {
    content.version.Major = major;
    content.version.Minor = minor;
    content.version.Patch = patch;
  });
}

// 4. Update action.yml (jessehouwing/vs-marketplace@vX references in descriptions)
const actionYmlPath = path.join(rootDir, 'action.yml');
try {
  let content = await fs.readFile(actionYmlPath, 'utf-8');
  content = content.replace(
    /(jessehouwing\/vs-marketplace@)[0-9A-Za-z._/-]+/g,
    `$1v${version}`
  );
  await fs.writeFile(actionYmlPath, content);
  console.log(`✓ action.yml → @v${version}`);
  updatedCount++;
} catch (e) {
  if (e.code === 'ENOENT') {
    console.log('⊘ action.yml (not found, skipped)');
    skippedCount++;
  } else {
    throw e;
  }
}

// 5. Update README.md
const readmePath = path.join(rootDir, 'README.md');
try {
  let content = await fs.readFile(readmePath, 'utf-8');
  content = content.replace(
    /(jessehouwing\/vs-marketplace@)[0-9A-Za-z._/-]+/g,
    `$1v${version}`
  );
  await fs.writeFile(readmePath, content);
  console.log(`✓ README.md → @v${version}`);
  updatedCount++;
} catch (e) {
  if (e.code === 'ENOENT') {
    console.log('⊘ README.md (not found, skipped)');
    skippedCount++;
  } else {
    throw e;
  }
}

// 6. Update docs directory
const docsDir = path.join(rootDir, 'docs');
try {
  const entries = await fs.readdir(docsDir, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/\.(md|yml|yaml)$/.test(entry.name)) continue;
    const filePath = path.join(entry.parentPath ?? entry.path, entry.name);
    const relative = path.relative(rootDir, filePath);
    let fileContent = await fs.readFile(filePath, 'utf-8');
    const updated = fileContent.replace(
      /(jessehouwing\/vs-marketplace@)[0-9A-Za-z._/-]+/g,
      `$1v${version}`
    );
    if (updated !== fileContent) {
      await fs.writeFile(filePath, updated);
      console.log(`✓ ${relative} → @v${version}`);
      updatedCount++;
    }
  }
} catch (e) {
  if (e.code === 'ENOENT') {
    console.log('⊘ docs/ (not found, skipped)');
    skippedCount++;
  } else {
    throw e;
  }
}

console.log(
  `\n✅ Version update complete: ${version} (${updatedCount} files updated${skippedCount > 0 ? `, ${skippedCount} skipped` : ''})`
);
