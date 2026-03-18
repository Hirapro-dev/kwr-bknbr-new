"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft, FiPlus, FiTrash2, FiEdit2, FiSave, FiX } from "react-icons/fi";

type Category = { id: number; name: string; slug: string; order: number; showInMenu: boolean };

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [newShowInMenu, setNewShowInMenu] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editShowInMenu, setEditShowInMenu] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      const authRes = await fetch("/api/auth/me");
      if (!authRes.ok) { router.push("/admin/login"); return; }
      const res = await fetch("/api/categories");
      if (res.ok) setCategories(await res.json());
      setLoading(false);
    };
    init();
  }, [router]);

  const handleCreate = async () => {
    if (!name.trim()) { alert("カテゴリ名を入力してください"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), order: categories.length, showInMenu: newShowInMenu }),
      });
      if (res.ok) {
        const created = await res.json();
        setCategories([...categories, created]);
        setName(""); setNewShowInMenu(false); setShowForm(false);
      } else { const d = await res.json(); alert(d.error || "作成に失敗しました"); }
    } catch { alert("作成に失敗しました"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("このカテゴリを削除しますか？")) return;
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    setCategories(categories.filter((c) => c.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditShowInMenu(cat.showInMenu);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditShowInMenu(false);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    if (!editName.trim()) { alert("カテゴリ名を入力してください"); return; }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/categories/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), showInMenu: editShowInMenu }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCategories(categories.map((c) => c.id === editingId ? { ...c, ...updated } : c));
        cancelEdit();
      } else { alert("更新に失敗しました"); }
    } catch { alert("更新に失敗しました"); }
    finally { setEditSaving(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard" className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"><FiArrowLeft size={18} /></Link>
            <span className="font-bold text-sm text-slate-900">カテゴリ管理</span>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="bg-black hover:bg-black/80 text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <FiPlus size={14} /> 新規追加
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-sm text-slate-500 mb-6">
          カテゴリを登録すると、記事投稿時にカテゴリを選択できます。1つの記事に複数のカテゴリを設定できます。
        </p>

        {showForm && (
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h2 className="font-bold text-sm text-slate-900 mb-4">カテゴリを追加</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">カテゴリ名 *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 投資信託"
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newShowInMenu} onChange={(e) => setNewShowInMenu(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-400" />
                  <span className="text-sm text-slate-700">メニューに追加</span>
                  <span className="text-[11px] text-slate-400">（ページ上部にカテゴリタブとして表示）</span>
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={saving}
                  className="bg-black hover:bg-black/80 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">追加</button>
                <button onClick={() => { setShowForm(false); setName(""); setNewShowInMenu(false); }}
                  className="border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600">キャンセル</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-slate-400">読み込み中...</p>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500">
            <p className="text-sm">カテゴリがありません。追加すると記事投稿時に選択できるようになります。</p>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((c) => (
              <div key={c.id} className="bg-white rounded-lg border border-slate-200">
                {editingId === c.id ? (
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-blue-600">編集中</h3>
                      <button onClick={cancelEdit} className="p-1 text-slate-400 hover:text-slate-600"><FiX size={16} /></button>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">カテゴリ名 *</label>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleUpdate(); }}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={editShowInMenu} onChange={(e) => setEditShowInMenu(e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-400" />
                        <span className="text-sm text-slate-700">メニューに追加</span>
                        <span className="text-[11px] text-slate-400">（ページ上部にカテゴリタブとして表示）</span>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleUpdate} disabled={editSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
                        <FiSave size={13} /> {editSaving ? "保存中..." : "保存"}
                      </button>
                      <button onClick={cancelEdit} className="border border-slate-200 px-4 py-2 rounded-lg text-xs text-slate-600 hover:bg-slate-50">キャンセル</button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-slate-500 text-xs font-bold">#</span>
                      </span>
                      <p className="font-medium text-slate-900 truncate">{c.name}</p>
                      {c.showInMenu && (
                        <span className="inline-block bg-green-50 text-green-600 text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0">メニュー表示</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(c)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg transition-colors" title="編集">
                        <FiEdit2 size={15} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors" title="削除">
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
