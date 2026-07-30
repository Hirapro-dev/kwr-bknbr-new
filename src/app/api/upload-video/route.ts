import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { createPresignedUploadUrl } from "@/lib/s3";
import { MAX_VIDEO_SIZE, formatFileSize, isAllowedVideoType } from "@/lib/video";

/**
 * 動画アップロード用の署名付きURLを発行する。
 *
 * ファイル本体はこのAPIを通らず、ブラウザからS3へ直接PUTされる。
 * （Vercel Functionsのボディ上限100MBとメモリ消費を避けるため）
 * ここでは「ログイン済みか」「許可された形式・サイズか」だけを検証する。
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });

  try {
    const body = await request.json();
    const filename = typeof body.filename === "string" ? body.filename : "";
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const size = typeof body.size === "number" ? body.size : 0;

    if (!isAllowedVideoType(contentType)) {
      return NextResponse.json(
        { error: "対応していない動画形式です（mp4 / webm / mov に対応）" },
        { status: 400 }
      );
    }

    if (size <= 0) {
      return NextResponse.json({ error: "ファイルサイズを取得できませんでした" }, { status: 400 });
    }

    if (size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        {
          error: `ファイルサイズは${formatFileSize(MAX_VIDEO_SIZE)}以下にしてください（選択されたファイル: ${formatFileSize(size)}）`,
        },
        { status: 400 }
      );
    }

    // 拡張子のみ元ファイルから引き継ぎ、ファイル名は日本語・記号を含まない形に作り直す
    const ext = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
    const safeName = `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { uploadUrl, publicUrl } = await createPresignedUploadUrl(safeName, contentType);

    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("upload-video error:", message);
    return NextResponse.json(
      { error: `アップロードURLの発行に失敗しました: ${message}` },
      { status: 500 }
    );
  }
}
