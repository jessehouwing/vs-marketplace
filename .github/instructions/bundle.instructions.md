---
applyTo: '**/bundle.mjs'
description: Guidance for bundling the JavaScript code for GitHub Actions and Azure Pipelines using Rollup
---

# Bundling Guidance

## Overview

`Scripts/bundle.mjs` uses **Rollup** (not esbuild) to create self-contained bundles for both the GitHub Action and the Azure Pipelines task. It also downloads `vswhere.exe` and stages it alongside the bundle.

## Output Targets

| Target          | Output path                             | Format          |
| --------------- | --------------------------------------- | --------------- |
| Azure Pipelines | `packages/azdo-task/dist/bundle.js`     | CommonJS        |
| GitHub Action   | `packages/github-action/dist/bundle.js` | CommonJS or ESM |

## Azure Pipelines

### Primary Goals

- Bundle the task into a single `dist/bundle.js` file to reduce install overhead.
- Stage resource files that `azure-pipelines-task-lib` reads at runtime from `__dirname`.
- Copy `vswhere.exe` into `dist/tools/` so it's available alongside the bundle.

### Externals Policy

Keep these external (do not attempt to bundle):

- `shelljs` — uses dynamic `require()` paths that cannot be statically analyzed
- `msalv1`, `msalv2`, `msalv3` — dynamically resolved at runtime from `azure-pipelines-tasks-azure-arm-rest`

Bundle these (do not add back to externals without a verified replacement):

- `azure-pipelines-task-lib` — required for `setResult`, `setSecret`, `getInput`, etc.

### Resource Staging

`azure-pipelines-task-lib` reads `module.json` and `lib.json` from its own `__dirname` at runtime. When bundled, these paths must be rewritten to point to staged copies.

- Rewrite `path.join(__dirname, 'module.json')` → `dist/__bundle_resources/azure-pipelines-task-lib/module.json`
- Rewrite `path.join(__dirname, 'lib.json')` → `dist/__bundle_resources/azure-pipelines-task-lib/lib.json`
- Copy `module.json`, `lib.json`, `package.json`, and `Strings/` folder from `azure-pipelines-task-lib` into `dist/__bundle_resources/azure-pipelines-task-lib/`

For `azure-pipelines-tasks-azure-arm-rest`, also:

- Rewrite and copy OpenSSL binary path joins (e.g., `path.join(__dirname, 'openssl3.X.Y', 'openssl')`)
- Copy all versioned OpenSSL folders from the package into `dist/__bundle_resources/azure-pipelines-tasks-azure-arm-rest/`

### Runtime Dependency Manifest

`dist/runtime-dependencies.json` and `dist/package.json` must reflect all external dependencies with correct version numbers. Resolve `msalv1`/`msalv2`/`msalv3` versions from `azure-pipelines-tasks-azure-arm-rest`'s own dependency metadata.

### Validation Checklist (Azure Target)

After modifying bundle script for the Azure target, validate:

1. `npm run bundle:azdo` succeeds with no errors.
2. `packages/azdo-task/dist/bundle.js` exists and contains `__bundle_resources` path references (not original `__dirname` paths).
3. `packages/azdo-task/dist/__bundle_resources/` contains expected `module.json`, `lib.json`, and `Strings/` files.
4. `packages/azdo-task/dist/runtime-dependencies.json` contains the correct external list.
5. `packages/azdo-task/dist/tools/vswhere.exe` exists.
6. Smoke test: on a Windows agent with Visual Studio, the task should reach the auth boundary (invalid PAT → 401), not fail on module or resource resolution.

### Debugging Heuristics

- `Not found resource file path .../dist/module.json` → missing `__bundle_resources` rewrite or copy step.
- `Cannot find module 'xyz'` after bundling → unresolved dynamic `require()` (add to externals) or missing `runtime-dependencies.json` entry.
- For any new third-party package, search for `path.join(__dirname, ...)` and dynamic `require(...)` before deciding external vs. bundled.

## GitHub Action

### Primary Goals

- Keep the bundle self-contained.
- No Azure Pipelines-specific resource rewrites apply to the Actions target.

### Validation Checklist (Actions Target)

1. `npm run bundle:actions` succeeds.
2. `packages/github-action/dist/bundle.js` exists.
3. `packages/github-action/dist/tools/vswhere.exe` exists.
4. No unintended Azure Pipelines rewrites were applied to the Actions target.

## Consistency Rules

- The bundle script must be target-aware. Any new rewrite or copy rule should be gated by target metadata so it applies to the correct output only.
- Both targets share the vswhere.exe staging step; this should remain shared.
- Keep edits minimal and focused on bundling behavior — do not change publishing or authentication logic while fixing bundle packaging.
