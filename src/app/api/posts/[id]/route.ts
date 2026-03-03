import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/** isPickup カラムがまだないDB用の select（GET/PUT で共通） */
const selectWithoutPickup = {
  id: true,
  title: true,
  slug: true,
  content: true,
  excerpt: true,
  eyecatch: true,
  published: true,
  scheduledAt: true,
  views: true,
  writerId: true,
  createdAt: true,
  updatedAt: true,
  writer: true,
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = parseInt(id);

  if (isNaN(numId)) {
    try {
      const post = await prisma.post.findUnique({ where: { slug: id }, include: { writer: true } });
      if (!post) return NextResponse.json({ error: "記事が見つかりません" }, { status: 404 });
      return NextResponse.json(post);
  } catch {
    const post = await prisma.post.findUnique({ where: { slug: id }, select: selectWithoutPickup });
      if (!post) return NextResponse.json({ error: "記事が見つかりません" }, { status: 404 });
      return NextResponse.json({ ...post, isPickup: false, showForGeneral: true, showForFull: true });
    }
  }

  try {
    const post = await prisma.post.findUnique({ where: { id: numId }, include: { writer: true } });
    if (!post) return NextResponse.json({ error: "記事が見つかりません" }, { status: 404 });
    return NextResponse.json(post);
  } catch {
    // 旧カラムがない時のフォールバック
    const post = await prisma.post.findUnique({ where: { id: numId }, select: selectWithoutPickup });
    if (!post) return NextResponse.json({ error: "記事が見つかりません" }, { status: 404 });
    return NextResponse.json({ ...post, isPickup: false, showForGeneral: true, showForFull: true });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const { title, content, excerpt, eyecatch, published, scheduledAt, writerId, isPickup, showForGeneral, showForFull } = body;

    const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();

    const data: {
      title?: string;
      content?: string;
      excerpt?: string;
      eyecatch?: string | null;
      published?: boolean;
      isPickup?: boolean;
      showForGeneral?: boolean;
      showForFull?: boolean;
      scheduledAt?: Date | null;
      writerId?: number | null;
    } = {
      eyecatch: eyecatch || undefined,
      published: isScheduled ? false : (published ?? undefined),
      isPickup: isPickup !== undefined ? !!isPickup : undefined,
      showForGeneral: showForGeneral !== undefined ? !!showForGeneral : undefined,
      showForFull: showForFull !== undefined ? !!showForFull : undefined,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      writerId: writerId !== undefined ? (writerId ? parseInt(writerId) : null) : undefined,
    };
    if (title !== undefined) data.title = title;
    if (content !== undefined) {
      data.content = content;
      data.excerpt = excerpt || content.replace(/<[^>]*>/g, "").slice(0, 200);
    } else if (excerpt !== undefined) data.excerpt = excerpt;

    try {
      const post = await prisma.post.update({
        where: { id: parseInt(id) },
        data,
        include: { writer: true },
      });
      return NextResponse.json(post);
    } catch {
      // 旧カラムがない時は該当フィールドを外して再試行
      const { isPickup: _o1, showForGeneral: _o2, showForFull: _o3, ...dataFallback } = data;
      const post = await prisma.post.update({
        where: { id: parseInt(id) },
        data: dataFallback,
        select: selectWithoutPickup,
      });
      return NextResponse.json({
        ...post,
        isPickup: isPickup !== undefined ? !!isPickup : false,
        showForGeneral: showForGeneral !== undefined ? !!showForGeneral : true,
        showForFull: showForFull !== undefined ? !!showForFull : true,
      });
    }
  } catch {
    return NextResponse.json({ error: "記事の更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.post.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "記事の削除に失敗しました" }, { status: 500 });
  }
}
