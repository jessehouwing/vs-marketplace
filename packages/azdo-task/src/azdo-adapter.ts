import * as tl from "azure-pipelines-task-lib/task.js";
import {
  IPlatformAdapter,
  ExecOptions,
  ExecResult,
  TaskResult as CoreTaskResult,
} from "@vs-marketplace/core";

export class AzdoAdapter implements IPlatformAdapter {
  getInput(name: string, required: boolean): string | undefined {
    const value = tl.getInput(name, required);
    return value ?? undefined;
  }

  getPathInput(name: string, required: boolean, checkExists: boolean): string {
    const value = tl.getPathInput(name, required, checkExists);
    if (!value) {
      throw new Error(`Required path input '${name}' was not supplied`);
    }
    return value;
  }

  setSecret(secret: string): void {
    tl.setSecret(secret);
  }

  info(message: string): void {
    console.log(message);
  }

  error(message: string): void {
    tl.error(message);
  }

  debug(message: string): void {
    tl.debug(message);
  }

  async exec(
    command: string,
    args: string[],
    options?: ExecOptions
  ): Promise<number> {
    const tool = tl.tool(command);
    for (const arg of args) {
      tool.arg(arg);
    }

    return await tool.exec({
      failOnStdErr: options?.failOnStdErr,
      cwd: options?.cwd,
      silent: options?.silent,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }

  execSync(command: string, args: string[], options?: ExecOptions): ExecResult {
    const tool = tl.tool(command);
    for (const arg of args) {
      tool.arg(arg);
    }

    const result = tool.execSync({
      failOnStdErr: options?.failOnStdErr,
      cwd: options?.cwd,
      silent: options?.silent,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    return {
      code: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  fileExists(path: string): boolean {
    return tl.exist(path);
  }

  setResult(result: CoreTaskResult, message: string): void {
    const azdoResult =
      result === CoreTaskResult.Succeeded
        ? tl.TaskResult.Succeeded
        : tl.TaskResult.Failed;
    tl.setResult(azdoResult, message);
  }
}
