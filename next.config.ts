import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    // モダンな画像フォーマットに対応（表示速度向上）
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
