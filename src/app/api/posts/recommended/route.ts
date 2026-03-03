import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** HTMLタグを除去し、比較用テキストを先頭N文字に切り詰める */
function toComparableText(excerpt: string | null, content: string, maxLen = 1200): string {
  const raw = (excerpt || content).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return raw.slice(0, maxLen);
}

/** 2文字バイグラムの一致率で類似度（0〜1）を計算（記事本文向け） */
function similarityScore(textA: string, textB: string): number {
  if (!textA.trim() || !textB.trim()) return 0;
  const toNgrams = (s: string): Set<string> => {
    const set = new Set<string>();
    const t = s.replace(/\s+/g, "");
    for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
    if (t.length === 1) set.add(t);
    return set;
  };
  const a = toNgrams(textA);
  const b = toNgrams(textB);
  let match = 0;
  a.forEach((ng) => {
    if (b.has(ng)) match++;
  });
  return a.size > 0 ? match / a.size : 0;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const limit = Math.min(10, Math.max(1, parseInt(searchParams.get("limit") || "3")));

  // slug なし＝トップ用：閲覧数順で指定件数返す
  if (!slug) {
    const posts = await prisma.post.findMany({
      where: { published: true },
      orderBy: { views: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        eyecatch: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ posts });
  }

  const current = await prisma.post.findUnique({
    where: { slug, published: true },
    select: { id: true, excerpt: true, content: true },
  });
  if (!current) {
    return NextResponse.json({ posts: [] });
  }

  const currentText = toComparableText(current.excerpt, current.content);

  const candidates = await prisma.post.findMany({
    where: { published: true, id: { not: current.id } },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      eyecatch: true,
      createdAt: true,
      content: true,
    },
  });

  const withScore = candidates.map((p) => {
    const text = toComparableText(p.excerpt, p.content);
    const { content: _c, ...rest } = p;
    return { ...rest, score: similarityScore(currentText, text) };
  });
  withScore.sort((a, b) => b.score - a.score);

  const top = withScore.slice(0, limit).map(({ score: _s, ...p }) => p);
  return NextResponse.json({ posts: top });
}
