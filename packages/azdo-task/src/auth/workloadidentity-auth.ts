import { AuthCredentials, IPlatformAdapter } from "@vs-marketplace/core";

/**
 * Get Workload Identity authentication from service connection.
 * Uses the azure-pipelines-tasks-artifacts-common library for federated credentials.
 */
export async function getWorkloadIdentityAuth(
  connectionName: string,
  platform: IPlatformAdapter
): Promise<AuthCredentials> {
  try {
    // Dynamic import to avoid dependency issues if the package is not available
    const { getFederatedWorkloadIdentityCredentials } =
      await import("azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils.js");

    const token = await getFederatedWorkloadIdentityCredentials(connectionName);

    if (!token) {
      throw new Error(
        `Failed to get service connection auth for workload identity service connection '${connectionName}'`
      );
    }

    platform.setSecret(token);

    return {
      authType: "pat",
      serviceUrl: "https://marketplace.visualstudio.com",
      token,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to get workload identity authentication: ${errorMessage}`,
      { cause: error }
    );
  }
}
