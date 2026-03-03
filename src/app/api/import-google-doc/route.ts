import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { google } from "googleapis";
import { uploadToS3 } from "@/lib/s3";

type InlineObjectsMap = Record<
  string,
  { inlineObjectProperties?: { embeddedObject?: { imageProperties?: { contentUri?: string } } } }
>;

const DOC_ID_REGEX = /\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/;

function parseDocId(url: string): string | null {
  const m = url.trim().match(DOC_ID_REGEX);
  return m ? m[1] : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toByte = (x: number) => Math.round((x ?? 0) * 255);
  return "#" + [toByte(r), toByte(g), toByte(b)].map((n) => n.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type TextStyle = {
  bold?: boolean;
  underline?: boolean;
  foregroundColor?: { rgbColor?: { red?: number; green?: number; blue?: number } };
  backgroundColor?: { rgbColor?: { red?: number; green?: number; blue?: number } };
};

function wrapTextRunStyle(text: string, style?: TextStyle): string {
  if (!text) return "";
  const escaped = escapeHtml(text);
  if (!style) return escaped;
  let out = escaped;
  if (style.bold) out = `<strong>${out}</strong>`;
  if (style.underline) out = `<u>${out}</u>`;
  const fg = style.foregroundColor?.rgbColor;
  if (fg != null && (fg.red !== undefined || fg.green !== undefined || fg.blue !== undefined)) {
    const hex = rgbToHex(fg.red ?? 0, fg.green ?? 0, fg.blue ?? 0);
    out = `<span style="color:${hex}">${out}</span>`;
  }
  const bg = style.backgroundColor?.rgbColor;
  if (bg != null && (bg.red !== undefined || bg.green !== undefined || bg.blue !== undefined)) {
    const hex = rgbToHex(bg.red ?? 0, bg.green ?? 0, bg.blue ?? 0);
    out = `<span style="background-color:${hex}">${out}</span>`;
  }
  return out;
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });

  try {
    const body = await request.json();
    const url = typeof body.url === "string" ? body.url : "";
    const documentId = parseDocId(url);
    if (!documentId) {
      return NextResponse.json({ error: "Google ドキュメントのURLを入力してください" }, { status: 400 });
    }

    const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!credentialsJson) {
      return NextResponse.json(
        { error: "GOOGLE_SERVICE_ACCOUNT_JSON が設定されていません。Google Cloud でサービスアカウントを作成し、JSON キーを環境変数に設定してください。" },
        { status: 503 }
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(credentialsJson) as object,
      scopes: ["https://www.googleapis.com/auth/documents.readonly", "https://www.googleapis.com/auth/drive.readonly"],
    });
    const docs = google.docs({ version: "v1", auth });

    const doc = await docs.documents.get({ documentId });
    const data = doc.data;
    if (!data?.title) {
      return NextResponse.json({ error: "ドキュメントを取得できませんでした" }, { status: 400 });
    }

    const title = data.title;
    const contentElements: string[] = [];

    // body.content または tabs[0].documentTab.body.content（API のバージョンに依存）
    const dataAny = data as { body?: { content?: unknown[] }; tabs?: { documentTab?: { body?: { content?: unknown[] } } }[] };
    const bodyContent = dataAny.body?.content ?? dataAny.tabs?.[0]?.documentTab?.body?.content ?? [];
    const elements = Array.isArray(bodyContent) ? bodyContent : [];

    for (const el of elements) {
      const se = el as { paragraph?: { elements?: unknown[]; paragraphStyle?: { namedStyleType?: string } }; table?: unknown };
      if (se.table) continue; // テーブルはスキップ（必要なら後で対応）
      const para = se.paragraph;
      if (!para?.elements) continue;

      const namedStyleType = para.paragraphStyle?.namedStyleType ?? "NORMAL_TEXT";
      let blockTag = "p";
      if (namedStyleType === "HEADING_1") blockTag = "h1";
      else if (namedStyleType === "HEADING_2") blockTag = "h2";
      else if (namedStyleType === "HEADING_3") blockTag = "h3";
      else if (namedStyleType === "HEADING_4") blockTag = "h4";

      const parts: string[] = [];
      for (const pe of para.elements as { textRun?: { content?: string; textStyle?: TextStyle }; inlineObjectElement?: { inlineObjectId?: string } }[]) {
        if (pe.textRun?.content != null) {
          const text = (pe.textRun.content as string).replace(/\n$/, "");
          if (text) parts.push(wrapTextRunStyle(text, pe.textRun.textStyle));
        }
        if (pe.inlineObjectElement?.inlineObjectId) {
          const objId = pe.inlineObjectElement.inlineObjectId;
          const inlineObjects: InlineObjectsMap = (data as { inlineObjects?: InlineObjectsMap }).inlineObjects ?? {};
          const inline = inlineObjects[objId];
          const contentUri = inline?.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri;
          if (contentUri) {
            try {
              const token = await auth.getAccessToken();
              const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
              const imageRes = await fetch(contentUri, { headers });
              if (imageRes.ok) {
                const buf = Buffer.from(await imageRes.arrayBuffer());
                const ext = "png";
                const filename = `gd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
                const imageUrl = await uploadToS3(buf, filename, "image/png");
                parts.push(`<img src="${escapeHtml(imageUrl)}" alt="" />`);
              } else {
                parts.push("[画像]");
              }
            } catch {
              parts.push("[画像]");
            }
          } else {
            parts.push("[画像]");
          }
        }
      }
      const inner = parts.join("");
      if (inner) contentElements.push(`<${blockTag}>${inner}</${blockTag}>`);
    }

    const content = contentElements.join("\n");

    return NextResponse.json({ title, content });
  } catch (e) {
    const message = e instanceof Error ? e.message : "取り込みに失敗しました";
    if (message.includes("403") || message.includes("Permission")) {
      return NextResponse.json(
        { error: "ドキュメントにアクセスできません。ドキュメントを「リンクを知っている全員が閲覧可」にするか、サービスアカウントのメールアドレスに共有してください。" },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
