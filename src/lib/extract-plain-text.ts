/**
 * HTMLコンテンツからプレーンテキストを抽出するユーティリティ
 * ブラウザのDOMParserを使用してHTMLをパースし、テキストノードのみを取得する
 */
export function extractPlainText(html: string, maxLength: number = 400): string {
  if (!html) return "";

  // DOMParserでHTMLをパース
  const doc = new DOMParser().parseFromString(html, "text/html");

  // 不要な要素を除去
  doc.querySelectorAll("script, style, iframe, noscript, .btn-wrap").forEach((el) => el.remove());

  // textContentでテキスト取得し、空白を正規化
  const text = (doc.body.textContent || "")
    .replace(/\s+/g, " ")
    .trim();

  // 指定文字数で切り、末尾に「…」を付加
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + "…";
  }
  return text;
}
