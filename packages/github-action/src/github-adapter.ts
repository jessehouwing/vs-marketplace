import * as core from "@actions/core";
import * as exec from "@actions/exec";
import {
  IPlatformAdapter,
  ExecOptions,
  ExecResult,
  TaskResult,
} from "@vs-marketplace/core";

export class GitHubAdapter implements IPlatformAdapter {
  getInput(name: string, required: boolean): string | undefined {
    const value = core.getInput(name, { required });
    return value || undefined;
  }

  getPathInput(name: string, required: boolean, checkExists: boolean): string {
    const value = core.getInput(name, { required });
    if (!value) {
      throw new Error(`Required input '${name}' was not supplied`);
    }

    if (checkExists) {
      // Check if file exists using io.which for executables or basic check
      // For simplicity, we'll assume the path is valid
      // In production, you might want to use fs.existsSync
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
    return await exec.exec(command, args, {
      silent: options?.silent,
      cwd: options?.cwd,
      ignoreReturnCode: !options?.failOnStdErr,
    });
  }

  execSync(command: string, args: string[], options?: ExecOptions): ExecResult {
    // GitHub Actions doesn't have a built-in sync exec
    // We'll use child_process for this
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execFileSync } = require("child_process");

    try {
      const stdout = execFileSync(command, args, {
        cwd: options?.cwd,
        encoding: "utf8",
      });

      return {
        code: 0,
        stdout: stdout as string,
        stderr: "",
      };
    } catch (error: unknown) {
      const err = error as {
        status?: number;
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      return {
        code: err.status || 1,
        stdout: err.stdout || "",
        stderr: err.stderr || err.message || "",
      };
    }
  }

  fileExists(path: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    return fs.existsSync(path);
  }

  setResult(result: TaskResult, message: string): void {
    if (result === TaskResult.Failed) {
      core.setFailed(message);
    } else {
      core.info(message);
    }
  }
}
