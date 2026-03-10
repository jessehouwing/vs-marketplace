import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { existsSync } from "fs";
import { TaskResult, } from "@vs-marketplace/core";
export class GitHubAdapter {
    quoteExecutablePath(command) {
        if (!/\s/.test(command)) {
            return command;
        }
        if (command.startsWith('"') && command.endsWith('"')) {
            return command;
        }
        return `"${command}"`;
    }
    getInput(name, required) {
        const value = core.getInput(name, { required });
        return value || undefined;
    }
    getPathInput(name, required, checkExists) {
        const value = core.getInput(name, { required });
        if (!value) {
            throw new Error(`Required input '${name}' was not supplied`);
        }
        if (checkExists && !existsSync(value)) {
            throw new Error(`Input path '${name}' does not exist: ${value}`);
        }
        return value;
    }
    setSecret(secret) {
        core.setSecret(secret);
    }
    info(message) {
        core.info(message);
    }
    error(message) {
        core.error(message);
    }
    debug(message) {
        core.debug(message);
    }
    async exec(command, args, options) {
        const result = await this.execOutput(command, args, options);
        return result.code;
    }
    async execOutput(command, args, options) {
        // @actions/exec parses the command string, so unquoted Windows paths with
        // spaces (e.g. C:\Program Files\...) can be split at whitespace.
        const result = await exec.getExecOutput(this.quoteExecutablePath(command), args, {
            silent: options?.silent,
            cwd: options?.cwd,
            ignoreReturnCode: true,
            failOnStdErr: false,
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
    fileExists(path) {
        return existsSync(path);
    }
    setResult(result, message) {
        if (result === TaskResult.Failed) {
            core.setFailed(message);
        }
        else {
            core.info(message);
        }
    }
}
