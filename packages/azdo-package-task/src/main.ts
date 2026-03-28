import * as tl from 'azure-pipelines-task-lib/task.js';
import { packageVsExtension, PackageOptions } from '@vs-marketplace/core';
import { AzdoPackageAdapter } from './azdo-package-adapter.js';

async function run(): Promise<void> {
  const adapter = new AzdoPackageAdapter();
  let packageInvoked = false;

  try {
    const vsixManifest = tl.getPathInput('vsixManifest', true, true);
    const outputPath = tl.getPathInput('outputPath', true, false);

    if (!vsixManifest || !outputPath) {
      throw new Error('Required inputs are missing');
    }

    const contentDir = tl.getInput('contentDir', false) || undefined;

    const options: PackageOptions = {
      vsixManifest,
      outputPath,
      contentDir,
    };

    packageInvoked = true;
    await packageVsExtension(options, adapter);
  } catch (error) {
    if (packageInvoked) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    adapter.error(message);
    adapter.setResult(1, message);
  }
}

run();
