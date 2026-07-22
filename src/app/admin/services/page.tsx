"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  FiPlus,
  FiTrash2,
  FiExternalLink,
  FiUpload,
  FiX,
  FiEdit2,
  FiSave,
} from "react-icons/fi";

type Service = {
  id: number;
  label: string;
  url: string;
  imageUrl: string | null;
  order: number;
};

export default function ServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // 新規作成用の状態
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 編集用の状態
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const [editPreviewUrl, setEditPreviewUrl] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      const authRes = await fetch("/api/auth/me");
      if (!authRes.ok) {
        router.push("/admin/login");
        return;
      }
      const res = await fetch("/api/services");
      if (res.ok) setServices(await res.json());
      setLoading(false);
    };
    init();
  }, [router]);

  // 画像アップロード共通処理（新規・編集両方で利用）
  const uploadImage = async (
    file: File,
    setUploadingFn: (v: boolean) => void,
    setPreviewFn: (v: string | null) => void,
    setImageUrlFn: (v: string) => void
  ) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("対応していないファイル形式です（JPEG, PNG, GIF, WebP のみ）");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setPreviewFn(reader.result as string);
    reader.readAsDataURL(file);

    setUploadingFn(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const { url: uploadedUrl } = await res.json();
        setImageUrlFn(uploadedUrl);
      } else {
        const d = await res.json();
        alert(d.error || "画像のアップロードに失敗しました");
        setPreviewFn(null);
      }
    } catch {
      alert("画像のアップロードに失敗しました");
      setPreviewFn(null);
    } finally {
      setUploadingFn(false);
    }
  };

  // ─── 新規作成用 ───
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadImage(file, setUploading, setPreviewUrl, setImageUrl);
  };

  const handleClearImage = () => {
    setImageUrl("");
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreate = async () => {
    if (!label.trim() || !url.trim()) {
      alert("表示名とリンク先URLを入力してください");
      return;
    }
    if (uploading) {
      alert("画像をアップロード中です。完了までお待ちください");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          url: url.trim(),
          imageUrl: imageUrl.trim() || null,
          order: services.length,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setServices([...services, created]);
        setLabel("");
        setUrl("");
        setImageUrl("");
        setShowForm(false);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        const d = await res.json();
        alert(d.error || "作成に失敗しました");
      }
    } catch {
      alert("作成に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("このサービスを削除しますか？")) return;
    await fetch(`/api/services/${id}`, { method: "DELETE" });
    setServices(services.filter((s) => s.id !== id));
    if (editingId === id) setEditingId(null);
  };

  // ─── 編集用 ───
  const startEdit = (service: Service) => {
    setEditingId(service.id);
    setEditLabel(service.label);
    setEditUrl(service.url);
    setEditImageUrl(service.imageUrl || "");
    setEditPreviewUrl(service.imageUrl || null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel("");
    setEditUrl("");
    setEditImageUrl("");
    setEditPreviewUrl(null);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  };

  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadImage(file, setEditUploading, setEditPreviewUrl, setEditImageUrl);
  };

  const handleEditClearImage = () => {
    setEditImageUrl("");
    setEditPreviewUrl(null);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    if (!editLabel.trim() || !editUrl.trim()) {
      alert("表示名とリンク先URLを入力してください");
      return;
    }
    if (editUploading) {
      alert("画像をアップロード中です。完了までお待ちください");
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/services/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: editLabel.trim(),
          url: editUrl.trim(),
          imageUrl: editImageUrl.trim() || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setServices(
          services.map((s) => (s.id === editingId ? { ...s, ...updated } : s))
        );
        cancelEdit();
      } else {
        alert("更新に失敗しました");
      }
    } catch {
      alert("更新に失敗しました");
    } finally {
      setEditSaving(false);
    }
  };

  // 画像アップロードエリアコンポーネント
  const ImageUploadArea = ({
    currentPreview,
    currentImageUrl,
    isUploading,
    onUpload,
    onClear,
    inputRef,
  }: {
    currentPreview: string | null;
    currentImageUrl: string;
    isUploading: boolean;
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClear: () => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
  }) => (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">
        サービスバナー画像（推奨: 16:9）
      </label>
      {currentPreview || currentImageUrl ? (
        <div className="relative inline-block">
          <Image
            src={currentPreview || currentImageUrl}
            alt="プレビュー"
            width={320}
            height={180}
            className="rounded-lg border border-slate-200 object-cover max-h-48"
            unoptimized
          />
          <button
            type="button"
            onClick={onClear}
            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md"
            title="画像を削除"
          >
            <FiX size={14} />
          </button>
          {isUploading && (
            <div className="absolute inset-0 bg-white/70 rounded-lg flex items-center justify-center">
              <span className="text-sm text-slate-600 font-medium">
                アップロード中...
              </span>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-lg px-4 py-6 flex flex-col items-center gap-2 text-slate-400 hover:text-blue-500 transition-colors"
        >
          <FiUpload size={24} />
          <span className="text-sm font-medium">
            クリックして画像をアップロード
          </span>
          <span className="text-[11px]">JPEG, PNG, GIF, WebP に対応</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={onUpload}
        className="hidden"
      />
    </div>
  );

  return (
    <div>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-black hover:bg-black/80 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
          >
            <FiPlus size={14} /> 新規追加
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          /service ページにバナー一覧として表示されます。並び順は順序の小さい順に並びます。
        </p>

        {/* 新規追加フォーム */}
        {showForm && (
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h2 className="font-bold text-sm text-slate-900 mb-4">
              サービスを追加
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  表示名（ラベル）*
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="例: 投資のKAWARA版"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  リンク先URL *
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <ImageUploadArea
                currentPreview={previewUrl}
                currentImageUrl={imageUrl}
                isUploading={uploading}
                onUpload={handleImageUpload}
                onClear={handleClearImage}
                inputRef={fileInputRef}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="bg-black hover:bg-black/80 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  追加
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 一覧 */}
        {loading ? (
          <p className="text-slate-400">読み込み中...</p>
        ) : services.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500">
            <p className="text-sm">
              サービスがありません。追加すると /service ページに表示されます。
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {services.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-lg border border-slate-200"
              >
                {editingId === s.id ? (
                  /* ── 編集モード ── */
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-blue-600">
                        編集中
                      </h3>
                      <button
                        onClick={cancelEdit}
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        <FiX size={16} />
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">
                        表示名（ラベル）*
                      </label>
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">
                        リンク先URL *
                      </label>
                      <input
                        type="url"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <ImageUploadArea
                      currentPreview={editPreviewUrl}
                      currentImageUrl={editImageUrl}
                      isUploading={editUploading}
                      onUpload={handleEditImageUpload}
                      onClear={handleEditClearImage}
                      inputRef={editFileInputRef}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdate}
                        disabled={editSaving || editUploading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <FiSave size={13} />{" "}
                        {editSaving ? "保存中..." : "保存"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="border border-slate-200 px-4 py-2 rounded-lg text-xs text-slate-600 hover:bg-slate-50"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── 表示モード ── */
                  <div className="p-4 flex items-center justify-between gap-4">
                    {s.imageUrl ? (
                      <Image
                        src={s.imageUrl}
                        alt={s.label}
                        width={120}
                        height={68}
                        className="rounded-md border border-slate-200 object-cover flex-shrink-0"
                        style={{ width: 120, height: 68 }}
                        unoptimized
                      />
                    ) : (
                      <div
                        className="rounded-md border border-slate-200 bg-slate-100 flex items-center justify-center flex-shrink-0"
                        style={{ width: 120, height: 68 }}
                      >
                        <span className="text-[10px] text-slate-400 font-bold">
                          NO IMAGE
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {s.label}
                      </p>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 truncate flex items-center gap-1 mt-0.5"
                      >
                        <FiExternalLink size={10} /> {s.url}
                      </a>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(s)}
                        className="p-2 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                        title="編集"
                      >
                        <FiEdit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                        title="削除"
                      >
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
