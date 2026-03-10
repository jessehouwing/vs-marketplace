# Migrate from PublishVisualStudioExtension to GitHub Actions

This guide helps you migrate from Microsoft's `PublishVisualStudioExtension@5` task (from the
[azure-devops-extension-tasks](https://github.com/microsoft/azure-devops-extension-tasks/tree/main/BuildTasks/PublishVSExtension)
extension) to the `jessehouwing/vs-marketplace@v6` GitHub Actions action.

## Migration approach

1. Move your pipeline trigger to a GitHub Actions workflow `on:` block.
2. Replace the `PublishVisualStudioExtension@5` step with `jessehouwing/vs-marketplace@v6`.
3. Migrate credentials from Azure DevOps service connections to GitHub secrets (PAT) or OIDC
   federation.
4. Rename inputs from `camelCase` to `kebab-case` (see mapping below).

## Input mapping

| `PublishVisualStudioExtension@5` input               | `jessehouwing/vs-marketplace@v6` input | Notes                                                          |
| ---------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| `connectTo: VsTeam` + `connectedServiceName`         | `auth-type: pat` + `token`             | Extract PAT from service connection and store as GitHub secret |
| `connectTo: AzureRM` + `connectedServiceNameAzureRM` | `auth-type: oidc`                      | Use `azure/login@v2` step before this action                   |
| `vsixFile`                                           | `vsix-file`                            | Renamed with kebab-case                                        |
| `manifestFile`                                       | `manifest-file`                        | Renamed with kebab-case                                        |
| `publisherId`                                        | `publisher-id`                         | Renamed with kebab-case                                        |
| `ignoreWarnings`                                     | `ignore-warnings`                      | Renamed with kebab-case                                        |

## Authentication migration

### Option 1: PAT (quickest migration)

In `PublishVisualStudioExtension@5`, the PAT was stored in an Azure DevOps service connection.
In GitHub Actions, store the same PAT as a repository or environment secret.

1. Copy the PAT value from your existing Azure DevOps service connection.
2. Add it as a GitHub Actions secret named `VS_MARKETPLACE_TOKEN` (or any name you choose).
3. Use `auth-type: pat` and pass the secret via `token`.

### Option 2: OIDC / Entra workload federation (recommended)

Instead of long-lived PAT secrets, use federated credentials:

1. Grant `id-token: write` permission in your workflow.
2. Add an `azure/login@v2` step before `jessehouwing/vs-marketplace@v6`.
3. Use `auth-type: oidc` on the action (no `token` input needed).

Required GitHub secrets for OIDC:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

See [Authentication Guide](./authentication.md) for full OIDC setup details, including how to
create a service principal and configure the marketplace resource ID
(`499b84ac-1321-427f-aa17-267ca6975798`).

## Agent requirements

Both the old task and this action require **Windows** because `VsixPublisher.exe` is only available
on Windows agents. Use `windows-latest` as the GitHub Actions runner.

## Before and after example

### Before (`PublishVisualStudioExtension@5` with PAT)

```yaml
# azure-pipelines.yml
trigger:
  tags:
    include:
      - v*

pool:
  vmImage: 'windows-latest'

steps:
  - task: VSBuild@1
    displayName: 'Build Extension'
    inputs:
      solution: '**/*.sln'
      configuration: 'Release'

  - task: PublishVisualStudioExtension@5
    displayName: 'Publish to VS Marketplace'
    inputs:
      connectTo: VsTeam
      connectedServiceName: 'My Marketplace Connection'
      vsixFile: '$(Build.SourcesDirectory)/output/MyExtension.vsix'
      manifestFile: '$(Build.SourcesDirectory)/publishManifest.json'
      publisherId: 'my-publisher'
      ignoreWarnings: 'VSIXValidatorWarning01'
```

### After (`jessehouwing/vs-marketplace@v6` with PAT)

```yaml
# .github/workflows/publish.yml
name: Publish VS Extension

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: windows-latest

    steps:
      - uses: actions/checkout@v4

      - name: Build Extension
        run: msbuild **/*.sln /p:Configuration=Release

      - name: Publish to VS Marketplace
        uses: jessehouwing/vs-marketplace@v6
        with:
          auth-type: pat
          token: ${{ secrets.VS_MARKETPLACE_TOKEN }}
          vsix-file: output/MyExtension.vsix
          manifest-file: publishManifest.json
          publisher-id: my-publisher
          ignore-warnings: VSIXValidatorWarning01
```

### Before (`PublishVisualStudioExtension@5` with workload identity federation)

```yaml
# azure-pipelines.yml
pool:
  vmImage: 'windows-latest'

steps:
  - task: PublishVisualStudioExtension@5
    displayName: 'Publish to VS Marketplace'
    inputs:
      connectTo: AzureRM
      connectedServiceNameAzureRM: 'My Azure RM Connection'
      vsixFile: '$(Build.SourcesDirectory)/output/MyExtension.vsix'
      manifestFile: '$(Build.SourcesDirectory)/publishManifest.json'
      publisherId: 'my-publisher'
```

### After (`jessehouwing/vs-marketplace@v6` with OIDC)

```yaml
# .github/workflows/publish.yml
name: Publish VS Extension (OIDC)

on:
  push:
    tags:
      - 'v*'

permissions:
  id-token: write
  contents: read

jobs:
  publish:
    runs-on: windows-latest

    steps:
      - uses: actions/checkout@v4

      - name: Azure Login
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Build Extension
        run: msbuild **/*.sln /p:Configuration=Release

      - name: Publish to VS Marketplace
        uses: jessehouwing/vs-marketplace@v6
        with:
          auth-type: oidc
          vsix-file: output/MyExtension.vsix
          manifest-file: publishManifest.json
          publisher-id: my-publisher
```

## Cutover checklist

- Triggers and branch/tag filters recreated in the `on:` block of the new workflow file.
- PAT extracted from Azure DevOps service connection and added to GitHub secrets, **or** OIDC
  federation configured with `azure/login@v2`.
- All input names updated from `camelCase` to `kebab-case`.
- Workflow tested against a non-production publisher or extension variant before going live.

## Related guides

- [Migrate from PublishVisualStudioExtension to Azure Pipelines](./migrate-from-publishvsextension-to-azure-pipelines.md)
- [Authentication Guide](./authentication.md)
