"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { FiArrowLeft, FiPlus, FiTrash2, FiUploadCloud } from "react-icons/fi";
import { compressAndUpload } from "@/lib/upload";

type Writer = { id: number; name: string; avatarUrl: string | null; order: number };

export default function WritersPage() {
  const router = useRouter();
  const [writers, setWriters] = useState<Writer[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      const authRes = await fetch("/api/auth/me");
      if (!authRes.ok) { router.push("/admin/login"); return; }
      const res = await fetch("/api/writers");
      if (res.ok) setWriters(await res.json());
      setLoading(false);
    };
    init();
  }, [router]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await compressAndUpload(file);
      setAvatarUrl(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) { alert("名前を入力してください"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/writers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), avatarUrl: avatarUrl || null, order: writers.length }),
      });
      if (res.ok) {
        const created = await res.json();
        setWriters([...writers, created]);
        setName(""); setAvatarUrl(""); setShowForm(false);
      } else { const d = await res.json(); alert(d.error || "作成に失敗しました"); }
    } catch { alert("作成に失敗しました"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("この執筆者を削除しますか？（紐付いた記事の執筆者は空になります）")) return;
    await fetch(`/api/writers/${id}`, { method: "DELETE" });
    setWriters(writers.filter((w) => w.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard" className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"><FiArrowLeft size={18} /></Link>
            <span className="font-bold text-sm text-slate-900">執筆者管理</span>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="bg-black hover:bg-black/80 text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <FiPlus size={14} /> 新規追加
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-sm text-slate-500 mb-6">
          執筆者を登録すると、記事投稿時に執筆者を選択できます。記事ページに執筆者名とアバター画像が表示されます。
        </p>

        {showForm && (
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h2 className="font-bold text-sm text-slate-900 mb-4">執筆者を追加</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">名前 *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 山田太郎"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">アバター画像</label>
                {avatarUrl ? (
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden border border-slate-200 relative">
                      <Image src={avatarUrl} alt="アバター" fill className="object-cover" sizes="64px" />
                    </div>
                    <button onClick={() => setAvatarUrl("")} className="text-xs text-red-500 hover:text-red-700">画像を削除</button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-200 rounded-lg py-6 flex flex-col items-center gap-2 cursor-pointer hover:border-blue-400 transition-colors"
                  >
                    {uploading ? (
                      <>
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-blue-600 text-xs">アップロード中...</span>
                      </>
                    ) : (
                      <>
                        <FiUploadCloud size={24} className="text-slate-300" />
                        <span className="text-slate-400 text-xs">クリックしてアバター画像を選択</span>
                        <span className="text-slate-300 text-[10px]">自動圧縮（WebP・最大1MB）</span>
                      </>
                    )}
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={saving || uploading}
                  className="bg-black hover:bg-black/80 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">追加</button>
                <button onClick={() => { setShowForm(false); setName(""); setAvatarUrl(""); }}
                  className="border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600">キャンセル</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-slate-400">読み込み中...</p>
        ) : writers.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500">
            <p className="text-sm">執筆者がいません。追加すると記事投稿時に選択できるようになります。</p>
          </div>
        ) : (
          <div className="space-y-2">
            {writers.map((w) => (
              <div key={w.id} className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {w.avatarUrl ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 relative flex-shrink-0">
                      <Image src={w.avatarUrl} alt={w.name} fill className="object-cover" sizes="40px" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-slate-400 text-sm font-bold">{w.name.charAt(0)}</span>
                    </div>
                  )}
                  <p className="font-medium text-slate-900 truncate">{w.name}</p>
                </div>
                <button onClick={() => handleDelete(w.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg" title="削除"><FiTrash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
