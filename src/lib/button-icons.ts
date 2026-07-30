export type ButtonIconPreset =
  | "ai" | "new" | "dna" | "market" | "growth" | "trophy" | "btc" | "ada" | "xrp"
  | "quantum-future" | "gold-outlook" | "ai-stock-selection" | "ips-wellness"
  | "steady-market" | "ai-bubble"
  | "custom";

export const BUTTON_ICON_PRESETS: {
  value: Exclude<ButtonIconPreset, "custom">;
  label: string;
  imageUrl?: string;
}[] = [
  { value: "ai", label: "AI" },
  { value: "new", label: "NEW" },
  { value: "dna", label: "DNA" },
  { value: "market", label: "市場分析" },
  { value: "growth", label: "上昇" },
  { value: "trophy", label: "トロフィー" },
  { value: "btc", label: "BTC" },
  { value: "ada", label: "ADA" },
  { value: "xrp", label: "XRP" },
  { value: "quantum-future", label: "量子予測", imageUrl: "/button-icons/quantum-future.png" },
  { value: "gold-outlook", label: "金予測", imageUrl: "/button-icons/gold-outlook.png" },
  { value: "ai-stock-selection", label: "AI銘柄", imageUrl: "/button-icons/ai-stock-selection.png" },
  { value: "ips-wellness", label: "iPS", imageUrl: "/button-icons/ips-wellness.png" },
  { value: "steady-market", label: "安定投資", imageUrl: "/button-icons/steady-market.png" },
  { value: "ai-bubble", label: "AIバブル", imageUrl: "/button-icons/ai-bubble.png" },
];

/** 既存ボタンの文章から、標準アイコンを決定論的に選ぶ */
export function suggestButtonIcon(text: string) {
  const rules: { pattern: RegExp; value: ButtonIconPreset }[] = [
    { pattern: /AIバブル|バブルの崩壊/i, value: "ai-bubble" },
    { pattern: /XRP/i, value: "xrp" },
    { pattern: /ADA|Cardano|カルダノ/i, value: "ada" },
    { pattern: /BTC|ビットコイン/i, value: "btc" },
    { pattern: /左右されない|ほったらかし投資/i, value: "steady-market" },
    { pattern: /iPS|ウェルネス/i, value: "ips-wellness" },
    { pattern: /AIエンジン|有望銘柄/i, value: "ai-stock-selection" },
    { pattern: /ゴールド|金特別/i, value: "gold-outlook" },
    { pattern: /量子|超精密|未来予測/i, value: "quantum-future" },
  ];
  const matched = rules.find((rule) => rule.pattern.test(text));
  if (!matched) return null;
  const preset = BUTTON_ICON_PRESETS.find((icon) => icon.value === matched.value);
  return preset ? { icon: preset.value, imageUrl: preset.imageUrl || "" } : null;
}
