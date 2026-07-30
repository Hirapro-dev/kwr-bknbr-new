import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthUser } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEYが設定されていません" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 200) : "";
    if (!text) {
      return NextResponse.json({ error: "ボタンテキストを入力してください" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey });
    const response = await client.images.generate({
      model: "gpt-image-2",
      prompt: [
        "Create one premium financial-media icon inspired by the following Japanese button text:",
        `「${text}」`,
        "Design requirements:",
        "- one simple symbolic object only, centered",
        "- elegant metallic gold line art with subtle gold highlights",
        "- solid uniform dark navy background (#071a2f), matching the KAWARA button",
        "- no circle border, no frame, no button, no separate background plate",
        "- no letters, words, numbers, logos, trademarks, or currency tickers",
        "- strong silhouette, readable at 48px",
        "- square composition with generous dark navy padding",
      ].join("\n"),
      size: "1024x1024",
      quality: "high",
      output_format: "png",
      n: 1,
    });

    const imageBase64 = response.data?.[0]?.b64_json;
    if (!imageBase64) {
      return NextResponse.json({ error: "生成画像を取得できませんでした" }, { status: 500 });
    }

    const buffer = Buffer.from(imageBase64, "base64");
    const filename = `button-icon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const url = await uploadToS3(buffer, filename, "image/png");
    return NextResponse.json({ url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("generate-button-icon error:", message);
    if (/billing hard limit|billing quota|insufficient_quota/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "OpenAI APIの利用上限に達しています。OpenAI Platformの請求設定で残高を追加するか、月間予算を引き上げてください。設定反映後、数分待ってから再度お試しください。",
          code: "OPENAI_BILLING_LIMIT",
        },
        { status: 402 }
      );
    }
    if (/transparent background is not supported/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "画像モデルが透過背景に対応していません。ページを再読み込みしてから、もう一度生成してください。",
          code: "OPENAI_TRANSPARENT_UNSUPPORTED",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: `AIアイコン生成に失敗しました: ${message}` }, { status: 500 });
  }
}
