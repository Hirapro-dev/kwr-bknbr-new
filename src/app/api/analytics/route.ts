import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// POST: 閲覧数を記録（フロント側から呼び出し）
// body: { postId, source?: "public" | "general" | "full" }
export async function POST(request: NextRequest) {
  try {
    const { postId, source } = await request.json();
    if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });
    const validSource = source === "general" || source === "full" ? source : "public";

    await prisma.$transaction([
      prisma.pageView.create({ data: { postId, source: validSource } }),
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
  const viewSource = searchParams.get("viewSource") || "all"; // all, public, general, full

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
          : viewSource === "general" || viewSource === "full"
            ? { source: viewSource }
            : {}),
      };

      const views = await prisma.pageView.findMany({
        where: viewWhere,
        orderBy: { createdAt: "asc" },
      });

      const clicks = await prisma.click.findMany({
        where: {
          postId: id,
          ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
        },
        orderBy: { createdAt: "desc" },
      });

      // グループ化（日付キー → 件数）
      const viewsByDateRaw: Record<string, number> = {};
      views.forEach((v) => {
        const key = groupBy === "month"
          ? v.createdAt.toISOString().slice(0, 7)
          : v.createdAt.toISOString().slice(0, 10);
        viewsByDateRaw[key] = (viewsByDateRaw[key] || 0) + 1;
      });

      // 日別・月別は全期間を0埋めして返す（グラフで棒が正しく並ぶように）
      const viewsByDate: Record<string, number> = {};
      if (period === "daily" && dateFilter) {
        const start = new Date(dateFilter);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const key = d.toISOString().slice(0, 10);
          viewsByDate[key] = viewsByDateRaw[key] ?? 0;
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
          }
        }
      } else {
        Object.assign(viewsByDate, viewsByDateRaw);
      }

      const clicksByUrl: Record<string, { count: number; label: string | null }> = {};
      clicks.forEach((c) => {
        if (!clicksByUrl[c.url]) clicksByUrl[c.url] = { count: 0, label: c.label };
        clicksByUrl[c.url].count++;
      });

      return NextResponse.json({ post, viewsByDate, clicksByUrl, totalClicks: clicks.length });
    }

    // 全体サマリー
    const posts = await prisma.post.findMany({
      select: { id: true, title: true, views: true, published: true, createdAt: true, scheduledAt: true, showForGeneral: true, showForFull: true, writer: { select: { id: true, name: true } } },
      orderBy: { views: "desc" },
    });

    const totalViews = posts.reduce((sum, p) => sum + p.views, 0);
    const totalClicks = await prisma.click.count();

    return NextResponse.json({ posts, totalViews, totalClicks });
  } catch {
    return NextResponse.json({ error: "解析データの取得に失敗しました" }, { status: 500 });
  }
}
