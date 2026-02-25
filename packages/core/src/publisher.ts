import { IPlatformAdapter } from "./platform-adapter.js";

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
  private getVsixPublisherExe(): string {
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

    const result = this.adapter.execSync(vswherePath, [
      "-version",
      "[15.0,)",
      "-latest",
      "-requires",
      "Microsoft.VisualStudio.Component.VSSDK",
      "-find",
      "VSSDK\\VisualStudioIntegration\\Tools\\Bin\\VsixPublisher.exe",
    ]);

    if (result.code === 0 && result.stdout) {
      const vsixPublisherExe = result.stdout.trim();
      if (this.adapter.fileExists(vsixPublisherExe)) {
        this.adapter.debug(`VsixPublisher.exe found at: ${vsixPublisherExe}`);
        this.vsixPublisherPath = vsixPublisherExe;
        return vsixPublisherExe;
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
    // Common vswhere locations
    const programFiles =
      process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    const vswherePath = `${programFiles}\\Microsoft Visual Studio\\Installer\\vswhere.exe`;

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

    const vsixPublisher = this.getVsixPublisherExe();
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

    const vsixPublisher = this.getVsixPublisherExe();
    const args = [
      "logout",
      "-publisherName",
      publisherId,
      "-ignoreMissingPublisher",
    ];

    const exitCode = await this.adapter.exec(vsixPublisher, args, {
      failOnStdErr: true,
    });

    if (exitCode !== 0) {
      throw new Error("Logout failed.");
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

    const vsixPublisher = this.getVsixPublisherExe();
    const args = [
      "publish",
      "-payload",
      vsixPath,
      "-publishManifest",
      manifestPath,
    ];

    if (warningsToIgnore) {
      args.push("-ignoreWarnings", warningsToIgnore);
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
    adapter.error(message);
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
