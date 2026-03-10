import { AzureRMEndpoint } from "azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint.js";
import { AuthCredentials, IPlatformAdapter } from "@vs-marketplace/core";

/**
 * Get Azure RM authentication using workload identity federation (OIDC)
 *
 * Gets an Azure access token and uses it for marketplace authentication.
 * The token is obtained from Azure AD using the service connection credentials.
 */
export async function getAzureRmAuth(
  connectionName: string,
  platform: IPlatformAdapter
): Promise<AuthCredentials> {
  try {
    const endpoint = new AzureRMEndpoint(connectionName);
    const azureEndpoint = await endpoint.getEndpoint();

    // Override the Active Directory resource ID for VS Marketplace
    // This is the Visual Studio Marketplace resource ID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (
      azureEndpoint.applicationTokenCredentials as any
    ).activeDirectoryResourceId = "499b84ac-1321-427f-aa17-267ca6975798";

    // Get the token from the application token credentials
    const token = await azureEndpoint.applicationTokenCredentials.getToken();

    if (!token) {
      throw new Error("Failed to get access token from Azure RM endpoint");
    }

    // Mask the token immediately to prevent exposure in logs
    platform.setSecret(token);

    // For marketplace operations, use the marketplace URL
    const serviceUrl = "https://marketplace.visualstudio.com";

    return {
      authType: "pat",
      serviceUrl,
      token: token,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const wrappedError = new Error(
      `Failed to get Azure RM authentication: ${errorMessage}`
    ) as Error & { cause?: unknown };
    wrappedError.cause = error;
    throw wrappedError;
  }
}
