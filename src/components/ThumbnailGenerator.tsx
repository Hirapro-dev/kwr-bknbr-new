"use client";

import { useState, useEffect } from "react";
import { FiZap, FiRefreshCw, FiCheck, FiX, FiChevronDown, FiChevronUp, FiAlignLeft, FiAlignCenter, FiAlignRight } from "react-icons/fi";

type StyleOption = { key: string; label: string };

// スタイルアイコンのマッピング
const STYLE_ICONS: Record<string, string> = {
  realistic: "📷",
  illustration: "🎨",
  anime: "✨",
  watercolor: "🖌️",
  minimal: "◻️",
  cyberpunk: "🌃",
};

// スタイルの色のマッピング
const STYLE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  realistic: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  illustration: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700" },
  anime: { bg: "bg-pink-50", border: "border-pink-300", text: "text-pink-700" },
  watercolor: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700" },
  minimal: { bg: "bg-slate-100", border: "border-slate-400", text: "text-slate-700" },
  cyberpunk: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
};

type Props = {
  title: string;
  content: string;
  onApply: (imageUrl: string) => void;
};

export default function ThumbnailGenerator({ title, content, onApply }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [styles, setStyles] = useState<StyleOption[]>([]);
  const [selectedStyle, setSelectedStyle] = useState("realistic");
  const [generating, setGenerating] = useState(false);
  // Geminiが生成した画像のDataURL（タイトル文字込み）
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("center");
  const [overlay, setOverlay] = useState(true);
  const [adjustPrompt, setAdjustPrompt] = useState("");
  const [error, setError] = useState("");

  // スタイル一覧を取得
  useEffect(() => {
    fetch("/api/generate-thumbnail")
      .then((r) => r.json())
      .then((d) => {
        if (d.styles) setStyles(d.styles);
      })
      .catch(() => {});
  }, []);

  // サムネイル生成
  const handleGenerate = async () => {
    if (!title.trim()) {
      setError("タイトルを入力してからサムネイルを生成してください");
      return;
    }

    setGenerating(true);
    setError("");
    setPreviewDataUrl(null);

    try {
      const res = await fetch("/api/generate-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content,
          style: selectedStyle,
          textAlign,
          overlay,
          adjustPrompt: adjustPrompt.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "生成に失敗しました");
        return;
      }

      // Base64をDataURLに変換してプレビュー用に保持
      const dataUrl = `data:${data.imageMimeType};base64,${data.imageBase64}`;
      setPreviewDataUrl(dataUrl);
    } catch {
      setError("生成中にエラーが発生しました");
    } finally {
      setGenerating(false);
    }
  };

  // 決定：画像をS3にアップロードしてアイキャッチに設定
  const handleApply = async () => {
    if (!previewDataUrl) return;

    try {
      // DataURL → Blob変換
      const res = await fetch(previewDataUrl);
      const blob = await res.blob();
      const file = new File([blob], `thumbnail-${Date.now()}.png`, { type: "image/png" });

      // S3にアップロード
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const d = await uploadRes.json();
        alert(d.error || "アップロードに失敗しました");
        return;
      }

      const { url } = await uploadRes.json();
      onApply(url);

      // リセット
      setIsOpen(false);
      setPreviewDataUrl(null);
      setAdjustPrompt("");
    } catch {
      alert("アップロードに失敗しました");
    }
  };

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors"
      >
        <FiZap size={15} />
        <span>AIでサムネイルを自動生成</span>
        {isOpen ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
      </button>

      {isOpen && (
        <div className="mt-2 md:mt-3 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-3 md:p-5">
          {/* スタイル選択 */}
          <div className="mb-3 md:mb-4">
            <p className="text-xs font-semibold text-slate-600 mb-1.5 md:mb-2">スタイル</p>
            {/* モバイル: 横スクロール、デスクトップ: グリッド */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 md:grid md:grid-cols-6 md:gap-2 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {styles.map((s) => {
                const colors = STYLE_COLORS[s.key] || STYLE_COLORS.realistic;
                const isSelected = selectedStyle === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSelectedStyle(s.key)}
                    className={`flex-shrink-0 flex flex-col items-center gap-0.5 md:gap-1 px-2.5 md:px-3 py-1.5 md:py-2.5 rounded-lg border-2 transition-all text-center ${
                      isSelected
                        ? `${colors.bg} ${colors.border} ${colors.text} shadow-sm`
                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-base md:text-lg">{STYLE_ICONS[s.key] || "🎨"}</span>
                    <span className="text-[10px] md:text-[11px] font-semibold leading-tight whitespace-nowrap">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* テキスト配置 & オーバーレイ - モバイルでは1行に */}
          <div className="mb-3 md:mb-4 flex flex-wrap items-center gap-3 md:gap-4">
            <div className="flex gap-1.5 md:gap-2">
              {([
                { key: "left" as const, label: "左", icon: <FiAlignLeft size={14} /> },
                { key: "center" as const, label: "中央", icon: <FiAlignCenter size={14} /> },
                { key: "right" as const, label: "右", icon: <FiAlignRight size={14} /> },
              ]).map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setTextAlign(a.key)}
                  className={`flex items-center gap-1 px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg border-2 text-[10px] md:text-xs font-semibold transition-all ${
                    textAlign === a.key
                      ? "bg-slate-800 border-slate-800 text-white shadow-sm"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {a.icon}
                  <span className="hidden md:inline">{a.label}</span>
                </button>
              ))}
            </div>

            {/* 透過オーバーレイ（インライン表示） */}
            <label className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                onClick={() => setOverlay(!overlay)}
                className={`relative w-9 h-[18px] md:w-10 md:h-5 rounded-full transition-colors ${overlay ? "bg-purple-600" : "bg-slate-300"}`}
              >
                <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] md:w-4 md:h-4 bg-white rounded-full shadow transition-transform ${overlay ? "translate-x-[18px] md:translate-x-5" : ""}`} />
              </button>
              <span className="text-[10px] md:text-xs font-semibold text-slate-600">透過レイヤー</span>
            </label>
          </div>

          {/* 微調整プロンプト */}
          <div className="mb-3 md:mb-4">
            <input
              type="text"
              value={adjustPrompt}
              onChange={(e) => setAdjustPrompt(e.target.value)}
              placeholder="追加の指示（任意）例: 明るい雰囲気で"
              className="w-full border border-purple-200 rounded-lg px-3 py-1.5 md:py-2 text-xs md:text-sm focus:outline-none focus:border-purple-400 bg-white placeholder:text-slate-400"
            />
          </div>

          {/* 生成ボタン */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !title.trim()}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-3 md:px-4 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-xs md:text-sm">生成中...（20〜40秒）</span>
              </>
            ) : previewDataUrl ? (
              <>
                <FiRefreshCw size={14} />
                <span>再生成する</span>
              </>
            ) : (
              <>
                <FiZap size={14} />
                <span>サムネイルを生成</span>
              </>
            )}
          </button>

          {/* エラー */}
          {error && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* プレビュー */}
          {previewDataUrl && (
            <div className="mt-3 md:mt-4">
              <p className="text-xs font-semibold text-slate-600 mb-1.5 md:mb-2">プレビュー</p>
              <div className="relative rounded-lg overflow-hidden border border-purple-200 shadow-md">
                <div className="aspect-[16/9] relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewDataUrl}
                    alt="サムネイルプレビュー"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* 決定 / やり直しボタン */}
              <div className="flex gap-2 md:gap-3 mt-2 md:mt-3">
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center justify-center gap-1.5 md:gap-2 transition-colors"
                >
                  <FiCheck size={14} />
                  <span>決定</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDataUrl(null)}
                  className="px-3 md:px-4 py-1.5 md:py-2 border border-slate-300 text-slate-600 rounded-lg text-xs md:text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5 md:gap-2 transition-colors"
                >
                  <FiX size={14} />
                  <span>やり直す</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
