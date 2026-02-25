#!/usr/bin/env node

import { rollup } from "rollup";
import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

const target = process.argv[2];

if (!target || !["azdo", "actions"].includes(target)) {
  console.error("Usage: node bundle.mjs [azdo|actions]");
  process.exit(1);
}

const isAzdo = target === "azdo";
const inputFile = isAzdo
  ? "packages/azdo-task/src/main.ts"
  : "packages/github-action/src/main.ts";
const outputFile = isAzdo
  ? "packages/azdo-task/dist/main.js"
  : "packages/github-action/dist/main.js";

async function bundle() {
  console.log(`Bundling ${target}...`);

  try {
    const bundle = await rollup({
      input: inputFile,
      plugins: [
        resolve({
          preferBuiltins: true,
        }),
        commonjs(),
        json(),
        typescript({
          tsconfig: isAzdo
            ? "./packages/azdo-task/tsconfig.json"
            : "./packages/github-action/tsconfig.json",
          declaration: false,
          declarationMap: false,
        }),
      ],
      external: [
        // Node built-ins
        "fs",
        "path",
        "os",
        "child_process",
        "util",
        "stream",
        "events",
        "url",
        "http",
        "https",
        "net",
        "tls",
        "crypto",
        "zlib",
        // Azure Pipelines libraries (must be available at runtime)
        ...(isAzdo
          ? [
              "azure-pipelines-task-lib",
              "azure-pipelines-task-lib/task",
              "azure-pipelines-task-lib/toolrunner",
              "azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint",
            ]
          : []),
        // GitHub Actions libraries (must be available at runtime)
        ...(!isAzdo ? ["@actions/core", "@actions/exec", "@actions/io"] : []),
      ],
    });

    await bundle.write({
      file: outputFile,
      format: "esm",
      sourcemap: true,
    });

    console.log(`✓ Bundle created: ${outputFile}`);
  } catch (error) {
    console.error("Bundle error:", error);
    process.exit(1);
  }
}

bundle();
