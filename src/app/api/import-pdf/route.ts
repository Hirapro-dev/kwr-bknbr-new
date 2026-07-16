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

type TextItem = { str: string; transform: number[] };
type Line = { text: string; y: number; gapBefore: number | null };

/** 1ページ分のテキストアイテムを行にまとめる（y座標でグループ化、2px以内は同一行） */
function buildLines(items: TextItem[]): Line[] {
  const lineMap: { y: number; parts: { x: number; str: string }[] }[] = [];
  for (const it of items) {
    if (typeof it.str !== "string") continue;
    const y = it.transform[5];
    const x = it.transform[4];
    const found = lineMap.find((l) => Math.abs(l.y - y) <= 2);
    if (found) {
      found.parts.push({ x, str: it.str });
    } else {
      lineMap.push({ y, parts: [{ x, str: it.str }] });
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
    lines.push({ text, y: l.y, gapBefore });
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

/** 段落（行の配列）をHTMLの<p>に変換。■/◾/【で始まる見出し行は太字にする */
function paragraphToHtml(paraLines: string[]): string {
  const inner = paraLines
    .map((line) => {
      const escaped = linkifyUrls(escapeHtml(line));
      return /^[■◾▪【]/.test(line.trim()) ? `<strong>${escaped}</strong>` : escaped;
    })
    .join("<br>");
  return `<p>${inner}</p>`;
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

    // 全ページの行を抽出。行間が標準の1.6倍を超えたら段落区切りとみなす
    const paragraphs: string[][] = [];
    let title = "";
    let current: string[] = [];

    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const tc = await page.getTextContent();
      const lines = buildLines(tc.items as TextItem[]);
      if (lines.length === 0) continue;

      const median = medianGap(lines);
      const threshold = median > 0 ? median * 1.6 : Infinity;

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
        current.push(line.text);
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
