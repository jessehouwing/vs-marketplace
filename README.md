# Visual Studio Marketplace Publishing

This repository provides tools for publishing Visual Studio extensions to the Visual Studio Marketplace:

- **GitHub Action**: Publish from GitHub Actions workflows
- **Azure Pipelines Task**: Publish from Azure Pipelines

## Features

- Publish Visual Studio extensions (.vsix files) to the Visual Studio Marketplace
- Support for both Personal Access Token (PAT) and Workload Identity Federation (OIDC) authentication
- Configurable warning suppression
- Cross-platform support (Windows agents required for VsixPublisher.exe)

## GitHub Action Usage

```yaml
- name: Publish Visual Studio Extension
  uses: jessehouwing/vs-marketplace@v1
  with:
    auth-type: pat
    token: ${{ secrets.VS_MARKETPLACE_TOKEN }}
    vsix-file: path/to/extension.vsix
    manifest-file: path/to/publishManifest.json
    publisher-id: my-publisher
    ignore-warnings: VSIXValidatorWarning01,VSIXValidatorWarning02
```

### Inputs

- `auth-type`: Authentication type (`pat` or `oidc`). Default: `pat`
- `token`: Personal Access Token (required when `auth-type` is `pat`)
- `vsix-file`: Path to the VSIX file to publish (required)
- `manifest-file`: Path to the publish manifest file (required)
- `publisher-id`: Publisher ID for the extension (required)
- `ignore-warnings`: Comma-separated list of warnings to ignore (optional)

## Azure Pipelines Task Usage

```yaml
- task: PublishVisualStudioExtension@1
  inputs:
    connectTo: AzureRM
    connectedServiceNameAzureRM: "Visual Studio Marketplace"
    vsixFile: "path/to/extension.vsix"
    manifestFile: "path/to/publishManifest.json"
    publisherId: "my-publisher"
    ignoreWarnings: "VSIXValidatorWarning01,VSIXValidatorWarning02"
```

### Task Inputs

- `connectTo`: Connection type (`VsTeam` for PAT or `AzureRM` for OIDC)
- `connectedServiceName`: Service connection for PAT authentication
- `connectedServiceNameAzureRM`: Service connection for OIDC authentication
- `vsixFile`: Path to the VSIX file to publish
- `manifestFile`: Path to the publish manifest file
- `publisherId`: Publisher ID for the extension
- `ignoreWarnings`: Comma-separated list of warnings to ignore

## Requirements

- Windows agent with Visual Studio SDK installed
- VsixPublisher.exe (included with Visual Studio SDK)
- Personal Access Token with appropriate marketplace permissions OR
- Azure service connection configured for workload identity federation

## Development

### Prerequisites

- Node.js (see `.node-version`)
- npm
- Visual Studio SDK (for testing)

### Setup

```bash
npm install
npm run build
npm run test
```

### Project Structure

This is a monorepo using npm workspaces:

- `packages/core`: Platform-agnostic publishing logic
- `packages/azdo-task`: Azure Pipelines task adapter
- `packages/github-action`: GitHub Action adapter

### Building

```bash
npm run build        # Build all packages
npm run bundle       # Bundle for distribution
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.