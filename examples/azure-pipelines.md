# Azure Pipelines Example

This example shows how to use the Visual Studio Marketplace Publishing task in Azure Pipelines.

## Basic Usage with PAT

```yaml
trigger:
  tags:
    include:
      - v*

pool:
  vmImage: "windows-latest"

steps:
  - task: VSBuild@1
    displayName: "Build Extension"
    inputs:
      solution: "**/*.sln"
      configuration: "Release"

  - task: PublishVisualStudioExtension@1
    displayName: "Publish to VS Marketplace"
    inputs:
      connectTo: "VsTeam"
      connectedServiceName: "Visual Studio Marketplace"
      vsixFile: "$(Build.SourcesDirectory)/output/MyExtension.vsix"
      manifestFile: "$(Build.SourcesDirectory)/publishManifest.json"
      publisherId: "my-publisher"
```

## Using Workload Identity Federation (OIDC)

For enhanced security using Workload Identity Federation:

```yaml
trigger:
  tags:
    include:
      - v*

pool:
  vmImage: "windows-latest"

steps:
  - task: VSBuild@1
    displayName: "Build Extension"
    inputs:
      solution: "**/*.sln"
      configuration: "Release"

  - task: PublishVisualStudioExtension@1
    displayName: "Publish to VS Marketplace"
    inputs:
      connectTo: "AzureRM"
      connectedServiceNameAzureRM: "Visual Studio Marketplace (OIDC)"
      vsixFile: "$(Build.SourcesDirectory)/output/MyExtension.vsix"
      manifestFile: "$(Build.SourcesDirectory)/publishManifest.json"
      publisherId: "my-publisher"
```

## Ignoring Warnings

If you need to ignore specific warnings during validation:

```yaml
- task: PublishVisualStudioExtension@1
  displayName: "Publish to VS Marketplace"
  inputs:
    connectTo: "VsTeam"
    connectedServiceName: "Visual Studio Marketplace"
    vsixFile: "$(Build.SourcesDirectory)/output/MyExtension.vsix"
    manifestFile: "$(Build.SourcesDirectory)/publishManifest.json"
    publisherId: "my-publisher"
    ignoreWarnings: "VSIXValidatorWarning01,VSIXValidatorWarning02"
```

## Setting up Service Connections

### PAT-based Service Connection

1. Go to your Azure DevOps project settings
2. Navigate to Service connections
3. Create a new service connection of type "Visual Studio Marketplace"
4. Enter your Personal Access Token from the Visual Studio Marketplace
5. Name the connection and save

### OIDC-based Service Connection

1. Set up an Azure service principal with federated credentials
2. Configure the resource ID: `499b84ac-1321-427f-aa17-267ca6975798`
3. Create an Azure Resource Manager service connection in Azure DevOps
4. Configure it to use workload identity federation
5. Use this connection in the task

## Example Publish Manifest

Create a `publishManifest.json` file in your repository:

```json
{
  "$schema": "http://json.schemastore.org/vsix-publish",
  "categories": ["coding", "snippets"],
  "identity": {
    "internalName": "MyExtension"
  },
  "overview": "README.md",
  "priceCategory": "free",
  "publisher": "my-publisher",
  "private": false,
  "qna": true,
  "repo": "https://dev.azure.com/my-org/my-project/_git/my-extension"
}
```
