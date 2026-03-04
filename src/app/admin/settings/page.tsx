"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiSave, FiEye, FiEyeOff, FiShield } from "react-icons/fi";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUsername, setCurrentUsername] = useState("");

  // フォーム
  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // パスワード表示切替
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // メッセージ
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setCurrentUsername(data.user.username);
        setNewUsername(data.user.username);
        setLoading(false);
      })
      .catch(() => {
        router.push("/admin/login");
      });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!currentPassword) {
      setMessage({ type: "error", text: "現在のパスワードを入力してください" });
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "新しいパスワードが一致しません" });
      return;
    }

    if (newPassword && newPassword.length < 4) {
      setMessage({ type: "error", text: "パスワードは4文字以上にしてください" });
      return;
    }

    if (newUsername === currentUsername && !newPassword) {
      setMessage({ type: "error", text: "変更内容がありません" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newUsername: newUsername !== currentUsername ? newUsername : undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "更新に失敗しました" });
      } else {
        setMessage({ type: "success", text: "設定を更新しました" });
        setCurrentUsername(data.username);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setMessage({ type: "error", text: "サーバーエラーが発生しました" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button onClick={() => router.push("/admin/dashboard")} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
            <FiArrowLeft size={18} />
          </button>
          <FiShield size={18} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">設定</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <form onSubmit={handleSubmit}>
          {/* アカウント情報 */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FiShield size={20} className="text-blue-500" />
              アカウント設定
            </h2>

            <p className="text-xs text-slate-400">
              ログインID・パスワードを変更できます。変更するには現在のパスワードが必要です。
            </p>

            {/* 現在のパスワード（必須） */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                現在のパスワード <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 pr-10"
                  placeholder="本人確認のため入力してください"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCurrent ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* 新しいユーザー名 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                ログインID
              </label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="新しいログインID"
                minLength={2}
              />
              <p className="mt-1 text-xs text-slate-400">変更しない場合はそのままにしてください</p>
            </div>

            {/* 新しいパスワード */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                新しいパスワード
              </label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 pr-10"
                  placeholder="変更する場合のみ入力"
                  minLength={4}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNew ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">4文字以上。変更しない場合は空欄のままにしてください</p>
            </div>

            {/* パスワード確認 */}
            {newPassword && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  新しいパスワード（確認）
                </label>
                <input
                  type={showNew ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                    confirmPassword && newPassword !== confirmPassword
                      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                      : "border-slate-200 focus:border-blue-400 focus:ring-blue-100"
                  }`}
                  placeholder="もう一度入力してください"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">パスワードが一致しません</p>
                )}
              </div>
            )}

            {/* メッセージ */}
            {message && (
              <div className={`p-3 rounded-lg text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {message.text}
              </div>
            )}

            {/* 保存ボタン */}
            <button
              type="submit"
              disabled={saving || !currentPassword}
              className="w-full py-3 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 保存中...</>
              ) : (
                <><FiSave size={16} /> 設定を保存</>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
