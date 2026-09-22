import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdtempSync, rmSync, readdirSync, statSync, mkdirSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { packageVsExtension, PackageOptions } from '../packager.js';
import { IPlatformAdapter, ExecOptions, ExecResult } from '../platform-adapter.js';

const execFileAsync = promisify(execFile);

/**
 * A real (non-mocked) IPlatformAdapter that shells out to the actual OS so these
 * integration tests exercise the genuine vswhere.exe / VSIXUtil.exe behavior,
 * rather than assumptions baked into MockPlatformAdapter.
 */
class RealPlatformAdapter implements IPlatformAdapter {
  getInput(): string | undefined {
    return undefined;
  }

  getPathInput(): string {
    throw new Error('Not used in integration test');
  }

  setSecret(): void {}

  info(): void {}

  error(): void {}

  debug(): void {}

  async exec(command: string, args: string[], options?: ExecOptions): Promise<number> {
    const result = await this.execOutput(command, args, options);
    return result.code;
  }

  async execOutput(command: string, args: string[], options?: ExecOptions): Promise<ExecResult> {
    try {
      const { stdout, stderr } = await execFileAsync(command, args, {
        cwd: options?.cwd,
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 10,
      });
      return { code: 0, stdout, stderr };
    } catch (error) {
      const execError = error as { code?: number; stdout?: string; stderr?: string };
      return {
        code: execError.code ?? 1,
        stdout: execError.stdout ?? '',
        stderr: execError.stderr ?? '',
      };
    }
  }

  fileExists(filePath: string): boolean {
    return existsSync(filePath);
  }

  async findMatch(root: string, patterns: string[]): Promise<string[]> {
    // Minimal recursive **/*.vsix resolver: sufficient for this integration test's
    // needs without pulling in a real glob dependency in the core package.
    const wantsVsix = patterns.some((p) => p.endsWith('.vsix'));
    if (!wantsVsix || !existsSync(root)) {
      return [];
    }

    const matches: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const entryPath = path.join(dir, entry);
        const stat = statSync(entryPath);
        if (stat.isDirectory()) {
          walk(entryPath);
        } else if (entry.toLowerCase().endsWith('.vsix')) {
          matches.push(entryPath);
        }
      }
    };
    walk(root);
    return matches;
  }

  setResult(): void {}

  ensureDirectory(dirPath: string): void {
    mkdirSync(dirPath, { recursive: true });
  }
}

const isWindows = process.platform === 'win32';
const vswhereCandidates = [
  path.join(
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    'Microsoft Visual Studio',
    'Installer',
    'vswhere.exe'
  ),
];
const hasVswhere = isWindows && vswhereCandidates.some((candidate) => existsSync(candidate));

// These tests shell out to the real vswhere.exe / VSIXUtil.exe and therefore only
// run on Windows agents with the Visual Studio SDK component installed. They are
// skipped elsewhere (e.g. Linux/macOS CI runners) rather than failing.
const describeIfVsixUtilAvailable = hasVswhere ? describe : describe.skip;

describeIfVsixUtilAvailable('packageVsExtension (integration, real VSIXUtil.exe)', () => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(currentDir, '..', '..', '..', '..');
  const vsixManifest = path.join(
    repoRoot,
    'tests',
    'sample-extension',
    'source.extension.vsixmanifest'
  );

  let tempRoot: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), 'vs-marketplace-package-'));
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('packages into an existing output directory and locates the generated .vsix', async () => {
    const outputDir = path.join(tempRoot, 'existing-dir');
    mkdirSync(outputDir, { recursive: true });

    const options: PackageOptions = {
      vsixManifest,
      outputPath: outputDir,
    };

    const adapter = new RealPlatformAdapter();
    const vsixPath = await packageVsExtension(options, adapter);

    expect(existsSync(vsixPath)).toBe(true);
    expect(vsixPath.toLowerCase()).toMatch(/\.vsix$/);
    expect(path.dirname(vsixPath)).toBe(outputDir);
  });

  it('packages into a directory that does not exist yet (matches CI output-path usage)', async () => {
    // Mirrors the real-world failure: `output-path: ${{ runner.temp }}/vsix` where
    // the "vsix" directory has never been created before the action runs.
    const outputDir = path.join(tempRoot, 'not-yet-created', 'vsix');
    expect(existsSync(outputDir)).toBe(false);

    const options: PackageOptions = {
      vsixManifest,
      outputPath: outputDir,
    };

    const adapter = new RealPlatformAdapter();
    const vsixPath = await packageVsExtension(options, adapter);

    expect(existsSync(vsixPath)).toBe(true);
    expect(vsixPath.toLowerCase()).toMatch(/\.vsix$/);
  });

  it('packages to an explicit .vsix file path and returns that exact path', async () => {
    const outputDir = path.join(tempRoot, 'explicit-file');
    mkdirSync(outputDir, { recursive: true });
    const explicitVsixPath = path.join(outputDir, 'MyTestExtension.vsix');

    const options: PackageOptions = {
      vsixManifest,
      outputPath: explicitVsixPath,
    };

    const adapter = new RealPlatformAdapter();
    const vsixPath = await packageVsExtension(options, adapter);

    expect(vsixPath).toBe(explicitVsixPath);
    expect(existsSync(explicitVsixPath)).toBe(true);
  });
});
