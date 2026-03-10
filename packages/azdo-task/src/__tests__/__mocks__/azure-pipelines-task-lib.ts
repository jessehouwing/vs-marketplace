import { jest } from "@jest/globals";

export const mockGetInput = jest.fn();
export const mockGetPathInput = jest.fn();
export const mockSetSecret = jest.fn();
export const mockError = jest.fn();
export const mockDebug = jest.fn();
export const mockToolArg = jest.fn().mockReturnThis();
export const mockToolExec = jest
  .fn<() => Promise<number>>()
  .mockResolvedValue(0);
export const mockToolExecSync = jest.fn().mockReturnValue({
  code: 0,
  stdout: "output",
  stderr: "",
});
export const mockTool = jest.fn().mockReturnValue({
  arg: mockToolArg,
  exec: mockToolExec,
  execSync: mockToolExecSync,
});
export const mockExist = jest.fn();
export const mockSetResult = jest.fn();

export const getInput = mockGetInput;
export const getPathInput = mockGetPathInput;
export const setSecret = mockSetSecret;
export const error = mockError;
export const debug = mockDebug;
export const tool = mockTool;
export const exist = mockExist;
export const TaskResult = {
  Succeeded: 0,
  Failed: 1,
};
export const setResult = mockSetResult;
