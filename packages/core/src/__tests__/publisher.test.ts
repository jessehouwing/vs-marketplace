import { describe, it, expect, beforeEach } from "@jest/globals";
import { VsixPublisher } from "../publisher.js";
import { MockPlatformAdapter } from "./mock-platform-adapter.js";

describe("VsixPublisher", () => {
  let adapter: MockPlatformAdapter;
  let publisher: VsixPublisher;

  beforeEach(() => {
    adapter = new MockPlatformAdapter();
    publisher = new VsixPublisher(adapter);

    // Set up default mocks for vswhere and VsixPublisher.exe
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
  });

  describe("login", () => {
    it("should login successfully with valid credentials", async () => {
      adapter.setExecMockResponse(0);

      await publisher.login("test-publisher", "test-token");

      const execCalls = adapter.getExecCalls();
      expect(execCalls).toHaveLength(1);
      expect(execCalls[0].command).toBe("C:\\VS\\VsixPublisher.exe");
      expect(execCalls[0].args).toEqual([
        "login",
        "-personalAccessToken",
        "test-token",
        "-publisherName",
        "test-publisher",
      ]);
      expect(execCalls[0].options?.failOnStdErr).toBe(true);

      const logs = adapter.getLogs();
      expect(logs.info).toContain("Logging in as 'test-publisher'");
      expect(logs.info).toContain("Login successful.");
    });

    it("should throw error when login fails", async () => {
      adapter.setExecMockResponse(1);

      await expect(
        publisher.login("test-publisher", "test-token")
      ).rejects.toThrow("Login failed.");
    });

    it("should use vswhere to find VsixPublisher.exe", async () => {
      adapter.setExecMockResponse(0);

      await publisher.login("test-publisher", "test-token");

      const execOutputCalls = adapter.getExecOutputCalls();
      expect(execOutputCalls).toHaveLength(1);
      expect(execOutputCalls[0].command).toBe(
        "C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe"
      );
      expect(execOutputCalls[0].args).toEqual([
        "-version",
        "[15.0,)",
        "-latest",
        "-requires",
        "Microsoft.VisualStudio.Component.VSSDK",
        "-find",
        "VSSDK\\VisualStudioIntegration\\Tools\\Bin\\VsixPublisher.exe",
      ]);
    });

    it("should throw error when vswhere fails", async () => {
      adapter.setFileExists(
        "C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe",
        false
      );
      adapter.setExecOutputMockResponse({
        code: 1,
        stdout: "",
        stderr: "not found",
      });

      // When vswhere.exe is not in the expected location, it falls back to "vswhere.exe"
      // and tries to execute it, which will fail to find VsixPublisher.exe
      await expect(
        publisher.login("test-publisher", "test-token")
      ).rejects.toThrow("Could not locate VsixPublisher.exe");
    });

    it("should throw error when VsixPublisher.exe is not found", async () => {
      adapter.setFileExists("C:\\VS\\VsixPublisher.exe", false);
      adapter.setExecOutputMockResponse({
        code: 0,
        stdout: "C:\\VS\\VsixPublisher.exe",
        stderr: "",
      });

      await expect(
        publisher.login("test-publisher", "test-token")
      ).rejects.toThrow("Could not locate VsixPublisher.exe");
    });
  });

  describe("logout", () => {
    it("should logout successfully after login", async () => {
      adapter.setExecMockResponse(0);

      // Login first
      await publisher.login("test-publisher", "test-token");

      // Clear baseline sync call count (login resolves VsixPublisher via vswhere)
      const execOutputCallsBefore = adapter.getExecOutputCalls().length;

      adapter.setExecOutputMockResponse({
        code: 0,
        stdout: "",
        stderr: "",
      });

      // Logout
      await publisher.logout("test-publisher");

      const execOutputCalls = adapter.getExecOutputCalls();
      expect(execOutputCalls).toHaveLength(execOutputCallsBefore + 1);
      expect(execOutputCalls[execOutputCallsBefore].command).toBe(
        "C:\\VS\\VsixPublisher.exe"
      );
      expect(execOutputCalls[execOutputCallsBefore].args).toEqual([
        "logout",
        "-publisherName",
        "test-publisher",
        "-ignoreMissingPublisher",
      ]);

      const logs = adapter.getLogs();
      expect(logs.info).toContain("Logging out publisher 'test-publisher'");
      expect(logs.info).toContain("Logout successful.");
    });

    it("should skip logout if not logged in", async () => {
      await publisher.logout("test-publisher");

      const logs = adapter.getLogs();
      expect(logs.info).toContain("Already logged out.");
      expect(adapter.getExecCalls()).toHaveLength(0);
    });

    it("should throw error when logout fails", async () => {
      adapter.setExecMockResponse(0);
      await publisher.login("test-publisher", "test-token");

      adapter.setExecOutputMockResponse({
        code: 1,
        stdout: "",
        stderr: "some unexpected failure",
      });

      await expect(publisher.logout("test-publisher")).rejects.toThrow(
        "Logout failed (exit code 1)."
      );
    });

    it("should ignore non-zero logout when already logged out", async () => {
      adapter.setExecMockResponse(0);
      await publisher.login("test-publisher", "test-token");

      adapter.setExecOutputMockResponse({
        code: 1,
        stdout: "",
        stderr: "Already logged out.",
      });

      await expect(publisher.logout("test-publisher")).resolves.toBeUndefined();

      const logs = adapter.getLogs();
      expect(logs.info).toContain("Already logged out.");
      expect(logs.debug).toContain(
        "Logout returned exit code 1 with 'already logged out' message; treating as success."
      );
    });

    it("should ignore logout exit code 31", async () => {
      adapter.setExecMockResponse(0);
      await publisher.login("test-publisher", "test-token");

      adapter.setExecOutputMockResponse({
        code: 31,
        stdout: "",
        stderr: "",
      });

      await expect(publisher.logout("test-publisher")).resolves.toBeUndefined();

      const logs = adapter.getLogs();
      expect(logs.info).toContain("Already logged out.");
      expect(logs.debug).toContain(
        "Logout returned exit code 31 (already logged out); treating as success."
      );
    });
  });

  describe("publish", () => {
    beforeEach(async () => {
      adapter.setExecMockResponse(0);
      // Login before publishing
      await publisher.login("test-publisher", "test-token");
    });

    it("should publish successfully with valid inputs", async () => {
      const execCallsBefore = adapter.getExecCalls().length;

      await publisher.publish(
        "C:\\path\\to\\extension.vsix",
        "C:\\path\\to\\manifest.json"
      );

      const execCalls = adapter.getExecCalls();
      expect(execCalls).toHaveLength(execCallsBefore + 1);
      expect(execCalls[execCallsBefore].command).toBe(
        "C:\\VS\\VsixPublisher.exe"
      );
      expect(execCalls[execCallsBefore].args).toEqual([
        "publish",
        "-payload",
        "C:\\path\\to\\extension.vsix",
        "-publishManifest",
        "C:\\path\\to\\manifest.json",
      ]);

      const logs = adapter.getLogs();
      expect(logs.info).toContain(
        "Publishing 'C:\\path\\to\\extension.vsix' to Visual Studio Marketplace"
      );
      expect(logs.info).toContain("Published successfully.");
    });

    it("should include ignore warnings when provided", async () => {
      const execCallsBefore = adapter.getExecCalls().length;

      await publisher.publish(
        "C:\\path\\to\\extension.vsix",
        "C:\\path\\to\\manifest.json",
        "Warning01,Warning02"
      );

      const execCalls = adapter.getExecCalls();
      expect(execCalls[execCallsBefore].args).toEqual([
        "publish",
        "-payload",
        "C:\\path\\to\\extension.vsix",
        "-publishManifest",
        "C:\\path\\to\\manifest.json",
        "-ignoreWarnings",
        "Warning01,Warning02",
      ]);
    });

    it("should throw error when publish fails", async () => {
      adapter.setExecMockResponse(1);

      await expect(
        publisher.publish(
          "C:\\path\\to\\extension.vsix",
          "C:\\path\\to\\manifest.json"
        )
      ).rejects.toThrow("Publish failed.");
    });
  });
});
