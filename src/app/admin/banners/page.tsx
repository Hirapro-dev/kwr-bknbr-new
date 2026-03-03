"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft, FiPlus, FiTrash2, FiExternalLink } from "react-icons/fi";

type Banner = { id: number; label: string; url: string; imageUrl: string | null; order: number };

export default function BannersPage() {
  const router = useRouter();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const handleCreate = async () => {
    if (!label.trim() || !url.trim()) { alert("表示名とリンク先URLを入力してください"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), url: url.trim(), imageUrl: imageUrl.trim() || null, order: banners.length }),
      });
      if (res.ok) {
        const created = await res.json();
        setBanners([...banners, created]);
        setLabel(""); setUrl(""); setImageUrl(""); setShowForm(false);
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
          トップページのサイドバーに、外部リンクのバナーを表示できます。ここで追加したバナーのみ表示され、1件もない場合は非表示です。
        </p>

        {showForm && (
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h2 className="font-bold text-sm text-slate-900 mb-4">バナーを追加</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">表示名（ラベル）</label>
                <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="例: 公式サイト" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">リンク先URL *</label>
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">画像URL（任意）</label>
                <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="画像がある場合のみ" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
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
            {banners.map((b) => (
              <div key={b.id} className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{b.label}</p>
                  <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 truncate flex items-center gap-1 mt-0.5">
                    <FiExternalLink size={10} /> {b.url}
                  </a>
                </div>
                <button onClick={() => handleDelete(b.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg" title="削除"><FiTrash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
