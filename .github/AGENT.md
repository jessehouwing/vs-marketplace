# AGENT.md — Copilot Coding Agent Instructions

## Repository Overview

VS Marketplace Publishing v6 — a GitHub Action and Azure Pipelines task for publishing Visual Studio extensions (`.vsix` files) to the Visual Studio Marketplace using `VsixPublisher.exe`.

**Architecture**: npm workspace monorepo with 3 packages:

- `packages/core` — Platform-agnostic publishing logic and `IPlatformAdapter` interface
- `packages/azdo-task` — Azure Pipelines task adapter
- `packages/github-action` — GitHub Actions adapter

## Quick Start

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Run Jest tests
npm run test

# Run tests with coverage
npm run test:coverage

# Bundle for distribution (Rollup)
npm run bundle

# Linting and formatting
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

## Key Commands

| Command                  | Description                                      |
| ------------------------ | ------------------------------------------------ |
| `npm run build`          | TypeScript compile all packages (via workspaces) |
| `npm run test`           | Jest unit tests (no coverage)                    |
| `npm run test:coverage`  | Jest with coverage report                        |
| `npm run bundle`         | Rollup bundle for azdo-task and github-action    |
| `npm run bundle:azdo`    | Bundle Azure Pipelines task only                 |
| `npm run bundle:actions` | Bundle GitHub Action only                        |
| `npm run lint`           | ESLint check (flat config)                       |
| `npm run lint:fix`       | Auto-fix ESLint issues                           |
| `npm run format`         | Auto-format with Prettier                        |
| `npm run format:check`   | Check Prettier formatting                        |

## Architecture Principles

- **Platform-agnostic core**: All publishing business logic lives in `packages/core/src/`. The core package never imports platform-specific packages (`azure-pipelines-task-lib`, `@actions/core`, etc.)
- **`IPlatformAdapter` interface**: Platform adapters implement this interface to abstract input/output/exec/filesystem operations
- **Tests use `MockPlatformAdapter`**: Located in `packages/core/src/__tests__/mock-platform-adapter.ts`
- **ES Modules**: All imports MUST use explicit `.js` extension (e.g., `import * as common from "./module.js"`)
- **Node 16+ module resolution**: TypeScript config uses `"module": "Node16"` and `"moduleResolution": "Node16"`

## File Organization

```
/
├── packages/                          # Workspace packages
│   ├── core/                          # @vs-marketplace/core
│   │   ├── src/
│   │   │   ├── index.ts               # Public API barrel export
│   │   │   ├── platform-adapter.ts    # IPlatformAdapter interface
│   │   │   ├── publisher.ts           # VsixPublisher class + publishVsExtension()
│   │   │   ├── auth.ts                # AuthCredentials + IAuthProvider interfaces
│   │   │   └── __tests__/             # Jest tests
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── azdo-task/                     # Azure Pipelines task adapter
│   │   ├── src/
│   │   │   ├── main.ts                # Task entry point
│   │   │   ├── azdo-adapter.ts        # IPlatformAdapter implementation
│   │   │   ├── auth/                  # Authentication providers
│   │   │   │   ├── index.ts           # getAuth() router
│   │   │   │   ├── pat-auth.ts        # PAT authentication
│   │   │   │   ├── workloadidentity-auth.ts  # Workload identity
│   │   │   │   └── azurerm-auth.ts    # Azure RM/OIDC
│   │   │   └── __tests__/             # Jest tests + mocks
│   │   ├── task.json                  # Azure Pipelines task manifest
│   │   └── package.json
│   └── github-action/                 # GitHub Actions adapter
│       ├── src/
│       │   ├── main.ts                # Action entry point
│       │   ├── github-adapter.ts      # IPlatformAdapter implementation
│       │   └── __tests__/             # Jest tests
│       └── package.json
├── Scripts/
│   └── bundle.mjs                     # Rollup bundling script
├── docs/                              # Documentation and migration guides
├── examples/                          # Usage examples
├── tsconfig.base.json                 # Shared TypeScript config
├── jest.config.ts                     # Test configuration (Jest + ts-jest ESM)
├── eslint.config.mjs                  # ESLint flat config
├── .prettierrc.yml                    # Prettier configuration
├── .node-version                      # Pin Node.js version
├── vss-extension.json                 # Azure DevOps extension manifest
├── action.yml                         # GitHub Action definition
└── .github/AGENT.md                   # This file
```

## Development Workflow

1. **Make changes** in `packages/core/src/` for business logic, or adapter packages for platform-specific behavior
2. **Run tests**: `npm run test` to verify
3. **Lint and format**: `npm run lint:fix && npm run format`
4. **Bundle** (if needed): `npm run bundle` for distribution
5. **Commit** both source and any generated `dist/` changes

## CRITICAL: End-of-Job Verification

**Before completing any coding session, ALWAYS run these commands in order:**

```bash
npm run format          # Fix formatting issues
npm run lint:fix        # Fix linting issues
npm run build           # Compile TypeScript
npm run test            # Verify all tests pass
npm run bundle          # Regenerate distribution bundles
```

This ensures:

- Code style is consistent across the codebase
- No linting errors or warnings remain
- All unit tests pass (no regressions)
- Bundle files in `dist/` are up-to-date with source changes

**Do not skip these steps** — CI will fail if bundles are out of sync or tests fail.

## Testing

- Tests use **Jest** with **ts-jest** in ESM mode
- Mock adapter in `packages/core/src/__tests__/mock-platform-adapter.ts`
- Azure Pipelines task-lib mocks in `packages/azdo-task/src/__tests__/__mocks__/`
- Test files follow pattern: `**/__tests__/**/*.test.ts`
- Run specific project: `npx jest --selectProjects=core`

## Important Notes

- **ES Module imports**: Always use `.js` extensions in imports, even in `.ts` files
- **Node version**: See `.node-version` for the pinned version
- **TypeScript strict mode**: Enabled — all types must be explicit
- **`vswhere.exe` multi-path**: `vswhere -find` can return multiple newline-separated paths; always split and check each path for existence
- **Windows-only runtime**: `VsixPublisher.exe` requires a Windows agent; tests run cross-platform but the action/task requires Windows at runtime

## When Unsure

1. Check `.github/copilot-instructions.md` for detailed architecture and patterns
2. Check `.github/instructions/` for file-type-specific guidance
3. Review tests — test files show expected usage patterns
4. Use platform adapter — never call platform APIs directly from core
5. Follow the existing patterns in each adapter package
6. Ask for clarification if the approach is unclear
