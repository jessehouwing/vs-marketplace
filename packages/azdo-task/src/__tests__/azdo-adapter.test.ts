import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { AzdoAdapter } from "../azdo-adapter.js";
import { TaskResult } from "@vs-marketplace/core";

// Mock azure-pipelines-task-lib
const mockTool = {
  arg: jest.fn().mockReturnThis(),
  exec: jest.fn<() => Promise<number>>().mockResolvedValue(0),
  execSync: jest.fn().mockReturnValue({
    code: 0,
    stdout: "output",
    stderr: "",
  }),
};

const mockTaskLib = {
  getInput: jest.fn(),
  getPathInput: jest.fn(),
  setSecret: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  tool: jest.fn().mockReturnValue(mockTool),
  exist: jest.fn(),
  TaskResult: {
    Succeeded: 0,
    Failed: 1,
  },
  setResult: jest.fn(),
};

jest.mock("azure-pipelines-task-lib/task.js", () => mockTaskLib);

import * as tl from "azure-pipelines-task-lib/task.js";

describe("AzdoAdapter", () => {
  let adapter: AzdoAdapter;

  beforeEach(() => {
    adapter = new AzdoAdapter();
    jest.clearAllMocks();
  });

  describe("getInput", () => {
    it("should get input value when present", () => {
      (tl.getInput as jest.MockedFunction<typeof tl.getInput>).mockReturnValue(
        "test-value"
      );

      const result = adapter.getInput("testInput", false);

      expect(result).toBe("test-value");
      expect(tl.getInput).toHaveBeenCalledWith("testInput", false);
    });

    it("should return undefined when input is null", () => {
      (tl.getInput as jest.MockedFunction<typeof tl.getInput>).mockReturnValue(
        null as unknown as string
      );

      const result = adapter.getInput("testInput", false);

      expect(result).toBeUndefined();
    });

    it("should handle required inputs", () => {
      (tl.getInput as jest.MockedFunction<typeof tl.getInput>).mockReturnValue(
        "required-value"
      );

      const result = adapter.getInput("requiredInput", true);

      expect(result).toBe("required-value");
      expect(tl.getInput).toHaveBeenCalledWith("requiredInput", true);
    });
  });

  describe("getPathInput", () => {
    it("should get path input", () => {
      (
        tl.getPathInput as jest.MockedFunction<typeof tl.getPathInput>
      ).mockReturnValue("C:\\path\\to\\file");

      const result = adapter.getPathInput("pathInput", true, true);

      expect(result).toBe("C:\\path\\to\\file");
      expect(tl.getPathInput).toHaveBeenCalledWith("pathInput", true, true);
    });

    it("should throw error when path input is null", () => {
      (
        tl.getPathInput as jest.MockedFunction<typeof tl.getPathInput>
      ).mockReturnValue(null as unknown as string);

      expect(() => adapter.getPathInput("pathInput", true, true)).toThrow(
        "Required path input 'pathInput' was not supplied"
      );
    });
  });

  describe("setSecret", () => {
    it("should call tl.setSecret", () => {
      adapter.setSecret("my-secret");

      expect(tl.setSecret).toHaveBeenCalledWith("my-secret");
    });
  });

  describe("info", () => {
    it("should log to console", () => {
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      adapter.info("test message");

      expect(consoleSpy).toHaveBeenCalledWith("test message");
      consoleSpy.mockRestore();
    });
  });

  describe("error", () => {
    it("should call tl.error", () => {
      adapter.error("error message");

      expect(tl.error).toHaveBeenCalledWith("error message");
    });
  });

  describe("debug", () => {
    it("should call tl.debug", () => {
      adapter.debug("debug message");

      expect(tl.debug).toHaveBeenCalledWith("debug message");
    });
  });

  describe("exec", () => {
    it("should execute command with args", async () => {
      const localMockTool = {
        arg: jest.fn().mockReturnThis(),
        exec: jest.fn<() => Promise<number>>().mockResolvedValue(0),
      };
      (tl.tool as jest.MockedFunction<typeof tl.tool>).mockReturnValue(
        localMockTool as never
      );

      const result = await adapter.exec("command", ["arg1", "arg2"]);

      expect(tl.tool).toHaveBeenCalledWith("command");
      expect(localMockTool.arg).toHaveBeenCalledWith("arg1");
      expect(localMockTool.arg).toHaveBeenCalledWith("arg2");
      expect(localMockTool.exec).toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should pass options to exec", async () => {
      const localMockTool = {
        arg: jest.fn().mockReturnThis(),
        exec: jest.fn<() => Promise<number>>().mockResolvedValue(0),
      };
      (tl.tool as jest.MockedFunction<typeof tl.tool>).mockReturnValue(
        localMockTool as never
      );

      await adapter.exec("command", [], {
        failOnStdErr: true,
        cwd: "/test/path",
      });

      expect(localMockTool.exec).toHaveBeenCalled();
      const callArgs = (localMockTool.exec as jest.Mock).mock.calls[0][0];
      expect(callArgs).toMatchObject({
        failOnStdErr: true,
        cwd: "/test/path",
      });
    });
  });

  describe("execSync", () => {
    it("should execute command synchronously", () => {
      const mockTool = {
        arg: jest.fn().mockReturnThis(),
        execSync: jest.fn().mockReturnValue({
          code: 0,
          stdout: "test output",
          stderr: "",
        }),
      };
      (tl.tool as jest.MockedFunction<typeof tl.tool>).mockReturnValue(
        mockTool as never
      );

      const result = adapter.execSync("command", ["arg1"]);

      expect(tl.tool).toHaveBeenCalledWith("command");
      expect(mockTool.arg).toHaveBeenCalledWith("arg1");
      expect(mockTool.execSync).toHaveBeenCalled();
      expect(result.code).toBe(0);
      expect(result.stdout).toBe("test output");
    });
  });

  describe("fileExists", () => {
    it("should check if file exists", () => {
      (tl.exist as jest.MockedFunction<typeof tl.exist>).mockReturnValue(true);

      const result = adapter.fileExists("C:\\test\\file.txt");

      expect(tl.exist).toHaveBeenCalledWith("C:\\test\\file.txt");
      expect(result).toBe(true);
    });

    it("should return false when file does not exist", () => {
      (tl.exist as jest.MockedFunction<typeof tl.exist>).mockReturnValue(
        false
      );

      const result = adapter.fileExists("C:\\test\\missing.txt");

      expect(result).toBe(false);
    });
  });

  describe("setResult", () => {
    it("should set succeeded result", () => {
      adapter.setResult(TaskResult.Succeeded, "Success message");

      expect(tl.setResult).toHaveBeenCalledWith(
        tl.TaskResult.Succeeded,
        "Success message"
      );
    });

    it("should set failed result", () => {
      adapter.setResult(TaskResult.Failed, "Failure message");

      expect(tl.setResult).toHaveBeenCalledWith(
        tl.TaskResult.Failed,
        "Failure message"
      );
    });
  });
});
