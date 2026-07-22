import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { CHANNELS, normalizeChannel, type ChannelBucket } from "@/lib/tracking";
import type { Prisma } from "@prisma/client";

// POST: 閲覧数を記録（フロント側から呼び出し）
// body: { postId, source?: "public" | "gen" | "vip" | "vc" | "wel", channel?: "mail" | "line" }
export async function POST(request: NextRequest) {
  try {
    const { postId, source, channel } = await request.json();
    if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });
    const validSource = source === "gen" || source === "vip" || source === "vc" || source === "wel" ? source : "public";
    // 配信チャネル（mail / line）。不正値・未指定は null（＝直接・不明）
    const validChannel = normalizeChannel(channel);

    await prisma.$transaction([
      prisma.pageView.create({ data: { postId, source: validSource, channel: validChannel } }),
      prisma.post.update({ where: { id: postId }, data: { views: { increment: 1 } } }),
    ]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

// GET: 解析データ取得（管理画面用）
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const postId = searchParams.get("postId");
  const period = searchParams.get("period") || "all"; // all, monthly, daily
  const viewSource = searchParams.get("viewSource") || "all"; // all, public, gen, vip, vc, wel
  const viewChannel = searchParams.get("viewChannel") || "all"; // all, mail, line, direct

  /**
   * チャネル絞り込み条件を作る。
   * "direct" は channel が未設定（＝配信URL経由でない）のレコードを指す。
   */
  const channelWhere = (value: string) =>
    value === "direct"
      ? { channel: null }
      : normalizeChannel(value)
        ? { channel: value }
        : {};

  type ChannelTally = Record<ChannelBucket, number>;
  type ChannelStats = { views: ChannelTally; clicks: ChannelTally };
  type SourceChannelRow = { source: string | null; channel: string | null; _count: { id: number } };

  const emptyTally = (): ChannelTally => ({ mail: 0, line: 0, direct: 0 });
  /** channel 値を集計キー（mail / line / direct）に寄せる */
  const bucketOf = (channel: string | null): ChannelBucket =>
    CHANNELS.includes(channel as (typeof CHANNELS)[number]) ? (channel as ChannelBucket) : "direct";
  /** source 値を集計キーに寄せる（null や "public" は「その他・直接」にまとめる） */
  const mediaKeyOf = (source: string | null) =>
    source === "gen" || source === "vip" || source === "vc" || source === "wel" ? source : "public";

  /**
   * groupBy(["source","channel"]) の結果を
   * { 媒体: { views: {mail,line,direct}, clicks: {...} } } のクロス集計に変換する。
   * 全体サマリーと記事単位の両方で使う。
   */
  const buildChannelMatrix = (
    viewRows: SourceChannelRow[],
    clickRows: SourceChannelRow[]
  ): Record<string, ChannelStats> => {
    const matrix: Record<string, ChannelStats> = {};
    const fill = (rows: SourceChannelRow[], kind: "views" | "clicks") => {
      rows.forEach((r) => {
        const key = mediaKeyOf(r.source);
        matrix[key] ??= { views: emptyTally(), clicks: emptyTally() };
        matrix[key][kind][bucketOf(r.channel)] += r._count.id;
      });
    };
    fill(viewRows, "views");
    fill(clickRows, "clicks");
    return matrix;
  };

  try {
    if (postId) {
      const id = parseInt(postId);
      const post = await prisma.post.findUnique({
        where: { id },
        select: { id: true, title: true, views: true },
      });

      let groupBy: "day" | "month" = "day";
      let dateFilter: Date | undefined;
      const now = new Date();

      if (period === "daily") {
        dateFilter = new Date(now);
        dateFilter.setDate(dateFilter.getDate() - 30);
      } else if (period === "monthly") {
        dateFilter = new Date(now);
        dateFilter.setMonth(dateFilter.getMonth() - 12);
        groupBy = "month";
      }

      const viewWhere = {
        postId: id,
        ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
        ...(viewSource === "public"
          ? { OR: [{ source: "public" }, { source: null }] }
          : viewSource === "gen" || viewSource === "vip" || viewSource === "vc" || viewSource === "wel"
            ? { source: viewSource }
            : {}),
        ...channelWhere(viewChannel),
      };

      const clickWhere = {
        postId: id,
        ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
        ...channelWhere(viewChannel),
      };

      const views = await prisma.pageView.findMany({
        where: viewWhere,
        orderBy: { createdAt: "asc" },
      });

      const clicks = await prisma.click.findMany({
        where: clickWhere,
        orderBy: { createdAt: "desc" },
      });

      // この記事の 媒体 × チャネル クロス集計（絞り込みの影響を受けない全期間の実数）
      const [viewMatrixRows, clickMatrixRows] = await Promise.all([
        prisma.pageView.groupBy({ by: ["source", "channel"], where: { postId: id }, _count: { id: true } }),
        prisma.click.groupBy({ by: ["source", "channel"], where: { postId: id }, _count: { id: true } }),
      ]);
      const channelMatrix = buildChannelMatrix(viewMatrixRows, clickMatrixRows);

      // グループ化（日付キー → 件数）
      const viewsByDateRaw: Record<string, number> = {};
      views.forEach((v) => {
        const key = groupBy === "month"
          ? v.createdAt.toISOString().slice(0, 7)
          : v.createdAt.toISOString().slice(0, 10);
        viewsByDateRaw[key] = (viewsByDateRaw[key] || 0) + 1;
      });

      // クリック数も同様に日付別にグループ化
      const clicksByDateRaw: Record<string, number> = {};
      clicks.forEach((c) => {
        const key = groupBy === "month"
          ? c.createdAt.toISOString().slice(0, 7)
          : c.createdAt.toISOString().slice(0, 10);
        clicksByDateRaw[key] = (clicksByDateRaw[key] || 0) + 1;
      });

      // 日別・月別は全期間を0埋めして返す（グラフで棒が正しく並ぶように）
      const viewsByDate: Record<string, number> = {};
      const clicksByDate: Record<string, number> = {};
      if (period === "daily" && dateFilter) {
        const start = new Date(dateFilter);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const key = d.toISOString().slice(0, 10);
          viewsByDate[key] = viewsByDateRaw[key] ?? 0;
          clicksByDate[key] = clicksByDateRaw[key] ?? 0;
        }
      } else if (period === "monthly" && dateFilter) {
        const startYear = dateFilter.getFullYear();
        const startMonth = dateFilter.getMonth();
        const endYear = now.getFullYear();
        const endMonth = now.getMonth();
        for (let y = startYear; y <= endYear; y++) {
          const mStart = y === startYear ? startMonth : 0;
          const mEnd = y === endYear ? endMonth : 11;
          for (let m = mStart; m <= mEnd; m++) {
            const key = `${y}-${String(m + 1).padStart(2, "0")}`;
            viewsByDate[key] = viewsByDateRaw[key] ?? 0;
            clicksByDate[key] = clicksByDateRaw[key] ?? 0;
          }
        }
      } else {
        Object.assign(viewsByDate, viewsByDateRaw);
        Object.assign(clicksByDate, clicksByDateRaw);
      }

      // URL別に集計（初回・最終クリック日時も保持）
      // 配信ごとに付与されるトラッキングパラメータ（?_stp=... 等）で集計が分散するため、
      // クエリ文字列とハッシュを除いたURLをキーにまとめる
      const normalizeUrl = (raw: string) => {
        try {
          const u = new URL(raw);
          return u.origin + u.pathname;
        } catch {
          return raw.split(/[?#]/)[0];
        }
      };
      const clicksByUrl: Record<string, { count: number; label: string | null; firstClickedAt: string; lastClickedAt: string }> = {};
      clicks.forEach((c) => {
        const at = c.createdAt.toISOString();
        const key = normalizeUrl(c.url);
        const entry = clicksByUrl[key];
        if (!entry) {
          clicksByUrl[key] = { count: 1, label: c.label, firstClickedAt: at, lastClickedAt: at };
          return;
        }
        entry.count++;
        if (at > entry.lastClickedAt) entry.lastClickedAt = at;
        if (at < entry.firstClickedAt) entry.firstClickedAt = at;
        if (!entry.label && c.label) entry.label = c.label;
      });

      // クリック履歴（新しい順。表示件数を抑えるため直近200件まで）
      const CLICK_LOG_LIMIT = 200;
      const clickLog = clicks.slice(0, CLICK_LOG_LIMIT).map((c) => ({
        url: c.url,
        label: c.label,
        source: c.source,
        channel: c.channel,
        createdAt: c.createdAt.toISOString(),
      }));

      return NextResponse.json({
        post, viewsByDate, clicksByDate, clicksByUrl,
        channelMatrix,
        clickLog,
        clickLogTruncated: clicks.length > CLICK_LOG_LIMIT,
        totalClicks: clicks.length,
        uniqueUrlCount: Object.keys(clicksByUrl).length,
      });
    }

    // ─── 絞り込み条件 ───
    const media = searchParams.get("media") || "all"; // all, gen, vip, vc, wel
    const listPeriod = searchParams.get("listPeriod") || "all"; // all, 7d, 30d, 90d, 12m
    const writerId = searchParams.get("writerId");
    const q = searchParams.get("q")?.trim() || "";

    // 媒体に応じた記事フィルター
    const postFilter: Prisma.PostWhereInput = media === "gen"
      ? { showForGen: true }
      : media === "vip"
        ? { showForVip: true }
        : media === "vc"
          ? { showForVC: true }
          : media === "wel"
            ? { showForWel: true }
            : {};

    // 執筆者で絞り込む
    if (writerId && !Number.isNaN(parseInt(writerId))) postFilter.writerId = parseInt(writerId);
    // タイトルのキーワードで絞り込む（大文字小文字を区別しない）
    if (q) postFilter.title = { contains: q, mode: "insensitive" };

    /** 集計期間の開始日時。"all" なら期間を絞らない */
    const listPeriodStart = (() => {
      if (listPeriod === "all") return null;
      const d = new Date();
      if (listPeriod === "7d") d.setDate(d.getDate() - 7);
      else if (listPeriod === "30d") d.setDate(d.getDate() - 30);
      else if (listPeriod === "90d") d.setDate(d.getDate() - 90);
      else if (listPeriod === "12m") d.setMonth(d.getMonth() - 12);
      else return null;
      d.setHours(0, 0, 0, 0);
      return d;
    })();
    const listDateFilter = listPeriodStart ? { createdAt: { gte: listPeriodStart } } : {};

    const posts = await prisma.post.findMany({
      where: postFilter,
      select: { id: true, title: true, views: true, published: true, createdAt: true, scheduledAt: true, showForGen: true, showForVip: true, showForVC: true, showForWel: true, writer: { select: { id: true, name: true } } },
      orderBy: { views: "desc" },
    });

    // 媒体別の閲覧数・クリック数を集計
    const sourceFilter = media !== "all" ? { source: media } : {};
    const postIds = posts.map((p) => p.id);
    const measureWhere = { postId: { in: postIds }, ...sourceFilter, ...listDateFilter };

    // 記事ごと・媒体ごとのチャネル別内訳をまとめて集計する。
    // 期間で絞り込むため post.views は使わず、PageView / Click の実レコードから数える。
    const channelByPost: Record<number, ChannelStats> = {};
    const viewsByPost: Record<number, number> = {};
    const clicksByPost: Record<number, number> = {};
    let channelMatrix: Record<string, ChannelStats> = {};
    let totalViews = 0;
    let totalClicks = 0;

    if (postIds.length > 0) {
      const [viewPostRows, clickPostRows, viewMediaRows, clickMediaRows] = await Promise.all([
        prisma.pageView.groupBy({ by: ["postId", "channel"], where: measureWhere, _count: { id: true } }),
        prisma.click.groupBy({ by: ["postId", "channel"], where: measureWhere, _count: { id: true } }),
        prisma.pageView.groupBy({ by: ["source", "channel"], where: measureWhere, _count: { id: true } }),
        prisma.click.groupBy({ by: ["source", "channel"], where: measureWhere, _count: { id: true } }),
      ]);

      const fillByPost = (
        rows: { postId: number; channel: string | null; _count: { id: number } }[],
        kind: "views" | "clicks",
        totals: Record<number, number>
      ) => {
        rows.forEach((r) => {
          channelByPost[r.postId] ??= { views: emptyTally(), clicks: emptyTally() };
          channelByPost[r.postId][kind][bucketOf(r.channel)] += r._count.id;
          totals[r.postId] = (totals[r.postId] ?? 0) + r._count.id;
        });
      };
      fillByPost(viewPostRows, "views", viewsByPost);
      fillByPost(clickPostRows, "clicks", clicksByPost);

      channelMatrix = buildChannelMatrix(viewMediaRows, clickMediaRows);
      totalViews = viewMediaRows.reduce((s, r) => s + r._count.id, 0);
      totalClicks = clickMediaRows.reduce((s, r) => s + r._count.id, 0);
    }

    // 当日の統計
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // 直近7日間の統計
    const week7Start = new Date(now);
    week7Start.setDate(week7Start.getDate() - 7);
    week7Start.setHours(0, 0, 0, 0);

    const dateRangeToday = { createdAt: { gte: todayStart } };
    const dateRange7Days = { createdAt: { gte: week7Start } };
    const postIdFilter = postIds.length > 0 ? { postId: { in: postIds } } : { postId: -1 };

    const [todayViews, todayClicks, last7DaysViews, last7DaysClicks] = await Promise.all([
      prisma.pageView.count({ where: { ...postIdFilter, ...sourceFilter, ...dateRangeToday } }),
      prisma.click.count({ where: { ...postIdFilter, ...sourceFilter, ...dateRangeToday } }),
      prisma.pageView.count({ where: { ...postIdFilter, ...sourceFilter, ...dateRange7Days } }),
      prisma.click.count({ where: { ...postIdFilter, ...sourceFilter, ...dateRange7Days } }),
    ]);

    return NextResponse.json({
      posts, postCount: posts.length, totalViews, totalClicks,
      todayViews, todayClicks, last7DaysViews, last7DaysClicks,
      viewsByPost, clicksByPost,
      channelByPost, channelMatrix,
    });
  } catch {
    return NextResponse.json({ error: "解析データの取得に失敗しました" }, { status: 500 });
  }
}
