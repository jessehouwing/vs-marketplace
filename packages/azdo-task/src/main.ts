import * as tl from 'azure-pipelines-task-lib/task.js';
import {
  publishVsExtension,
  PublishOptions,
  packageVsExtension,
  PackageOptions,
} from '@vs-marketplace/core';
import { AzdoAdapter } from './azdo-adapter.js';
import { getAuth } from './auth/index.js';

async function run(): Promise<void> {
  const adapter = new AzdoAdapter();
  let operationInvoked = false;

  try {
    const operation = (tl.getInput('operation', true) || 'Publish').toLowerCase();

    if (operation === 'package') {
      const vsixManifest = tl.getPathInput('vsixManifest', true, true)!;
      const outputPath = tl.getPathInput('outputPath', true, false)!;
      const contentDir = tl.filePathSupplied('contentDir')
        ? tl.getPathInput('contentDir', false, false) || undefined
        : undefined;

      const options: PackageOptions = {
        vsixManifest,
        outputPath,
        contentDir,
      };

      operationInvoked = true;
      const vsixFile = await packageVsExtension(options, adapter);
      tl.setVariable('vsixFile', vsixFile, false, true);
    } else {
      // Publish operation (default)
      const connectionType = adapter.getInput('connectionType', true);
      if (!connectionType) {
        throw new Error('connectionType is required');
      }

      const normalizedConnectionType = connectionType.trim().toLowerCase();

      let connectionName: string | undefined;
      if (normalizedConnectionType === 'pat') {
        connectionName = adapter.getInput('connectionNamePAT', true);
      } else if (normalizedConnectionType === 'workloadidentity') {
        connectionName = adapter.getInput('connectionNameWorkloadIdentity', true);
      } else if (normalizedConnectionType === 'azurerm') {
        connectionName = adapter.getInput('connectionNameAzureRM', true);
      }

      if (!connectionName) {
        throw new Error('Service connection name is required');
      }

      const auth = await getAuth(connectionType, connectionName, adapter);

      const vsixFile = tl.getPathInput('vsixFile', true, true);
      const manifestFile = tl.getPathInput('manifestFile', true, true);
      const publisherId = tl.getInput('publisherId', true);
      const ignoreWarnings = tl.getInput('ignoreWarnings', false);

      if (!vsixFile || !manifestFile || !publisherId || !auth.token) {
        throw new Error('Required inputs are missing');
      }

      const options: PublishOptions = {
        connectTo: 'pat',
        token: auth.token,
        vsixFile,
        manifestFile,
        publisherId,
        ignoreWarnings: ignoreWarnings || undefined,
      };

      operationInvoked = true;
      await publishVsExtension(options, adapter);
    }
  } catch (error) {
    if (operationInvoked) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    adapter.error(message);
    adapter.setResult(1, message);
  }
}

run();
