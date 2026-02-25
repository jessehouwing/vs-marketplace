import * as core from "@actions/core";
import { DefaultAzureCredential } from "@azure/identity";
import { publishVsExtension, PublishOptions } from "@vs-marketplace/core";
import { GitHubAdapter } from "./github-adapter.js";

async function run(): Promise<void> {
  const adapter = new GitHubAdapter();

  try {
    // Get authentication configuration
    const authType = core.getInput("auth-type", { required: false }) || "pat";

    let token: string;

    if (authType === "pat") {
      // Personal Access Token authentication
      token = core.getInput("token", { required: true });
    } else if (authType === "oidc") {
      // OIDC authentication using Azure credentials
      const credential = new DefaultAzureCredential();

      // Get token for Visual Studio Marketplace
      // Resource ID: 499b84ac-1321-427f-aa17-267ca6975798
      const tokenResponse = await credential.getToken(
        "499b84ac-1321-427f-aa17-267ca6975798/.default"
      );
      token = tokenResponse.token;
    } else {
      throw new Error(`Unsupported auth-type: ${authType}`);
    }

    // Get action inputs
    const vsixFile = core.getInput("vsix-file", { required: true });
    const manifestFile = core.getInput("manifest-file", { required: true });
    const publisherId = core.getInput("publisher-id", { required: true });
    const ignoreWarnings = core.getInput("ignore-warnings", {
      required: false,
    });

    const options: PublishOptions = {
      connectTo: authType === "pat" ? "pat" : "oidc",
      token,
      vsixFile,
      manifestFile,
      publisherId,
      ignoreWarnings: ignoreWarnings || undefined,
    };

    // Publish the extension
    await publishVsExtension(options, adapter);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    adapter.error(message);
    adapter.setResult(1, message);
  }
}

run();
