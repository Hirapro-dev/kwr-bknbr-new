"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft, FiEye, FiMousePointer, FiBarChart2, FiChevronDown, FiExternalLink } from "react-icons/fi";

type PostSummary = { id: number; title: string; views: number; published: boolean; createdAt: string; scheduledAt: string | null; showForGeneral?: boolean; showForFull?: boolean; writer?: { id: number; name: string } | null };
type Writer = { id: number; name: string };
type PostDetail = {
  post: { id: number; title: string; views: number };
  viewsByDate: Record<string, number>;
  clicksByUrl: Record<string, { count: number; label: string | null }>;
  totalClicks: number;
};

type Period = "all" | "monthly" | "daily";

export default function AnalyticsPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-400">読み込み中...</p></div>}><AnalyticsContent /></Suspense>;
}

function AnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [selectedPost, setSelectedPost] = useState<number | null>(null);
  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [period, setPeriod] = useState<Period>("daily");
  const [viewSource, setViewSource] = useState<"all" | "public" | "general" | "full">("all");
  const [writers, setWriters] = useState<Writer[]>([]);
  const [filterWriterId, setFilterWriterId] = useState<number | null>(null);
  const [filterMember, setFilterMember] = useState<"all" | "general" | "full">("all");

  useEffect(() => {
    const init = async () => {
      const authRes = await fetch("/api/auth/me");
      if (!authRes.ok) { router.push("/admin/login"); return; }
      const res = await fetch("/api/analytics");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts);
        setTotalViews(data.totalViews);
        setTotalClicks(data.totalClicks);
      }
      // 執筆者一覧を取得
      try {
        const wRes = await fetch("/api/writers");
        if (wRes.ok) setWriters(await wRes.json());
      } catch { /* ignore */ }

      const qPostId = searchParams.get("postId");
      if (qPostId) setSelectedPost(parseInt(qPostId));
      setLoading(false);
    };
    init();
  }, [router, searchParams]);

  useEffect(() => {
    if (selectedPost === null) { setDetail(null); return; }
    const loadDetail = async () => {
      setDetailLoading(true);
      const res = await fetch(`/api/analytics?postId=${selectedPost}&period=${period}&viewSource=${viewSource}`);
      if (res.ok) setDetail(await res.json());
      setDetailLoading(false);
    };
    loadDetail();
  }, [selectedPost, period, viewSource]);

  const filteredPosts = posts
    .filter((p) => (filterWriterId ? p.writer?.id === filterWriterId : true))
    .filter((p) => {
      if (filterMember === "all") return true;
      if (filterMember === "general") return p.showForGeneral !== false;
      if (filterMember === "full") return p.showForFull !== false;
      return true;
    });
  const maxViews = Math.max(...filteredPosts.map((p) => p.views), 1);

  const memberLabel = (p: PostSummary) => {
    const g = p.showForGeneral !== false;
    const f = p.showForFull !== false;
    if (g && f) return "一般・正";
    if (g) return "一般";
    if (f) return "正";
    return "—";
  };

  const formatPublishedAt = (p: PostSummary) => {
    if (p.published) return new Date(p.scheduledAt || p.createdAt).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
    if (p.scheduledAt) return `予約: ${new Date(p.scheduledAt).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    return "下書き";
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-400">読み込み中...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3 min-w-0">
          <Link href="/admin/dashboard" className="p-2 text-slate-400 hover:text-blue-600 rounded-lg shrink-0"><FiArrowLeft size={18} /></Link>
          <span className="font-bold text-sm text-slate-900 truncate">アクセス解析</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 w-full min-w-0 box-border">
        {/* フィルター */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <select
            value={filterMember}
            onChange={(e) => setFilterMember(e.target.value as "all" | "general" | "full")}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 focus:outline-none focus:border-blue-400"
          >
            <option value="all">全会員</option>
            <option value="general">一般会員向け</option>
            <option value="full">正会員向け</option>
          </select>
          {writers.length > 0 && (
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
          )}
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-slate-400 mb-2"><FiEye size={16} /><span className="text-xs font-semibold">総閲覧数</span></div>
            <p className="text-3xl font-black text-slate-900">{filteredPosts.reduce((s, p) => s + p.views, 0).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-slate-400 mb-2"><FiMousePointer size={16} /><span className="text-xs font-semibold">総クリック数</span></div>
            <p className="text-3xl font-black text-slate-900">{filterWriterId ? "—" : totalClicks.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-slate-400 mb-2"><FiBarChart2 size={16} /><span className="text-xs font-semibold">記事数</span></div>
            <p className="text-3xl font-black text-slate-900">{filteredPosts.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 min-w-0">
          {/* 記事一覧（閲覧数ランキング） */}
          <div className="min-w-0">
            <h2 className="font-bold text-sm text-slate-900 mb-3">記事別アクセス数</h2>
            <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {filteredPosts.length === 0 ? (
                <p className="text-sm text-slate-400 p-4">記事がありません</p>
              ) : filteredPosts.map((post, i) => (
                <button key={post.id} onClick={() => setSelectedPost(post.id === selectedPost ? null : post.id)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-slate-50 ${selectedPost === post.id ? "bg-blue-50 border-l-2 border-blue-500" : ""}`}>
                  <span className="text-xs font-bold text-slate-300 w-5 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{post.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-[11px] text-slate-500">公開日: {formatPublishedAt(post)}</p>
                      {post.writer && <span className="text-[11px] text-slate-400">| {post.writer.name}</span>}
                      <span className="text-[11px] text-slate-500">| 会員: {memberLabel(post)}</span>
                    </div>
                    <div className="mt-1.5 w-full bg-slate-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${(post.views / maxViews) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-700 shrink-0">{post.views.toLocaleString()}</span>
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
                        <select value={viewSource} onChange={(e) => setViewSource(e.target.value as "all" | "public" | "general" | "full")}
                          className="appearance-none text-xs border border-slate-200 rounded-lg px-3 py-1.5 pr-7 bg-white focus:outline-none focus:border-blue-400 cursor-pointer">
                          <option value="all">全会員</option>
                          <option value="public">公開のみ</option>
                          <option value="general">一般会員</option>
                          <option value="full">正会員</option>
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

                  {/* 閲覧数 棒グラフ（日別は日毎・月別は月毎の本数を表示） */}
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

                {/* クリック数 */}
                <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 overflow-hidden">
                  <div className="flex items-center justify-between mb-3 min-w-0">
                    <div className="flex items-center gap-2 text-slate-400 shrink-0"><FiMousePointer size={14} /><span className="text-xs font-semibold">リンククリック数</span></div>
                    <span className="text-xs text-slate-400 shrink-0">合計 {detail.totalClicks}</span>
                  </div>
                  {Object.keys(detail.clicksByUrl).length === 0 ? (
                    <p className="text-xs text-slate-300 py-4 text-center">クリックデータがありません</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto overflow-x-hidden">
                      {Object.entries(detail.clicksByUrl)
                        .sort(([, a], [, b]) => b.count - a.count)
                        .map(([url, data]) => (
                          <div key={url} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0 min-w-0">
                            <span className="text-sm font-bold text-blue-600 w-8 shrink-0 text-right">{data.count}</span>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className="text-xs font-medium text-slate-700 truncate">{data.label || url}</p>
                              <p className="text-[10px] text-slate-400 break-all">
                                <FiExternalLink size={9} className="inline shrink-0 mr-0.5" />
                                {url}
                              </p>
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
      </main>
    </div>
  );
}
