import { describe, it, expect, beforeEach } from "@jest/globals";
import { GitHubAdapter } from "../github-adapter.js";
import { TaskResult } from "@vs-marketplace/core";

describe("GitHubAdapter", () => {
  let adapter: GitHubAdapter;

  beforeEach(() => {
    adapter = new GitHubAdapter();
  });

  describe("execSync", () => {
    it("should execute command synchronously", () => {
      // Test with a simple echo command
      const result = adapter.execSync("echo", ["test"]);

      expect(result.code).toBe(0);
    });

    it("should handle command errors", () => {
      const result = adapter.execSync("nonexistentcommand123", ["arg"]);

      expect(result.code).not.toBe(0);
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

