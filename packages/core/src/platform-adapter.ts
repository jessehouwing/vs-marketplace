/**
 * Platform adapter interface for VS Marketplace publishing
 */
export interface IPlatformAdapter {
  /**
   * Get an input value
   */
  getInput(name: string, required: boolean): string | undefined;

  /**
   * Get a file path input
   */
  getPathInput(name: string, required: boolean, checkExists: boolean): string;

  /**
   * Mark a value as secret (mask in logs)
   */
  setSecret(secret: string): void;

  /**
   * Log an informational message
   */
  info(message: string): void;

  /**
   * Log an error message
   */
  error(message: string): void;

  /**
   * Log a debug message
   */
  debug(message: string): void;

  /**
   * Execute a command
   */
  exec(command: string, args: string[], options?: ExecOptions): Promise<number>;

  /**
   * Execute a command synchronously
   */
  execOutput(command: string, args: string[], options?: ExecOptions): Promise<ExecResult>;

  /**
   * Check if a file exists
   */
  fileExists(path: string): boolean;

  /**
   * Set task result
   */
  setResult(result: TaskResult, message: string): void;
}

export interface ExecOptions {
  silent?: boolean;
  failOnStdErr?: boolean;
  cwd?: string;
  ignoreReturnCode?: boolean;
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export enum TaskResult {
  Succeeded = 0,
  Failed = 1,
}
