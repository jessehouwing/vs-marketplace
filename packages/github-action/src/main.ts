import * as core from '@actions/core';
import { DefaultAzureCredential } from '@azure/identity';
import {
  publishVsExtension,
  PublishOptions,
  packageVsExtension,
  PackageOptions,
} from '@vs-marketplace/core';
import { GitHubAdapter } from './github-adapter.js';

async function run(): Promise<void> {
  const adapter = new GitHubAdapter();
  let operationInvoked = false;

  try {
    const operation = (core.getInput('operation', { required: false }) || 'publish').toLowerCase();

    if (operation === 'package') {
      const vsixManifest = core.getInput('vsix-manifest', { required: true });
      const outputPath = core.getInput('output-path', { required: true });
      const filesManifest =
        core.getInput('files-manifest', { required: false }) ||
        core.getInput('content-dir', { required: false }) ||
        undefined;
      const workingDirectory = core.getInput('working-directory', { required: false }) || undefined;

      const options: PackageOptions = {
        vsixManifest,
        outputPath,
        filesManifest,
        workingDirectory,
      };

      operationInvoked = true;
      const vsixFile = await packageVsExtension(options, adapter);
      core.setOutput('vsix-file', vsixFile);
    } else {
      // Publish operation (default)
      const authType = core.getInput('auth-type', { required: false }) || 'pat';

      let token: string;

      if (authType === 'pat') {
        token = core.getInput('token', { required: true });
      } else if (authType === 'oidc') {
        const credential = new DefaultAzureCredential();
        const tokenResponse = await credential.getToken(
          '499b84ac-1321-427f-aa17-267ca6975798/.default'
        );

        if (!tokenResponse || !tokenResponse.token) {
          throw new Error(
            'Failed to obtain access token from Azure credentials. ' +
              'Ensure Azure login is configured and has permissions for Visual Studio Marketplace.'
          );
        }

        token = tokenResponse.token;
      } else {
        throw new Error(`Unsupported auth-type: ${authType}`);
      }

      const vsixFile = core.getInput('vsix-file', { required: true });
      const manifestFile = core.getInput('manifest-file', { required: true });
      const publisherId = core.getInput('publisher-id', { required: true });
      const ignoreWarnings = core.getInput('ignore-warnings', { required: false });
      const workingDirectory = core.getInput('working-directory', { required: false }) || undefined;

      const options: PublishOptions = {
        connectTo: authType === 'pat' ? 'pat' : 'oidc',
        token,
        vsixFile,
        manifestFile,
        publisherId,
        ignoreWarnings: ignoreWarnings || undefined,
        workingDirectory,
      };

      operationInvoked = true;
      await publishVsExtension(options, adapter);
    }
  } catch (error) {
    if (operationInvoked) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    adapter.setResult(1, message);
  }
}

run();
