/**
 * 配信チャネル（メルマガ / LINE）の計測に関する共通定義。
 *
 * 計測の2軸:
 *   - media   … どの会員向けサイトで読まれたか（gen / vip / vc / wel）＝既存の `source`
 *   - channel … どの配信媒体から来たか（mail / line）＝本ファイルで追加
 *
 * 流れ:
 *   1. 配信URL `/gen/{slug}?ch=line` で着地
 *   2. ClickTracker が `ch` を読み取り Cookie `kwr_ch` に保存（ラストタッチ方式）
 *   3. 閲覧数・記事内リンクのクリックを channel 付きで記録
 *   4. 関連記事へ回遊しても Cookie が残っている限り channel を引き継ぐ
 */

/** 配信チャネル。DBには文字列で保存する */
export type Channel = "mail" | "line";

/** 集計時の表示区分（channel が null のものは "direct" に寄せる） */
export type ChannelBucket = Channel | "direct";

/** 着地URLに付けるクエリパラメータ名 */
export const CHANNEL_PARAM = "ch";

/** チャネルを保持するCookie名（JSから読む必要があるため HttpOnly にはしない） */
export const CHANNEL_COOKIE = "kwr_ch";

/**
 * Cookieの保持期間（30日）。
 * これより長いと「先月LINEから来た人が今月メルマガで来た」を誤判定しやすくなる。
 */
export const CHANNEL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

export const CHANNELS: Channel[] = ["mail", "line"];

/** 集計表で使う並び順（直接流入を最後に置く） */
export const CHANNEL_BUCKETS: ChannelBucket[] = ["mail", "line", "direct"];

export const CHANNEL_LABELS: Record<ChannelBucket, string> = {
  mail: "メルマガ",
  line: "LINE",
  direct: "直接・不明",
};

/** 媒体（会員種別）。既存の source と同じ値 */
export type Media = "gen" | "vip" | "vc" | "wel";

export const MEDIA_LIST: { key: Media; label: string; path: string }[] = [
  { key: "gen", label: "一般会員", path: "/gen" },
  { key: "vip", label: "正会員", path: "/vip" },
  { key: "vc", label: "仮想通貨長者", path: "/vc" },
  { key: "wel", label: "ウェルネス", path: "/wel" },
];

/** 不正値・未指定を弾いて Channel に正規化する。該当しなければ null */
export function normalizeChannel(value: unknown): Channel | null {
  return value === "mail" || value === "line" ? value : null;
}

/** null（＝チャネル不明）を集計用の "direct" に寄せる */
export function toChannelBucket(value: string | null | undefined): ChannelBucket {
  return normalizeChannel(value) ?? "direct";
}

/** GA4でも同じ流入を追えるように付与するUTMパラメータ */
const UTM_BY_CHANNEL: Record<Channel, { source: string; medium: string }> = {
  mail: { source: "mailmagazine", medium: "email" },
  line: { source: "line", medium: "social" },
};

/**
 * 配信用URLを組み立てる。
 * @param origin   例: "https://example.com"（末尾スラッシュなし）
 * @param media    配信先の媒体
 * @param slug     記事スラッグ
 * @param channel  配信チャネル
 * @param withUtm  GA4用のUTMパラメータも付けるか
 */
export function buildDeliveryUrl(
  origin: string,
  media: Media,
  slug: string,
  channel: Channel,
  withUtm = false
): string {
  const path = MEDIA_LIST.find((m) => m.key === media)?.path ?? "/gen";
  const params = new URLSearchParams({ [CHANNEL_PARAM]: channel });
  if (withUtm) {
    const utm = UTM_BY_CHANNEL[channel];
    params.set("utm_source", utm.source);
    params.set("utm_medium", utm.medium);
  }
  return `${origin.replace(/\/$/, "")}${path}/${slug}?${params.toString()}`;
}
