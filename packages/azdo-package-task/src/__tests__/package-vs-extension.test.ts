import { packageVsExtension, PackageOptions, TaskResult } from '@vs-marketplace/core';
import { MockPlatformAdapter } from '../../../core/src/__tests__/mock-platform-adapter.js';

describe('packageVsExtension', () => {
  let adapter: MockPlatformAdapter;

  beforeEach(() => {
    adapter = new MockPlatformAdapter();
  });

  const baseOptions: PackageOptions = {
    vsixManifest: 'C:\\source.extension.vsixmanifest',
    outputPath: 'C:\\output',
  };

  function setupVsixUtil(vsixUtilPath: string) {
    adapter.setFileExists(vsixUtilPath, true);
    adapter.setExecOutputMockResponse({
      code: 0,
      stdout: vsixUtilPath,
      stderr: '',
    });
  }

  it('calls vswhere then VSIXUtil CreateVsix on success', async () => {
    const vsixUtil = 'C:\\VS\\VSIXUtil.exe';
    setupVsixUtil(vsixUtil);

    await packageVsExtension(baseOptions, adapter);

    const outputCalls = adapter.getExecOutputCalls();
    expect(outputCalls).toHaveLength(1);
    expect(outputCalls[0].args).toContain('-find');
    expect(outputCalls[0].args).toContain(
      'VSSDK\\VisualStudioIntegration\\Tools\\Bin\\VSIXUtil.exe'
    );

    const execCalls = adapter.getExecCalls();
    expect(execCalls).toHaveLength(1);
    expect(execCalls[0].command).toBe(vsixUtil);
    expect(execCalls[0].args[0]).toBe('CreateVsix');
    expect(execCalls[0].args[1]).toBe(baseOptions.vsixManifest);
  });

  it('passes output path to VSIXUtil', async () => {
    const vsixUtil = 'C:\\VS\\VSIXUtil.exe';
    setupVsixUtil(vsixUtil);

    await packageVsExtension(baseOptions, adapter);

    const execCalls = adapter.getExecCalls();
    expect(execCalls[0].args).toContain('/out');
    expect(execCalls[0].args).toContain(baseOptions.outputPath);
  });

  it('passes content dir when provided', async () => {
    const vsixUtil = 'C:\\VS\\VSIXUtil.exe';
    setupVsixUtil(vsixUtil);

    const options: PackageOptions = {
      ...baseOptions,
      contentDir: 'C:\\extension-content',
    };

    await packageVsExtension(options, adapter);

    const execCalls = adapter.getExecCalls();
    expect(execCalls[0].args).toContain('/dir');
    expect(execCalls[0].args).toContain(options.contentDir);
  });

  it('does not pass content dir when not provided', async () => {
    const vsixUtil = 'C:\\VS\\VSIXUtil.exe';
    setupVsixUtil(vsixUtil);

    await packageVsExtension(baseOptions, adapter);

    const execCalls = adapter.getExecCalls();
    expect(execCalls[0].args).not.toContain('/dir');
  });

  it('sets task result to Succeeded on success', async () => {
    const vsixUtil = 'C:\\VS\\VSIXUtil.exe';
    setupVsixUtil(vsixUtil);

    await packageVsExtension(baseOptions, adapter);

    expect(adapter.getTaskResult()?.result).toBe(TaskResult.Succeeded);
  });

  it('sets task result to Failed when VSIXUtil fails', async () => {
    const vsixUtil = 'C:\\VS\\VSIXUtil.exe';
    adapter.setFileExists(vsixUtil, true);
    adapter.setExecOutputMockResponse({ code: 0, stdout: vsixUtil, stderr: '' });
    adapter.setExecMockResponse(1);

    await expect(packageVsExtension(baseOptions, adapter)).rejects.toThrow();
    expect(adapter.getTaskResult()?.result).toBe(TaskResult.Failed);
  });

  it('throws when vswhere cannot find VSIXUtil', async () => {
    adapter.setExecOutputMockResponse({ code: 1, stdout: '', stderr: 'Not found' });

    await expect(packageVsExtension(baseOptions, adapter)).rejects.toThrow(
      'Could not locate VSIXUtil.exe'
    );
  });
});
