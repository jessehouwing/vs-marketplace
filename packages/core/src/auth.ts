/**
 * Authentication types and interfaces
 */

/**
 * Authentication credentials for accessing the Visual Studio Marketplace
 */
export interface AuthCredentials {
  /** Type of authentication */
  authType: "pat";
  /** Service URL (marketplace URL) */
  serviceUrl: string;
  /** Personal Access Token */
  token: string;
}

/**
 * Auth provider interface
 * Platform-specific implementations handle PAT endpoints, OIDC/Entra flows, etc.
 */
export interface IAuthProvider {
  /**
   * Resolve credentials from platform-specific configuration.
   * @returns Promise resolving to authentication credentials
   */
  getCredentials(): Promise<AuthCredentials>;
}
