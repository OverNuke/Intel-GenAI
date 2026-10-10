import type { NextConfig } from "next";
import { devApiRewrites } from "./src/lib/dev-proxy";

const nextConfig: NextConfig = {
  async rewrites() {
    return devApiRewrites(process.env.NODE_ENV);
  },
};

export default nextConfig;
