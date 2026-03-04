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
  showForGen: boolean;
  showForVip: boolean;
  showForVC: boolean;
};

/** 媒体ごとの設定 */
const VARIANT_CONFIG: Record<Variant, { label: string; logo: string; headerBg: string }> = {
  gen: {
    label: "一般会員",
    logo: "/header_logo.png",
    // 左から右への青ベースのグラデーション
    headerBg: "linear-gradient(to right, #1e40af, #3b82f6)",
  },
  vip: {
    label: "正会員",
    logo: "/header_logo_vip.png",
    // 左から右への赤ベースのグラデーション
    headerBg: "linear-gradient(to right, #991b1b, #ef4444)",
  },
  vc: {
    label: "VC長者",
    logo: "/header_logo_vc.png",
    // 左から右への濃いグレーから黒のグラデーション
    headerBg: "linear-gradient(to right, #374151, #111827)",
  },
};

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
  showForGen,
  showForVip,
  showForVC,
}: LineImageGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  // 媒体ごとのプレビューURL
  const [previews, setPreviews] = useState<Record<Variant, string | null>>({
    gen: null,
    vip: null,
    vc: null,
  });
  const [avatarDataUrl, setAvatarDataUrl] = useState<string>("");
  // 現在レンダリング中の媒体（隠しDIV用）
  const [renderVariant, setRenderVariant] = useState<Variant>("gen");
  const templateRef = useRef<HTMLDivElement>(null);

  // チェックされた媒体のリスト
  const enabledVariants: Variant[] = [];
  if (showForGen) enabledVariants.push("gen");
  if (showForVip) enabledVariants.push("vip");
  if (showForVC) enabledVariants.push("vc");

  // アバター画像をDataURLに事前変換（CORS対策）
  useEffect(() => {
    if (writerAvatarUrl) {
      toDataUrl(writerAvatarUrl).then(setAvatarDataUrl);
    } else {
      setAvatarDataUrl("");
    }
  }, [writerAvatarUrl]);

  const bodyText = extractPlainText(content, 500);
  const currentConfig = VARIANT_CONFIG[renderVariant];

  /** 指定媒体の画像を1枚生成 */
  const generateSingle = useCallback(async (v: Variant): Promise<string | null> => {
    return new Promise((resolve) => {
      // renderVariantを変更してDOMを更新させ、次のフレームでキャプチャ
      setRenderVariant(v);
      // DOM更新を待つために requestAnimationFrame を2回使う
      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          const node = templateRef.current;
          if (!node) { resolve(null); return; }
          try {
            const dataUrl = await toPng(node, {
              width: 1040,
              height: 2080,
              pixelRatio: 1,
              cacheBust: true,
              skipAutoScale: true,
            });
            resolve(dataUrl);
          } catch (err) {
            console.error(`LINE画像生成エラー (${v}):`, err);
            resolve(null);
          }
        });
      });
    });
  }, []);

  /** チェック済み媒体の画像をすべて生成 */
  const handleGenerateAll = useCallback(async () => {
    if (enabledVariants.length === 0) {
      alert("媒体が選択されていません。チェックボックスから配信先を選んでください。");
      return;
    }
    setGenerating(true);
    setPreviews({ gen: null, vip: null, vc: null });

    const results: Record<Variant, string | null> = { gen: null, vip: null, vc: null };
    for (const v of enabledVariants) {
      const url = await generateSingle(v);
      results[v] = url;
    }
    setPreviews(results);

    const failCount = enabledVariants.filter((v) => !results[v]).length;
    if (failCount > 0) {
      alert(`${failCount}件の画像生成に失敗しました。ブラウザを変えて再度お試しください。`);
    }
    setGenerating(false);
  }, [enabledVariants, generateSingle]);

  /** 1枚ダウンロード */
  const handleDownload = (v: Variant) => {
    const url = previews[v];
    if (!url) return;
    const link = document.createElement("a");
    const slug = title.slice(0, 20).replace(/[^a-zA-Z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, "_");
    link.download = `line-${v}-${slug}-${Date.now()}.png`;
    link.href = url;
    link.click();
  };

  /** 全媒体を一括ダウンロード */
  const handleDownloadAll = () => {
    for (const v of enabledVariants) {
      if (previews[v]) handleDownload(v);
    }
  };

  const previewCount = enabledVariants.filter((v) => previews[v]).length;

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
          {/* 対象媒体の表示 & 生成ボタン */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="text-xs font-semibold text-slate-500">対象媒体:</label>
            <div className="flex gap-1.5 flex-wrap">
              {enabledVariants.length > 0 ? (
                enabledVariants.map((v) => (
                  <span
                    key={v}
                    className={`px-3 py-1 text-xs rounded-full font-medium ${
                      v === "gen"
                        ? "bg-blue-100 text-blue-700"
                        : v === "vip"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {VARIANT_CONFIG[v].label}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">媒体が選択されていません</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleGenerateAll}
              disabled={generating || !title.trim() || enabledVariants.length === 0}
              className="ml-auto px-4 py-1.5 text-xs bg-black text-white rounded-lg hover:bg-black/80 disabled:opacity-50 flex items-center gap-1.5"
            >
              {generating ? (
                <><FiRefreshCw size={12} className="animate-spin" /> 生成中...</>
              ) : (
                <><FiSmartphone size={12} /> {enabledVariants.length > 1 ? `${enabledVariants.length}媒体を一括生成` : "生成"}</>
              )}
            </button>
          </div>

          {/* プレビュー一覧 */}
          {previewCount > 0 && (
            <div className="space-y-4">
              <div className={`grid gap-4 ${previewCount >= 3 ? "grid-cols-1 md:grid-cols-3" : previewCount === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                {enabledVariants.map((v) =>
                  previews[v] ? (
                    <div key={v} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                      <div className={`text-center py-1.5 text-xs font-semibold text-white ${
                        v === "gen" ? "bg-blue-600" : v === "vip" ? "bg-red-600" : "bg-gray-700"
                      }`}>
                        {VARIANT_CONFIG[v].label}
                      </div>
                      <div className="p-2 flex justify-center">
                        <img
                          src={previews[v]!}
                          alt={`${VARIANT_CONFIG[v].label} LINE配信画像`}
                          className="w-[200px] md:w-[240px] h-auto rounded shadow-sm"
                        />
                      </div>
                      <div className="flex justify-center pb-2">
                        <button
                          type="button"
                          onClick={() => handleDownload(v)}
                          className={`px-3 py-1 text-xs text-white rounded-lg flex items-center gap-1.5 ${
                            v === "gen" ? "bg-blue-600 hover:bg-blue-700" : v === "vip" ? "bg-red-600 hover:bg-red-700" : "bg-gray-700 hover:bg-gray-800"
                          }`}
                        >
                          <FiDownload size={12} /> DL
                        </button>
                      </div>
                    </div>
                  ) : null
                )}
              </div>
              {previewCount > 1 && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleDownloadAll}
                    className="px-5 py-2 text-sm bg-black text-white rounded-lg hover:bg-black/80 flex items-center gap-2"
                  >
                    <FiDownload size={14} /> すべてダウンロード（1040×2080px）
                  </button>
                </div>
              )}
            </div>
          )}

          {previewCount === 0 && !generating && (
            <p className="text-xs text-slate-400 text-center py-3">
              タイトルと本文を入力して「生成」をクリックすると、チェック済み媒体のLINE配信用画像をまとめて生成できます
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
        {/* ── ヘッダーバー（媒体ごとのグラデーション） ── */}
        <div
          style={{
            width: "100%",
            height: "80px",
            background: currentConfig.headerBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentConfig.logo}
            alt="logo"
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
