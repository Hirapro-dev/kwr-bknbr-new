/**
 * LINE配信画像をCanvas 2D APIで直接描画するモジュール
 * html-to-imageに依存せず、確実に画像を生成する
 */

export type TextAlign = "left" | "center" | "right";

/** スタイル設定 */
export type LineImageStyles = {
  // ヘッダー
  headerHeight: number;
  headerText: string;
  headerFontSize: number;
  headerFontWeight: string;
  headerTextColor: string;
  // タイトル
  titleFontSize: number;
  titleFontWeight: string;
  titleLineHeight: number;
  titleAlign: TextAlign;
  titleColor: string;
  // From テキスト
  fromFontSize: number;
  fromColor: string;
  fromPrefix: string;
  // アバター
  avatarSize: number;
  avatarShow: boolean;
  avatarAlign: TextAlign;
  // 本文
  bodyFontSize: number;
  bodyFontWeight: string;
  bodyLineHeight: number;
  bodyAlign: TextAlign;
  bodyColor: string;
  // ボタン
  btnText: string;
  btnFontSize: number;
  btnPaddingX: number;
  btnPaddingY: number;
  btnRadius: number;
  btnBgFrom: string;
  btnBgMid: string;
  btnBgTo: string;
  btnTextColor: string;
  btnEmoji: string;
  btnShadowColor: string;
  // 背景
  bgColor: string;
  // パディング
  paddingX: number;
  paddingTop: number;
};

/** デフォルトスタイル */
export const DEFAULT_STYLES: LineImageStyles = {
  headerHeight: 80,
  headerText: "KAWARA版",
  headerFontSize: 32,
  headerFontWeight: "700",
  headerTextColor: "#ffffff",
  titleFontSize: 48,
  titleFontWeight: "900",
  titleLineHeight: 1.4,
  titleAlign: "center",
  titleColor: "#000000",
  fromFontSize: 26,
  fromColor: "#4b5563",
  fromPrefix: "From：KAWARA版",
  avatarSize: 200,
  avatarShow: true,
  avatarAlign: "left",
  bodyFontSize: 28,
  bodyFontWeight: "400",
  bodyLineHeight: 1.9,
  bodyAlign: "left",
  bodyColor: "#1f2937",
  btnText: "続きを読む",
  btnFontSize: 32,
  btnPaddingX: 80,
  btnPaddingY: 28,
  btnRadius: 999,
  btnBgFrom: "#dd6b20",
  btnBgMid: "#ed8936",
  btnBgTo: "#f6ad55",
  btnTextColor: "#ffffff",
  btnEmoji: "",
  btnShadowColor: "rgba(0,0,0,0.15)",
  bgColor: "#ffffff",
  paddingX: 60,
  paddingTop: 60,
};

export type Variant = "gen" | "vip" | "vc";

export const VARIANT_CONFIG: Record<Variant, { label: string; headerGradient: [string, string] }> = {
  gen: {
    label: "一般会員",
    headerGradient: ["#1e40af", "#3b82f6"],
  },
  vip: {
    label: "正会員",
    headerGradient: ["#991b1b", "#ef4444"],
  },
  vc: {
    label: "VC長者",
    headerGradient: ["#374151", "#111827"],
  },
};

/** ボタングラデーションプリセット（記事エディタのbtn-*と同じ色味） */
export const BTN_GRADIENT_PRESETS: { key: string; label: string; from: string; mid: string; to: string }[] = [
  { key: "orange", label: "オレンジ", from: "#dd6b20", mid: "#ed8936", to: "#f6ad55" },
  { key: "blue",   label: "青",       from: "#007adf", mid: "#00b4cc", to: "#00ecbc" },
  { key: "red",    label: "赤",       from: "#e53e3e", mid: "#f56565", to: "#fc8181" },
  { key: "green",  label: "緑",       from: "#38a169", mid: "#48bb78", to: "#68d391" },
  { key: "purple", label: "紫",       from: "#805ad5", mid: "#9f7aea", to: "#b794f4" },
  { key: "black",  label: "黒",       from: "#1f2937", mid: "#374151", to: "#1f2937" },
];

const W = 1040;
const H = 2080;

/** 画像を読み込みImageオブジェクトを返す */
async function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** テキストを折り返して描画（Canvas用） */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  align: TextAlign,
): number {
  // テキスト揃え設定
  ctx.textAlign = align;
  const drawX = align === "center" ? x + maxWidth / 2 : align === "right" ? x + maxWidth : x;

  const lines: string[] = [];
  // 改行で分割
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    if (para === "") {
      lines.push("");
      continue;
    }
    let currentLine = "";
    for (const char of para) {
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  let curY = y;
  for (const line of lines) {
    ctx.fillText(line, drawX, curY);
    curY += lineHeight;
  }

  // 描画後の合計高さを返す
  return lines.length * lineHeight;
}

/** 角丸四角形を描画 */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** 丸い画像を描画 */
function drawCircleImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, radius: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // カバーフィット
  const size = radius * 2;
  const aspect = img.width / img.height;
  let sw = size, sh = size;
  if (aspect > 1) { sw = size * aspect; } else { sh = size / aspect; }
  ctx.drawImage(img, cx - sw / 2, cy - sh / 2, sw, sh);
  ctx.restore();

  // 枠線
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** Canvas APIでLINE配信画像を生成 */
export async function generateLineImage(
  variant: Variant,
  data: {
    title: string;
    body: string;
    writerName: string;
    avatarDataUrl: string;
  },
  styles: LineImageStyles,
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const config = VARIANT_CONFIG[variant];
  const font = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif';

  // ── 背景 ──
  ctx.fillStyle = styles.bgColor;
  ctx.fillRect(0, 0, W, H);

  // ── ヘッダーバー（グラデーション） ──
  const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
  headerGrad.addColorStop(0, config.headerGradient[0]);
  headerGrad.addColorStop(1, config.headerGradient[1]);
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, W, styles.headerHeight);

  // ヘッダーテキスト
  if (styles.headerText) {
    ctx.fillStyle = styles.headerTextColor;
    ctx.font = `${styles.headerFontWeight} ${styles.headerFontSize}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(styles.headerText, W / 2, styles.headerHeight / 2);
  }

  // ── メインコンテンツ ──
  let curY = styles.headerHeight + styles.paddingTop;
  const contentWidth = W - styles.paddingX * 2;

  // タイトル
  ctx.fillStyle = styles.titleColor;
  ctx.font = `${styles.titleFontWeight} ${styles.titleFontSize}px ${font}`;
  ctx.textBaseline = "top";
  const titleLH = styles.titleFontSize * styles.titleLineHeight;
  const titleH = wrapText(ctx, data.title || "タイトル未入力", styles.paddingX, curY, contentWidth, titleLH, styles.titleAlign);
  curY += titleH + 40;

  // From テキスト
  if (data.writerName) {
    ctx.fillStyle = styles.fromColor;
    ctx.font = `400 ${styles.fromFontSize}px ${font}`;
    ctx.textAlign = "left";
    ctx.fillText(`${styles.fromPrefix} ${data.writerName}`, styles.paddingX, curY);
    curY += styles.fromFontSize + 30;
  }

  // アバター
  if (styles.avatarShow && data.avatarDataUrl) {
    const avatarImg = await loadImage(data.avatarDataUrl);
    if (avatarImg) {
      const r = styles.avatarSize / 2;
      // 揃え位置に応じてX座標を計算
      const avatarCx = styles.avatarAlign === "center" ? W / 2
        : styles.avatarAlign === "right" ? W - styles.paddingX - r
        : styles.paddingX + r; // left
      drawCircleImage(ctx, avatarImg, avatarCx, curY + r, r);
      curY += styles.avatarSize + 40;
    }
  }

  // 本文テキスト
  ctx.fillStyle = styles.bodyColor;
  ctx.font = `${styles.bodyFontWeight} ${styles.bodyFontSize}px ${font}`;
  const bodyLH = styles.bodyFontSize * styles.bodyLineHeight;
  const bodyH = wrapText(ctx, data.body || "", styles.paddingX, curY, contentWidth, bodyLH, styles.bodyAlign);
  curY += bodyH + 60;

  // ── CTAボタン ──
  ctx.font = `800 ${styles.btnFontSize}px ${font}`;
  ctx.textAlign = "left";
  const btnTextMetrics = ctx.measureText(styles.btnText);
  const emojiW = styles.btnEmoji ? styles.btnFontSize + 12 : 0;
  const btnContentW = btnTextMetrics.width + emojiW;
  const btnW = btnContentW + styles.btnPaddingX * 2;
  const btnH = styles.btnFontSize + styles.btnPaddingY * 2;
  const btnX = (W - btnW) / 2;
  const btnY = curY;

  // ボタン影
  ctx.shadowColor = styles.btnShadowColor;
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 6;

  // ボタン背景（3ストップグラデーション角丸）
  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY);
  btnGrad.addColorStop(0, styles.btnBgFrom);
  btnGrad.addColorStop(0.5, styles.btnBgMid);
  btnGrad.addColorStop(1, styles.btnBgTo);
  ctx.fillStyle = btnGrad;
  roundRect(ctx, btnX, btnY, btnW, btnH, styles.btnRadius);
  ctx.fill();

  // 影リセット
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // ボタンテキスト
  ctx.fillStyle = styles.btnTextColor;
  ctx.font = `800 ${styles.btnFontSize}px ${font}`;
  ctx.textBaseline = "middle";
  const textX = btnX + styles.btnPaddingX;
  const textY = btnY + btnH / 2;
  ctx.textAlign = "left";
  ctx.fillText(styles.btnText, textX, textY);

  // 絵文字
  if (styles.btnEmoji) {
    ctx.font = `${styles.btnFontSize + 4}px ${font}`;
    ctx.fillText(styles.btnEmoji, textX + btnTextMetrics.width + 12, textY);
  }

  return canvas.toDataURL("image/png");
}
