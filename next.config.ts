import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node-telegram-bot-api", "@prisma/client"],
};

export default nextConfig;
