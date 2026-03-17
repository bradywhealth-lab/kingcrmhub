#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const baselineErrors = new Set([
  "src/app/api/activities/route.ts|TS2322|Type 'Record<string, unknown> | undefined' is not assignable to type 'NullableJsonNullValueInput | InputJsonValue | undefined'.",
  "src/app/api/ai/carrier-playbook/route.ts|TS2322|Type '({ score: number; carrierId: string; carrierName: string; documentId: string; documentName: string; chunkIndex: number; content: string; } | null)[]' is not assignable to type 'RetrievedChunk[]'.",
  "src/app/api/ai/carrier-playbook/route.ts|TS2677|A type predicate's type must be assignable to its parameter's type.",
  "src/app/api/ai/carrier-playbook/route.ts|TS18047|'b' is possibly 'null'.",
  "src/app/api/ai/carrier-playbook/route.ts|TS18047|'a' is possibly 'null'.",
  "src/app/api/ai/feedback/route.ts|TS2322|Type 'Record<string, unknown> | null' is not assignable to type 'NullableJsonNullValueInput | InputJsonValue | undefined'.",
  "src/app/api/ai/route.ts|TS2488|Type 'unknown' must have a '[Symbol.iterator]()' method that returns an iterator.",
  "src/app/api/bookings/route.ts|TS2322|Type 'string | null' is not assignable to type 'string | undefined'.",
  "src/app/api/carriers/[id]/documents/route.ts|TS2339|Property 'default' does not exist on type 'typeof import(\"/workspace/node_modules/pdf-parse/dist/pdf-parse/esm/index\")'.",
  "src/app/api/content/route.ts|TS2322|Type '{ title?: string | null | undefined; content?: string | undefined; status?: string | undefined; platform?: string | undefined; scheduledFor?: Date | null | undefined; publishedAt?: Date | ... 1 more ... | undefined; publishedUrl?: string | ... 1 more ... | undefined; mediaUrls?: string[] | ... 1 more ... | undefined...' is not assignable to type '(Without<ContentQueueUpdateManyMutationInput, ContentQueueUncheckedUpdateManyInput> & ContentQueueUncheckedUpdateManyInput) | (Without<...> & ContentQueueUpdateManyMutationInput)'.",
  "src/app/api/leads/route.ts|TS2322|Type 'Record<string, unknown> | undefined' is not assignable to type 'NullableJsonNullValueInput | InputJsonValue | undefined'.",
  "src/app/api/upload/route.ts|TS2322|Type 'InputJsonValue | null' is not assignable to type 'NullableJsonNullValueInput | InputJsonValue | undefined'.",
  "src/app/api/upload/route.ts|TS2322|Type 'InputJsonValue | null' is not assignable to type 'NullableJsonNullValueInput | InputJsonValue | undefined'.",
]);

const result = spawnSync(
  "bunx",
  ["tsc", "--noEmit", "--project", "tsconfig.typecheck.json", "--pretty", "false"],
  { encoding: "utf8" },
);

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const matches = [...output.matchAll(/^(.+)\(\d+,\d+\): error (TS\d+): (.+)$/gm)];
const observedErrors = matches.map(([, file, code, message]) => `${file}|${code}|${message}`);

if (result.error) {
  console.error("Typecheck gate failed to execute tsc.");
  console.error(result.error);
  process.exit(1);
}

if (observedErrors.length === 0) {
  console.log("Typecheck passed with zero TypeScript errors.");
  process.exit(result.status ?? 0);
}

const unknownErrors = observedErrors.filter((entry) => !baselineErrors.has(entry));

if (unknownErrors.length > 0) {
  console.error("Typecheck gate found NEW TypeScript errors:");
  for (const entry of unknownErrors) {
    console.error(`- ${entry}`);
  }
  console.error("\nFull tsc output:\n");
  console.error(output);
  process.exit(1);
}

console.log(
  `Typecheck gate passed with ${observedErrors.length} known baseline TypeScript errors.`,
);
