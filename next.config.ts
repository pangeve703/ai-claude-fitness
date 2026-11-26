import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node-telegram-bot-api", "@prisma/client"],
  // Pin the workspace root to this project (run `npm run dev` from the project folder).
  // Without it, a stray lockfile in a parent folder (e.g. ~/package-lock.json) makes
  // Turbopack treat that parent as the root and watch far too many files.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
