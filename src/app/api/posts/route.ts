import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { generateSlug } from "@/lib/utils";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "12");
  const all = searchParams.get("all") === "true";
  const sort = searchParams.get("sort") || "newest";
  const pickup = searchParams.get("pickup") === "true";
  const forMember = searchParams.get("for") as string | null; // "general" | "full"
  const q = searchParams.get("q")?.trim() || "";

  // 予約投稿の自動公開チェック
  const now = new Date();
  await prisma.post.updateMany({
    where: { published: false, scheduledAt: { lte: now, not: null } },
    data: { published: true },
  });

  const where: Prisma.PostWhereInput = all ? {} : { published: true };
  if (pickup) (where as Prisma.PostWhereInput).isPickup = true;
  if (forMember === "general") (where as Prisma.PostWhereInput).showForGeneral = true;
  if (forMember === "full") (where as Prisma.PostWhereInput).showForFull = true;
  if (q) {
    (where as Prisma.PostWhereInput).OR = [
      { title: { contains: q, mode: "insensitive" } },
      { excerpt: { contains: q, mode: "insensitive" } },
      { content: { contains: q, mode: "insensitive" } },
    ];
  }
  const skip = (page - 1) * limit;

  let orderBy: Prisma.PostOrderByWithRelationInput;
  switch (sort) {
    case "oldest": orderBy = { createdAt: "asc" }; break;
    case "views_desc": orderBy = { views: "desc" }; break;
    case "views_asc": orderBy = { views: "asc" }; break;
    default: orderBy = { createdAt: "desc" };
  }

  const selectWithPickup = {
    id: true,
    title: true,
    slug: true,
    excerpt: true,
    eyecatch: true,
    published: true,
    isPickup: true,
    showForGeneral: true,
    showForFull: true,
    views: true,
    scheduledAt: true,
    createdAt: true,
    writer: { select: { id: true, name: true, avatarUrl: true } },
  };

  const selectWithoutPickup = {
    id: true,
    title: true,
    slug: true,
    excerpt: true,
    eyecatch: true,
    published: true,
    views: true,
    scheduledAt: true,
    createdAt: true,
    writer: { select: { id: true, name: true, avatarUrl: true } },
  };

  try {
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: selectWithPickup,
      }),
      prisma.post.count({ where }),
    ]);
    return NextResponse.json({
      posts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch {
    // isPickup / showForGeneral / showForFull カラムがまだない場合はフィルタなしで再取得
    const whereFallback: Prisma.PostWhereInput = all ? {} : { published: true };
    if (q) {
      whereFallback.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { excerpt: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
      ];
    }
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: whereFallback,
        orderBy,
        skip,
        take: limit,
        select: selectWithoutPickup,
      }),
      prisma.post.count({ where: whereFallback }),
    ]);
    const postsWithPickup = posts.map((p) => ({ ...p, isPickup: false, showForGeneral: true, showForFull: true }));
    return NextResponse.json({
      posts: postsWithPickup,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });

  try {
    const body = await request.json();
    const { title, content, excerpt, eyecatch, published, scheduledAt, writerId, isPickup, showForGeneral, showForFull } = body;

    const slug = generateSlug();
    const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();

    const post = await prisma.post.create({
      data: {
        title,
        slug,
        content,
        excerpt: excerpt || content.replace(/<[^>]*>/g, "").slice(0, 200),
        eyecatch: eyecatch || null,
        published: isScheduled ? false : (published ?? false),
        isPickup: isPickup === true,
        showForGeneral: showForGeneral !== false,
        showForFull: showForFull !== false,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        writerId: writerId ? parseInt(writerId) : null,
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch {
    return NextResponse.json({ error: "記事の作成に失敗しました" }, { status: 500 });
  }
}
