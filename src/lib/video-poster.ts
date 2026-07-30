/**
 * 動画のサムネイル（poster画像）を作るためのブラウザ専用ユーティリティ。
 *
 * S3上の動画から指定時点のフレームを切り出す。
 * canvasに描画するには動画をCORS付きで取得する必要があるため、
 * 取り込み用の <video> には crossOrigin="anonymous" を付ける。
 * （バケットのCORSでGETが許可されていないとここで失敗するので、
 *   その場合は画像を手動アップロードする経路にフォールバックさせる）
 */

/** 切り出したフレームの最大幅。posterに1920pxは不要なので抑える */
const MAX_POSTER_WIDTH = 1280;

/**
 * 動画URLの指定時点のフレームを画像Fileとして切り出す。
 * @param url  動画の公開URL
 * @param time 切り出す位置（秒）
 */
export async function captureVideoFrame(url: string, time: number): Promise<File> {
  const video = document.createElement("video");
  // src を設定する前に付けないとCORS付き取得にならない
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const onError = () =>
        reject(
          new Error(
            "動画を読み込めませんでした。S3バケットのCORS設定でGETが許可されているか確認してください。"
          )
        );
      video.addEventListener("error", onError, { once: true });
      video.addEventListener("loadedmetadata", () => resolve(), { once: true });
      // 読み込みが進まない場合に無限待ちしないよう上限を設ける
      setTimeout(() => reject(new Error("動画の読み込みがタイムアウトしました")), 30000);
    });

    // 範囲外の時刻を指定するとseekedが来ないので、動画長に収める
    const target = Math.min(Math.max(time, 0), Math.max(video.duration - 0.1, 0));
    await new Promise<void>((resolve, reject) => {
      video.addEventListener("seeked", () => resolve(), { once: true });
      video.addEventListener("error", () => reject(new Error("指定位置へ移動できませんでした")), {
        once: true,
      });
      setTimeout(() => reject(new Error("フレームの取得がタイムアウトしました")), 30000);
      video.currentTime = target;
    });

    const scale = Math.min(1, MAX_POSTER_WIDTH / (video.videoWidth || MAX_POSTER_WIDTH));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvasを初期化できませんでした");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9)
    );
    if (!blob) {
      // 別ドメインの動画をCORSなしで読み込むとcanvasが汚染され、ここで失敗する
      throw new Error("フレームを画像に変換できませんでした");
    }

    return new File([blob], `poster-${Date.now()}.jpg`, { type: "image/jpeg" });
  } finally {
    // 参照を切って読み込みを止める
    video.removeAttribute("src");
    video.load();
  }
}
