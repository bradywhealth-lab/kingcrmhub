import { defineConfig } from "prisma/config";

// Load .env.local for DATABASE_URL
import { config } from "dotenv";
import path from "path";

// Try loading from .env.local first, then fall back to .env
const envPath = path.resolve(process.cwd(), ".env.local");
config({ path: envPath });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun prisma/seed.ts",
  },
  engine: "classic",
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  },
});
