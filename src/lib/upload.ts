import imageCompression from "browser-image-compression";
import {
  MAX_VIDEO_SIZE,
  formatFileSize,
  isAllowedVideoType,
  resolveVideoType,
} from "@/lib/video";

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: "image/webp" as const,
};

export async function compressAndUpload(file: File): Promise<string> {
  let compressed: File;

  // GIFはアニメーションが壊れるので圧縮しない
  if (file.type === "image/gif") {
    compressed = file;
  } else {
    compressed = await imageCompression(file, COMPRESSION_OPTIONS);
  }

  const formData = new FormData();
  formData.append("file", compressed, compressed.name);

  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "アップロードに失敗しました");
  }

  return data.url;
}

/**
 * 動画ファイルをS3へ直接アップロードし、公開URLを返す。
 *
 * 手順:
 *   1. /api/upload-video に署名付きURLを発行してもらう（認証・形式・サイズ検証もここ）
 *   2. そのURLへブラウザから直接PUT（Vercelの関数を経由しないのでサイズ上限が効かない）
 *
 * fetch にはアップロード進捗を取る手段がないため、PUTは XMLHttpRequest で行う。
 *
 * @param onProgress 0〜100 の進捗率を受け取るコールバック
 */
export async function uploadVideo(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const contentType = resolveVideoType(file);

  // サーバー側でも検証するが、無駄な往復を避けるため手前で弾く
  if (!isAllowedVideoType(contentType)) {
    throw new Error("対応していない動画形式です（mp4 / webm / mov に対応）");
  }
  if (file.size > MAX_VIDEO_SIZE) {
    throw new Error(
      `ファイルサイズは${formatFileSize(MAX_VIDEO_SIZE)}以下にしてください（選択されたファイル: ${formatFileSize(file.size)}）`
    );
  }

  const signRes = await fetch("/api/upload-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType, size: file.size }),
  });
  const signData = await signRes.json();
  if (!signRes.ok) {
    throw new Error(signData.error || "アップロードURLの発行に失敗しました");
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signData.uploadUrl);
    // 署名時のContentTypeと一致させないとS3が署名不一致で拒否する
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else
        reject(
          new Error(
            `S3へのアップロードに失敗しました（HTTP ${xhr.status}）。バケットのCORS設定でPUTが許可されているか確認してください。`
          )
        );
    });
    xhr.addEventListener("error", () =>
      reject(
        new Error(
          "S3へのアップロードに失敗しました。ネットワーク接続、またはバケットのCORS設定を確認してください。"
        )
      )
    );
    xhr.addEventListener("abort", () => reject(new Error("アップロードが中断されました")));

    xhr.send(file);
  });

  return signData.publicUrl as string;
}
