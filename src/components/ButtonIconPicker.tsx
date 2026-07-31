"use client";

import { useEffect, useMemo, useState } from "react";
import { FiRefreshCw, FiTrash2, FiZap } from "react-icons/fi";
import {
  BUTTON_ICON_PRESETS,
  type ButtonIconPreset,
} from "@/lib/button-icons";

type Props = {
  buttonText: string;
  value: ButtonIconPreset;
  customIconUrl: string;
  onChange: (icon: ButtonIconPreset, customIconUrl?: string) => void;
};

export default function ButtonIconPicker({ buttonText, value, customIconUrl, onChange }: Props) {
  const [generating, setGenerating] = useState(false);
  const [hiddenKeys, setHiddenKeys] = useState<string[]>([]);
  const [deletingKey, setDeletingKey] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const visiblePresets = useMemo(
    () => BUTTON_ICON_PRESETS.filter((preset) => !hiddenKeys.includes(preset.value)),
    [hiddenKeys],
  );

  useEffect(() => {
    let active = true;

    void fetch("/api/button-icons")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "アイコン一覧の読み込みに失敗しました");
        if (active) setHiddenKeys(Array.isArray(data.hiddenKeys) ? data.hiddenKeys : []);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "アイコン一覧の読み込みに失敗しました");
      });

    return () => {
      active = false;
    };
  }, []);

  const deletePreset = async (key: Exclude<ButtonIconPreset, "custom">, label: string) => {
    if (!window.confirm(`「${label}」を選択一覧から削除しますか？\n既存記事のアイコン表示は変わりません。`)) {
      return;
    }

    setDeletingKey(key);
    setError("");
    try {
      const res = await fetch("/api/button-icons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "アイコンの削除に失敗しました");

      const nextHiddenKeys = [...hiddenKeys, key];
      setHiddenKeys(nextHiddenKeys);

      if (value === key) {
        const nextPreset = BUTTON_ICON_PRESETS.find((preset) => !nextHiddenKeys.includes(preset.value));
        if (nextPreset) onChange(nextPreset.value, nextPreset.imageUrl || "");
      }
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "アイコン生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mb-3">
      <label className="block text-xs text-slate-500 mb-1.5">左アイコン</label>
      <div className="grid grid-cols-4 gap-1.5">
        {visiblePresets.map((icon) => (
          <div key={icon.value} className="relative">
            <button
              type="button"
              onClick={() => onChange(icon.value, icon.imageUrl || "")}
              className={`flex min-h-[72px] w-full flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-[10px] font-semibold transition-colors ${
                value === icon.value
                  ? "border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span
                className="button-icon-thumb"
                data-icon={icon.value}
                style={icon.imageUrl ? { backgroundImage: `url("${icon.imageUrl}")`, backgroundSize: "72%" } : undefined}
                aria-hidden="true"
              />
              <span>{icon.label}</span>
            </button>
            <button
              type="button"
              onClick={() => void deletePreset(icon.value, icon.label)}
              disabled={deletingKey === icon.value}
              aria-label={`${icon.label}を選択一覧から削除`}
              title="選択一覧から削除"
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-slate-400 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-50"
            >
              {deletingKey === icon.value ? <FiRefreshCw className="animate-spin" size={12} /> : <FiTrash2 size={12} />}
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
