"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff, FiLogOut, FiHome,
  FiBarChart2, FiSettings, FiImage, FiUsers, FiClock, FiTrendingUp,
  FiMousePointer, FiShield,
} from "react-icons/fi";
import { formatDate, getDisplayDate } from "@/lib/utils";

type Post = {
  id: number; title: string; slug: string; published: boolean;
  isPickup: boolean;
  showForGen?: boolean;
  showForVip?: boolean;
  showForVC?: boolean;
  createdAt: string; excerpt: string | null; eyecatch: string | null;
  views: number; scheduledAt: string | null;
  writer?: { id: number; name: string } | null;
};

type Writer = { id: number; name: string };
type SortKey = "newest" | "oldest" | "views_desc" | "views_asc";
type MediaTab = "gen" | "vip" | "vc";

// 媒体タブの定義
const MEDIA_TABS: { key: MediaTab; label: string; color: string; bgColor: string; borderColor: string }[] = [
  { key: "gen", label: "一般会員", color: "text-blue-700", bgColor: "bg-blue-50", borderColor: "border-blue-500" },
  { key: "vip", label: "正会員", color: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-500" },
  { key: "vc", label: "仮想通貨長者", color: "text-purple-700", bgColor: "bg-purple-50", borderColor: "border-purple-500" },
];

type StatsData = {
  todayViews: number;
  todayClicks: number;
  last7DaysViews: number;
  last7DaysClicks: number;
  viewsByPost: Record<number, number>;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>("newest");
  const [writers, setWriters] = useState<Writer[]>([]);
  const [filterWriterId, setFilterWriterId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<MediaTab>("gen");
  const [stats, setStats] = useState<StatsData>({
    todayViews: 0, todayClicks: 0, last7DaysViews: 0, last7DaysClicks: 0, viewsByPost: {},
  });

  useEffect(() => {
    checkAuth();
    fetchWriters();
  }, []);

  useEffect(() => { fetchPosts(); }, [sort]);

  // 媒体タブ切り替え時に統計を取得
  const fetchStats = useCallback(async (media: MediaTab) => {
    try {
      const res = await fetch(`/api/analytics?media=${media}`);
      if (res.ok) {
        const data = await res.json();
        setStats({
          todayViews: data.todayViews || 0,
          todayClicks: data.todayClicks || 0,
          last7DaysViews: data.last7DaysViews || 0,
          last7DaysClicks: data.last7DaysClicks || 0,
          viewsByPost: data.viewsByPost || {},
        });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStats(activeTab);
  }, [activeTab, fetchStats]);

  const fetchWriters = async () => {
    try {
      const res = await fetch("/api/writers");
      if (res.ok) { const data = await res.json(); setWriters(data); }
    } catch { /* ignore */ }
  };

  const checkAuth = async () => {
    const res = await fetch("/api/auth/me");
    if (!res.ok) router.push("/admin/login");
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/posts?all=true&limit=100&sort=${sort}`);
      const data = await res.json();
      setPosts(data.posts || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("この記事を削除しますか？")) return;
    setDeleting(id);
    try {
      await fetch(`/api/posts/${id}`, { method: "DELETE" });
      setPosts(posts.filter((p) => p.id !== id));
    } catch { alert("削除に失敗しました"); }
    finally { setDeleting(null); }
  };

  const togglePublish = async (post: Post) => {
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...post, published: !post.published }),
      });
      if (res.ok) {
        setPosts(posts.map((p) => p.id === post.id ? { ...p, published: !p.published } : p));
      }
    } catch { alert("更新に失敗しました"); }
  };

  const togglePickup = async (post: Post) => {
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...post, isPickup: !post.isPickup }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPosts(posts.map((p) => p.id === post.id ? { ...p, isPickup: updated.isPickup ?? !p.isPickup } : p));
      }
    } catch { alert("更新に失敗しました"); }
  };

  const handleLogout = () => {
    document.cookie = "auth_token=; path=/; max-age=0";
    router.push("/admin/login");
  };

  // 現在の媒体タブでフィルターされた記事
  const filteredPosts = posts
    .filter((p) => (filterWriterId ? p.writer?.id === filterWriterId : true))
    .filter((p) => {
      if (activeTab === "gen") return p.showForGen !== false;
      if (activeTab === "vip") return p.showForVip !== false;
      if (activeTab === "vc") return p.showForVC === true;
      return true;
    })
    .sort((a, b) => {
      // 閲覧数ソートの場合は媒体別の閲覧数で並べ替え
      if (sort === "views_desc" && Object.keys(stats.viewsByPost).length > 0) {
        return (stats.viewsByPost[b.id] || 0) - (stats.viewsByPost[a.id] || 0);
      }
      if (sort === "views_asc" && Object.keys(stats.viewsByPost).length > 0) {
        return (stats.viewsByPost[a.id] || 0) - (stats.viewsByPost[b.id] || 0);
      }
      // 日付ソートの場合は scheduledAt ?? createdAt で並べ替え
      if (sort === "newest" || sort === "oldest") {
        const dateA = new Date(a.scheduledAt ?? a.createdAt).getTime();
        const dateB = new Date(b.scheduledAt ?? b.createdAt).getTime();
        return sort === "newest" ? dateB - dateA : dateA - dateB;
      }
      return 0;
    });

  // 媒体別の閲覧数を使って合計を算出（viewsByPostがある場合はそちらを優先）
  const getPostViews = (postId: number) => {
    if (Object.keys(stats.viewsByPost).length > 0) {
      return stats.viewsByPost[postId] || 0;
    }
    return 0;
  };
  const totalViews = Object.keys(stats.viewsByPost).length > 0
    ? filteredPosts.reduce((s, p) => s + getPostViews(p.id), 0)
    : filteredPosts.reduce((s, p) => s + p.views, 0);

  const memberLabel = (p: Post) => {
    const g = p.showForGen !== false;
    const f = p.showForVip !== false;
    const vc = p.showForVC === true;
    const parts: string[] = [];
    if (g) parts.push("一般");
    if (f) parts.push("正");
    if (vc) parts.push("VC");
    return parts.length > 0 ? parts.join("・") : "—";
  };

  const currentTabInfo = MEDIA_TABS.find((t) => t.key === activeTab)!;
  // 媒体タブに応じた記事ページのベースパス
  const mediaBasePath = `/${activeTab}`;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-500">管理画面</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/analytics" className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="解析"><FiBarChart2 size={18} /></Link>
            <Link href="/admin/custom-editors" className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="編集の追加"><FiSettings size={18} /></Link>
            <Link href="/admin/banners" className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="バナー管理"><FiImage size={18} /></Link>
            <Link href="/admin/writers" className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="執筆者管理"><FiUsers size={18} /></Link>
            <Link href="/" target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="サイト表示（別タブ）"><FiHome size={18} /></Link>
            <Link href="/admin/settings" className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="設定"><FiShield size={18} /></Link>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="ログアウト"><FiLogOut size={18} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* 媒体タブ */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg border border-slate-200 p-1">
          {MEDIA_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-2.5 rounded-md text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? `${tab.bgColor} ${tab.color} shadow-sm`
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 統計カード（当日/7日間の閲覧数・クリック数） */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className={`bg-white rounded-lg border-l-4 ${currentTabInfo.borderColor} border border-slate-200 p-4`}>
            <p className="text-xs text-slate-400 font-medium">当日の閲覧数</p>
            <p className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
              <FiEye size={18} className="text-slate-300" />
              {stats.todayViews.toLocaleString()}
            </p>
          </div>
          <div className={`bg-white rounded-lg border-l-4 ${currentTabInfo.borderColor} border border-slate-200 p-4`}>
            <p className="text-xs text-slate-400 font-medium">当日のクリック数</p>
            <p className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
              <FiMousePointer size={18} className="text-slate-300" />
              {stats.todayClicks.toLocaleString()}
            </p>
          </div>
          <div className={`bg-white rounded-lg border-l-4 ${currentTabInfo.borderColor} border border-slate-200 p-4`}>
            <p className="text-xs text-slate-400 font-medium">直近7日間の閲覧数</p>
            <p className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
              <FiEye size={18} className="text-slate-300" />
              {stats.last7DaysViews.toLocaleString()}
            </p>
          </div>
          <div className={`bg-white rounded-lg border-l-4 ${currentTabInfo.borderColor} border border-slate-200 p-4`}>
            <p className="text-xs text-slate-400 font-medium">直近7日間のクリック数</p>
            <p className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
              <FiMousePointer size={18} className="text-slate-300" />
              {stats.last7DaysClicks.toLocaleString()}
            </p>
          </div>
        </div>

        {/* ツールバー */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-slate-900">記事管理</h1>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 focus:outline-none focus:border-blue-400"
            >
              <option value="newest">新しい順</option>
              <option value="oldest">古い順</option>
              <option value="views_desc">閲覧数 多い順</option>
              <option value="views_asc">閲覧数 少ない順</option>
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
          <Link href="/admin/posts/new"
            className="bg-black hover:bg-black/80 text-white font-semibold px-5 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm">
            <FiPlus size={16} /> 新規記事
          </Link>
        </div>

        {/* 記事一覧 */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">読み込み中...</div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-400 text-lg mb-4">この媒体に該当する記事がありません</p>
            <Link href="/admin/posts/new" className="inline-flex items-center gap-2 bg-black text-white px-5 py-2 rounded-lg text-sm">
              <FiPlus size={16} /> 新規記事を作成
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            {/* デスクトップテーブル */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">タイトル</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">執筆者</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">会員</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ステータス</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">人気</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">閲覧数</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">日付</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPosts.map((post) => (
                    <tr key={post.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link href={`${mediaBasePath}/${post.slug}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-900 text-sm hover:text-blue-600 hover:underline">
                          {post.title}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">
                        {post.writer?.name || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600">
                        {memberLabel(post)}
                      </td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => togglePublish(post)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            post.published
                              ? "bg-green-50 text-green-700 hover:bg-green-100"
                              : post.scheduledAt
                              ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}>
                          {post.published ? <><FiEye size={11} /> 公開中</> : post.scheduledAt ? <><FiClock size={11} /> 予約</> : <><FiEyeOff size={11} /> 下書き</>}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer" title={post.isPickup ? "人気記事を解除" : "人気記事に設定"}>
                          <input
                            type="checkbox"
                            checked={post.isPickup}
                            onChange={() => togglePickup(post)}
                            className="rounded border-slate-300 text-amber-500 focus:ring-amber-400 w-4 h-4"
                          />
                        </label>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 text-sm text-slate-500">
                          <FiTrendingUp size={13} />
                          {getPostViews(post.id).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-400">
                        {formatDate(getDisplayDate(post))}
                        {post.scheduledAt && !post.published && (
                          <span className="block text-xs text-amber-500">
                            予約: {new Date(post.scheduledAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/admin/analytics?postId=${post.id}`} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg transition-colors" title="解析"><FiBarChart2 size={15} /></Link>
                          <Link href={`/admin/posts/${post.id}/edit`} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg transition-colors" title="編集"><FiEdit2 size={15} /></Link>
                          <button onClick={() => handleDelete(post.id)} disabled={deleting === post.id}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors disabled:opacity-50" title="削除"><FiTrash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* モバイル */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredPosts.map((post) => (
                <div key={post.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <Link href={`${mediaBasePath}/${post.slug}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-900 text-sm truncate block hover:text-blue-600 hover:underline">
                        {post.title}
                      </Link>
                      {post.writer && (
                        <span className="text-xs text-slate-400 mt-1 block">{post.writer.name}</span>
                      )}
                      <span className="text-[11px] text-slate-500 mt-0.5 block">会員: {memberLabel(post)}</span>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <button onClick={() => togglePublish(post)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            post.published ? "bg-green-50 text-green-700" : post.scheduledAt ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
                          }`}>
                          {post.published ? "公開" : post.scheduledAt ? "予約" : "下書き"}
                        </button>
                        <label className="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={post.isPickup}
                            onChange={() => togglePickup(post)}
                            className="rounded border-slate-300 text-amber-500 focus:ring-amber-400 w-3.5 h-3.5"
                          />
                          <span className="text-xs text-slate-600">人気</span>
                        </label>
                        <span className="text-xs text-slate-400 flex items-center gap-1"><FiTrendingUp size={11} />{getPostViews(post.id).toLocaleString()}</span>
                        <span className="text-xs text-slate-400">{formatDate(getDisplayDate(post))}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link href={`/admin/analytics?postId=${post.id}`} className="p-1.5 text-slate-400 hover:text-blue-600"><FiBarChart2 size={15} /></Link>
                      <Link href={`/admin/posts/${post.id}/edit`} className="p-1.5 text-slate-400 hover:text-blue-600"><FiEdit2 size={15} /></Link>
                      <button onClick={() => handleDelete(post.id)} disabled={deleting === post.id}
                        className="p-1.5 text-slate-400 hover:text-red-500 disabled:opacity-50"><FiTrash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
