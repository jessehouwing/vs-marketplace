# Contributing to VS Marketplace Publishing

Thank you for your interest in contributing to this project!

## Development Setup

### Prerequisites

- Node.js 20.x or later
- npm
- Visual Studio SDK (for testing on Windows)

### Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/jessehouwing/vs-marketplace.git
   cd vs-marketplace
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the project:

   ```bash
   npm run build
   ```

4. Run tests:
   ```bash
   npm test
   ```

## Project Structure

This is a monorepo using npm workspaces:

```
vs-marketplace/
├── packages/
│   ├── core/              # Platform-agnostic publishing logic
│   │   ├── src/
│   │   │   ├── platform-adapter.ts    # Platform abstraction
│   │   │   ├── publisher.ts           # Core publishing logic
│   │   │   └── index.ts
│   │   └── package.json
│   ├── azdo-task/         # Azure Pipelines task
│   │   ├── src/
│   │   │   ├── azdo-adapter.ts        # Azure Pipelines adapter
│   │   │   └── main.ts                # Task entry point
│   │   ├── task.json                  # Task definition
│   │   └── package.json
│   └── github-action/     # GitHub Action
│       ├── src/
│       │   ├── github-adapter.ts      # GitHub Actions adapter
│       │   └── main.ts                # Action entry point
│       └── package.json
├── Scripts/
│   └── bundle.mjs         # Rollup bundling script
├── docs/                  # Documentation
├── examples/              # Usage examples
└── package.json           # Root workspace config
```

## Development Workflow

### Making Changes

1. Make changes to the appropriate package
2. Build to check for TypeScript errors:
   ```bash
   npm run build
   ```
3. Run linter:
   ```bash
   npm run lint
   ```
4. Format code:
   ```bash
   npm run format
   ```
5. Bundle for distribution:
   ```bash
   npm run bundle
   ```

### Testing

Currently, the project focuses on TypeScript compilation and linting. To add tests:

1. Add test files in `__tests__` directories
2. Run tests with:
   ```bash
   npm test
   ```

### Code Style

- Use TypeScript strict mode
- Follow the existing code style
- Run Prettier for formatting: `npm run format`
- Run ESLint for linting: `npm run lint`

## Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Ensure all checks pass:
   ```bash
   npm run build
   npm run lint
   npm run format:check
   ```
5. Commit your changes with a descriptive message
6. Push to your fork
7. Create a Pull Request

## Pull Request Guidelines

- Write clear, concise commit messages
- Update documentation if needed
- Add tests for new features
- Ensure all CI checks pass
- Keep changes focused and minimal

## Architecture Guidelines

### Platform Abstraction

The core package should remain platform-agnostic:

- Use the `IPlatformAdapter` interface for platform-specific operations
- Keep publishing logic in the core package
- Implement platform-specific details in adapter packages

### Adding New Features

When adding features:

1. Implement core logic in `packages/core`
2. Update both adapters (`azdo-task` and `github-action`)
3. Update documentation and examples
4. Test on both platforms if possible

## Questions?

Feel free to open an issue for:

- Bug reports
- Feature requests
- Questions about the codebase
- General discussions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
