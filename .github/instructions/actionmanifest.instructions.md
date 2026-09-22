---
applyTo: '**/action.yml,**/action.yaml'
description: Guidance for authoring and editing the GitHub Action manifest (action.yml)
---

# Action Manifest Authoring Rules

## General Rules

- Do not put deprecation notices in an input `description`.
- For deprecated inputs, use the dedicated `deprecationMessage:` field instead.
- Treat `action.yml` in the repository root as the source of truth for input/output metadata.
- The action runs on `node24` — keep the `runs.using` field as `node24`.
- The entry point is always `dist/bundle.js` — do not change this to a source file.

## Input Definitions

- Inputs that accept lists (e.g., warnings to ignore) should document both comma-separated and newline-separated formats in the `description`.
- Mark inputs as `required: false` unless they are truly required in all cases (e.g., `token` is only required for PAT auth, not OIDC).
- Use clear, lowercase kebab-case names (e.g., `auth-type`, `vsix-file`, `manifest-file`).
- When renaming an input, add the new name and set `deprecationMessage:` on the old name with a migration hint.

## Current Inputs

| Input             | Required | Default | Description                                       |
| ----------------- | -------- | ------- | ------------------------------------------------- |
| `auth-type`       | No       | `pat`   | Authentication type: `pat` or `oidc`              |
| `token`           | No       | —       | PAT for Marketplace (required when auth-type=pat) |
| `vsix-file`       | Yes      | —       | Path to the `.vsix` file to publish               |
| `manifest-file`   | Yes      | —       | Path to the publish manifest JSON file            |
| `publisher-id`    | Yes      | —       | Publisher ID for the extension                    |
| `ignore-warnings` | No       | —       | Comma/newline-separated warning codes to ignore   |

## Synchronization with task.json

The GitHub Action and the Azure Pipelines task expose the same core functionality. When adding or renaming inputs:

1. Check whether the equivalent input exists in `packages/azdo-task/task.json`.
2. Keep the concepts aligned even if the input names differ due to camelCase (task.json) vs. kebab-case (action.yml) conventions.
3. Update `packages/github-action/src/main.ts` to read the new input.
4. Update documentation in `README.md` and `docs/` as needed.

## After Any Change to action.yml

- Run `npm run validate:action-inputs` to validate the manifest against `action.schema.yml`.
- Run `npm run lint` to check for any issues.
- Update examples in `examples/github-actions.md` if input names or behavior changed.
- Check that `README.md` input table is still accurate.
