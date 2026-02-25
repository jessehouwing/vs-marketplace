This extension provides Azure Pipelines tasks to publish Visual Studio extensions to the [Visual Studio Marketplace](https://marketplace.visualstudio.com).

## How to use

After installing this extension in your Azure DevOps organization, add the task to your [Azure Pipelines YAML pipeline](https://learn.microsoft.com/azure/devops/pipelines/?view=azure-devops).

You can find examples in the [repository documentation](https://github.com/jessehouwing/vs-marketplace/tree/main/examples).

For authenticated operations, you can use either a Personal Access Token (PAT), Microsoft Entra ID Workload Identity Federation (OIDC), or Azure Resource Manager service connection.

## Required PAT scopes

When creating a PAT for pipeline automation, include at least the following scope:

- **Publish**: `Marketplace (Publish)`

For setup details and troubleshooting, see:

- PAT setup: [Use personal access tokens](https://learn.microsoft.com/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate)

## Microsoft Entra ID Workload Federation (OIDC)

This extension supports Azure Pipelines service connections based on **Azure Resource Manager + Workload Identity Federation**.

- No long-lived PAT secret is required in your pipeline.
- Azure Pipelines requests short-lived tokens during the run.
- Use `connectionType: AzureRM` for authentication.

For setup details, required marketplace resource scope (`499b84ac-1321-427f-aa17-267ca6975798`), and troubleshooting, see:

- [Authentication documentation](https://github.com/jessehouwing/vs-marketplace/blob/main/docs/authentication.md)
- [Azure Pipelines usage examples](https://github.com/jessehouwing/vs-marketplace/blob/main/examples/azure-pipelines.md)

## Azure Pipelines task

The **VS Marketplace** task publishes a Visual Studio extension (`.vsix` file) to the Visual Studio Marketplace.

### Required inputs:
- **VSIX file**: Path to the .vsix file to publish
- **Manifest file**: Path to the publish manifest JSON file
- **Publisher ID**: Your Visual Studio Marketplace publisher identifier
- **Connection Type**: Authentication method (PAT, WorkloadIdentity, or AzureRM)
- **Service Connection**: The appropriate service connection for your chosen auth method

### Optional inputs:
- **Ignore Warnings**: Comma-separated list of warnings to ignore during validation

## Example usage

```yaml
- task: vs-marketplace@6
  displayName: 'Publish to VS Marketplace'
  inputs:
    connectionType: 'PAT'
    connectionNamePAT: 'VS Marketplace Connection'
    vsixFile: '$(Build.SourcesDirectory)/output/MyExtension.vsix'
    manifestFile: '$(Build.SourcesDirectory)/publishManifest.json'
    publisherId: 'my-publisher'
```

## Support

For issues and feature requests, please visit the [GitHub repository](https://github.com/jessehouwing/vs-marketplace/issues).
