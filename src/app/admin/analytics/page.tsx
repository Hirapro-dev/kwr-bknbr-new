"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiEye, FiMousePointer, FiBarChart2, FiChevronDown, FiExternalLink, FiArrowUp, FiArrowDown, FiClock, FiSend } from "react-icons/fi";
import { CHANNEL_BUCKETS, CHANNEL_LABELS, type ChannelBucket } from "@/lib/tracking";

/** チャネル別の件数（mail / line / direct） */
type ChannelTally = Record<ChannelBucket, number>;
type ChannelStats = { views: ChannelTally; clicks: ChannelTally };

type PostSummary = { id: number; title: string; views: number; clicks: number; published: boolean; createdAt: string; scheduledAt: string | null; showForGen?: boolean; showForVip?: boolean; showForVC?: boolean; showForWel?: boolean; writer?: { id: number; name: string } | null };
type Writer = { id: number; name: string };
type ClickLogItem = { url: string; label: string | null; source: string | null; channel: string | null; createdAt: string };
type PostDetail = {
  post: { id: number; title: string; views: number };
  viewsByDate: Record<string, number>;
  clicksByDate: Record<string, number>;
  clicksByUrl: Record<string, { count: number; label: string | null; firstClickedAt: string; lastClickedAt: string }>;
  /** この記事の 媒体 × チャネル クロス集計 */
  channelMatrix: Record<string, ChannelStats>;
  clickLog: ClickLogItem[];
  clickLogTruncated: boolean;
  totalClicks: number;
  uniqueUrlCount: number;
};

type Period = "all" | "monthly" | "daily";
type ChannelFilter = "all" | ChannelBucket;

/** クロス集計表に出す媒体の行（public = 配信を経由しない直接閲覧） */
const MATRIX_ROWS: { key: string; label: string }[] = [
  { key: "gen", label: "一般会員" },
  { key: "vip", label: "正会員" },
  { key: "vc", label: "仮想通貨長者" },
  { key: "wel", label: "ウェルネス" },
  { key: "public", label: "その他・直接" },
];

/** チャネル列の色分け（メルマガ＝青／LINE＝緑／直接＝グレー） */
const CHANNEL_COLOR: Record<ChannelBucket, string> = {
  mail: "text-blue-700",
  line: "text-green-700",
  direct: "text-slate-400",
};

const EMPTY_TALLY: ChannelTally = { mail: 0, line: 0, direct: 0 };
const EMPTY_STATS: ChannelStats = { views: EMPTY_TALLY, clicks: EMPTY_TALLY };

/**
 * 媒体 × 配信チャネルのクロス集計表。
 * 全体サマリーと、記事を選んだときの詳細パネルの両方で使う。
 */
function ChannelMatrixTable({ matrix }: { matrix: Record<string, ChannelStats> }) {
  const cell = (views: number, clicks: number, strong = false) => (
    <>
      <span className={`${strong ? "font-black" : "font-bold"} text-slate-900`}>{views.toLocaleString()}</span>
      <span className={`block text-[10px] ${strong ? "font-bold" : "font-semibold"} text-orange-500`}>{clicks.toLocaleString()}</span>
    </>
  );

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-xs min-w-[420px]">
        <thead>
          <tr className="text-slate-400 border-b border-slate-100">
            <th className="text-left font-semibold py-2 pr-2">媒体</th>
            {CHANNEL_BUCKETS.map((c) => (
              <th key={c} className={`text-right font-semibold py-2 px-2 ${CHANNEL_COLOR[c]}`}>{CHANNEL_LABELS[c]}</th>
            ))}
            <th className="text-right font-semibold py-2 pl-2">合計</th>
          </tr>
        </thead>
        <tbody>
          {MATRIX_ROWS.map((row) => {
            const stats = matrix[row.key] ?? EMPTY_STATS;
            const viewTotal = CHANNEL_BUCKETS.reduce((s, c) => s + stats.views[c], 0);
            const clickTotal = CHANNEL_BUCKETS.reduce((s, c) => s + stats.clicks[c], 0);
            return (
              <tr key={row.key} className="border-b border-slate-50 last:border-0">
                <td className="py-2 pr-2 font-semibold text-slate-700 whitespace-nowrap">{row.label}</td>
                {CHANNEL_BUCKETS.map((c) => (
                  <td key={c} className="text-right py-2 px-2 tabular-nums">{cell(stats.views[c], stats.clicks[c])}</td>
                ))}
                <td className="text-right py-2 pl-2 tabular-nums bg-slate-50/60">{cell(viewTotal, clickTotal, true)}</td>
              </tr>
            );
          })}
          {/* 全媒体の合計 */}
          <tr className="border-t-2 border-slate-200">
            <td className="py-2 pr-2 font-bold text-slate-900 whitespace-nowrap">合計</td>
            {CHANNEL_BUCKETS.map((c) => (
              <td key={c} className="text-right py-2 px-2 tabular-nums">
                {cell(
                  MATRIX_ROWS.reduce((s, r) => s + (matrix[r.key]?.views[c] ?? 0), 0),
                  MATRIX_ROWS.reduce((s, r) => s + (matrix[r.key]?.clicks[c] ?? 0), 0),
                  true
                )}
              </td>
            ))}
            <td className="text-right py-2 pl-2 tabular-nums bg-slate-50/60">
              {cell(
                MATRIX_ROWS.reduce((s, r) => s + CHANNEL_BUCKETS.reduce((t, c) => t + (matrix[r.key]?.views[c] ?? 0), 0), 0),
                MATRIX_ROWS.reduce((s, r) => s + CHANNEL_BUCKETS.reduce((t, c) => t + (matrix[r.key]?.clicks[c] ?? 0), 0), 0),
                true
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** 記事一覧の並べ替えキー */
type SortKey = "views" | "clicks" | "date";
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "views", label: "閲覧数" },
  { key: "clicks", label: "クリック数" },
  { key: "date", label: "配信日" },
];

/** 日時を「2026/07/21 14:05」形式で表示 */
const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
  });

export default function AnalyticsPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-400">読み込み中...</p></div>}><AnalyticsContent /></Suspense>;
}

function AnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [selectedPost, setSelectedPost] = useState<number | null>(null);
  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [period, setPeriod] = useState<Period>("daily");
  const [viewSource, setViewSource] = useState<"all" | "public" | "gen" | "vip" | "vc" | "wel">("all");
  const [viewChannel, setViewChannel] = useState<ChannelFilter>("all");
  // 記事ごとのチャネル内訳（一覧の各行に表示する）
  const [channelByPost, setChannelByPost] = useState<Record<number, ChannelStats>>({});
  const [writers, setWriters] = useState<Writer[]>([]);
  const [filterWriterId, setFilterWriterId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [sortDesc, setSortDesc] = useState(true);

  // 全媒体の記事をまとめて取得する（媒体の内訳は各記事のチャネル別表で確認する）
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics?media=all");
      if (res.ok) {
        const data = await res.json();
        // 記事別クリック数をマージ（APIは記事一覧と別集計で返す）
        const clicksByPost: Record<number, number> = data.clicksByPost || {};
        setPosts((data.posts as PostSummary[]).map((p) => ({ ...p, clicks: clicksByPost[p.id] ?? 0 })));
        setChannelByPost(data.channelByPost || {});
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const authRes = await fetch("/api/auth/me");
      if (!authRes.ok) { router.push("/admin/login"); return; }
      // 執筆者一覧を取得
      try {
        const wRes = await fetch("/api/writers");
        if (wRes.ok) setWriters(await wRes.json());
      } catch { /* ignore */ }

      const qPostId = searchParams.get("postId");
      if (qPostId) setSelectedPost(parseInt(qPostId));

      await fetchAnalytics();
    };
    init();
  }, [router, searchParams, fetchAnalytics]);

  useEffect(() => {
    // 選択解除時の detail クリアは選択操作側で行う（効果内で直接setStateしないため）
    if (selectedPost === null) return;
    const loadDetail = async () => {
      setDetailLoading(true);
      const res = await fetch(`/api/analytics?postId=${selectedPost}&period=${period}&viewSource=${viewSource}&viewChannel=${viewChannel}`);
      if (res.ok) setDetail(await res.json());
      setDetailLoading(false);
    };
    loadDetail();
  }, [selectedPost, period, viewSource, viewChannel]);

  // 配信日（予約投稿があればその日時、なければ作成日）をソート用の数値に変換
  const deliveredAt = (p: PostSummary) => new Date(p.scheduledAt || p.createdAt).getTime();

  const filteredPosts = posts
    .filter((p) => (filterWriterId ? p.writer?.id === filterWriterId : true))
    .slice()
    .sort((a, b) => {
      const diff =
        sortKey === "views" ? a.views - b.views
          : sortKey === "clicks" ? a.clicks - b.clicks
            : deliveredAt(a) - deliveredAt(b);
      return sortDesc ? -diff : diff;
    });

  // 棒グラフは並べ替えの基準になっている指標を表示（配信日順のときは閲覧数）
  const barKey: "views" | "clicks" = sortKey === "clicks" ? "clicks" : "views";
  const maxBarValue = Math.max(...filteredPosts.map((p) => p[barKey]), 1);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDesc((d) => !d);
    else { setSortKey(key); setSortDesc(true); }
  };

  const memberLabel = (p: PostSummary) => {
    const parts: string[] = [];
    if (p.showForGen !== false) parts.push("一般");
    if (p.showForVip !== false) parts.push("正");
    if (p.showForVC === true) parts.push("VC");
    if (p.showForWel === true) parts.push("ウェルネス");
    return parts.length > 0 ? parts.join("・") : "—";
  };

  const formatPublishedAt = (p: PostSummary) => {
    if (p.published) return new Date(p.scheduledAt || p.createdAt).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
    if (p.scheduledAt) return `予約: ${new Date(p.scheduledAt).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    return "下書き";
  };

  return (
    <div className="overflow-x-hidden">
      <main className="max-w-5xl mx-auto px-4 py-6 w-full min-w-0 box-border">
        {/* フィルター（執筆者のみ。媒体の内訳は記事ごとのチャネル別表で確認する） */}
        {writers.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <select
              value={filterWriterId ?? ""}
              onChange={(e) => setFilterWriterId(e.target.value ? parseInt(e.target.value) : null)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 focus:outline-none focus:border-blue-400"
            >
              <option value="">全執筆者</option>
              {writers.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-400">読み込み中...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 min-w-0">
            {/* 記事一覧（閲覧数ランキング） */}
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <h2 className="font-bold text-sm text-slate-900">記事別アクセス数</h2>
                <span className="text-[11px] text-slate-400">{filteredPosts.length}件</span>
              </div>

              {/* 並べ替え（同じ項目をもう一度押すと昇順・降順が反転） */}
              <div className="flex items-center gap-1 mb-3 bg-white rounded-lg border border-slate-200 p-1">
                <span className="text-[11px] text-slate-400 px-1.5 shrink-0">並べ替え</span>
                {SORT_OPTIONS.map((o) => (
                  <button key={o.key} onClick={() => toggleSort(o.key)}
                    title={`${o.label}で並べ替え${sortKey === o.key ? (sortDesc ? "（降順）" : "（昇順）") : ""}`}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      sortKey === o.key ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    }`}>
                    {o.label}
                    {sortKey === o.key && (sortDesc ? <FiArrowDown size={11} /> : <FiArrowUp size={11} />)}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {filteredPosts.length === 0 ? (
                  <p className="text-sm text-slate-400 p-4">記事がありません</p>
                ) : filteredPosts.map((post, i) => (
                  <button key={post.id} onClick={() => {
                    // 同じ記事をもう一度押したら選択解除
                    const next = post.id === selectedPost ? null : post.id;
                    setSelectedPost(next);
                    if (next === null) setDetail(null);
                  }}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-slate-50 ${selectedPost === post.id ? "bg-blue-50 border-l-2 border-blue-500" : ""}`}>
                    <span className="text-xs font-bold text-slate-300 w-5 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{post.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-[11px] text-slate-500">配信日: {formatPublishedAt(post)}</p>
                        {post.writer && <span className="text-[11px] text-slate-400">| {post.writer.name}</span>}
                        <span className="text-[11px] text-slate-500">| 会員: {memberLabel(post)}</span>
                      </div>
                      {/* 配信チャネル別の内訳（閲覧数 / クリック数） */}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {CHANNEL_BUCKETS.map((c) => {
                          const stats = channelByPost[post.id];
                          const v = stats?.views[c] ?? 0;
                          const cl = stats?.clicks[c] ?? 0;
                          if (v === 0 && cl === 0) return null;
                          return (
                            <span key={c} className={`text-[10px] font-semibold ${CHANNEL_COLOR[c]}`}>
                              {CHANNEL_LABELS[c]} {v.toLocaleString()}
                              <span className="text-orange-500"> / {cl.toLocaleString()}</span>
                            </span>
                          );
                        })}
                      </div>
                      <div className="mt-1.5 w-full bg-slate-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${barKey === "clicks" ? "bg-orange-500" : "bg-blue-500"}`}
                          style={{ width: `${(post[barKey] / maxBarValue) * 100}%` }} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="flex items-center justify-end gap-1 text-slate-700">
                        <FiEye size={11} className="text-slate-300" />
                        <span className="text-sm font-bold">{post.views.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-end gap-1 text-orange-600 mt-0.5">
                        <FiMousePointer size={10} className="text-orange-300" />
                        <span className="text-xs font-bold">{post.clicks.toLocaleString()}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 詳細パネル */}
            <div>
              {selectedPost === null ? (
                <div className="bg-white rounded-lg border border-slate-200 p-8 text-center min-w-0">
                  <FiBarChart2 size={36} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">左の記事をクリックして詳細を表示</p>
                </div>
              ) : detailLoading ? (
                <div className="bg-white rounded-lg border border-slate-200 p-8 text-center min-w-0">
                  <p className="text-sm text-slate-400 animate-pulse">読み込み中...</p>
                </div>
              ) : detail ? (
                <div className="space-y-4 min-w-0 overflow-hidden">
                  <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <h3 className="font-bold text-sm text-slate-900 break-words min-w-0">{detail.post.title}</h3>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <div className="relative">
                          <select value={viewSource} onChange={(e) => setViewSource(e.target.value as "all" | "public" | "gen" | "vip" | "vc" | "wel")}
                            className="appearance-none text-xs border border-slate-200 rounded-lg px-3 py-1.5 pr-7 bg-white focus:outline-none focus:border-blue-400 cursor-pointer">
                            <option value="all">全会員</option>
                            <option value="public">公開のみ</option>
                            <option value="gen">一般会員</option>
                            <option value="vip">正会員</option>
                            <option value="vc">仮想通貨長者</option>
                            <option value="wel">ウェルネス</option>
                          </select>
                          <FiChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        {/* 配信チャネルでの絞り込み（グラフ・クリック履歴に反映） */}
                        <div className="relative">
                          <select value={viewChannel} onChange={(e) => setViewChannel(e.target.value as ChannelFilter)}
                            className="appearance-none text-xs border border-slate-200 rounded-lg px-3 py-1.5 pr-7 bg-white focus:outline-none focus:border-blue-400 cursor-pointer">
                            <option value="all">全チャネル</option>
                            {CHANNEL_BUCKETS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
                          </select>
                          <FiChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        <div className="relative">
                          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}
                            className="appearance-none text-xs border border-slate-200 rounded-lg px-3 py-1.5 pr-7 bg-white focus:outline-none focus:border-blue-400 cursor-pointer">
                            <option value="daily">日別（30日間）</option>
                            <option value="monthly">月別（12ヶ月）</option>
                            <option value="all">全期間</option>
                          </select>
                          <FiChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* この記事の 媒体 × 配信チャネル クロス集計（絞り込みに関わらず全期間の実数） */}
                    <div className="mb-5 pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <FiSend size={13} /><span className="text-xs font-semibold">この記事の配信チャネル別</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mb-2">上段が閲覧数、下段（橙）がクリック数。</p>
                      <ChannelMatrixTable matrix={detail.channelMatrix ?? {}} />
                    </div>

                    {/* 閲覧数 棒グラフ */}
                    <div className="mb-2 flex items-center gap-2 text-slate-400"><FiEye size={14} /><span className="text-xs font-semibold">閲覧数推移</span></div>
                    {Object.keys(detail.viewsByDate).length === 0 ? (
                      <p className="text-xs text-slate-300 py-4 text-center">データがありません</p>
                    ) : (
                      <div className="w-full min-w-0 overflow-x-auto">
                        <div className="flex items-end gap-[2px] sm:gap-[3px] h-28 mt-2 min-w-0" style={{ minWidth: "min(100%, 320px)" }}>
                          {(() => {
                            const entries = Object.entries(detail.viewsByDate).sort(([a], [b]) => a.localeCompare(b));
                            const maxVal = Math.max(...entries.map(([, v]) => v), 1);
                            return entries.map(([date, count]) => (
                              <div key={date} className="flex-1 min-w-0 flex flex-col items-center group relative" style={{ minWidth: "4px" }}>
                                <div className="w-full max-w-[12px] mx-auto bg-blue-500 rounded-t-sm transition-all hover:bg-blue-600"
                                  style={{ height: `${(count / maxVal) * 100}%`, minHeight: count > 0 ? "4px" : "1px" }} />
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                  {date}: {count}
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                        <div className="flex justify-between mt-1 text-[10px] text-slate-300">
                          <span>{Object.entries(detail.viewsByDate).sort(([a], [b]) => a.localeCompare(b))[0]?.[0] || ""}</span>
                          <span>{Object.entries(detail.viewsByDate).sort(([a], [b]) => a.localeCompare(b)).at(-1)?.[0] || ""}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* クリック数推移グラフ */}
                  <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 overflow-hidden">
                    <div className="mb-2 flex items-center gap-2 text-slate-400"><FiMousePointer size={14} /><span className="text-xs font-semibold">クリック数推移</span></div>
                    {!detail.clicksByDate || Object.keys(detail.clicksByDate).length === 0 ? (
                      <p className="text-xs text-slate-300 py-4 text-center">クリックデータがありません</p>
                    ) : (
                      <div className="w-full min-w-0 overflow-x-auto">
                        <div className="flex items-end gap-[2px] sm:gap-[3px] h-28 mt-2 min-w-0" style={{ minWidth: "min(100%, 320px)" }}>
                          {(() => {
                            const entries = Object.entries(detail.clicksByDate).sort(([a], [b]) => a.localeCompare(b));
                            const maxVal = Math.max(...entries.map(([, v]) => v), 1);
                            return entries.map(([date, count]) => (
                              <div key={date} className="flex-1 min-w-0 flex flex-col items-center group relative" style={{ minWidth: "4px" }}>
                                <div className="w-full max-w-[12px] mx-auto bg-orange-500 rounded-t-sm transition-all hover:bg-orange-600"
                                  style={{ height: `${(count / maxVal) * 100}%`, minHeight: count > 0 ? "4px" : "1px" }} />
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                  {date}: {count}
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                        <div className="flex justify-between mt-1 text-[10px] text-slate-300">
                          <span>{Object.entries(detail.clicksByDate).sort(([a], [b]) => a.localeCompare(b))[0]?.[0] || ""}</span>
                          <span>{Object.entries(detail.clicksByDate).sort(([a], [b]) => a.localeCompare(b)).at(-1)?.[0] || ""}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* リンク別クリック数 */}
                  <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 overflow-hidden">
                    <div className="flex items-center gap-2 text-slate-400 mb-3">
                      <FiMousePointer size={14} /><span className="text-xs font-semibold">リンク別クリック数</span>
                    </div>

                    {/* 集計サマリー */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-slate-50 rounded-lg px-3 py-2">
                        <p className="text-[10px] font-semibold text-slate-400">クリック総数</p>
                        <p className="text-lg font-black text-slate-900 leading-tight">{detail.totalClicks.toLocaleString()}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2">
                        <p className="text-[10px] font-semibold text-slate-400">ユニークリンク数</p>
                        <p className="text-lg font-black text-slate-900 leading-tight">{detail.uniqueUrlCount.toLocaleString()}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">URLパラメータを除いて集計</p>
                      </div>
                    </div>

                    {Object.keys(detail.clicksByUrl).length === 0 ? (
                      <p className="text-xs text-slate-300 py-4 text-center">クリックデータがありません</p>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto overflow-x-hidden">
                        {Object.entries(detail.clicksByUrl)
                          .sort(([, a], [, b]) => b.count - a.count)
                          .map(([url, data]) => (
                            <div key={url} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0 min-w-0">
                              <span className="text-sm font-bold text-blue-600 w-8 shrink-0 text-right pt-0.5">{data.count}</span>
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <p className="text-xs font-medium text-slate-700 truncate">{data.label || url}</p>
                                <p className="text-[10px] text-slate-400 break-all">
                                  <FiExternalLink size={9} className="inline shrink-0 mr-0.5" />
                                  {url}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 flex-wrap">
                                  <FiClock size={9} className="shrink-0" />
                                  <span>最終 {formatDateTime(data.lastClickedAt)}</span>
                                  {data.count > 1 && <span className="text-slate-300">/ 初回 {formatDateTime(data.firstClickedAt)}</span>}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* クリック履歴（日時つき） */}
                  <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 overflow-hidden">
                    <div className="flex items-center justify-between mb-3 min-w-0 gap-2">
                      <div className="flex items-center gap-2 text-slate-400 shrink-0"><FiClock size={14} /><span className="text-xs font-semibold">クリック履歴</span></div>
                      {detail.clickLogTruncated && <span className="text-[10px] text-slate-400 shrink-0">直近200件を表示</span>}
                    </div>
                    {!detail.clickLog || detail.clickLog.length === 0 ? (
                      <p className="text-xs text-slate-300 py-4 text-center">クリックデータがありません</p>
                    ) : (
                      <div className="max-h-72 overflow-y-auto overflow-x-hidden divide-y divide-slate-50">
                        {detail.clickLog.map((c, i) => (
                          <div key={`${c.createdAt}-${i}`} className="flex items-start gap-3 py-2 min-w-0">
                            <span className="text-[10px] text-slate-400 font-mono shrink-0 pt-0.5 tabular-nums">{formatDateTime(c.createdAt)}</span>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className="text-xs text-slate-700 truncate">{c.label || c.url}</p>
                              <p className="text-[10px] text-slate-400 break-all">{c.url}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {c.channel && (
                                <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${c.channel === "line" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
                                  {CHANNEL_LABELS[c.channel as ChannelBucket] ?? c.channel}
                                </span>
                              )}
                              {c.source && <span className="text-[10px] text-slate-400 bg-slate-50 rounded px-1.5 py-0.5">{c.source}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
