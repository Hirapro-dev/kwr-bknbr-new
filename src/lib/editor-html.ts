/**
 * コードモード用: HTMLを整形して視認性を上げる。
 * - </p>, </div>, </blockquote>, </h1>〜</h6> の直後に改行2つ（段落＝1行＋空行）
 * - <br> の直後に改行1つ
 */
export function prettyPrintHtml(html: string): string {
  if (!html.trim()) return html;
  let s = html.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // ブロック閉じタグの直後に改行2つ（まだ改行がなければ）
  s = s.replace(/<\/(?:p|div|blockquote|h[1-6]|li)>(?!\s*\n)/gi, (match) => match + "\n\n");
  // <br> の直後に改行1つ
  s = s.replace(/<br\s*\/?>(?!\s*\n)/gi, () => "<br>\n");
  // 連続する空行を最大2つに
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/**
 * ビジュアルモード用: タグ間の改行・空白を除去し、コード⇔ビジュアル往復で余計なスペースが増えないようにする。
 */
export function normalizeHtmlForVisual(html: string): string {
  if (!html.trim()) return html;
  return html.replace(/>\s+</g, "><").trim();
}
