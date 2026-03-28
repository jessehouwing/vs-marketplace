import { IPlatformAdapter } from './platform-adapter.js';
import path from 'path';
import { fileURLToPath } from 'url';

export interface PackageOptions {
  vsixManifest: string;
  outputPath: string;
  contentDir?: string;
}

export class VsixPackager {
  private vsixUtilPath: string | null = null;

  constructor(private adapter: IPlatformAdapter) {}

  /**
   * Find VSIXUtil.exe using vswhere
   */
  private async getVsixUtilExe(): Promise<string> {
    if (this.vsixUtilPath) {
      return this.vsixUtilPath;
    }

    const vswherePath = this.findVswhere();
    if (!vswherePath) {
      throw new Error(
        'Could not locate vswhere.exe. Ensure Visual Studio is installed on the agent.'
      );
    }

    const result = await this.adapter.execOutput(
      vswherePath,
      [
        '-version',
        '[15.0,)',
        '-latest',
        '-requires',
        'Microsoft.VisualStudio.Component.VSSDK',
        '-find',
        'VSSDK\\VisualStudioIntegration\\Tools\\Bin\\VSIXUtil.exe',
      ],
      {
        failOnStdErr: false,
        ignoreReturnCode: true,
      }
    );

    if (result.code === 0 && result.stdout) {
      const paths = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      for (const vsixUtilExe of paths) {
        if (this.adapter.fileExists(vsixUtilExe)) {
          this.adapter.debug(`VSIXUtil.exe found at: ${vsixUtilExe}`);
          this.vsixUtilPath = vsixUtilExe;
          return vsixUtilExe;
        }
      }
    }

    throw new Error(
      'Could not locate VSIXUtil.exe. Ensure the Visual Studio SDK is installed on the agent.'
    );
  }

  /**
   * Find vswhere.exe in common locations
   */
  private findVswhere(): string | null {
    const bundlePath = process.argv[1]
      ? path.resolve(process.argv[1])
      : fileURLToPath(import.meta.url);
    const bundleDir = path.dirname(bundlePath);
    const bundledVswhere = path.join(bundleDir, 'tools', 'vswhere.exe');

    this.adapter.debug(`Checking for bundled vswhere at: ${bundledVswhere}`);
    if (this.adapter.fileExists(bundledVswhere)) {
      this.adapter.debug('Using bundled vswhere.exe');
      return bundledVswhere;
    }

    const programFiles = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const vswherePath = `${programFiles}\\Microsoft Visual Studio\\Installer\\vswhere.exe`;

    this.adapter.debug(`Checking for system vswhere at: ${vswherePath}`);
    if (this.adapter.fileExists(vswherePath)) {
      return vswherePath;
    }

    return 'vswhere.exe';
  }

  /**
   * Package a Visual Studio extension into a .vsix file
   */
  async package(vsixManifest: string, outputPath: string, contentDir?: string): Promise<string> {
    this.adapter.info(`Packaging Visual Studio extension from manifest '${vsixManifest}'`);

    const vsixUtil = await this.getVsixUtilExe();

    const args = ['CreateVsix', vsixManifest];

    if (outputPath) {
      args.push('/out', outputPath);
    }

    if (contentDir) {
      args.push('/dir', contentDir);
    }

    const exitCode = await this.adapter.exec(vsixUtil, args, {
      failOnStdErr: false,
    });

    if (exitCode !== 0) {
      throw new Error(`VSIXUtil.exe CreateVsix failed with exit code ${exitCode}.`);
    }

    this.adapter.info('Extension packaged successfully.');
    return outputPath;
  }
}

/**
 * Main package function
 */
export async function packageVsExtension(
  options: PackageOptions,
  adapter: IPlatformAdapter
): Promise<void> {
  try {
    const packager = new VsixPackager(adapter);
    await packager.package(options.vsixManifest, options.outputPath, options.contentDir);
    adapter.setResult(0, 'Visual Studio extension packaged successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    adapter.setResult(1, message);
    throw error;
  }
}
