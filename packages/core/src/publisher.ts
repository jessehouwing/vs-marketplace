import { IPlatformAdapter } from "./platform-adapter.js";
import path from "path";
import { fileURLToPath } from "url";

export interface PublishOptions {
  connectTo: "pat" | "oidc";
  token: string;
  vsixFile: string;
  manifestFile: string;
  publisherId: string;
  ignoreWarnings?: string;
}

export class VsixPublisher {
  private vsixPublisherPath: string | null = null;
  private loggedIn = false;

  constructor(private adapter: IPlatformAdapter) {}

  /**
   * Find VsixPublisher.exe using vswhere
   */
  private async getVsixPublisherExe(): Promise<string> {
    if (this.vsixPublisherPath) {
      return this.vsixPublisherPath;
    }

    // On Windows, VsixPublisher.exe comes with Visual Studio
    // We'll use vswhere to find it
    const vswherePath = this.findVswhere();
    if (!vswherePath) {
      throw new Error(
        "Could not locate vswhere.exe. Ensure Visual Studio is installed on the agent."
      );
    }

    const result = await this.adapter.execOutput(
      vswherePath,
      [
        "-version",
        "[15.0,)",
        "-latest",
        "-requires",
        "Microsoft.VisualStudio.Component.VSSDK",
        "-find",
        "VSSDK\\VisualStudioIntegration\\Tools\\Bin\\VsixPublisher.exe",
      ],
      {
        failOnStdErr: false,
        ignoreReturnCode: true,
      }
    );

    if (result.code === 0 && result.stdout) {
      // vswhere -find can return multiple paths (one per line)
      // Split by line breaks and pick the first existing path
      const paths = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      for (const vsixPublisherExe of paths) {
        if (this.adapter.fileExists(vsixPublisherExe)) {
          this.adapter.debug(`VsixPublisher.exe found at: ${vsixPublisherExe}`);
          this.vsixPublisherPath = vsixPublisherExe;
          return vsixPublisherExe;
        }
      }
    }

    throw new Error(
      "Could not locate VsixPublisher.exe. Ensure the Visual Studio SDK is installed on the agent."
    );
  }

  /**
   * Find vswhere.exe in common locations
   */
  private findVswhere(): string | null {
    // Prefer vswhere bundled alongside the runtime entrypoint (dist/bundle.js).
    const bundlePath = process.argv[1]
      ? path.resolve(process.argv[1])
      : fileURLToPath(import.meta.url);
    const bundleDir = path.dirname(bundlePath);
    const bundledVswhere = path.join(bundleDir, "tools", "vswhere.exe");

    this.adapter.debug(`Checking for bundled vswhere at: ${bundledVswhere}`);
    if (this.adapter.fileExists(bundledVswhere)) {
      this.adapter.debug(`Using bundled vswhere.exe`);
      return bundledVswhere;
    }

    // Fallback: Common vswhere locations in Visual Studio installation
    const programFiles =
      process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    const vswherePath = `${programFiles}\\Microsoft Visual Studio\\Installer\\vswhere.exe`;

    this.adapter.debug(`Checking for system vswhere at: ${vswherePath}`);
    if (this.adapter.fileExists(vswherePath)) {
      return vswherePath;
    }

    // Try to find in PATH
    // For now, assume it's available or bundled
    return "vswhere.exe";
  }

  /**
   * Login to Visual Studio Marketplace
   */
  async login(publisherId: string, token: string): Promise<void> {
    this.adapter.info(`Logging in as '${publisherId}'`);

    const vsixPublisher = await this.getVsixPublisherExe();
    const args = [
      "login",
      "-personalAccessToken",
      token,
      "-publisherName",
      publisherId,
    ];

    const exitCode = await this.adapter.exec(vsixPublisher, args, {
      failOnStdErr: true,
    });

    if (exitCode !== 0) {
      throw new Error("Login failed.");
    }

    this.loggedIn = true;
    this.adapter.info("Login successful.");
  }

  /**
   * Logout from Visual Studio Marketplace
   */
  async logout(publisherId: string): Promise<void> {
    if (!this.loggedIn) {
      this.adapter.info("Already logged out.");
      return;
    }

    this.adapter.info(`Logging out publisher '${publisherId}'`);

    const vsixPublisher = await this.getVsixPublisherExe();
    const args = [
      "logout",
      "-publisherName",
      publisherId,
      "-ignoreMissingPublisher",
    ];

    const result = await this.adapter.execOutput(vsixPublisher, args, {
      failOnStdErr: false,
      ignoreReturnCode: true,
    });

    if (result.code !== 0) {
      if (result.code === 31) {
        this.adapter.debug(
          "Logout returned exit code 31 (already logged out); treating as success."
        );
        this.loggedIn = false;
        this.adapter.info("Already logged out.");
        return;
      }

      const combinedOutput = `${result.stdout || ""}\n${result.stderr || ""}`.toLowerCase();
      const alreadyLoggedOut = combinedOutput.includes("already logged out");
      if (alreadyLoggedOut) {
        this.adapter.debug(
          `Logout returned exit code ${result.code} with 'already logged out' message; treating as success.`
        );
        this.loggedIn = false;
        this.adapter.info("Already logged out.");
        return;
      }

      throw new Error(`Logout failed (exit code ${result.code}).`);
    }

    this.loggedIn = false;
    this.adapter.info("Logout successful.");
  }

  /**
   * Publish VSIX to Visual Studio Marketplace
   */
  async publish(
    vsixPath: string,
    manifestPath: string,
    warningsToIgnore?: string
  ): Promise<void> {
    this.adapter.info(`Publishing '${vsixPath}' to Visual Studio Marketplace`);

    const vsixPublisher = await this.getVsixPublisherExe();
    const args = [
      "publish",
      "-payload",
      vsixPath,
      "-publishManifest",
      manifestPath,
    ];

    if (warningsToIgnore) {
      // Normalize: support both comma-separated and newline-separated lists
      const warnings = warningsToIgnore
        .split(/[\n,]/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0)
        .join(",");
      if (warnings) {
        args.push("-ignoreWarnings", warnings);
      }
    }

    const exitCode = await this.adapter.exec(vsixPublisher, args, {
      failOnStdErr: true,
    });

    if (exitCode !== 0) {
      throw new Error("Publish failed.");
    }

    this.adapter.info("Published successfully.");
  }
}

/**
 * Main publish function
 */
export async function publishVsExtension(
  options: PublishOptions,
  adapter: IPlatformAdapter
): Promise<void> {
  let publisher: VsixPublisher | null = null;
  const { publisherId } = options;

  try {
    // Mask the token
    adapter.setSecret(options.token);

    // Create publisher instance
    publisher = new VsixPublisher(adapter);

    // Login
    await publisher.login(publisherId, options.token);

    // Publish
    await publisher.publish(
      options.vsixFile,
      options.manifestFile,
      options.ignoreWarnings
    );

    adapter.setResult(0, "Visual Studio extension published successfully");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    adapter.setResult(1, message);
    throw error;
  } finally {
    // Always logout
    if (publisher) {
      try {
        await publisher.logout(publisherId);
      } catch (logoutError) {
        adapter.debug(
          `Logout error: ${logoutError instanceof Error ? logoutError.message : String(logoutError)}`
        );
      }
    }
    adapter.info("All done");
  }
}
