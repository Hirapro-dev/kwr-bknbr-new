import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    // WebPフォーマットに対応（AVIFは古いiOSで非対応のため除外）
    formats: ["image/webp"],
  },
};

export default nextConfig;
