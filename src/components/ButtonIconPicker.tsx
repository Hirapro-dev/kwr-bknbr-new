"use client";

import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiRefreshCw, FiTrash2, FiZap } from "react-icons/fi";
import {
  BUTTON_ICON_PRESETS,
  SAVED_ICON_LABEL_MAX,
  type ButtonIconPreset,
  type SavedButtonIcon,
} from "@/lib/button-icons";

type Props = {
  buttonText: string;
  value: ButtonIconPreset;
  customIconUrl: string;
  onChange: (icon: ButtonIconPreset, customIconUrl?: string) => void;
};

/** 選択一覧に並べる1件分。コード側プリセットとDB登録アイコンを同じ形に揃える */
type PickerItem = {
  key: string;
  label: string;
  /** 画像アイコンのURL。空ならCSSで描くプリセット図形 */
  imageUrl: string;
  /** コード側プリセットのみ持つ */
  presetValue?: Exclude<ButtonIconPreset, "custom">;
  source: "preset" | "saved";
};

export default function ButtonIconPicker({ buttonText, value, customIconUrl, onChange }: Props) {
  const [generating, setGenerating] = useState(false);
  const [hiddenKeys, setHiddenKeys] = useState<string[]>([]);
  const [savedIcons, setSavedIcons] = useState<SavedButtonIcon[]>([]);
  const [deletingKey, setDeletingKey] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  // 生成したアイコンを一覧に追加するときの名前
  const [saveLabel, setSaveLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const items = useMemo<PickerItem[]>(() => {
    const presets: PickerItem[] = BUTTON_ICON_PRESETS.filter(
      (preset) => !hiddenKeys.includes(preset.value),
    ).map((preset) => ({
      key: preset.value,
      label: preset.label,
      imageUrl: preset.imageUrl || "",
      presetValue: preset.value,
      source: "preset",
    }));
    const saved: PickerItem[] = savedIcons.map((icon) => ({
      key: icon.key,
      label: icon.label,
      imageUrl: icon.imageUrl,
      source: "saved",
    }));
    return [...presets, ...saved];
  }, [hiddenKeys, savedIcons]);

  // 表示中のAI生成アイコンが、まだ一覧に登録されていないか
  const canSaveCurrentIcon =
    !!customIconUrl && !savedIcons.some((icon) => icon.imageUrl === customIconUrl);

  useEffect(() => {
    let active = true;

    void fetch("/api/button-icons")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "アイコン一覧の読み込みに失敗しました");
        if (!active) return;
        setHiddenKeys(Array.isArray(data.hiddenKeys) ? data.hiddenKeys : []);
        setSavedIcons(Array.isArray(data.savedIcons) ? data.savedIcons : []);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "アイコン一覧の読み込みに失敗しました");
      });

    return () => {
      active = false;
    };
  }, []);

  /** 一覧での選択状態。DB登録アイコンは custom + 画像URLの一致で判定する */
  const isSelected = (item: PickerItem) =>
    item.source === "saved"
      ? value === "custom" && customIconUrl === item.imageUrl
      : value === item.presetValue;

  const selectItem = (item: PickerItem) => {
    if (item.source === "saved") onChange("custom", item.imageUrl);
    else if (item.presetValue) onChange(item.presetValue, item.imageUrl);
  };

  const deleteItem = async (item: PickerItem) => {
    const note =
      item.source === "saved"
        ? "この登録を削除しても、既に記事に入れたアイコンの表示は変わりません。"
        : "既存記事のアイコン表示は変わりません。";
    if (!window.confirm(`「${item.label}」を選択一覧から削除しますか？\n${note}`)) return;

    setDeletingKey(item.key);
    setError("");
    try {
      const res = await fetch("/api/button-icons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: item.key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "アイコンの削除に失敗しました");

      const wasSelected = isSelected(item);
      // 登録アイコンはレコードごと削除、コード側プリセットは非表示リストに追加
      if (item.source === "saved") setSavedIcons((prev) => prev.filter((icon) => icon.key !== item.key));
      else setHiddenKeys((prev) => [...prev, item.key]);
      const nextItems = items.filter((i) => i.key !== item.key);

      // 選択中のアイコンを消したときは、残っている先頭のアイコンに寄せる
      if (wasSelected && nextItems.length > 0) selectItem(nextItems[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "アイコンの削除に失敗しました");
    } finally {
      setDeletingKey("");
    }
  };

  const generateIcon = async () => {
    if (!imagePrompt.trim() && !buttonText.trim()) {
      setError("作りたいイメージ、またはボタンテキストを入力してください");
      return;
    }
    setGenerating(true);
    setError("");
    setErrorCode("");
    try {
      const res = await fetch("/api/generate-button-icon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: buttonText.trim(),
          imagePrompt: imagePrompt.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorCode(data.code || "");
        throw new Error(data.error || "アイコン生成に失敗しました");
      }
      onChange("custom", data.url);
      // 一覧に追加するときの名前は、入力したイメージ（なければボタンテキスト）を初期値にする
      setSaveLabel(
        (imagePrompt.trim() || buttonText.trim()).replace(/\s+/g, " ").slice(0, SAVED_ICON_LABEL_MAX),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "アイコン生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  /** 生成したアイコンを選択一覧（デフォルト）に登録する */
  const saveCurrentIcon = async () => {
    const label = saveLabel.trim();
    if (!label) {
      setError("一覧に表示する名前を入力してください");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/button-icons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, imageUrl: customIconUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "アイコンの追加に失敗しました");

      setSavedIcons((prev) => [...prev, data.icon as SavedButtonIcon]);
      setSaveLabel("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "アイコンの追加に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-3">
      <label className="block text-xs text-slate-500 mb-1.5">左アイコン</label>
      <div className="grid grid-cols-4 gap-1.5">
        {items.map((item) => (
          <div key={item.key} className="relative">
            <button
              type="button"
              onClick={() => selectItem(item)}
              className={`flex min-h-[72px] w-full flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-[10px] font-semibold transition-colors ${
                isSelected(item)
                  ? "border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span
                className="button-icon-thumb"
                data-icon={item.imageUrl ? "custom" : item.presetValue}
                style={
                  item.imageUrl
                    ? ({ "--button-icon-image": `url("${item.imageUrl}")` } as React.CSSProperties)
                    : undefined
                }
                aria-hidden="true"
              />
              <span className="line-clamp-1 w-full text-center">{item.label}</span>
            </button>
            <button
              type="button"
              onClick={() => void deleteItem(item)}
              disabled={deletingKey === item.key}
              aria-label={`${item.label}を選択一覧から削除`}
              title="選択一覧から削除"
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-slate-400 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-50"
            >
              {deletingKey === item.key ? <FiRefreshCw className="animate-spin" size={12} /> : <FiTrash2 size={12} />}
            </button>
          </div>
        ))}
      </div>

      {customIconUrl && (
        <button
          type="button"
          onClick={() => onChange("custom", customIconUrl)}
          className={`mt-2 flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors ${
            value === "custom"
              ? "border-amber-500 bg-amber-50 ring-1 ring-amber-200"
              : "border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span
            className="button-icon-thumb shrink-0"
            data-icon="custom"
            style={{ "--button-icon-image": `url("${customIconUrl}")` } as React.CSSProperties}
            aria-hidden="true"
          />
          <span>
            <span className="block text-xs font-semibold text-slate-700">AI生成アイコン</span>
            <span className="block text-[10px] text-slate-400">クリックしてこのアイコンを選択</span>
          </span>
        </button>
      )}

      {/* 生成したアイコンを次回以降も選べるように一覧へ登録する */}
      {canSaveCurrentIcon && (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2">
          <label htmlFor="button-icon-save-label" className="mb-1 block text-[11px] font-semibold text-emerald-800">
            このアイコンを選択一覧に追加
          </label>
          <div className="flex gap-1.5">
            <input
              id="button-icon-save-label"
              type="text"
              value={saveLabel}
              onChange={(e) => setSaveLabel(e.target.value)}
              maxLength={SAVED_ICON_LABEL_MAX}
              placeholder="一覧に出す名前（例：量子予測）"
              disabled={saving}
              className="min-w-0 flex-1 rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none transition-colors placeholder:text-slate-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-wait disabled:bg-slate-50"
            />
            <button
              type="button"
              onClick={() => void saveCurrentIcon()}
              disabled={saving || !saveLabel.trim()}
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <FiRefreshCw className="animate-spin" size={12} /> : <FiPlus size={12} />}
              追加
            </button>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-emerald-700/70">
            追加すると、次回以降の記事でも上の一覧から選べるようになります。
          </p>
        </div>
      )}

      <div className="mt-2">
        <label htmlFor="button-icon-image-prompt" className="mb-1 block text-xs font-semibold text-slate-600">
          作りたいアイコンのイメージ
          <span className="ml-1 font-normal text-slate-400">（任意）</span>
        </label>
        <textarea
          id="button-icon-image-prompt"
          value={imagePrompt}
          onChange={(e) => setImagePrompt(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="例：未来的なAIチップと回路。知的で先進的な印象"
          disabled={generating}
          className="block w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-700 outline-none transition-colors placeholder:text-slate-300 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:cursor-wait disabled:bg-slate-50"
        />
        <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
          空欄の場合は、上のボタンテキストを参考に生成します。
        </p>
      </div>

      <button
        type="button"
        onClick={generateIcon}
        disabled={generating}
        className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-wait disabled:opacity-60"
      >
        {generating ? <FiRefreshCw className="animate-spin" /> : <FiZap />}
        {generating ? "GPT Image 2で生成中…" : customIconUrl ? "別のAIアイコンを再生成" : "AIアイコンを生成"}
      </button>
      <p className="mt-1 text-[10px] text-slate-400">生成ごとにOpenAI APIの利用料金が発生します。</p>
      {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
      {errorCode === "OPENAI_BILLING_LIMIT" && (
        <a
          href="https://platform.openai.com/settings/organization/billing/overview"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-[10px] font-semibold text-blue-600 underline hover:text-blue-800"
        >
          OpenAI Platformの請求設定を開く
        </a>
      )}
    </div>
  );
}
