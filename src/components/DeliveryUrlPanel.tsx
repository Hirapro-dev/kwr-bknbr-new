"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { FiCheck, FiCopy, FiLink } from "react-icons/fi";
import { CHANNELS, CHANNEL_LABELS, MEDIA_LIST, buildDeliveryUrl, type Channel, type Media } from "@/lib/tracking";

type Props = {
  /** 記事スラッグ。新規作成中（保存前）は空文字 */
  slug: string;
  showForGen: boolean;
  showForVip: boolean;
  showForVC: boolean;
  showForWel: boolean;
};

/** チャネルごとの見た目（メルマガ＝青系／LINE＝緑系） */
const CHANNEL_STYLE: Record<Channel, { badge: string; button: string }> = {
  mail: { badge: "bg-blue-50 text-blue-700", button: "hover:bg-blue-50 hover:text-blue-700" },
  line: { badge: "bg-green-50 text-green-700", button: "hover:bg-green-50 hover:text-green-700" },
};

/** origin は変化しないので購読は不要（useSyncExternalStore の要件を満たすためのダミー） */
const subscribeNoop = () => () => {};
/** 公開URLのドメイン。NEXT_PUBLIC_SITE_URL があれば優先（ローカル開発でも本番URLを出せる） */
const getOrigin = () => process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
/** SSR時は window が無いため、環境変数が無ければ空文字を返す */
const getServerOrigin = () => process.env.NEXT_PUBLIC_SITE_URL || "";

/**
 * 配信用URL（媒体 × チャネル）を生成してコピーできるパネル。
 * 表示先会員にチェックを入れた媒体の分だけ、メルマガ用・LINE用の2本ずつ出す。
 */
export default function DeliveryUrlPanel({ slug, showForGen, showForVip, showForVC, showForWel }: Props) {
  const origin = useSyncExternalStore(subscribeNoop, getOrigin, getServerOrigin);
  const [withUtm, setWithUtm] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const enabled: Media[] = useMemo(() => {
    const flags: Record<Media, boolean> = { gen: showForGen, vip: showForVip, vc: showForVC, wel: showForWel };
    return MEDIA_LIST.filter((m) => flags[m.key]).map((m) => m.key);
  }, [showForGen, showForVip, showForVC, showForWel]);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // クリップボードAPIが使えない環境（非HTTPS等）向けのフォールバック
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
  };

  return (
    <div className="mb-4 md:mb-6 bg-white rounded-lg border border-slate-200 p-3 md:p-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2 text-slate-500">
          <FiLink size={14} />
          <span className="text-xs font-semibold">配信用URL（メルマガ / LINE）</span>
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={withUtm}
            onChange={(e) => setWithUtm(e.target.checked)}
            className="rounded border-slate-300 text-blue-500 focus:ring-blue-400"
          />
          <span className="text-[11px] text-slate-500">UTMパラメータも付ける（GA4用）</span>
        </label>
      </div>

      {!slug ? (
        <p className="text-xs text-slate-400 py-2">記事を保存するとURLが発行されます。</p>
      ) : enabled.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">「表示先会員」を1つ以上選ぶとURLが表示されます。</p>
      ) : (
        <div className="space-y-3">
          {enabled.map((mediaKey) => {
            const media = MEDIA_LIST.find((m) => m.key === mediaKey)!;
            return (
              <div key={mediaKey}>
                <p className="text-[11px] font-semibold text-slate-600 mb-1.5">{media.label}</p>
                <div className="space-y-1.5">
                  {CHANNELS.map((channel) => {
                    const key = `${mediaKey}-${channel}`;
                    const url = buildDeliveryUrl(origin, mediaKey, slug, channel, withUtm);
                    const copied = copiedKey === key;
                    return (
                      <div key={key} className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] font-bold px-1.5 py-1 rounded shrink-0 w-16 text-center ${CHANNEL_STYLE[channel].badge}`}>
                          {CHANNEL_LABELS[channel]}
                        </span>
                        <input
                          readOnly
                          value={url}
                          onFocus={(e) => e.currentTarget.select()}
                          className="flex-1 min-w-0 text-[11px] font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-blue-400"
                        />
                        <button
                          type="button"
                          onClick={() => copy(key, url)}
                          title="URLをコピー"
                          className={`shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2 py-1.5 rounded border border-slate-200 transition-colors ${
                            copied ? "bg-green-50 text-green-700 border-green-200" : `text-slate-500 ${CHANNEL_STYLE[channel].button}`
                          }`}
                        >
                          {copied ? <><FiCheck size={12} />済</> : <><FiCopy size={12} />コピー</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-slate-400 leading-relaxed">
            このURLから開くと、閲覧数・記事内リンクのクリックが配信チャネル別に記録されます（Cookieで30日間引き継ぎ）。
            アクセス解析ページで「メルマガ / LINE」の内訳を確認できます。
          </p>
        </div>
      )}
    </div>
  );
}
