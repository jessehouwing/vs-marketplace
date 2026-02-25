# Project Summary

## Overview

This repository provides tools for publishing Visual Studio extensions to the Visual Studio Marketplace from both GitHub Actions and Azure Pipelines.

## What was ported

This is a port of the `PublishVSExtension` task from:
https://github.com/microsoft/azure-devops-extension-tasks/tree/main/BuildTasks/PublishVSExtension

## Architecture

Following the pattern from [azdo-marketplace](https://github.com/jessehouwing/azdo-marketplace), this project uses a monorepo structure with:

### Core Package (`packages/core`)

Platform-agnostic publishing logic including:

- `IPlatformAdapter` interface for abstracting platform differences
- `VsixPublisher` class for wrapping VsixPublisher.exe
- Authentication handling (PAT and OIDC)
- Publishing workflow with login/publish/logout

### Azure Pipelines Task (`packages/azdo-task`)

- `AzdoAdapter` implementing the platform interface using `azure-pipelines-task-lib`
- Task definition (`task.json`) with inputs for authentication and publishing
- Support for both PAT and Workload Identity Federation (OIDC)

### GitHub Action (`packages/github-action`)

- `GitHubAdapter` implementing the platform interface using `@actions/core`
- Action definition (`action.yml`) with equivalent inputs
- Support for both PAT and OIDC authentication

## Key Features

1. **Dual Authentication Support**

   - Personal Access Token (PAT)
   - Workload Identity Federation (OIDC) via Azure

2. **Platform Consistency**

   - Same core logic for both GitHub Actions and Azure Pipelines
   - Consistent input/output interface
   - Shared authentication handling

3. **Modern Tooling**
   - TypeScript with strict mode
   - ESM modules
   - Rollup bundling
   - ESLint and Prettier

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Bundle for distribution
npm run bundle

# Lint
npm run lint

# Format
npm run format
```

## Usage

See the `examples/` directory for:

- GitHub Actions workflows
- Azure Pipelines YAML

See the `docs/` directory for:

- Authentication setup
- Contributing guidelines

## Requirements

- Windows agent with Visual Studio SDK (VsixPublisher.exe)
- Node.js 20.x or later
- PAT with marketplace publish permissions OR Azure service principal

## Files

```
vs-marketplace/
├── packages/
│   ├── core/                    # Platform-agnostic logic
│   ├── azdo-task/               # Azure Pipelines task
│   └── github-action/           # GitHub Action
├── Scripts/
│   └── bundle.mjs               # Rollup bundling
├── docs/                        # Documentation
├── examples/                    # Usage examples
├── action.yml                   # GitHub Action definition
├── vss-extension.json           # Azure DevOps extension manifest
├── package.json                 # Workspace config
└── README.md                    # Main documentation
```

## Next Steps

1. Test with actual VSIX files and publish manifests
2. Add unit tests
3. Set up CI/CD for the repository itself
4. Publish to GitHub Marketplace and Azure DevOps Marketplace
5. Add more detailed error handling and diagnostics
