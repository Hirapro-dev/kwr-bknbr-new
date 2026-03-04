"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { FiSmartphone, FiDownload, FiChevronDown, FiCamera, FiEdit3 } from "react-icons/fi";
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
const VARIANT_CONFIG: Record<Variant, { label: string; logo: string; headerBg: string; accent: string }> = {
  gen: {
    label: "一般会員",
    logo: "/header_logo.png",
    headerBg: "linear-gradient(to right, #1e40af, #3b82f6)",
    accent: "#3b82f6",
  },
  vip: {
    label: "正会員",
    logo: "/header_logo_vip.png",
    headerBg: "linear-gradient(to right, #991b1b, #ef4444)",
    accent: "#ef4444",
  },
  vc: {
    label: "VC長者",
    logo: "/header_logo_vc.png",
    headerBg: "linear-gradient(to right, #374151, #111827)",
    accent: "#374151",
  },
};

/**
 * 画像URLをDataURLに変換（CORS対策）
 */
async function toDataUrl(url: string): Promise<string> {
  if (!url) return "";
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const res = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`);
      if (!res.ok) return "";
      const data = await res.json();
      return data.dataUrl || "";
    }
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

  // 編集可能なフィールド（初期値は親から受け取り）
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editWriter, setEditWriter] = useState("");
  const [initialized, setInitialized] = useState(false);

  // アバター・ロゴのDataURLキャッシュ
  const [avatarDataUrl, setAvatarDataUrl] = useState<string>("");
  const [logoDataUrls, setLogoDataUrls] = useState<Record<Variant, string>>({ gen: "", vip: "", vc: "" });

  // 画像化の状態
  const [generating, setGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<Record<Variant, string | null>>({ gen: null, vip: null, vc: null });
  const [activeVariant, setActiveVariant] = useState<Variant>("gen");

  // 各媒体のキャプチャ用ref
  const captureRefs = useRef<Record<Variant, HTMLDivElement | null>>({ gen: null, vip: null, vc: null });

  // チェックされた媒体のリスト
  const enabledVariants: Variant[] = [];
  if (showForGen) enabledVariants.push("gen");
  if (showForVip) enabledVariants.push("vip");
  if (showForVC) enabledVariants.push("vc");

  // 初期値セット（開いたときに最新の値を読み込み）
  useEffect(() => {
    if (isOpen && !initialized) {
      const bodyText = extractPlainText(content, 500);
      setEditTitle(title || "");
      setEditBody(bodyText || "");
      setEditWriter(writerName || "");
      setInitialized(true);
      // 画像リセット
      setGeneratedImages({ gen: null, vip: null, vc: null });
    }
    if (!isOpen) {
      setInitialized(false);
    }
  }, [isOpen, initialized, title, content, writerName]);

  // アバター画像をDataURLに事前変換
  useEffect(() => {
    if (writerAvatarUrl) {
      toDataUrl(writerAvatarUrl).then(setAvatarDataUrl);
    } else {
      setAvatarDataUrl("");
    }
  }, [writerAvatarUrl]);

  // ロゴ画像をDataURLに事前変換
  useEffect(() => {
    const loadLogos = async () => {
      const results: Record<Variant, string> = { gen: "", vip: "", vc: "" };
      for (const v of ["gen", "vip", "vc"] as Variant[]) {
        results[v] = await toDataUrl(VARIANT_CONFIG[v].logo);
      }
      setLogoDataUrls(results);
    };
    loadLogos();
  }, []);

  // activeVariant が enabledVariants に含まれない場合、最初の媒体に切り替え
  useEffect(() => {
    if (enabledVariants.length > 0 && !enabledVariants.includes(activeVariant)) {
      setActiveVariant(enabledVariants[0]);
    }
  }, [enabledVariants, activeVariant]);

  /** 全媒体の画像を一括生成 */
  const handleGenerateAll = useCallback(async () => {
    if (enabledVariants.length === 0) return;
    setGenerating(true);
    setGeneratedImages({ gen: null, vip: null, vc: null });

    const results: Record<Variant, string | null> = { gen: null, vip: null, vc: null };

    for (const v of enabledVariants) {
      const node = captureRefs.current[v];
      if (!node) continue;
      try {
        // html-to-imageでキャプチャ
        const dataUrl = await toPng(node, {
          width: 1040,
          height: 2080,
          pixelRatio: 1,
          cacheBust: true,
          skipAutoScale: true,
        });
        results[v] = dataUrl;
      } catch (err) {
        console.error(`LINE画像生成エラー (${v}):`, err);
      }
    }

    setGeneratedImages(results);
    setGenerating(false);

    const failCount = enabledVariants.filter((v) => !results[v]).length;
    if (failCount > 0) {
      alert(`${failCount}件の画像生成に失敗しました。`);
    }
  }, [enabledVariants]);

  /** 1枚ダウンロード */
  const handleDownload = (v: Variant) => {
    const url = generatedImages[v];
    if (!url) return;
    const link = document.createElement("a");
    const slug = editTitle.slice(0, 20).replace(/[^a-zA-Z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, "_");
    link.download = `line-${v}-${slug}-${Date.now()}.png`;
    link.href = url;
    link.click();
  };

  /** 全媒体を一括ダウンロード */
  const handleDownloadAll = () => {
    for (const v of enabledVariants) {
      if (generatedImages[v]) handleDownload(v);
    }
  };

  /** 「再編集」で画像をリセット */
  const handleReEdit = () => {
    setGeneratedImages({ gen: null, vip: null, vc: null });
  };

  const generatedCount = enabledVariants.filter((v) => generatedImages[v]).length;
  const isGenerated = generatedCount > 0;

  /** プレビューテンプレート（媒体別） */
  const renderTemplate = (v: Variant, isCapture: boolean) => {
    const config = VARIANT_CONFIG[v];
    const logoSrc = logoDataUrls[v] || config.logo;

    return (
      <div
        ref={isCapture ? (el) => { captureRefs.current[v] = el; } : undefined}
        style={{
          width: "1040px",
          height: "2080px",
          overflow: "hidden",
          fontFamily: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif',
          background: "#ffffff",
          ...(isCapture ? { position: "absolute", left: "-9999px", top: `${["gen", "vip", "vc"].indexOf(v) * 2100}px` } : {}),
        }}
      >
        {/* ヘッダーバー */}
        <div style={{ width: "100%", height: "80px", background: config.headerBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="logo" style={{ height: "40px", objectFit: "contain" }} />
        </div>

        {/* メインコンテンツ */}
        <div style={{ padding: "60px 60px 40px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* タイトル */}
          <h1 style={{ fontSize: "48px", fontWeight: 900, lineHeight: 1.4, textAlign: "center", color: "#000000", margin: "0 0 40px 0", wordBreak: "break-word", maxWidth: "920px" }}>
            {editTitle || "タイトル未入力"}
          </h1>

          {/* From テキスト */}
          {editWriter && (
            <p style={{ fontSize: "26px", color: "#4b5563", margin: "0 0 30px 0", textAlign: "left", width: "100%" }}>
              From：KAWARA版 {editWriter}
            </p>
          )}

          {/* アバター */}
          {avatarDataUrl && (
            <div style={{ margin: "0 0 40px 0" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarDataUrl} alt={editWriter} style={{ width: "200px", height: "200px", borderRadius: "50%", objectFit: "cover", border: "3px solid #e5e7eb" }} />
            </div>
          )}

          {/* 本文テキスト */}
          <div style={{ fontSize: "28px", lineHeight: 1.9, color: "#1f2937", textAlign: "left", width: "100%", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
            {editBody || "本文テキストがここに表示されます。"}
          </div>

          {/* CTAボタン */}
          <div style={{ marginTop: "60px", width: "100%", display: "flex", justifyContent: "center" }}>
            <div style={{ background: "linear-gradient(to right, #f59e0b, #fbbf24)", borderRadius: "16px", padding: "28px 80px", display: "inline-flex", alignItems: "center", gap: "12px", boxShadow: "0 6px 20px rgba(245, 158, 11, 0.4)" }}>
              <span style={{ fontSize: "32px", fontWeight: 800, color: "#000000" }}>続きを読む</span>
              <span style={{ fontSize: "36px" }}>👆</span>
            </div>
          </div>
        </div>
      </div>
    );
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
        <div className="mt-3 bg-white border border-slate-200 rounded-lg overflow-hidden">
          {/* 対象媒体の表示 */}
          <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
            <label className="text-xs font-semibold text-slate-500">対象媒体:</label>
            <div className="flex gap-1.5 flex-wrap">
              {enabledVariants.length > 0 ? (
                enabledVariants.map((v) => (
                  <span
                    key={v}
                    className={`px-3 py-1 text-xs rounded-full font-medium ${
                      v === "gen" ? "bg-blue-100 text-blue-700"
                        : v === "vip" ? "bg-red-100 text-red-700"
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
          </div>

          {enabledVariants.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              媒体チェックボックスから配信先を選んでください
            </div>
          ) : !isGenerated ? (
            /* ===== プレビュー＆編集モード ===== */
            <div className="p-4">
              {/* 媒体タブ切り替え（プレビュー用） */}
              {enabledVariants.length > 1 && (
                <div className="flex gap-1 mb-4">
                  {enabledVariants.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setActiveVariant(v)}
                      className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                        activeVariant === v
                          ? v === "gen" ? "bg-blue-600 text-white" : v === "vip" ? "bg-red-600 text-white" : "bg-gray-700 text-white"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {VARIANT_CONFIG[v].label}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
                {/* 左: プレビュー（縮小表示） */}
                <div className="flex flex-col items-center">
                  <p className="text-[10px] text-slate-400 mb-2">プレビュー（{VARIANT_CONFIG[activeVariant].label}）</p>
                  <div
                    className="border border-slate-200 rounded-lg overflow-hidden shadow-sm bg-white"
                    style={{ width: "260px", height: "520px" }}
                  >
                    <div style={{ transform: "scale(0.25)", transformOrigin: "top left", width: "1040px", height: "2080px" }}>
                      {renderTemplate(activeVariant, false)}
                    </div>
                  </div>
                </div>

                {/* 右: 編集フィールド */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <FiEdit3 size={14} />
                    <span>画像コンテンツを編集</span>
                  </div>

                  {/* タイトル */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">記事タイトル</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                      placeholder="タイトルを入力"
                    />
                  </div>

                  {/* 執筆者 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">執筆者名</label>
                    <input
                      type="text"
                      value={editWriter}
                      onChange={(e) => setEditWriter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                      placeholder="執筆者名"
                    />
                  </div>

                  {/* 本文（冒頭セクション） */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">冒頭テキスト</label>
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-y"
                      placeholder="冒頭のテキストを入力"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">記事本文から冒頭が自動抽出されています。必要に応じて編集できます。</p>
                  </div>

                  {/* 画像化ボタン */}
                  <button
                    type="button"
                    onClick={handleGenerateAll}
                    disabled={generating || !editTitle.trim()}
                    className="w-full py-3 text-sm font-semibold bg-black text-white rounded-lg hover:bg-black/80 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    {generating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        画像を生成しています...
                      </>
                    ) : (
                      <>
                        <FiCamera size={16} />
                        {enabledVariants.length > 1 ? `${enabledVariants.length}媒体の画像を生成` : "画像を生成"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ===== 生成完了 → ダウンロードモード ===== */
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-green-700">画像が生成されました！</p>
                <button
                  type="button"
                  onClick={handleReEdit}
                  className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center gap-1.5"
                >
                  <FiEdit3 size={12} /> 再編集
                </button>
              </div>

              <div className={`grid gap-4 ${generatedCount >= 3 ? "grid-cols-1 md:grid-cols-3" : generatedCount === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-sm mx-auto"}`}>
                {enabledVariants.map((v) =>
                  generatedImages[v] ? (
                    <div key={v} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                      <div className={`text-center py-1.5 text-xs font-semibold text-white ${
                        v === "gen" ? "bg-blue-600" : v === "vip" ? "bg-red-600" : "bg-gray-700"
                      }`}>
                        {VARIANT_CONFIG[v].label}
                      </div>
                      <div className="p-2 flex justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={generatedImages[v]!}
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

              {generatedCount > 1 && (
                <div className="flex justify-center mt-4">
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

          {/* ===== キャプチャ用の隠しテンプレート ===== */}
          <div style={{ position: "fixed", left: "-99999px", top: 0, pointerEvents: "none" }} aria-hidden>
            {enabledVariants.map((v) => (
              <div key={v}>
                {renderTemplate(v, true)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
