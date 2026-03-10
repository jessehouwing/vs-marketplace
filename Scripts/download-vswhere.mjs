#!/usr/bin/env node

import { createWriteStream, promises as fs } from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

const vswhereLatest =
  "https://github.com/Microsoft/vswhere/releases/latest/download/vswhere.exe";

// Single location for vswhere.exe - in core package tools directory
// This will be bundled with both Azure Pipelines task and GitHub Action
const targetPath = path.join(rootDir, "packages/core/tools/vswhere.exe");

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destination);

    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          file.close();
          download(response.headers.location, destination)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        file.close();
        fs.unlink(destination).catch(() => {});
        reject(err);
      });

    file.on("error", (err) => {
      file.close();
      fs.unlink(destination).catch(() => {});
      reject(err);
    });
  });
}

async function downloadVswhere() {
  console.log("Downloading vswhere.exe...");

  try {
    // Create tools directory if it doesn't exist
    const toolsDir = path.dirname(targetPath);
    await fs.mkdir(toolsDir, { recursive: true });

    // Download vswhere.exe directly to target location
    await download(vswhereLatest, targetPath);
    console.log(
      `✓ Downloaded vswhere.exe to ${path.relative(rootDir, targetPath)}`
    );

    console.log("✓ vswhere.exe setup complete");
  } catch (error) {
    console.error("Failed to download vswhere.exe:", error.message);
    process.exit(1);
  }
}

downloadVswhere();
