import { NextRequest, NextResponse } from "next/server";

/**
 * 外部画像をプロキシしてBase64 DataURLとして返すAPI
 * CORSの制限を回避するために使用（LINE画像生成時のS3画像読み込み用）
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json({ error: "url パラメータが必要です" }, { status: 400 });
  }

  // 許可するドメインのチェック（S3バケットと自サイトのみ）
  try {
    const parsed = new URL(imageUrl);
    const allowed =
      parsed.hostname.endsWith(".amazonaws.com") ||
      parsed.hostname === "localhost" ||
      parsed.hostname.endsWith(".vercel.app");
    if (!allowed) {
      return NextResponse.json({ error: "許可されていないドメインです" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "無効なURLです" }, { status: 400 });
  }

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      return NextResponse.json({ error: "画像の取得に失敗しました" }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") || "image/png";
    const buffer = Buffer.from(await res.arrayBuffer());
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;

    return NextResponse.json({ dataUrl });
  } catch {
    return NextResponse.json({ error: "画像の取得に失敗しました" }, { status: 500 });
  }
}
