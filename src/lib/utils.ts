export function generateSlug(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8);
  // 例: 183045a1b2c3
  return `${h}${m}${s}${rand}`;
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  });
}

/** 予約投稿日があればそちらを、なければ作成日を表示用日付として返す */
export function getDisplayDate(post: { scheduledAt?: string | Date | null; createdAt: string | Date }): string | Date {
  return post.scheduledAt ? post.scheduledAt : post.createdAt;
}

/** JST（Asia/Tokyo）のDateTimeをdatetime-local用の文字列（YYYY-MM-DDTHH:mm）に変換 */
export function toJstDatetimeLocal(date: Date | string): string {
  const d = new Date(date);
  // JSTオフセット: UTC+9時間
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 16);
}

/** datetime-localの値（JSTとして入力された）をUTCのISO文字列に変換 */
export function fromJstDatetimeLocal(localValue: string): string {
  // localValueは "YYYY-MM-DDTHH:mm" 形式でJSTとして解釈
  const jstDate = new Date(localValue + ":00+09:00");
  return jstDate.toISOString();
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}
