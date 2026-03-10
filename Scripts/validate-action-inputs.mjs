#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const checkOnly = process.argv.includes('--check');

function loadYaml(content) {
  const parsed = yaml.load(content);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid YAML document');
  }
  return parsed;
}

async function main() {
  const rootActionPath = path.join(rootDir, 'action.yml');
  const rootActionContent = await fs.readFile(rootActionPath, 'utf8');
  const rootAction = loadYaml(rootActionContent);
  const rootInputs = rootAction.inputs ?? {};

  if (!rootInputs || typeof rootInputs !== 'object') {
    throw new Error('action.yml does not contain a valid inputs section');
  }

  const inputNames = Object.keys(rootInputs);

  const validationErrors = [];

  for (const inputName of inputNames) {
    const input = rootInputs[inputName];
    if (!input || typeof input !== 'object') {
      validationErrors.push(`action.yml: input '${inputName}' has invalid definition`);
      continue;
    }

    if (typeof input.description !== 'string' || input.description.trim().length === 0) {
      validationErrors.push(`action.yml: input '${inputName}' is missing a description`);
    }
  }

  if (validationErrors.length > 0) {
    for (const message of validationErrors) {
      console.error(message);
    }
    throw new Error(`Found ${validationErrors.length} action input validation issue(s).`);
  }

  if (checkOnly) {
    console.log(
      `No action input issues found. Checked ${inputNames.length} input(s) in action.yml.`
    );
    return;
  }

  console.log(`Action inputs are valid. Checked ${inputNames.length} input(s) in action.yml.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
