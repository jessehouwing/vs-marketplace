import { IPlatformAdapter, ExecOptions, ExecResult, TaskResult } from '../platform-adapter.js';

/**
 * Mock implementation of IPlatformAdapter for testing
 */
export class MockPlatformAdapter implements IPlatformAdapter {
  private inputs: Map<string, string> = new Map();
  private secrets: Set<string> = new Set();
  private logs: {
    info: string[];
    error: string[];
    debug: string[];
  } = {
    info: [],
    error: [],
    debug: [],
  };
  private execCalls: Array<{
    command: string;
    args: string[];
    options?: ExecOptions;
  }> = [];
  private execOutputCalls: Array<{
    command: string;
    args: string[];
    options?: ExecOptions;
  }> = [];
  private fileExistsMap: Map<string, boolean> = new Map();
  private execMockResponse: number = 0;
  private execOutputMockResponse: ExecResult = {
    code: 0,
    stdout: '',
    stderr: '',
  };
  private taskResult: { result: TaskResult; message: string } | null = null;

  // Configuration methods for tests
  setInput(name: string, value: string): void {
    this.inputs.set(name, value);
  }

  setFileExists(path: string, exists: boolean): void {
    this.fileExistsMap.set(path, exists);
  }

  setExecMockResponse(exitCode: number): void {
    this.execMockResponse = exitCode;
  }

  setExecOutputMockResponse(result: ExecResult): void {
    this.execOutputMockResponse = result;
  }

  // Getters for assertions
  getSecrets(): Set<string> {
    return this.secrets;
  }

  getLogs() {
    return this.logs;
  }

  getExecCalls() {
    return this.execCalls;
  }

  getExecOutputCalls() {
    return this.execOutputCalls;
  }

  getTaskResult() {
    return this.taskResult;
  }

  // IPlatformAdapter implementation
  getInput(name: string, required: boolean): string | undefined {
    const value = this.inputs.get(name);
    if (required && !value) {
      throw new Error(`Required input '${name}' was not supplied`);
    }
    return value;
  }

  getPathInput(name: string, required: boolean, checkExists: boolean): string {
    const value = this.getInput(name, required);
    if (!value) {
      throw new Error(`Required path input '${name}' was not supplied`);
    }
    if (checkExists && !this.fileExists(value)) {
      throw new Error(`Path '${value}' does not exist`);
    }
    return value;
  }

  setSecret(secret: string): void {
    this.secrets.add(secret);
  }

  info(message: string): void {
    this.logs.info.push(message);
  }

  error(message: string): void {
    this.logs.error.push(message);
  }

  debug(message: string): void {
    this.logs.debug.push(message);
  }

  async exec(command: string, args: string[], options?: ExecOptions): Promise<number> {
    this.execCalls.push({ command, args, options });
    return this.execMockResponse;
  }

  async execOutput(command: string, args: string[], options?: ExecOptions): Promise<ExecResult> {
    this.execOutputCalls.push({ command, args, options });
    return this.execOutputMockResponse;
  }

  fileExists(path: string): boolean {
    return this.fileExistsMap.get(path) ?? false;
  }

  setResult(result: TaskResult, message: string): void {
    this.taskResult = { result, message };
  }
}
