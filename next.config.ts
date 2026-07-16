import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-distはバンドルせずNode解決にする（cMap等をfsから読むため）
  serverExternalPackages: ["pdfjs-dist"],
  // Vercelデプロイ時にcMap（日本語文字コード表）・標準フォントを同梱する
  outputFileTracingIncludes: {
    "/api/import-pdf": [
      "./node_modules/pdfjs-dist/cmaps/**/*",
      "./node_modules/pdfjs-dist/standard_fonts/**/*",
    ],
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
