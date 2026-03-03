"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft, FiPlus, FiTrash2, FiSave } from "react-icons/fi";

type CustomEditor = { id: number; name: string; icon: string; html: string; order: number };

const ICON_SUGGESTIONS = ["⚡", "📌", "💡", "🔥", "🎯", "📢", "⭐", "🏷️", "📎", "🔗", "📊", "🎨", "✅", "❗", "💬", "🖊️"];

export default function CustomEditorsPage() {
  const router = useRouter();
  const [editors, setEditors] = useState<CustomEditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("⚡");
  const [newHtml, setNewHtml] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      const authRes = await fetch("/api/auth/me");
      if (!authRes.ok) { router.push("/admin/login"); return; }
      const res = await fetch("/api/custom-editors");
      if (res.ok) setEditors(await res.json());
      setLoading(false);
    };
    init();
  }, [router]);

  const handleCreate = async () => {
    if (!newName.trim() || !newHtml.trim()) { alert("名前とHTMLテンプレートを入力してください"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/custom-editors", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, icon: newIcon, html: newHtml }),
      });
      if (res.ok) {
        const created = await res.json();
        setEditors([...editors, created]);
        setNewName(""); setNewIcon("⚡"); setNewHtml(""); setShowForm(false);
      }
    } catch { alert("作成に失敗しました"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("この編集機能を削除しますか？")) return;
    await fetch(`/api/custom-editors/${id}`, { method: "DELETE" });
    setEditors(editors.filter((e) => e.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard" className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"><FiArrowLeft size={18} /></Link>
            <span className="font-bold text-sm text-slate-900">編集の追加</span>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="bg-black hover:bg-black/80 text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <FiPlus size={14} /> 新規追加
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-sm text-slate-500 mb-6">
          カスタム編集機能を追加すると、記事エディタのツールバーにアイコンが追加されます。<br />
          クリック時にHTMLテンプレートが本文に挿入されます。
        </p>

        {showForm && (
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h2 className="font-bold text-sm text-slate-900 mb-4">新しい編集機能を追加</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">機能名</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="例: お知らせボックス" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">アイコン</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {ICON_SUGGESTIONS.map((ic) => (
                    <button key={ic} onClick={() => setNewIcon(ic)}
                      className={`w-9 h-9 rounded-lg border text-lg flex items-center justify-center transition-colors ${newIcon === ic ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-300"}`}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">HTMLテンプレート</label>
                <textarea value={newHtml} onChange={(e) => setNewHtml(e.target.value)} rows={5}
                  placeholder={'<div style="background:#fef3c7;border:1px solid #fbbf24;padding:1rem;border-radius:0.5rem;margin:1rem 0;">ここにテキスト</div>'}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400 resize-y" />
              </div>

              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
                  <FiSave size={13} /> 保存
                </button>
                <button onClick={() => setShowForm(false)} className="border border-slate-200 px-4 py-2 rounded-lg text-xs text-slate-600 hover:bg-slate-50">
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400">読み込み中...</div>
        ) : editors.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-400">カスタム編集機能はまだありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {editors.map((editor) => (
              <div key={editor.id} className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{editor.icon}</span>
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{editor.name}</p>
                    <p className="text-xs text-slate-400 font-mono truncate max-w-md">{editor.html.slice(0, 80)}...</p>
                  </div>
                </div>
                <button onClick={() => handleDelete(editor.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                  <FiTrash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
