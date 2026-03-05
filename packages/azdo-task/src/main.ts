import * as tl from "azure-pipelines-task-lib/task.js";
import { publishVsExtension, PublishOptions } from "@vs-marketplace/core";
import { AzdoAdapter } from "./azdo-adapter.js";
import { getAuth } from "./auth/index.js";

async function run(): Promise<void> {
  const adapter = new AzdoAdapter();
  let publishInvoked = false;

  try {
    // Get authentication configuration
    const connectionType = adapter.getInput("connectionType", true);
    if (!connectionType) {
      throw new Error("connectionType is required");
    }

    const normalizedConnectionType = connectionType.trim().toLowerCase();

    // Get the appropriate connection name based on type
    let connectionName: string | undefined;
    if (normalizedConnectionType === "pat") {
      connectionName = adapter.getInput("connectionNamePAT", true);
    } else if (normalizedConnectionType === "workloadidentity") {
      connectionName = adapter.getInput("connectionNameWorkloadIdentity", true);
    } else if (normalizedConnectionType === "azurerm") {
      connectionName = adapter.getInput("connectionNameAzureRM", true);
    }

    if (!connectionName) {
      throw new Error("Service connection name is required");
    }

    // Get authentication credentials using the new auth system
    const auth = await getAuth(connectionType, connectionName, adapter);

    // Get task inputs
    const vsixFile = tl.getPathInput("vsixFile", true, true);
    const manifestFile = tl.getPathInput("manifestFile", true, true);
    const publisherId = tl.getInput("publisherId", true);
    const ignoreWarnings = tl.getInput("ignoreWarnings", false);

    if (!vsixFile || !manifestFile || !publisherId || !auth.token) {
      throw new Error("Required inputs are missing");
    }

    const options: PublishOptions = {
      connectTo: "pat", // All auth methods return a token that works like PAT
      token: auth.token,
      vsixFile,
      manifestFile,
      publisherId,
      ignoreWarnings: ignoreWarnings || undefined,
    };

    // Publish the extension
    publishInvoked = true;
    await publishVsExtension(options, adapter);
  } catch (error) {
    if (publishInvoked) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    adapter.error(message);
    adapter.setResult(1, message);
  }
}

run();
