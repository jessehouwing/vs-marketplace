import * as tl from "azure-pipelines-task-lib/task.js";
import { AzureRMEndpoint } from "azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint.js";
import { publishVsExtension, PublishOptions } from "@vs-marketplace/core";
import { AzdoAdapter } from "./azdo-adapter.js";

async function run(): Promise<void> {
  const adapter = new AzdoAdapter();

  try {
    // Get authentication configuration
    const connectTo = (tl.getInput("connectTo", false) ?? "AzureRM") as
      | "VsTeam"
      | "AzureRM";

    let token: string;

    if (connectTo === "VsTeam") {
      // Personal Access Token authentication
      const connectedService = tl.getInput("connectedServiceName", true);
      if (!connectedService) {
        throw new Error("connectedServiceName is required");
      }
      token = tl.getEndpointAuthorizationParameter(
        connectedService,
        "password",
        true
      );
    } else {
      // OIDC / Azure RM authentication
      const connectedService = tl.getInput("connectedServiceNameAzureRM", true);
      if (!connectedService) {
        throw new Error("connectedServiceNameAzureRM is required");
      }

      const endpoint = await new AzureRMEndpoint(connectedService).getEndpoint();

      // Override the Active Directory resource ID for VS Marketplace
      // This is the Visual Studio Marketplace resource ID
      (endpoint.applicationTokenCredentials as any).activeDirectoryResourceId =
        "499b84ac-1321-427f-aa17-267ca6975798";

      token = await endpoint.applicationTokenCredentials.getToken();
    }

    // Get task inputs
    const vsixFile = tl.getPathInput("vsixFile", true, true);
    const manifestFile = tl.getPathInput("manifestFile", true, true);
    const publisherId = tl.getInput("publisherId", true);
    const ignoreWarnings = tl.getInput("ignoreWarnings", false);

    if (!vsixFile || !manifestFile || !publisherId) {
      throw new Error("Required inputs are missing");
    }

    const options: PublishOptions = {
      connectTo: connectTo === "VsTeam" ? "pat" : "oidc",
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
