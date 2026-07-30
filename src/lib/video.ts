/**
 * 記事本文への動画埋め込みに関する共通定義。
 *
 * 2つの入力経路をサポートする:
 *   - YouTube … URLから動画IDを抜き出して iframe で埋め込む
 *   - 動画ファイル … S3へ直接アップロードして <video> で埋め込む
 *
 * ★再生方式についての重要な制約★
 *   ブラウザは「音ありの自動再生」を一律でブロックする（ユーザー操作なしに音は鳴らせない）。
 *   そのため自動再生は必ずミュート付きで出力する。音を聞かせたい場合はクリック再生を選ぶ。
 *   YouTubeも同様で、autoplay=1 単体では再生されず mute=1 とセットにする必要がある。
 */

/** 再生方式。click = 音ありでクリック再生 / auto = ミュートで自動再生＋ループ */
export type VideoPlayMode = "click" | "auto";

export const VIDEO_PLAY_MODES: { value: VideoPlayMode; label: string; hint: string }[] = [
  { value: "click", label: "クリック再生", hint: "再生ボタンを押すと音ありで再生します（推奨）" },
  { value: "auto", label: "自動再生", hint: "ブラウザの制約で音なし・ループ再生になります" },
];

/** アップロードを許可する動画のMIMEタイプ。quicktime は iPhone の .mov */
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

/** 拡張子からMIMEを補う（ブラウザが type を空で渡してくる端末があるため） */
export const VIDEO_EXT_TO_TYPE: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

/**
 * アップロード上限（1GB）。
 * S3の単一PUTは5GBまで可能なので技術的な余裕はあるが、上げるほど
 * 「S3の転送量課金」と「読者の通信量」が視聴数に比例して膨らむ点に注意。
 * 目安: 1GBの動画を1,000人が視聴すると約1TBの転送量になる。
 */
export const MAX_VIDEO_SIZE = 1024 * 1024 * 1024;

/** これを超えたら「読み込みが重くなる」と警告する目安（30MB） */
export const VIDEO_SIZE_WARN_THRESHOLD = 30 * 1024 * 1024;

/** バイト数を人が読める形式にする */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * ファイルのMIMEタイプを判定する。
 * File.type が空の端末があるので、その場合は拡張子から補う。
 */
export function resolveVideoType(file: { type: string; name: string }): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return VIDEO_EXT_TO_TYPE[ext] || "";
}

/** 許可された動画タイプかどうか */
export function isAllowedVideoType(type: string): boolean {
  return (ALLOWED_VIDEO_TYPES as readonly string[]).includes(type);
}

/** YouTubeのURLから動画IDを取り出す。取れなければ null */
export function extractYoutubeId(url: string): string | null {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

/** HTML属性値に埋め込むための最小限のエスケープ */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** YouTube埋め込みHTMLを組み立てる */
export function buildYoutubeEmbed(videoId: string, mode: VideoPlayMode): string {
  const params = new URLSearchParams({ rel: "0" });
  if (mode === "auto") {
    // autoplay は mute とセットでないとブラウザに止められる
    params.set("autoplay", "1");
    params.set("mute", "1");
    // loop は playlist に自分自身のIDを指定しないと効かない（YouTube側の仕様）
    params.set("loop", "1");
    params.set("playlist", videoId);
  }
  const src = `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  return (
    `<div class="youtube-wrap" data-play-mode="${mode}">` +
    `<iframe src="${escapeAttr(src)}" title="YouTube動画" loading="lazy" ` +
    `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ` +
    `allowfullscreen></iframe></div>`
  );
}

/**
 * アップロードした動画ファイルの埋め込みHTMLを組み立てる。
 * 自動再生でも controls を付けるのは、視聴者がミュート解除・停止できるようにするため。
 *
 * @param posterUrl サムネイル画像のURL。クリック再生時に再生前に表示される。
 *                  指定すると preload="none" にできるため、再生されるまで
 *                  動画本体を一切ダウンロードしない（転送量の節約になる）。
 */
export function buildVideoFileEmbed(
  url: string,
  mode: VideoPlayMode,
  posterUrl?: string
): string {
  const src = escapeAttr(url);
  const poster = posterUrl?.trim() ? ` poster="${escapeAttr(posterUrl.trim())}"` : "";

  // playsinline … iOSで勝手に全画面にならないようにする（自動再生の前提条件でもある）
  // preload … サムネイルがあれば none（再生するまで動画を取得しない）、
  //           なければ metadata（1フレーム目を出すために最小限だけ取得）
  const attrs =
    mode === "auto"
      ? 'autoplay muted loop playsinline controls preload="auto"'
      : `controls playsinline preload="${poster ? "none" : "metadata"}"`;

  return (
    `<div class="video-wrap" data-play-mode="${mode}">` +
    `<video src="${src}"${poster} ${attrs}></video></div>`
  );
}
