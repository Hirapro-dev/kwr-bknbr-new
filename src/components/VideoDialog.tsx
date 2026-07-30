"use client";

import { useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiCamera,
  FiFilm,
  FiImage,
  FiRefreshCw,
  FiUpload,
  FiX,
  FiYoutube,
} from "react-icons/fi";
import { compressAndUpload, uploadVideo } from "@/lib/upload";
import { captureVideoFrame } from "@/lib/video-poster";
import {
  MAX_VIDEO_SIZE,
  VIDEO_PLAY_MODES,
  VIDEO_SIZE_WARN_THRESHOLD,
  buildVideoFileEmbed,
  buildYoutubeEmbed,
  extractYoutubeId,
  formatFileSize,
  type VideoPlayMode,
} from "@/lib/video";

type Source = "youtube" | "file";

type Props = {
  /** 組み立てた埋め込みHTMLを本文に挿入する */
  onInsert: (html: string) => void;
  onClose: () => void;
};

/**
 * 動画挿入ダイアログ。
 * YouTubeのURL埋め込みと、動画ファイル（mp4 / webm / mov）の直接アップロードに対応する。
 * 再生方式は「クリック再生」「自動再生」から選ぶ。
 */
export default function VideoDialog({ onInsert, onClose }: Props) {
  const [source, setSource] = useState<Source>("youtube");
  const [playMode, setPlayMode] = useState<VideoPlayMode>("click");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [posterBusy, setPosterBusy] = useState("");
  const [posterError, setPosterError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);
  // プレビュー動画。「今表示している位置」をサムネにするために現在位置を読む
  const previewRef = useRef<HTMLVideoElement>(null);

  const handleFileSelect = async (file: File) => {
    setError("");
    setFileName(file.name);
    setFileSize(file.size);
    setUploading(true);
    setProgress(0);
    // 動画を差し替えたら前のサムネイルは無効になるので消す
    setPosterUrl("");
    setPosterError("");
    try {
      const url = await uploadVideo(file, setProgress);
      setVideoUrl(url);
    } catch (e) {
      setVideoUrl("");
      setError(e instanceof Error ? e.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  };

  /** プレビューで表示している位置のフレームをサムネイルにする */
  const capturePoster = async () => {
    if (!videoUrl) return;
    setPosterBusy("capture");
    setPosterError("");
    try {
      const time = previewRef.current?.currentTime ?? 0;
      const frame = await captureVideoFrame(videoUrl, time);
      setPosterUrl(await compressAndUpload(frame));
    } catch (e) {
      setPosterError(
        e instanceof Error ? e.message : "フレームの切り出しに失敗しました"
      );
    } finally {
      setPosterBusy("");
    }
  };

  /** 手持ちの画像をサムネイルにする */
  const uploadPoster = async (file: File) => {
    setPosterBusy("upload");
    setPosterError("");
    try {
      setPosterUrl(await compressAndUpload(file));
    } catch (e) {
      setPosterError(e instanceof Error ? e.message : "画像のアップロードに失敗しました");
    } finally {
      setPosterBusy("");
    }
  };

  const handleInsert = () => {
    setError("");
    if (source === "youtube") {
      const videoId = extractYoutubeId(youtubeUrl.trim());
      if (!videoId) {
        setError("有効なYouTube URLを入力してください");
        return;
      }
      onInsert(buildYoutubeEmbed(videoId, playMode));
    } else {
      if (!videoUrl) {
        setError("動画ファイルをアップロードしてください");
        return;
      }
      onInsert(buildVideoFileEmbed(videoUrl, playMode, posterUrl));
    }
    onClose();
  };

  const isHeavy = fileSize > VIDEO_SIZE_WARN_THRESHOLD;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-sm font-semibold text-slate-800">動画を挿入</p>

        {/* 入力元の切り替え */}
        <div className="mb-4 grid grid-cols-2 gap-1.5">
          {(
            [
              { value: "youtube", label: "YouTube", icon: <FiYoutube size={14} /> },
              { value: "file", label: "動画ファイル", icon: <FiFilm size={14} /> },
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setSource(tab.value);
                setError("");
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                source === tab.value
                  ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {source === "youtube" ? (
          <div className="mb-4">
            <label className="mb-1.5 block text-xs text-slate-500">YouTubeのURL</label>
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-slate-400">
              通常の動画・Shorts・ライブのURLに対応しています
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              サムネイルはYouTube側で設定したものが使われます（記事側からの指定はできません）。
            </p>
          </div>
        ) : (
          <div className="mb-4">
            <label className="mb-1.5 block text-xs text-slate-500">動画ファイル</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileSelect(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-400 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"
            >
              {uploading ? <FiRefreshCw className="animate-spin" /> : <FiUpload />}
              {uploading ? `アップロード中… ${progress}%` : "ファイルを選択"}
            </button>

            {uploading && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {!uploading && videoUrl && (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="truncate text-[11px] font-semibold text-slate-700">{fileName}</p>
                <p className="text-[10px] text-slate-400">
                  {formatFileSize(fileSize)} ・ アップロード完了
                </p>
                <video
                  ref={previewRef}
                  src={videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="mt-2 w-full rounded"
                />
              </div>
            )}

            {/* サムネイル（poster）。再生前に表示される画像 */}
            {!uploading && videoUrl && (
              <div className="mt-3 rounded-lg border border-slate-200 p-2">
                <p className="mb-1.5 text-xs font-semibold text-slate-700">サムネイル</p>
                <p className="mb-2 text-[10px] text-slate-400">
                  クリック再生のとき、再生前に表示される画像です。設定すると再生されるまで動画本体を読み込まないので、表示も軽くなります。
                </p>

                {posterUrl && (
                  <div className="relative mb-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={posterUrl}
                      alt="サムネイルのプレビュー"
                      className="w-full rounded border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setPosterUrl("")}
                      aria-label="サムネイルを削除"
                      title="サムネイルを削除"
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <FiX size={12} />
                    </button>
                  </div>
                )}

                <input
                  ref={posterInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadPoster(file);
                    e.target.value = "";
                  }}
                />

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => void capturePoster()}
                    disabled={posterBusy !== ""}
                    className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    {posterBusy === "capture" ? (
                      <FiRefreshCw className="animate-spin" size={12} />
                    ) : (
                      <FiCamera size={12} />
                    )}
                    {posterBusy === "capture" ? "取得中…" : "今の位置を使う"}
                  </button>
                  <button
                    type="button"
                    onClick={() => posterInputRef.current?.click()}
                    disabled={posterBusy !== ""}
                    className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    {posterBusy === "upload" ? (
                      <FiRefreshCw className="animate-spin" size={12} />
                    ) : (
                      <FiImage size={12} />
                    )}
                    {posterBusy === "upload" ? "送信中…" : "画像を選ぶ"}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  「今の位置を使う」は、上のプレビューで表示している場面をそのままサムネイルにします。
                </p>
                {posterError && <p className="mt-1 text-[10px] text-red-600">{posterError}</p>}
              </div>
            )}

            {isHeavy && videoUrl && (
              <p className="mt-2 flex items-start gap-1 text-[10px] text-amber-700">
                <FiAlertTriangle size={12} className="mt-px shrink-0" />
                ファイルが大きいため、読者の通信環境では読み込みに時間がかかります。
                {formatFileSize(VIDEO_SIZE_WARN_THRESHOLD)}以下への圧縮、またはYouTube埋め込みを推奨します。
              </p>
            )}

            <p className="mt-1 text-[10px] text-slate-400">
              mp4 / webm / mov、{formatFileSize(MAX_VIDEO_SIZE)}まで
            </p>
          </div>
        )}

        {/* 再生方式 */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs text-slate-500">再生方式</label>
          <div className="grid grid-cols-2 gap-1.5">
            {VIDEO_PLAY_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setPlayMode(m.value)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                  playMode === m.value
                    ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            {VIDEO_PLAY_MODES.find((m) => m.value === playMode)?.hint}
          </p>
          {playMode === "auto" && (
            <p className="mt-1 flex items-start gap-1 text-[10px] text-amber-700">
              <FiAlertTriangle size={12} className="mt-px shrink-0" />
              音ありの自動再生はブラウザ側で一律ブロックされるため、自動再生は必ず音なしになります。音を聞かせたい場合は「クリック再生」を選んでください。
            </p>
          )}
        </div>

        {error && <p className="mb-3 text-[11px] text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleInsert}
            disabled={uploading}
            className="flex-1 cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            挿入
          </button>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
