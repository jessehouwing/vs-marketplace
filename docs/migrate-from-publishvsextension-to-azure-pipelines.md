# Migrate from PublishVisualStudioExtension to vs-marketplace (Azure Pipelines)

This guide helps you migrate from Microsoft's `PublishVisualStudioExtension@5` task (from the
[azure-devops-extension-tasks](https://github.com/microsoft/azure-devops-extension-tasks/tree/main/BuildTasks/PublishVSExtension)
extension) to the `vs-marketplace@6` task in this repository.

## What changes

The core publish behavior is identical: both tasks locate `VsixPublisher.exe`, log in, publish the
VSIX, then log out. The differences are:

- **Task name**: `PublishVisualStudioExtension@5` → `vs-marketplace@6`
- **Connection inputs**: renamed and restructured (see mapping below)
- **Service connection endpoint type**: `VstsMarketplacePublishing` → `VsMarketplacePublishing` (new service connection required)
- **New auth option**: `WorkloadIdentity` federation support added (not present in v5 task)

## Migration checklist

- Install the `vs-marketplace` extension in your Azure DevOps organization.
- Replace each `PublishVisualStudioExtension@5` step with `vs-marketplace@6`.
- Create a new service connection of type `VsMarketplacePublishing` if using PAT auth (endpoint type has changed).
- Update the connection input names (see mapping below).
- Update `connectionType` to match your auth method.
- Run the pipeline and verify the publish succeeds.

## Input mapping

| `PublishVisualStudioExtension@5` input | `vs-marketplace@6` input  | Notes                                                                 |
| -------------------------------------- | ------------------------- | --------------------------------------------------------------------- |
| `connectTo: VsTeam`                    | `connectionType: PAT`     | Auth type selection for PAT                                           |
| `connectTo: AzureRM`                   | `connectionType: AzureRM` | Auth type selection for OIDC                                          |
| `connectedServiceName`                 | `connectionNamePAT`       | PAT service connection — endpoint type changes (see below)            |
| `connectedServiceNameAzureRM`          | `connectionNameAzureRM`   | AzureRM service connection — same type, can reuse existing connection |
| `vsixFile`                             | `vsixFile`                | Unchanged                                                             |
| `manifestFile`                         | `manifestFile`            | Unchanged                                                             |
| `publisherId`                          | `publisherId`             | Unchanged                                                             |
| `ignoreWarnings`                       | `ignoreWarnings`          | Unchanged                                                             |

### New auth option in v6

`vs-marketplace@6` adds a third auth mode not available in `PublishVisualStudioExtension@5`:

- `connectionType: WorkloadIdentity` — uses a workload identity federation service connection
  (`connectionNameWorkloadIdentity`) instead of a PAT or Azure RM connection.

### Service connection endpoint type change (PAT)

The old task registered service connections under `VstsMarketplacePublishing`; this task uses
`VsMarketplacePublishing`. You must create a **new** service connection of the correct type — the
existing one cannot be reused directly.

Steps:

1. Go to your Azure DevOps project settings → **Service connections**.
2. Create a new connection of type **Visual Studio Marketplace** (registered by the `vs-marketplace`
   extension).
3. Paste your existing PAT and save.
4. Update your pipeline to reference the new connection name in `connectionNamePAT`.

## Before and after example

### Before (`PublishVisualStudioExtension@5` with PAT)

```yaml
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

### After (`vs-marketplace@6` with PAT)

```yaml
- task: vs-marketplace@6
  displayName: 'Publish to VS Marketplace'
  inputs:
    connectionType: 'PAT'
    connectionNamePAT: 'My Marketplace Connection (v6)'
    vsixFile: '$(Build.SourcesDirectory)/output/MyExtension.vsix'
    manifestFile: '$(Build.SourcesDirectory)/publishManifest.json'
    publisherId: 'my-publisher'
    ignoreWarnings: 'VSIXValidatorWarning01'
```

### Before (`PublishVisualStudioExtension@5` with workload identity federation)

```yaml
- task: PublishVisualStudioExtension@5
  displayName: 'Publish to VS Marketplace'
  inputs:
    connectTo: AzureRM
    connectedServiceNameAzureRM: 'My Azure RM Connection'
    vsixFile: '$(Build.SourcesDirectory)/output/MyExtension.vsix'
    manifestFile: '$(Build.SourcesDirectory)/publishManifest.json'
    publisherId: 'my-publisher'
```

### After (`vs-marketplace@6` with AzureRM / OIDC)

```yaml
- task: vs-marketplace@6
  displayName: 'Publish to VS Marketplace'
  inputs:
    connectionType: 'AzureRM'
    connectionNameAzureRM: 'My Azure RM Connection'
    vsixFile: '$(Build.SourcesDirectory)/output/MyExtension.vsix'
    manifestFile: '$(Build.SourcesDirectory)/publishManifest.json'
    publisherId: 'my-publisher'
```

## Agent requirements

Both tasks require a **Windows agent** with Visual Studio (including the Visual Studio SDK /
`Microsoft.VisualStudio.Component.VSSDK` workload) installed so that `VsixPublisher.exe` is
available. No change is needed for the agent pool.

```yaml
pool:
  vmImage: 'windows-latest'
```

## Authentication reference

For full authentication setup details, including OIDC federation and PAT scopes, see
[Authentication Guide](./authentication.md).
