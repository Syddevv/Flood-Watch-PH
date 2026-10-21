import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.FLOODWATCH_TEST_DIST_DIR
    ? { distDir: process.env.FLOODWATCH_TEST_DIST_DIR }
    : {}),
};

export default nextConfig;
