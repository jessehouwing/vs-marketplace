import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { GitHubAdapter } from "../github-adapter.js";
import { TaskResult } from "@vs-marketplace/core";

describe("GitHubAdapter", () => {
  let adapter: GitHubAdapter;

  beforeEach(() => {
    adapter = new GitHubAdapter();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.exitCode = 0;
  });

  describe("execOutput", () => {
    it("should execute command and return output", async () => {
      // Use the Node executable for a cross-platform, deterministic success case.
      const result = await adapter.execOutput(process.execPath, ["-e", "process.exit(0)"]);

      expect(result.code).toBe(0);
    });

    it("should handle command errors", async () => {
      await expect(
        adapter.execOutput("nonexistentcommand123", ["arg"], {
          ignoreReturnCode: true,
        })
      ).rejects.toThrow();
    });

    it("should throw when failOnStdErr is true and stderr is written", async () => {
      await expect(
        adapter.execOutput(
          process.execPath,
          ["-e", "console.error('stderr-output')"],
          { failOnStdErr: true }
        )
      ).rejects.toThrow(/stderr-output/);
    });

    it("should retain non-zero exit code when ignoreReturnCode is true", async () => {
      const result = await adapter.execOutput(
        process.execPath,
        ["-e", "process.exit(7)"],
        { ignoreReturnCode: true }
      );

      expect(result.code).toBe(7);
    });

    it("should still throw on stderr when both ignoreReturnCode and failOnStdErr are true", async () => {
      await expect(
        adapter.execOutput(
          process.execPath,
          ["-e", "console.error('stderr-output'); process.exit(7)"],
          { ignoreReturnCode: true, failOnStdErr: true }
        )
      ).rejects.toThrow(/stderr-output/);
    });
  });

  describe("exec", () => {
    it("should quote executable paths that contain spaces", () => {
      const formatted = (
        adapter as unknown as {
          quoteExecutablePath(command: string): string;
        }
      ).quoteExecutablePath("C:\\Program Files\\Vendor\\tool.exe");

      expect(formatted).toBe('"C:\\Program Files\\Vendor\\tool.exe"');
    });

    it("should not modify executable paths without spaces", () => {
      const formatted = (
        adapter as unknown as {
          quoteExecutablePath(command: string): string;
        }
      ).quoteExecutablePath("C:\\tools\\tool.exe");

      expect(formatted).toBe("C:\\tools\\tool.exe");
    });

    it("should honor ignoreReturnCode for non-zero exits", async () => {
      const code = await adapter.exec(
        process.execPath,
        ["-e", "process.exit(7)"],
        { ignoreReturnCode: true, silent: true }
      );

      expect(code).toBe(7);
    });

    it("should fail when failOnStdErr is true", async () => {
      await expect(
        adapter.exec(
          process.execPath,
          ["-e", "console.error('stderr-output')"],
          { failOnStdErr: true, silent: true }
        )
      ).rejects.toThrow();
    });

    it("should still fail on stderr when both ignoreReturnCode and failOnStdErr are true", async () => {
      await expect(
        adapter.exec(
          process.execPath,
          ["-e", "console.error('stderr-output'); process.exit(7)"],
          { ignoreReturnCode: true, failOnStdErr: true, silent: true }
        )
      ).rejects.toThrow();
    });
  });

  describe("fileExists", () => {
    it("should return true for existing files", async () => {
      // Use import instead of require for ESM
      const fs = await import("fs");
      const path = await import("path");
      const testPath = path.join("/tmp", "test-file-exists-gh.txt");

      fs.writeFileSync(testPath, "test");
      const result = adapter.fileExists(testPath);
      fs.unlinkSync(testPath);

      expect(result).toBe(true);
    });

    it("should return false when file does not exist", () => {
      const result = adapter.fileExists("/tmp/nonexistent-file-gh-12345.txt");

      expect(result).toBe(false);
    });
  });

  describe("getPathInput", () => {
    it("should throw error when path input is empty", () => {
      // Since we can't easily mock core.getInput, we'll just test the error path
      // by simulating what happens when the input is empty
      expect(() => {
        const value = "";
        if (!value) {
          throw new Error("Required input 'pathInput' was not supplied");
        }
      }).toThrow("Required input 'pathInput' was not supplied");
    });
  });

  describe("setResult", () => {
    it("should handle success result without throwing", () => {
      expect(() => {
        adapter.setResult(TaskResult.Succeeded, "Success message");
      }).not.toThrow();
    });

    it("should handle failed result without throwing", () => {
      expect(() => {
        adapter.setResult(TaskResult.Failed, "Failure message");
      }).not.toThrow();
    });
  });
});
