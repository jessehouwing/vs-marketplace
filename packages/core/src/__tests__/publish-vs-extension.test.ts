import { describe, it, expect, beforeEach } from "@jest/globals";
import { publishVsExtension, PublishOptions } from "../publisher.js";
import { MockPlatformAdapter } from "./mock-platform-adapter.js";
import { TaskResult } from "../platform-adapter.js";

describe("publishVsExtension", () => {
  let adapter: MockPlatformAdapter;
  let options: PublishOptions;

  beforeEach(() => {
    adapter = new MockPlatformAdapter();

    // Set up default mocks
    adapter.setFileExists(
      "C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe",
      true
    );
    adapter.setFileExists("C:\\VS\\VsixPublisher.exe", true);
    adapter.setExecOutputMockResponse({
      code: 0,
      stdout: "C:\\VS\\VsixPublisher.exe",
      stderr: "",
    });
    adapter.setExecMockResponse(0);

    options = {
      connectTo: "pat",
      token: "test-token-12345",
      vsixFile: "C:\\extension.vsix",
      manifestFile: "C:\\manifest.json",
      publisherId: "test-publisher",
    };
  });

  it("should mask the token as a secret", async () => {
    await publishVsExtension(options, adapter);

    const secrets = adapter.getSecrets();
    expect(secrets.has("test-token-12345")).toBe(true);
  });

  it("should complete the full publish workflow", async () => {
    await publishVsExtension(options, adapter);

    const execCalls = adapter.getExecCalls();
    const execOutputCalls = adapter.getExecOutputCalls();

    // Login and publish are async exec calls; vswhere lookup and logout use execOutput.
    expect(execCalls.length).toBeGreaterThanOrEqual(2);
    expect(execOutputCalls.length).toBeGreaterThanOrEqual(2);

    // Check login call
    const loginCall = execCalls.find((call) => call.args.includes("login"));
    expect(loginCall).toBeDefined();
    expect(loginCall?.args).toContain("-personalAccessToken");
    expect(loginCall?.args).toContain("test-token-12345");

    // Check publish call
    const publishCall = execCalls.find((call) => call.args.includes("publish"));
    expect(publishCall).toBeDefined();
    expect(publishCall?.args).toContain("-payload");
    expect(publishCall?.args).toContain("C:\\extension.vsix");

    // Check logout call
    const logoutCall = execOutputCalls.find((call) => call.args.includes("logout"));
    expect(logoutCall).toBeDefined();
  });

  it("should set success result on completion", async () => {
    await publishVsExtension(options, adapter);

    const result = adapter.getTaskResult();
    expect(result).not.toBeNull();
    expect(result?.result).toBe(TaskResult.Succeeded);
    expect(result?.message).toBe(
      "Visual Studio extension published successfully"
    );
  });

  it("should log completion message", async () => {
    await publishVsExtension(options, adapter);

    const logs = adapter.getLogs();
    expect(logs.info).toContain("All done");
  });

  it("should handle login errors and set failure result", async () => {
    adapter.setExecMockResponse(1); // Fail on first exec (login)

    await expect(publishVsExtension(options, adapter)).rejects.toThrow(
      "Login failed."
    );

    const result = adapter.getTaskResult();
    expect(result?.result).toBe(TaskResult.Failed);
    expect(result?.message).toBe("Login failed.");

    const logs = adapter.getLogs();
    expect(logs.error).not.toContain("Login failed.");
  });

  it("should handle publish errors and set failure result", async () => {
    let callCount = 0;
    const originalExec = adapter.exec.bind(adapter);
    adapter.exec = async (command, args, options) => {
      callCount++;
      if (callCount === 2) {
        // Fail on second call (publish)
        return 1;
      }
      return originalExec(command, args, options);
    };

    await expect(publishVsExtension(options, adapter)).rejects.toThrow(
      "Publish failed."
    );

    const result = adapter.getTaskResult();
    expect(result?.result).toBe(TaskResult.Failed);
  });

  it("should attempt logout even if publish fails", async () => {
    let callCount = 0;
    adapter.exec = async (command, args) => {
      callCount++;
      if (callCount === 2) {
        // Fail on publish
        return 1;
      }
      return 0;
    };

    await expect(publishVsExtension(options, adapter)).rejects.toThrow();

    // Should still attempt logout
    const logs = adapter.getLogs();
    const logoutAttempted = logs.info.some((log) =>
      log.includes("Logging out")
    );
    expect(logoutAttempted).toBe(true);
  });

  it("should not fail if logout throws an error", async () => {
    adapter.setExecMockResponse(0);
    const originalExecOutput = adapter.execOutput.bind(adapter);
    adapter.execOutput = async (command, args, options) => {
      if (args.includes("logout")) {
        return {
          code: 1,
          stdout: "",
          stderr: "logout failed",
        };
      }

      return originalExecOutput(command, args, options);
    };

    // Should complete successfully despite logout error
    await publishVsExtension(options, adapter);

    const logs = adapter.getLogs();
    const debugLogs = logs.debug;
    const hasLogoutError = debugLogs.some((log) =>
      log.includes("Logout error")
    );
    expect(hasLogoutError).toBe(true);
  });

  it("should include ignore warnings in publish call when provided", async () => {
    options.ignoreWarnings = "Warning01,Warning02";

    await publishVsExtension(options, adapter);

    const execCalls = adapter.getExecCalls();
    const publishCall = execCalls.find((call) => call.args.includes("publish"));

    expect(publishCall?.args).toContain("-ignoreWarnings");
    expect(publishCall?.args).toContain("Warning01,Warning02");
  });

  it("should handle error objects with message property", async () => {
    adapter.setFileExists(
      "C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe",
      false
    );
    adapter.setExecOutputMockResponse({
      code: 1,
      stdout: "",
      stderr: "",
    });

    await expect(publishVsExtension(options, adapter)).rejects.toThrow();

    const logs = adapter.getLogs();
    expect(logs.error.length).toBe(0);
  });

  it("should handle non-Error thrown values", async () => {
    // Mock execOutput to throw a non-Error value during VsixPublisher.exe lookup
    adapter.execOutput = async () => {
      throw "String error"; // eslint-disable-line @typescript-eslint/only-throw-error
    };

    // This should fail during the login attempt when trying to find VsixPublisher.exe
    await expect(publishVsExtension(options, adapter)).rejects.toBe(
      "String error"
    );

    const result = adapter.getTaskResult();
    expect(result?.result).toBe(TaskResult.Failed);
    expect(result?.message).toBe("String error");
  });
});
