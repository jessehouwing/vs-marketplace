# AI Coding Agent Instructions — VS Marketplace v6

Purpose: Help agents quickly and accurately contribute to the VS Marketplace publishing tools — a GitHub Action and Azure Pipelines task for publishing Visual Studio extensions via `VsixPublisher.exe`.

## Big Picture — Architecture

### Repository Structure

```
packages/
├── core/                  # @vs-marketplace/core — platform-agnostic publishing logic
│   ├── src/
│   │   ├── index.ts               # Public API barrel export
│   │   ├── platform-adapter.ts    # IPlatformAdapter interface + types
│   │   ├── publisher.ts           # VsixPublisher class + publishVsExtension()
│   │   ├── auth.ts                # AuthCredentials + IAuthProvider interfaces
│   │   └── __tests__/             # Jest tests
│   │       ├── mock-platform-adapter.ts  # MockPlatformAdapter for tests
│   │       ├── publish-vs-extension.test.ts
│   │       └── publisher.test.ts
│   └── dist/                      # Compiled TypeScript output
├── azdo-task/             # Azure Pipelines task adapter
│   ├── src/
│   │   ├── main.ts                # Task entry point
│   │   ├── azdo-adapter.ts        # AzdoAdapter : IPlatformAdapter
│   │   ├── auth/
│   │   │   ├── index.ts           # getAuth() router
│   │   │   ├── pat-auth.ts        # PAT from service connection
│   │   │   ├── workloadidentity-auth.ts  # Workload identity token
│   │   │   └── azurerm-auth.ts    # Azure RM / OIDC token
│   │   └── __tests__/             # Jest tests + mock lib
│   ├── task.json                  # Azure Pipelines task manifest
│   ├── icon.png                   # Task icon
│   └── dist/                      # Bundled output (Rollup)
└── github-action/         # GitHub Actions adapter
    ├── src/
    │   ├── main.ts                # Action entry point
    │   ├── github-adapter.ts      # GitHubAdapter : IPlatformAdapter
    │   └── __tests__/             # Jest tests
    └── dist/                      # Bundled output (Rollup)
```

### V6 Key Concepts

1. **Unified Core**: All business logic in `packages/core/src/`. Never import platform packages there.
2. **Platform Adapters**: Thin wrappers (`main.ts` + `*-adapter.ts`) translate platform I/O to the `IPlatformAdapter` interface.
3. **Single Operation**: This tool only publishes VS extensions — not packages or other marketplace operations.
4. **VsixPublisher.exe**: The actual publishing uses Microsoft's `VsixPublisher.exe`, found via `vswhere.exe`. This requires a Windows agent at runtime.
5. **Rollup Bundling**: `Scripts/bundle.mjs` bundles to `dist/bundle.js` using Rollup. The bundle includes a copy of `vswhere.exe` at `dist/tools/vswhere.exe`.
6. **TypeScript ES Modules**: All code uses ES modules with `.js` extensions in imports.

## Development Workflow

### Setup

```bash
npm install              # Install all workspace dependencies
npm run build            # Build all packages (TypeScript)
npm run test             # Run all unit tests
npm run lint             # Run ESLint
npm run format           # Format with Prettier
```

### Building

```bash
npm run build            # Compile all TypeScript packages
npm run bundle           # Bundle both azdo-task and github-action for distribution
npm run bundle:azdo      # Bundle Azure Pipelines task only
npm run bundle:actions   # Bundle GitHub Action only
```

### Testing

```bash
npm run test             # Run all tests (no coverage)
npm run test:coverage    # Run tests with coverage report
```

### Full Verification (run before committing)

```bash
npm run format           # Fix formatting
npm run lint:fix         # Fix linting
npm run build            # Compile
npm run test             # Test
npm run bundle           # Bundle
```

## Platform Adapter Pattern

### `IPlatformAdapter` Interface (packages/core/src/platform-adapter.ts)

All platform-specific operations go through this interface. The core package only uses `IPlatformAdapter` — never platform libraries directly.

```typescript
interface IPlatformAdapter {
  // Input
  getInput(name: string, required: boolean): string | undefined;
  getPathInput(name: string, required: boolean, checkExists: boolean): string;

  // Security
  setSecret(secret: string): void;

  // Logging
  info(message: string): void;
  error(message: string): void;
  debug(message: string): void;

  // Execution
  exec(command: string, args: string[], options?: ExecOptions): Promise<number>;
  execOutput(command: string, args: string[], options?: ExecOptions): Promise<ExecResult>;

  // Filesystem
  fileExists(path: string): boolean;

  // Result
  setResult(result: TaskResult, message: string): void;
}
```

### Azure Pipelines Adapter (packages/azdo-task/src/azdo-adapter.ts)

- Uses `azure-pipelines-task-lib` (`tl.*`) for `getInput`, `getPathInput`, `setSecret`, `error`, `debug`, `exist`, `setResult`
- Uses Node.js `child_process.spawn` for `exec` and `execOutput` (not `tl.exec` — avoids `tool-runner` overhead)
- Uses `console.log` for `info` (not `tl.debug` which only shows in verbose mode)

### GitHub Action Adapter (packages/github-action/src/github-adapter.ts)

- Uses `@actions/core` for input, output, logging, and secrets
- Handles OIDC auth via `@azure/identity` `DefaultAzureCredential`

## Authentication System

### Azure Pipelines — `getAuth()` Router (packages/azdo-task/src/auth/index.ts)

Routes based on `connectionType` input (case-insensitive):

| `connectionType`   | Auth Module                | Description                                           |
| ------------------ | -------------------------- | ----------------------------------------------------- |
| `PAT`              | `pat-auth.ts`              | PAT from `VsMarketplacePublishing` service connection |
| `WorkloadIdentity` | `workloadidentity-auth.ts` | Workload identity federated token                     |
| `AzureRM`          | `azurerm-auth.ts`          | Azure RM OIDC via service connection                  |

All auth methods return `AuthCredentials` with a `token` field that works with `VsixPublisher.exe`.

### GitHub Action Auth (packages/github-action/src/main.ts)

- `auth-type: pat` → uses `token` input directly
- `auth-type: oidc` → uses `DefaultAzureCredential` to get token for resource `499b84ac-1321-427f-aa17-267ca6975798`

### Service Connection Naming

- PAT uses custom endpoint type `VsMarketplacePublishing` (NOT `CloudMarketplaceEndpoint` used in azdo-marketplace)
- This avoids side-by-side conflicts with the `jessehouwing/azdo-marketplace` extension

## Publishing Logic (packages/core/src/publisher.ts)

### `VsixPublisher` Class

Wraps `VsixPublisher.exe` command-line calls:

1. **`login(publisherId, token)`** → `VsixPublisher.exe login -personalAccessToken <token> -publisherName <id>`
2. **`publish(vsixPath, manifestPath, warningsToIgnore?)`** → `VsixPublisher.exe publish -payload <vsix> -publishManifest <json> [-ignoreWarnings <list>]`
3. **`logout(publisherId)`** → `VsixPublisher.exe logout -publisherName <id> -ignoreMissingPublisher`

### `VsixPublisher.exe` Discovery

1. Check for bundled `vswhere.exe` at `dist/tools/vswhere.exe` (relative to `process.argv[1]`)
2. Fallback: `%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe`
3. Fallback: assume `vswhere.exe` is on PATH
4. Run `vswhere -find` with `Microsoft.VisualStudio.Component.VSSDK` requirement
5. **Multi-path**: `vswhere -find` may return multiple newline-separated paths — always split and check each for file existence

### `publishVsExtension()` Function

The main entry point for publishing:

```typescript
export async function publishVsExtension(
  options: PublishOptions,
  adapter: IPlatformAdapter
): Promise<void>;
```

Flow:

1. Mask token as secret
2. Create `VsixPublisher` instance
3. `login()`
4. `publish()`
5. `setResult(Succeeded, ...)` or `setResult(Failed, ...)` on error
6. Always `logout()` in `finally` block (silently ignores logout errors)

## Testing Patterns

### `MockPlatformAdapter` (packages/core/src/**tests**/mock-platform-adapter.ts)

Use this for all core and integration tests:

```typescript
const adapter = new MockPlatformAdapter();

// Setup
adapter.setInput('vsixFile', 'C:\\extension.vsix');
adapter.setFileExists('C:\\VS\\VsixPublisher.exe', true);
adapter.setExecMockResponse(0); // exec() returns this exit code
adapter.setExecOutputMockResponse({ code: 0, stdout: 'C:\\VS\\VsixPublisher.exe', stderr: '' });

// Execute
await publishVsExtension(options, adapter);

// Assert
expect(adapter.getSecrets().has('my-token')).toBe(true);
expect(adapter.getExecCalls()).toHaveLength(2); // login + publish
expect(adapter.getTaskResult()?.result).toBe(TaskResult.Succeeded);
```

### Azure Pipelines Task-Lib Mock

Located at `packages/azdo-task/src/__tests__/__mocks__/azure-pipelines-task-lib.ts`.

When testing the azdo adapter, use simplified tests that focus on testable logic. Avoid complex ESM mocking of `azure-pipelines-task-lib`.

### Jest Configuration

- Preset: `ts-jest/presets/default-esm` (ESM mode)
- `moduleNameMapper` maps `@vs-marketplace/core` → `packages/core/src/index.ts`
- `tsconfig` override in `globals['ts-jest']` includes `baseUrl` and `paths`
- Tests match pattern: `**/__tests__/**/*.test.ts`

## TypeScript Conventions

- **ES Module imports**: Always use `.js` extension in imports (even in `.ts` files):
  ```typescript
  import { publishVsExtension } from '../publisher.js'; // ✅
  import { publishVsExtension } from '../publisher'; // ❌
  ```
- **Module resolution**: `"module": "Node16"`, `"moduleResolution": "Node16"`
- **Strict mode**: All types must be explicit; no implicit `any`
- **`noUnusedLocals`** and **`noUnusedParameters`**: Enabled — remove unused code
- **`noImplicitReturns`**: Enabled — all code paths must return
- **ESLint**: Flat config in `eslint.config.mjs`; runs as CI check

## Bundling (Scripts/bundle.mjs)

The bundle script uses **Rollup** (not esbuild):

- Azure Pipelines task: Outputs to `packages/azdo-task/dist/bundle.js` (CommonJS format for Node.js/Azure Pipelines compatibility)
- GitHub Action: Outputs to `packages/github-action/dist/bundle.js`
- Downloads and copies `vswhere.exe` into `dist/tools/`
- `shelljs` is external (dynamic require behavior)
- `azure-pipelines-task-lib` dependencies that use dynamic file paths are resource-staged into `dist/__bundle_resources/`

After any change that affects business logic, run `npm run bundle` and commit the updated `dist/` files.

For full bundling guidance, see `.github/instructions/bundle.instructions.md`.

## Manifest Files

### `action.yml` (GitHub Action manifest)

- Defines inputs: `auth-type`, `token`, `vsix-file`, `manifest-file`, `publisher-id`, `ignore-warnings`
- Runs with `node20` runtime
- Entry: `dist/bundle.js`
- Do not put deprecation notices in `description`; use `deprecationMessage:` field

### `packages/azdo-task/task.json` (Azure Pipelines task manifest)

- Task version: `6.0.0`
- Execution target: `dist/bundle.js` (Node20_1 runner, Windows platform only)
- Connection type inputs: `connectionNamePAT`, `connectionNameWorkloadIdentity`, `connectionNameAzureRM`
- Each is shown/hidden via `visibleRule` based on `connectionType`
- Use `aliases` array when renaming inputs for backward compatibility

### `vss-extension.json` (Extension manifest)

- Extension ID: `vs-marketplace-extension`
- Publisher: `jessehouwing`
- Version: `6.0.0`
- Includes custom endpoint type `VsMarketplacePublishing`

For manifest-specific guidance, see `.github/instructions/taskmanifest.instructions.md` and `.github/instructions/actionmanifest.instructions.md`.

## Key Warnings and Pitfalls

### ❌ Never do this

- Import `azure-pipelines-task-lib`, `@actions/core`, or other platform packages from `packages/core/src/`
- Use hardcoded paths like `/tmp` — use `os.tmpdir()` for cross-platform compatibility
- Assume `vswhere -find` returns a single path — it may return multiple newline-separated paths
- Forget to run `npm run bundle` after source changes — CI checks that `dist/` is in sync
- Use `import ... from "../module"` without `.js` extension

### ✅ Always do this

- Keep all business logic in `packages/core/src/`
- Use `IPlatformAdapter` for all platform operations from core
- Add `.js` extensions to all relative imports in TypeScript
- Run `npm run format && npm run lint:fix && npm run test && npm run bundle` before committing
- Test with `MockPlatformAdapter` from `packages/core/src/__tests__/mock-platform-adapter.ts`
- Handle multi-line `vswhere.exe` output by splitting on `\r?\n` and iterating through each path

## Common Tasks

### Adding a New Input

1. Add to `action.yml` (GitHub Action)
2. Add to `packages/azdo-task/task.json` (Azure Pipelines task)
3. Read in `packages/github-action/src/main.ts`
4. Read in `packages/azdo-task/src/main.ts`
5. Pass to core via `PublishOptions` (if core-level) or handle in adapter (if platform-specific)
6. Add tests in both adapter test files

### Adding a New Auth Method

1. Create `packages/azdo-task/src/auth/<method>-auth.ts`
2. Export `get<Method>Auth(connectionName, platform): Promise<AuthCredentials>`
3. Add case to `packages/azdo-task/src/auth/index.ts` `getAuth()` router
4. Add option to `connectionType` pickList in `task.json`
5. Add input for service connection with appropriate `visibleRule`

### Changing Core Publishing Logic

1. Edit `packages/core/src/publisher.ts`
2. Update `packages/core/src/__tests__/publish-vs-extension.test.ts` or `publisher.test.ts`
3. Run `npm run test` to verify
4. Run `npm run bundle` to update dist files
