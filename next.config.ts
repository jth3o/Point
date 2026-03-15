import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow larger payloads for VTT uploads if needed
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
