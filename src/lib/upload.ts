import imageCompression from "browser-image-compression";

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
