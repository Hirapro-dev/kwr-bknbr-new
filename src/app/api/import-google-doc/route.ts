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

type RgbColor = { red?: number; green?: number; blue?: number };

type TextStyle = {
  bold?: boolean;
  underline?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  link?: { url?: string };
  // Google Docs APIは foregroundColor / backgroundColor の両形式を返す場合がある
  foregroundColor?: { color?: { rgbColor?: RgbColor }; rgbColor?: RgbColor };
  backgroundColor?: { color?: { rgbColor?: RgbColor }; rgbColor?: RgbColor };
};

// リンク付きテキストランの結果を表す型
type TextRunResult = { html: string; isLink: boolean; linkUrl?: string };

/** RgbColorを取得するヘルパー（Google Docs APIの2種類の形式に対応） */
function extractRgb(colorObj?: { color?: { rgbColor?: RgbColor }; rgbColor?: RgbColor }): RgbColor | null {
  if (!colorObj) return null;
  // 直接rgbColorがある場合
  const direct = colorObj.rgbColor;
  if (direct && (direct.red !== undefined || direct.green !== undefined || direct.blue !== undefined)) {
    return direct;
  }
  // color.rgbColor の形式
  const nested = colorObj.color?.rgbColor;
  if (nested && (nested.red !== undefined || nested.green !== undefined || nested.blue !== undefined)) {
    return nested;
  }
  return null;
}

/** インラインスタイルを適用した文字列を返す（色・太字・下線・マーカー・イタリック・取り消し線） */
function applyInlineStyles(escaped: string, style?: TextStyle): string {
  if (!style) return escaped;
  let out = escaped;
  if (style.bold) out = `<strong>${out}</strong>`;
  if (style.italic) out = `<em>${out}</em>`;
  if (style.strikethrough) out = `<s>${out}</s>`;
  if (style.underline && !style.link?.url) out = `<u>${out}</u>`; // リンクには下線つけない（aタグ側で処理）

  // 前景色（黒 #000000 はデフォルトなのでスキップ）
  const fg = extractRgb(style.foregroundColor);
  if (fg) {
    const hex = rgbToHex(fg.red ?? 0, fg.green ?? 0, fg.blue ?? 0);
    if (hex !== "#000000") {
      out = `<span style="color:${hex}">${out}</span>`;
    }
  }

  // 背景色（マーカー / ハイライト）
  const bg = extractRgb(style.backgroundColor);
  if (bg) {
    const hex = rgbToHex(bg.red ?? 0, bg.green ?? 0, bg.blue ?? 0);
    if (hex !== "#ffffff" && hex !== "#000000") {
      out = `<span style="background-color:${hex};padding:2px 4px;border-radius:3px">${out}</span>`;
    }
  }
  return out;
}

function wrapTextRunStyle(text: string, style?: TextStyle): TextRunResult {
  if (!text) return { html: "", isLink: false };
  const escaped = escapeHtml(text);
  if (!style) return { html: escaped, isLink: false };

  // リンクがある場合：スタイル（太字・色・マーカー）も適用した上でリンクとしてマーク
  const linkUrl = style.link?.url;
  if (linkUrl) {
    const styled = applyInlineStyles(escaped, style);
    return {
      html: styled,
      isLink: true,
      linkUrl,
    };
  }

  const out = applyInlineStyles(escaped, style);
  return { html: out, isLink: false };
}

// リンクテキストをbtn-wrapボタンHTMLに変換
function linkToButton(text: string, url: string): string {
  const escapedText = escapeHtml(text);
  const escapedUrl = escapeHtml(url);
  // sp-only改行を含めてスマホでも読みやすく
  return `<div class="btn-wrap"><a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-c">${escapedText}</a></div>`;
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

    // ドキュメントメタデータのタイトル（ファイル名）をフォールバックとして保持
    const metaTitle = data.title;
    let docTitle: string | null = null; // 本文中の「タイトル」スタイルから抽出
    const contentElements: string[] = [];

    // body.content または tabs[0].documentTab.body.content（API のバージョンに依存）
    const dataAny = data as { body?: { content?: unknown[] }; tabs?: { documentTab?: { body?: { content?: unknown[] } } }[] };
    const bodyContent = dataAny.body?.content ?? dataAny.tabs?.[0]?.documentTab?.body?.content ?? [];
    const elements = Array.isArray(bodyContent) ? bodyContent : [];

    for (const el of elements) {
      const se = el as {
        paragraph?: { elements?: unknown[]; paragraphStyle?: { namedStyleType?: string } };
        table?: { tableRows?: { tableCells?: { content?: unknown[] }[] }[] };
      };

      // テーブル処理
      if (se.table) {
        const rows = se.table.tableRows ?? [];
        const tableHtml: string[] = ["<table>"];
        for (let ri = 0; ri < rows.length; ri++) {
          tableHtml.push("<tr>");
          const cells = rows[ri].tableCells ?? [];
          for (const cell of cells) {
            const tag = ri === 0 ? "th" : "td";
            // セル内の段落テキストを結合
            const cellContent = cell.content ?? [];
            const cellTexts: string[] = [];
            for (const cellEl of cellContent as { paragraph?: { elements?: unknown[] } }[]) {
              const cellPara = cellEl.paragraph;
              if (!cellPara?.elements) continue;
              const cellParts: string[] = [];
              for (const pe of cellPara.elements as { textRun?: { content?: string; textStyle?: TextStyle } }[]) {
                if (pe.textRun?.content != null) {
                  const text = (pe.textRun.content as string).replace(/\n$/, "");
                  if (text) {
                    const result = wrapTextRunStyle(text, pe.textRun.textStyle);
                    cellParts.push(result.html);
                  }
                }
              }
              if (cellParts.length > 0) cellTexts.push(cellParts.join(""));
            }
            tableHtml.push(`<${tag}>${cellTexts.join("<br>")}</${tag}>`);
          }
          tableHtml.push("</tr>");
        }
        tableHtml.push("</table>");
        contentElements.push(tableHtml.join(""));
        continue;
      }

      const para = se.paragraph;
      if (!para?.elements) continue;

      const namedStyleType = para.paragraphStyle?.namedStyleType ?? "NORMAL_TEXT";

      // 「タイトル」スタイル（TITLE）、「サブタイトル」（SUBTITLE）、「見出し1」（HEADING_1）を
      // 記事タイトルとして抽出し、本文からは除外する（最初の1つのみ）
      if (docTitle === null && (namedStyleType === "TITLE" || namedStyleType === "SUBTITLE" || namedStyleType === "HEADING_1")) {
        const titleParts: string[] = [];
        for (const pe of para.elements as { textRun?: { content?: string } }[]) {
          if (pe.textRun?.content != null) {
            const text = (pe.textRun.content as string).replace(/\n$/, "");
            if (text) titleParts.push(text);
          }
        }
        const extracted = titleParts.join("").trim();
        if (extracted) {
          docTitle = extracted;
          continue; // この段落は本文に含めない
        }
      }

      let blockTag = "p";
      if (namedStyleType === "HEADING_1") blockTag = "h1";
      else if (namedStyleType === "HEADING_2") blockTag = "h2";
      else if (namedStyleType === "HEADING_3") blockTag = "h3";
      else if (namedStyleType === "HEADING_4") blockTag = "h4";

      // リンクテキストランを収集してボタンに変換
      type PartItem = { type: "html"; html: string } | { type: "link"; text: string; url: string };
      const parts: PartItem[] = [];
      for (const pe of para.elements as { textRun?: { content?: string; textStyle?: TextStyle }; inlineObjectElement?: { inlineObjectId?: string } }[]) {
        if (pe.textRun?.content != null) {
          const text = (pe.textRun.content as string).replace(/\n$/, "");
          if (text) {
            const result = wrapTextRunStyle(text, pe.textRun.textStyle);
            if (result.isLink && result.linkUrl) {
              parts.push({ type: "link", text, url: result.linkUrl });
            } else if (result.html) {
              parts.push({ type: "html", html: result.html });
            }
          }
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
                parts.push({ type: "html", html: `<img src="${escapeHtml(imageUrl)}" alt="" />` });
              } else {
                parts.push({ type: "html", html: "[画像]" });
              }
            } catch {
              parts.push({ type: "html", html: "[画像]" });
            }
          } else {
            parts.push({ type: "html", html: "[画像]" });
          }
        }
      }

      // パラグラフ全体がリンクのみで構成されている場合はボタン化
      const nonEmptyParts = parts.filter(p => p.type === "link" || (p.type === "html" && p.html.trim()));
      const allLinks = nonEmptyParts.length > 0 && nonEmptyParts.every(p => p.type === "link");

      if (allLinks) {
        // リンクのみの段落 → 各リンクをボタンとして出力
        for (const p of nonEmptyParts) {
          if (p.type === "link") {
            contentElements.push(linkToButton(p.text, p.url));
          }
        }
      } else {
        // 通常の段落（リンクが混在する場合はテキストリンクとして出力）
        const innerParts = parts.map(p => {
          if (p.type === "link") {
            return `<a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.text)}</a>`;
          }
          return p.html;
        });
        const inner = innerParts.join("");
        if (inner) contentElements.push(`<${blockTag}>${inner}</${blockTag}>`);
      }
    }

    const content = contentElements.join("\n");
    // 本文中の「タイトル」スタイルから抽出したテキストを優先、なければファイル名
    const title = docTitle || metaTitle;

    // 文字化け検出（連続する置換文字 U+FFFD や制御文字の混在をチェック）
    const fullText = title + content;
    const mojibakePatterns = [
      /\ufffd{2,}/,                    // 連続する置換文字（U+FFFD）
      /[\x00-\x08\x0e-\x1f]{2,}/,     // 連続する制御文字
      /\ufffd/,                        // 単発の置換文字でも検出
      /\u00c3[\u0080-\u00bf]{2,}/,     // UTF-8バイトがLatin-1として解釈されたパターン
      /\u00e2\u0080[\u0090-\u00bf]{2,}/, // マルチバイト文字の誤変換パターン
    ];
    const hasMojibake = mojibakePatterns.some((p) => p.test(fullText));

    return NextResponse.json({ title, content, hasMojibake });
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
