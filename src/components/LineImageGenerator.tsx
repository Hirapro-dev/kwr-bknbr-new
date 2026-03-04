"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { FiSmartphone, FiDownload, FiRefreshCw, FiChevronDown } from "react-icons/fi";
import { toPng } from "html-to-image";
import { extractPlainText } from "@/lib/extract-plain-text";

type Variant = "gen" | "vip" | "vc";

type LineImageGeneratorProps = {
  title: string;
  content: string;
  writerName: string;
  writerAvatarUrl: string | null;
};

const VARIANT_OPTIONS: { value: Variant; label: string; logo: string }[] = [
  { value: "gen", label: "一般会員", logo: "/header_logo.png" },
  { value: "vip", label: "正会員", logo: "/header_logo_vip.png" },
  { value: "vc", label: "VC長者", logo: "/header_logo_vc.png" },
];

/** 外部画像URLをDataURLに変換（CORS対策） */
async function toDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

export default function LineImageGenerator({
  title,
  content,
  writerName,
  writerAvatarUrl,
}: LineImageGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [variant, setVariant] = useState<Variant>("gen");
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string>("");
  const templateRef = useRef<HTMLDivElement>(null);

  // アバター画像をDataURLに事前変換（CORS対策）
  useEffect(() => {
    if (writerAvatarUrl) {
      toDataUrl(writerAvatarUrl).then(setAvatarDataUrl);
    } else {
      setAvatarDataUrl("");
    }
  }, [writerAvatarUrl]);

  const bodyText = extractPlainText(content, 500);
  const logoSrc = VARIANT_OPTIONS.find((v) => v.value === variant)?.logo || "/header_logo.png";

  const handleGenerate = useCallback(async () => {
    const node = templateRef.current;
    if (!node) return;

    setGenerating(true);
    setPreviewUrl(null);
    try {
      // html-to-imageで隠しDIVをPNGに変換
      const dataUrl = await toPng(node, {
        width: 1040,
        height: 2080,
        pixelRatio: 1,
        cacheBust: true,
        skipAutoScale: true,
      });
      setPreviewUrl(dataUrl);
    } catch (err) {
      console.error("LINE画像生成エラー:", err);
      alert("画像の生成に失敗しました。ブラウザを変えて再度お試しください。");
    } finally {
      setGenerating(false);
    }
  }, []);

  const handleDownload = () => {
    if (!previewUrl) return;
    const link = document.createElement("a");
    const slug = title.slice(0, 20).replace(/[^a-zA-Z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, "_");
    link.download = `line-${variant}-${slug}-${Date.now()}.png`;
    link.href = previewUrl;
    link.click();
  };

  return (
    <div className="mb-4 md:mb-6">
      {/* 折りたたみトグル */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
      >
        <FiSmartphone size={16} />
        <span>LINE配信画像を生成</span>
        <FiChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="mt-3 bg-white border border-slate-200 rounded-lg p-4">
          {/* 設定エリア */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="text-xs font-semibold text-slate-500">媒体:</label>
            <div className="flex gap-1">
              {VARIANT_OPTIONS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => { setVariant(v.value); setPreviewUrl(null); }}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    variant === v.value
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !title.trim()}
              className="ml-auto px-4 py-1.5 text-xs bg-black text-white rounded-lg hover:bg-black/80 disabled:opacity-50 flex items-center gap-1.5"
            >
              {generating ? (
                <><FiRefreshCw size={12} className="animate-spin" /> 生成中...</>
              ) : (
                <><FiSmartphone size={12} /> 生成</>
              )}
            </button>
          </div>

          {/* プレビュー & ダウンロード */}
          {previewUrl && (
            <div className="space-y-3">
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 p-2 flex justify-center">
                {/* 1040x2080 を幅300px程度に縮小表示 */}
                <img
                  src={previewUrl}
                  alt="LINE配信画像プレビュー"
                  className="w-[260px] md:w-[300px] h-auto rounded shadow-sm"
                />
              </div>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <FiDownload size={14} /> ダウンロード（1040×2080px）
                </button>
              </div>
            </div>
          )}

          {!previewUrl && !generating && (
            <p className="text-xs text-slate-400 text-center py-3">
              タイトルと本文を入力して「生成」をクリックすると、LINE配信用画像をプレビューできます
            </p>
          )}

          {generating && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-sm text-blue-600">画像を生成しています...</span>
            </div>
          )}
        </div>
      )}

      {/* ======= 隠しDIV: 画像テンプレート（1040x2080px） ======= */}
      <div
        ref={templateRef}
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: "1040px",
          height: "2080px",
          overflow: "hidden",
          fontFamily:
            '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif',
          background: "#ffffff",
        }}
      >
        {/* ── ヘッダーバー ── */}
        <div
          style={{
            width: "100%",
            height: "80px",
            background: "#000000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="ロゴ"
            style={{ height: "40px", objectFit: "contain" }}
            crossOrigin="anonymous"
          />
        </div>

        {/* ── メインコンテンツ ── */}
        <div
          style={{
            padding: "60px 60px 40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* タイトル */}
          <h1
            style={{
              fontSize: "48px",
              fontWeight: 900,
              lineHeight: 1.4,
              textAlign: "center",
              color: "#000000",
              margin: "0 0 40px 0",
              wordBreak: "break-word",
              maxWidth: "920px",
            }}
          >
            {title || "タイトル未入力"}
          </h1>

          {/* From テキスト */}
          {writerName && (
            <p
              style={{
                fontSize: "26px",
                color: "#4b5563",
                margin: "0 0 30px 0",
                textAlign: "left",
                width: "100%",
              }}
            >
              From：KAWARA版 {writerName}
            </p>
          )}

          {/* アバター画像 */}
          {(avatarDataUrl || writerAvatarUrl) && (
            <div style={{ margin: "0 0 40px 0" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarDataUrl || writerAvatarUrl || ""}
                alt={writerName}
                style={{
                  width: "200px",
                  height: "200px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "3px solid #e5e7eb",
                }}
                crossOrigin="anonymous"
              />
            </div>
          )}

          {/* 本文テキスト */}
          <div
            style={{
              fontSize: "28px",
              lineHeight: 1.9,
              color: "#1f2937",
              textAlign: "left",
              width: "100%",
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
            }}
          >
            {bodyText || "本文テキストがここに表示されます。"}
          </div>

          {/* CTAボタン */}
          <div
            style={{
              marginTop: "60px",
              width: "100%",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                background: "linear-gradient(to right, #f59e0b, #fbbf24)",
                borderRadius: "16px",
                padding: "28px 80px",
                display: "inline-flex",
                alignItems: "center",
                gap: "12px",
                boxShadow: "0 6px 20px rgba(245, 158, 11, 0.4)",
              }}
            >
              <span
                style={{
                  fontSize: "32px",
                  fontWeight: 800,
                  color: "#000000",
                }}
              >
                続きを読む
              </span>
              <span style={{ fontSize: "36px" }}>👆</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
