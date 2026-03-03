"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { FiArrowLeft, FiPlus, FiTrash2, FiExternalLink, FiUpload, FiX } from "react-icons/fi";

type Banner = { id: number; label: string; url: string; imageUrl: string | null; media: string; order: number };

// 媒体ラベルのマッピング
const MEDIA_LABELS: Record<string, { label: string; color: string; bgColor: string }> = {
  all: { label: "全媒体", color: "text-slate-700", bgColor: "bg-slate-100" },
  gen: { label: "一般会員", color: "text-blue-700", bgColor: "bg-blue-50" },
  vip: { label: "正会員", color: "text-emerald-700", bgColor: "bg-emerald-50" },
  vc: { label: "仮想通貨長者", color: "text-purple-700", bgColor: "bg-purple-50" },
};

export default function BannersPage() {
  const router = useRouter();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [media, setMedia] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      const authRes = await fetch("/api/auth/me");
      if (!authRes.ok) { router.push("/admin/login"); return; }
      const res = await fetch("/api/banners");
      if (res.ok) setBanners(await res.json());
      setLoading(false);
    };
    init();
  }, [router]);

  // 画像アップロード処理
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイル形式チェック
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("対応していないファイル形式です（JPEG, PNG, GIF, WebP のみ）");
      return;
    }

    // プレビュー表示
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);

    // S3にアップロード
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const { url: uploadedUrl } = await res.json();
        setImageUrl(uploadedUrl);
      } else {
        const d = await res.json();
        alert(d.error || "画像のアップロードに失敗しました");
        setPreviewUrl(null);
      }
    } catch {
      alert("画像のアップロードに失敗しました");
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  // アップロード済み画像をクリア
  const handleClearImage = () => {
    setImageUrl("");
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreate = async () => {
    if (!label.trim() || !url.trim()) { alert("表示名とリンク先URLを入力してください"); return; }
    if (uploading) { alert("画像をアップロード中です。完了までお待ちください"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), url: url.trim(), imageUrl: imageUrl.trim() || null, media, order: banners.length }),
      });
      if (res.ok) {
        const created = await res.json();
        setBanners([...banners, created]);
        setLabel(""); setUrl(""); setImageUrl(""); setMedia("all"); setShowForm(false);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else { const d = await res.json(); alert(d.error || "作成に失敗しました"); }
    } catch { alert("作成に失敗しました"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("このバナーを削除しますか？")) return;
    await fetch(`/api/banners/${id}`, { method: "DELETE" });
    setBanners(banners.filter((b) => b.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard" className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"><FiArrowLeft size={18} /></Link>
            <span className="font-bold text-sm text-slate-900">バナー管理</span>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="bg-black hover:bg-black/80 text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <FiPlus size={14} /> 新規追加
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-sm text-slate-500 mb-6">
          トップページのサイドバーに、外部リンクのバナーを表示できます。媒体ごとに異なるバナーを設定できます。
        </p>

        {showForm && (
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h2 className="font-bold text-sm text-slate-900 mb-4">バナーを追加</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">表示名（ラベル）*</label>
                <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="例: 公式サイト" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">リンク先URL *</label>
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">バナー画像（任意）</label>
                {previewUrl || imageUrl ? (
                  <div className="relative inline-block">
                    <Image
                      src={previewUrl || imageUrl}
                      alt="プレビュー"
                      width={320}
                      height={160}
                      className="rounded-lg border border-slate-200 object-cover max-h-40"
                      unoptimized
                    />
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md"
                      title="画像を削除"
                    >
                      <FiX size={14} />
                    </button>
                    {uploading && (
                      <div className="absolute inset-0 bg-white/70 rounded-lg flex items-center justify-center">
                        <span className="text-sm text-slate-600 font-medium">アップロード中...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-lg px-4 py-6 flex flex-col items-center gap-2 text-slate-400 hover:text-blue-500 transition-colors"
                  >
                    <FiUpload size={24} />
                    <span className="text-sm font-medium">クリックして画像をアップロード</span>
                    <span className="text-[11px]">JPEG, PNG, GIF, WebP に対応</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">表示対象の媒体</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(MEDIA_LABELS).map(([key, info]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMedia(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        media === key
                          ? `${info.bgColor} ${info.color} border-current`
                          : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {info.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">「全媒体」を選ぶと全てのページに表示されます</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={saving} className="bg-black hover:bg-black/80 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">追加</button>
                <button onClick={() => setShowForm(false)} className="border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600">キャンセル</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-slate-400">読み込み中...</p>
        ) : banners.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500">
            <p className="text-sm">バナーがありません。追加するとトップページのサイドバーに表示されます。</p>
          </div>
        ) : (
          <div className="space-y-2">
            {banners.map((b) => {
              const mediaInfo = MEDIA_LABELS[b.media] || MEDIA_LABELS.all;
              return (
                <div key={b.id} className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-4">
                  {b.imageUrl && (
                    <Image
                      src={b.imageUrl}
                      alt={b.label}
                      width={80}
                      height={40}
                      className="rounded-md border border-slate-200 object-cover flex-shrink-0"
                      style={{ width: 80, height: 40 }}
                      unoptimized
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 truncate">{b.label}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${mediaInfo.bgColor} ${mediaInfo.color}`}>
                        {mediaInfo.label}
                      </span>
                    </div>
                    <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 truncate flex items-center gap-1 mt-0.5">
                      <FiExternalLink size={10} /> {b.url}
                    </a>
                  </div>
                  <button onClick={() => handleDelete(b.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg" title="削除"><FiTrash2 size={16} /></button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
