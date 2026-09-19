import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // pdf-parse ships ESM-only + a pdfjs worker asset. Turbopack inlines it
  // into a server chunk and rewrites the worker URL to a chunk-relative
  // path that never exists at runtime ("Setting up fake worker failed:
  // Cannot find module .../.next/server/chunks/pdf.worker.mjs"), which
  // makes every PDF text extraction fail silently (M159). Keep it a
  // runtime external so Next require()s the package's CJS entry, which
  // loads its own worker from real node_modules.
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
