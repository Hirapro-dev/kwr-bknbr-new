import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

// イメージスタイル定義
const IMAGE_STYLES: Record<string, { label: string; prompt: string }> = {
  realistic: {
    label: "リアル",
    prompt: "photorealistic, ultra high quality photograph, professional photography, cinematic lighting, 8K resolution",
  },
  illustration: {
    label: "イラスト",
    prompt: "high quality digital illustration, clean vector art style, modern flat design with depth, vibrant colors",
  },
  anime: {
    label: "アニメ風",
    prompt: "anime art style, Japanese animation aesthetic, vivid colors, detailed anime illustration, studio quality",
  },
  watercolor: {
    label: "水彩画",
    prompt: "watercolor painting style, soft blending, artistic brush strokes, elegant watercolor illustration, fine art quality",
  },
  minimal: {
    label: "ミニマル",
    prompt: "minimalist design, clean simple composition, geometric shapes, limited color palette, modern minimal art",
  },
  cyberpunk: {
    label: "サイバーパンク",
    prompt: "cyberpunk aesthetic, neon lights, futuristic cityscape, dark background with glowing elements, sci-fi atmosphere",
  },
};

export async function GET() {
  // スタイル一覧を返す
  const styles = Object.entries(IMAGE_STYLES).map(([key, val]) => ({
    key,
    label: val.label,
  }));
  return NextResponse.json({ styles });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY が設定されていません" }, { status: 500 });
  }

  try {
    const { title, content, style, adjustPrompt, textAlign, overlay } = await request.json();

    if (!title?.trim()) {
      return NextResponse.json({ error: "タイトルを入力してください" }, { status: 400 });
    }

    const styleKey = style || "realistic";
    const styleInfo = IMAGE_STYLES[styleKey] || IMAGE_STYLES.realistic;

    // テキスト配置の指示を生成
    const alignKey = textAlign || "center";
    const ALIGN_PROMPTS: Record<string, string> = {
      left: "タイトル文字は画像の左寄せで、垂直方向は中央に配置。左側に余白を少し取り、テキストは左揃えにする",
      center: "タイトル文字は画像の水平・垂直ともに中央に配置。テキストは中央揃えにする",
      right: "タイトル文字は画像の右寄せで、垂直方向は中央に配置。右側に余白を少し取り、テキストは右揃えにする",
    };
    const alignPrompt = ALIGN_PROMPTS[alignKey] || ALIGN_PROMPTS.center;

    // 記事本文からHTMLタグを除去して要約用テキストを取得（最大300文字）
    const plainContent = (content || "")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);

    // Gemini用プロンプト: タイトル文字を含めた完成サムネイルを直接生成
    const prompt = `投資ブログのサムネイル画像を1枚生成してください。

【画像に入れるタイトル文字】
「${title}」

【記事の内容テーマ】
${plainContent || title}
${adjustPrompt ? `\n【追加の指示】${adjustPrompt}` : ""}

【画像スタイル】${styleInfo.prompt}

【デザイン指示】
- 横長の16:9アスペクト比で生成
- ${alignPrompt}
- タイトル文字は大きく太い白文字で配置
- タイトル文字は読みやすさ最優先。${overlay !== false ? "文字の後ろに半透明の暗いオーバーレイ帯（黒の40〜60%透過）を敷いて視認性を確保する" : "オーバーレイは使わず、文字に太い影やアウトラインをつけて視認性を確保する。背景画像はそのまま見せる"}
- フォントサイズは画像幅の1/12〜1/10程度の大きさ（非常に大きく目立つように）
- 背景は記事テーマに合ったイメージ画像
- ブログのサムネイルとして魅力的でクリックしたくなるデザインにする
- ブランドロゴやサイト名は入れないでください`;

    // Gemini API呼び出し（画像生成対応モデル: gemini-3-pro-image-preview）
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", errText);
      return NextResponse.json(
        { error: `画像生成に失敗しました（${geminiRes.status}）` },
        { status: 500 }
      );
    }

    const geminiData = await geminiRes.json();

    // レスポンスから画像データを取得
    let imageBase64 = "";
    let imageMimeType = "image/png";

    const candidates = geminiData.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          imageBase64 = part.inlineData.data;
          imageMimeType = part.inlineData.mimeType || "image/png";
          break;
        }
      }
      if (imageBase64) break;
    }

    if (!imageBase64) {
      console.error("Gemini response (no image):", JSON.stringify(geminiData).slice(0, 500));
      return NextResponse.json(
        { error: "画像の生成に失敗しました。もう一度お試しください" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imageBase64,
      imageMimeType,
      style: styleKey,
      styleLabel: styleInfo.label,
    });
  } catch (e) {
    console.error("generate-thumbnail error:", e);
    return NextResponse.json({ error: "サムネイル生成中にエラーが発生しました" }, { status: 500 });
  }
}
