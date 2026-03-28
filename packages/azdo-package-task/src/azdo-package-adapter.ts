import * as tl from 'azure-pipelines-task-lib/task.js';
import { spawn } from 'child_process';
import {
  IPlatformAdapter,
  ExecOptions,
  ExecResult,
  TaskResult as CoreTaskResult,
} from '@vs-marketplace/core';

export class AzdoPackageAdapter implements IPlatformAdapter {
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

  async exec(command: string, args: string[], options?: ExecOptions): Promise<number> {
    const result = await this.execOutput(command, args, options);
    return result.code;
  }

  async execOutput(command: string, args: string[], options?: ExecOptions): Promise<ExecResult> {
    return await new Promise<ExecResult>((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options?.cwd,
        shell: false,
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        if (!options?.silent) {
          process.stdout.write(text);
        }
      });

      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        if (!options?.silent) {
          process.stderr.write(text);
        }
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (exitCode) => {
        const code = typeof exitCode === 'number' ? exitCode : 1;

        if (options?.failOnStdErr && stderr.trim().length > 0) {
          reject(new Error(`Command wrote to stderr: ${stderr.trim()}`));
          return;
        }

        if (code !== 0 && !options?.ignoreReturnCode) {
          reject(new Error(`The process '${command}' failed with exit code ${code}`));
          return;
        }

        resolve({
          code,
          stdout,
          stderr,
        });
      });
    });
  }

  fileExists(path: string): boolean {
    return tl.exist(path);
  }

  setResult(result: CoreTaskResult, message: string): void {
    const azdoResult =
      result === CoreTaskResult.Succeeded ? tl.TaskResult.Succeeded : tl.TaskResult.Failed;
    tl.setResult(azdoResult, message);
  }
}
