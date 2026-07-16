import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

// PDF解析はNode.jsランタイムで実行（pdfjs-distがfsを使うため）
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// 日本語フォントの文字コード表（cMap）と標準フォントの置き場所
const CMAP_DIR = path.join(process.cwd(), "node_modules/pdfjs-dist/cmaps") + "/";
const FONT_DIR = path.join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts") + "/";

/** pdfjs-distをロード（Node 20.16未満向けにgetBuiltinModuleをポリフィル） */
async function loadPdfjs() {
  const proc = process as NodeJS.Process & { getBuiltinModule?: (name: string) => unknown };
  if (typeof proc.getBuiltinModule !== "function") {
    const req = createRequire(import.meta.url);
    proc.getBuiltinModule = (name: string) => req(name);
  }
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

// pdf.js内部のファイル読込（fetch）は実行環境によって失敗するため、
// cMap（日本語文字コード表）・標準フォントは自前でfsから読んで渡す
class FsCMapReaderFactory {
  baseUrl: string;
  isCompressed: boolean;
  constructor({ baseUrl, isCompressed }: { baseUrl: string; isCompressed: boolean }) {
    this.baseUrl = baseUrl;
    this.isCompressed = isCompressed;
  }
  async fetch({ name }: { name: string }) {
    const file = path.join(this.baseUrl, name + (this.isCompressed ? ".bcmap" : ""));
    const data = await readFile(file);
    return { cMapData: new Uint8Array(data), isCompressed: this.isCompressed };
  }
}

class FsStandardFontDataFactory {
  baseUrl: string;
  constructor({ baseUrl }: { baseUrl: string }) {
    this.baseUrl = baseUrl;
  }
  async fetch({ filename }: { filename: string }) {
    const data = await readFile(path.join(this.baseUrl, filename));
    return new Uint8Array(data);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** エスケープ済みテキスト中のURLを<a>タグに変換 */
function linkifyUrls(escaped: string): string {
  return escaped.replace(
    /(https?:\/\/[^\s<>"']+)/g,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  );
}

type TextItem = { str: string; transform: number[]; fontName?: string };
type Line = { text: string; y: number; gapBefore: number | null; fonts: Record<string, number> };

/** 1ページ分のテキストアイテムを行にまとめる（y座標でグループ化、2px以内は同一行） */
function buildLines(items: TextItem[]): Line[] {
  const lineMap: { y: number; parts: { x: number; str: string; fontName?: string }[] }[] = [];
  for (const it of items) {
    if (typeof it.str !== "string") continue;
    const y = it.transform[5];
    const x = it.transform[4];
    const found = lineMap.find((l) => Math.abs(l.y - y) <= 2);
    if (found) {
      found.parts.push({ x, str: it.str, fontName: it.fontName });
    } else {
      lineMap.push({ y, parts: [{ x, str: it.str, fontName: it.fontName }] });
    }
  }
  // 上から下（PDFのy座標は下から上なので降順）に並べ、行内はxの昇順で結合
  lineMap.sort((a, b) => b.y - a.y);
  const lines: Line[] = [];
  let prevY: number | null = null;
  for (const l of lineMap) {
    l.parts.sort((a, b) => a.x - b.x);
    const text = l.parts.map((p) => p.str).join("").replace(/\s+$/g, "");
    const gapBefore = prevY !== null ? prevY - l.y : null;
    prevY = l.y;
    if (text.trim() === "") continue;
    // フォント別の文字数（空白除く）を集計。太字判定に使う
    const fonts: Record<string, number> = {};
    for (const p of l.parts) {
      const chars = p.str.replace(/\s+/g, "").length;
      if (chars > 0 && p.fontName) fonts[p.fontName] = (fonts[p.fontName] || 0) + chars;
    }
    lines.push({ text, y: l.y, gapBefore, fonts });
  }
  return lines;
}

/** 行間ギャップの中央値（標準の行間隔）を求める */
function medianGap(lines: Line[]): number {
  const gaps = lines
    .map((l) => l.gapBefore)
    .filter((g): g is number => g !== null && g > 0)
    .sort((a, b) => a - b);
  if (gaps.length === 0) return 0;
  return gaps[Math.floor(gaps.length / 2)];
}

// 段落を構成する1行（テキスト＋太字フラグ）
type ParaLine = { text: string; bold: boolean };

// 箇条書き行（・で始まる行）の判定
const BULLET_RE = /^\s*[・･•]/;

/** 1行をHTML化（エスケープ→URLリンク化→太字） */
function renderLine(line: ParaLine): string {
  const escaped = linkifyUrls(escapeHtml(line.text));
  const bold = line.bold || /^[■◾▪【]/.test(line.text.trim());
  return bold ? `<strong>${escaped}</strong>` : escaped;
}

/** 段落をHTMLに変換。・が2行以上連続する場合は<ul><li>にする */
function paragraphToHtml(paraLines: ParaLine[]): string {
  const blocks: string[] = [];
  let textBuf: string[] = [];
  let bulletBuf: ParaLine[] = [];

  const flushText = () => {
    if (textBuf.length > 0) {
      blocks.push(`<p>${textBuf.join("<br>")}</p>`);
      textBuf = [];
    }
  };
  const flushBullets = () => {
    if (bulletBuf.length >= 2) {
      // 2行以上連続 → <ul><li>（行頭の・は除去）
      flushText();
      const items = bulletBuf
        .map((l) => {
          const inner = linkifyUrls(escapeHtml(l.text.replace(/^\s*[・･•]\s*/, "")));
          return `<li>${l.bold ? `<strong>${inner}</strong>` : inner}</li>`;
        })
        .join("");
      blocks.push(`<ul>${items}</ul>`);
    } else if (bulletBuf.length === 1) {
      // 単独の・行は通常テキストのまま
      textBuf.push(renderLine(bulletBuf[0]));
    }
    bulletBuf = [];
  };

  for (const line of paraLines) {
    if (BULLET_RE.test(line.text)) {
      bulletBuf.push(line);
    } else {
      flushBullets();
      textBuf.push(renderLine(line));
    }
  }
  flushBullets();
  flushText();
  return blocks.join("\n");
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDFファイルを指定してください" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "ファイルサイズは20MB以下にしてください" }, { status: 400 });
    }

    const { getDocument } = await loadPdfjs();
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocument({
      data,
      cMapUrl: CMAP_DIR,
      cMapPacked: true,
      standardFontDataUrl: FONT_DIR,
      useSystemFonts: true,
      // fetchではなくfsで読む自前ファクトリを使う（Next.js/Vercel環境対策）
      useWorkerFetch: false,
      CMapReaderFactory: FsCMapReaderFactory,
      StandardFontDataFactory: FsStandardFontDataFactory,
    }).promise;

    // 1パス目: 全ページの行を集め、フォント別の総文字数を集計
    const pages: { lines: Line[]; threshold: number }[] = [];
    const fontTotals: Record<string, number> = {};
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const tc = await page.getTextContent();
      const lines = buildLines(tc.items as TextItem[]);
      if (lines.length === 0) continue;
      // 行間が標準（中央値）の1.6倍を超えたら段落区切りとみなす
      const median = medianGap(lines);
      pages.push({ lines, threshold: median > 0 ? median * 1.6 : Infinity });
      for (const l of lines) {
        for (const [f, n] of Object.entries(l.fonts)) fontTotals[f] = (fontTotals[f] || 0) + n;
      }
    }

    // 本文の基本フォント＝最も文字数が多いフォント。
    // 基本フォントを1文字も含まない行は太字（見出し等）とみなす
    const majorityFont = Object.entries(fontTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    const isBoldLine = (l: Line) =>
      Object.keys(l.fonts).length > 0 && !(majorityFont in l.fonts);

    // 2パス目: 段落を構築（ページ境界は常に段落区切り）
    const paragraphs: ParaLine[][] = [];
    let title = "";
    let current: ParaLine[] = [];

    for (const { lines, threshold } of pages) {
      for (const line of lines) {
        const isBreak = line.gapBefore !== null && line.gapBefore > threshold;
        if (isBreak && current.length > 0) {
          paragraphs.push(current);
          current = [];
        }
        // 最初の非空行はタイトルとして扱い、本文から除外
        if (!title) {
          title = line.text.trim();
          continue;
        }
        current.push({ text: line.text, bold: isBoldLine(line) });
      }
      // ページ境界で段落を閉じる
      if (current.length > 0) {
        paragraphs.push(current);
        current = [];
      }
    }
    if (current.length > 0) paragraphs.push(current);

    if (!title && paragraphs.length === 0) {
      return NextResponse.json(
        { error: "PDFからテキストを抽出できませんでした。画像化されたPDF（スキャン等）は取り込めません。" },
        { status: 422 }
      );
    }

    const content = paragraphs.map(paragraphToHtml).join("\n");
    return NextResponse.json({ title, content });
  } catch (e) {
    console.error("PDF取り込みエラー:", e);
    return NextResponse.json({ error: "PDFの解析に失敗しました" }, { status: 500 });
  }
}
