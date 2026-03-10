---
applyTo: 'vss-extension.json,**/vss-extension.json,packages/**/task.json'
description: Guidance for editing the Azure DevOps extension manifest and Azure Pipelines task manifest
---

# Task and Extension Manifest Authoring Rules

## General Rules

- When editing `vss-extension.json` or `packages/azdo-task/task.json`, preserve schema-compatible structure and all required fields.
- Use the official Azure Pipelines task schema as the source of truth:
  - https://github.com/microsoft/azure-pipelines-task-lib/blob/master/tasks.schema.json
- Keep input naming consistent between the manifest and the runtime code that reads the inputs.
- When renaming task inputs, add an `aliases` array to the canonical input name containing the old name(s) for backward compatibility.

## task.json — Input Rules

### Connection Type Inputs

The task has three service connection inputs, each shown/hidden based on `connectionType`:

| Input                            | `visibleRule`                       | Endpoint Type             |
| -------------------------------- | ----------------------------------- | ------------------------- |
| `connectionNamePAT`              | `connectionType = PAT`              | `VsMarketplacePublishing` |
| `connectionNameWorkloadIdentity` | `connectionType = WorkloadIdentity` | `workloadidentityuser`    |
| `connectionNameAzureRM`          | `connectionType = AzureRM`          | `AzureRM`                 |

- `VsMarketplacePublishing` is the custom endpoint type defined in `vss-extension.json`. It must NOT be renamed to avoid conflicts with other extensions.
- Do not use `CloudMarketplaceEndpoint` — that name is reserved for the `jessehouwing/azdo-marketplace` extension.

### `visibleRule` Behavior and Limits

- `visibleRule` controls UI visibility only. YAML pipelines do **not** enforce it.
- Runtime code must independently validate all required input combinations.
- If input **B** has `visibleRule` depending on input **A**, and **A** is hidden, **B** will also be hidden — even if **B**'s own rule could evaluate true.
- Design rule hierarchy: broad gate first (e.g., `connectionType`) → specific gate second.
- `visibleRule` expressions can only reference inputs defined **earlier** in `task.json`.
- Prefer simple boolean expressions. Avoid mixing `&&` and `||` in the same rule.

### Adding New Inputs

1. Add the input definition to `packages/azdo-task/task.json`.
2. If the input depends on `connectionType`, add an appropriate `visibleRule`.
3. Add reading logic in `packages/azdo-task/src/main.ts`.
4. If the input is platform-agnostic, add it to `PublishOptions` in `packages/core/src/publisher.ts` and pass it through.
5. Update `action.yml` with an equivalent input if appropriate.
6. Update examples in `docs/` and `README.md`.

## vss-extension.json — Extension Manifest Rules

### Required Fields

- `id`: `vs-marketplace-extension` (do not change)
- `publisher`: `jessehouwing` (do not change)
- `version`: must match the task version Major.Minor.Patch

### Endpoint Type Contribution

The extension defines a custom service endpoint type `VsMarketplacePublishing`. This is the type used by `connectionNamePAT` in `task.json`.

Rules:

- Do not rename the endpoint type ID `vs-marketplace-endpoint-type`.
- Do not change the `name` field `VsMarketplacePublishing` — changing it breaks existing service connections in user organizations.
- The `url.value` should remain `https://marketplace.visualstudio.com`.

### Files Section

The `files` section must include:

- `packages/azdo-task/task.json`
- `packages/azdo-task/dist` (the bundled output directory)
- `packages/azdo-task/icon.png`

Do not include source files (`packages/azdo-task/src/`) in the extension package.

## Version Consistency

The task version in `task.json` (`Major`, `Minor`, `Patch`) must stay consistent with:

- The extension version in `vss-extension.json`
- The GitHub release tag (e.g., `v6.0.0`)
- The action version reference in documentation (e.g., `jessehouwing/vs-marketplace@v6`)

When bumping the version, update all three places.
