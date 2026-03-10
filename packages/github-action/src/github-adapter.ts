import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { existsSync } from "fs";
import {
  IPlatformAdapter,
  ExecOptions,
  ExecResult,
  TaskResult,
} from "@vs-marketplace/core";

export class GitHubAdapter implements IPlatformAdapter {
  private quoteExecutablePath(command: string): string {
    if (!/\s/.test(command)) {
      return command;
    }

    if (command.startsWith('"') && command.endsWith('"')) {
      return command;
    }

    return `"${command}"`;
  }

  getInput(name: string, required: boolean): string | undefined {
    const value = core.getInput(name, { required });
    return value || undefined;
  }

  getPathInput(name: string, required: boolean, checkExists: boolean): string {
    const value = core.getInput(name, { required });
    if (!value) {
      throw new Error(`Required input '${name}' was not supplied`);
    }

    if (checkExists && !existsSync(value)) {
      throw new Error(
        `Input path '${name}' does not exist: ${value}`
      );
    }

    return value;
  }

  setSecret(secret: string): void {
    core.setSecret(secret);
  }

  info(message: string): void {
    core.info(message);
  }

  error(message: string): void {
    core.error(message);
  }

  debug(message: string): void {
    core.debug(message);
  }

  async exec(
    command: string,
    args: string[],
    options?: ExecOptions
  ): Promise<number> {
    const result = await this.execOutput(command, args, options);
    return result.code;
  }

  async execOutput(
    command: string,
    args: string[],
    options?: ExecOptions
  ): Promise<ExecResult> {
    // @actions/exec parses the command string, so unquoted Windows paths with
    // spaces (e.g. C:\Program Files\...) can be split at whitespace.
    const result = await exec.getExecOutput(this.quoteExecutablePath(command), args, {
      silent: options?.silent,
      cwd: options?.cwd,
      ignoreReturnCode: true,
      failOnStdErr: false
    });

    if (options?.failOnStdErr && result.stderr.trim().length > 0) {
      throw new Error(`Command wrote to stderr: ${result.stderr.trim()}`);
    }

    if (result.exitCode !== 0 && !options?.ignoreReturnCode) {
      throw new Error(`The process '${command}' failed with exit code ${result.exitCode}`);
    }

    return {
      code: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  fileExists(path: string): boolean {
    return existsSync(path);
  }

  setResult(result: TaskResult, message: string): void {
    if (result === TaskResult.Failed) {
      core.setFailed(message);
    } else {
      core.info(message);
    }
  }
}
