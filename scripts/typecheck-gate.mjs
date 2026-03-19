#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const tscArgs = ["tsc", "--noEmit", "--project", "tsconfig.typecheck.json", "--pretty", "false"];

let result = spawnSync("bunx", tscArgs, { encoding: "utf8" });

if (result.error?.code === "ENOENT") {
  result = spawnSync("npx", tscArgs, { encoding: "utf8" });
}

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

if (result.error) {
  console.error("Typecheck failed to execute tsc.");
  console.error(result.error);
  process.exit(1);
}

if (output) {
  process.stdout.write(output);
}

process.exit(result.status ?? 1);
