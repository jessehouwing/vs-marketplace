import path from 'path';
import { packageVsExtension, PackageOptions } from '../packager.js';
import { TaskResult } from '../platform-adapter.js';
import { MockPlatformAdapter } from './mock-platform-adapter.js';

describe('packageVsExtension', () => {
  let adapter: MockPlatformAdapter;

  beforeEach(() => {
    adapter = new MockPlatformAdapter();
  });

  const baseOptions: PackageOptions = {
    vsixManifest: 'C:\\source.extension.vsixmanifest',
    outputPath: 'C:\\output',
  };

  const vsixUtil = 'C:\\VS\\VSIXUtil.exe';
  const vsixOutputPath = 'C:\\output\\MyExt.vsix';

  function setupVsixUtil() {
    adapter.setFileExists(vsixUtil, true);
    adapter.setFindMatchMockResponse([vsixOutputPath]);
    adapter.setExecOutputResponseQueue([
      { code: 0, stdout: vsixUtil, stderr: '' },
      { code: 0, stdout: '', stderr: '' },
    ]);
  }

  it('calls vswhere then VSIXUtil package on success', async () => {
    setupVsixUtil();

    await packageVsExtension(baseOptions, adapter);

    const outputCalls = adapter.getExecOutputCalls();
    expect(outputCalls).toHaveLength(2);
    expect(outputCalls[0].args).toContain('-find');
    expect(outputCalls[0].args).toContain(
      'VSSDK\\VisualStudioIntegration\\Tools\\Bin\\VSIXUtil.exe'
    );
    expect(outputCalls[1].command).toBe(vsixUtil);
    expect(outputCalls[1].args[0]).toBe('package');
    expect(outputCalls[1].args).toContain('-sourceManifest');
    expect(outputCalls[1].args).toContain(baseOptions.vsixManifest);
  });

  it('passes output path to VSIXUtil', async () => {
    setupVsixUtil();

    await packageVsExtension(baseOptions, adapter);

    const outputCalls = adapter.getExecOutputCalls();
    expect(outputCalls[1].args).toContain('-outputPath');
    expect(outputCalls[1].args).toContain(baseOptions.outputPath);
  });

  it('passes files manifest when provided', async () => {
    setupVsixUtil();

    const options: PackageOptions = {
      ...baseOptions,
      filesManifest: 'C:\\extension-content\\files.json',
    };

    await packageVsExtension(options, adapter);

    const outputCalls = adapter.getExecOutputCalls();
    expect(outputCalls[1].args).toContain('-files');
    expect(outputCalls[1].args).toContain(options.filesManifest);
  });

  it('does not pass files manifest when not provided', async () => {
    setupVsixUtil();

    await packageVsExtension(baseOptions, adapter);

    const outputCalls = adapter.getExecOutputCalls();
    expect(outputCalls[1].args).not.toContain('-files');
  });

  it('passes working directory as cwd to VSIXUtil exec call', async () => {
    const options: PackageOptions = {
      ...baseOptions,
      workingDirectory: 'C:\\my-extension',
    };
    setupVsixUtil();

    await packageVsExtension(options, adapter);

    const outputCalls = adapter.getExecOutputCalls();
    expect(outputCalls[1].options?.cwd).toBe('C:\\my-extension');
  });

  it('does not set cwd when working directory is not specified', async () => {
    setupVsixUtil();

    await packageVsExtension(baseOptions, adapter);

    const outputCalls = adapter.getExecOutputCalls();
    expect(outputCalls[1].options?.cwd).toBeUndefined();
  });

  it('resolves relative outputPath ending in .vsix against workingDirectory for file existence check', async () => {
    const workingDirectory = '/work/extension';
    const relativeOutputPath = 'dist/MyExt.vsix';
    const resolvedPath = path.join(workingDirectory, relativeOutputPath);

    const options: PackageOptions = {
      vsixManifest: '/work/extension/source.extension.vsixmanifest',
      outputPath: relativeOutputPath,
      workingDirectory,
    };

    adapter.setFileExists(vsixUtil, true);
    adapter.setFileExists(resolvedPath, true);
    adapter.setExecOutputResponseQueue([
      { code: 0, stdout: vsixUtil, stderr: '' },
      { code: 0, stdout: '', stderr: '' },
    ]);

    const result = await packageVsExtension(options, adapter);

    expect(result).toBe(resolvedPath);
  });

  it('sets task result to Succeeded on success', async () => {
    setupVsixUtil();

    await packageVsExtension(baseOptions, adapter);

    expect(adapter.getTaskResult()?.result).toBe(TaskResult.Succeeded);
  });

  it('sets task result to Failed when VSIXUtil fails', async () => {
    adapter.setFileExists(vsixUtil, true);
    adapter.setExecOutputResponseQueue([
      { code: 0, stdout: vsixUtil, stderr: '' },
      { code: 1, stdout: '', stderr: 'Error' },
    ]);

    await expect(packageVsExtension(baseOptions, adapter)).rejects.toThrow();
    expect(adapter.getTaskResult()?.result).toBe(TaskResult.Failed);
  });

  it('throws when vswhere cannot find VSIXUtil', async () => {
    adapter.setExecOutputMockResponse({ code: 1, stdout: '', stderr: 'Not found' });

    await expect(packageVsExtension(baseOptions, adapter)).rejects.toThrow(
      'Could not locate VSIXUtil.exe'
    );
  });

  it('returns the resolved vsix path', async () => {
    setupVsixUtil();

    const result = await packageVsExtension(baseOptions, adapter);

    expect(result).toBe(vsixOutputPath);
  });

  it('returns outputPath directly when outputPath ends with .vsix', async () => {
    const vsixOptions: PackageOptions = {
      ...baseOptions,
      outputPath: 'C:\\output\\MyExt.vsix',
    };
    adapter.setFileExists(vsixUtil, true);
    adapter.setFileExists('C:\\output\\MyExt.vsix', true);
    adapter.setExecOutputResponseQueue([
      { code: 0, stdout: vsixUtil, stderr: '' },
      { code: 0, stdout: '', stderr: '' },
    ]);

    const result = await packageVsExtension(vsixOptions, adapter);

    expect(result).toBe('C:\\output\\MyExt.vsix');
  });
});
