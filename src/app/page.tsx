import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostCard from "@/components/PostCard";
import Pagination from "@/components/Pagination";
import { formatDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type Post = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  eyecatch: string | null;
  published: boolean;
  views: number;
  createdAt: Date;
  writer?: { name: string; avatarUrl: string | null } | null;
};

type Banner = { id: number; label: string; url: string; imageUrl: string | null; order: number };

const postSelect = {
  id: true, title: true, slug: true, excerpt: true,
  eyecatch: true, published: true, views: true, createdAt: true,
  writer: { select: { name: true, avatarUrl: true } },
} as const;

async function getPosts(page: number, q?: string) {
  const limit = 12;
  const skip = (page - 1) * limit;

  const now = new Date();
  await prisma.post.updateMany({
    where: { published: false, scheduledAt: { lte: now, not: null } },
    data: { published: true },
  });

  const where: { published: boolean; OR?: Array<{ title?: { contains: string; mode: "insensitive" }; excerpt?: { contains: string; mode: "insensitive" }; content?: { contains: string; mode: "insensitive" } }> } = { published: true };
  if (q?.trim()) {
    const k = q.trim();
    where.OR = [
      { title: { contains: k, mode: "insensitive" } },
      { excerpt: { contains: k, mode: "insensitive" } },
      { content: { contains: k, mode: "insensitive" } },
    ];
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: postSelect,
    }),
    prisma.post.count({ where }),
  ]);

  return { posts, total, page, totalPages: Math.ceil(total / limit) };
}

/** トップ用：人気記事（管理画面で PickUp に指定した記事） */
async function getPickupPosts(): Promise<Post[]> {
  try {
    const now = new Date();
    await prisma.post.updateMany({
      where: { published: false, scheduledAt: { lte: now, not: null } },
      data: { published: true },
    });

    return await prisma.post.findMany({
      where: { published: true, isPickup: true } as Prisma.PostWhereInput,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: postSelect,
    });
  } catch {
    // isPickup カラムがまだない（マイグレーション未実行）場合は空で返す
    return [];
  }
}

/** サイドバー用：おすすめ記事5件（閲覧数順） */
async function getRecommendedForTop(): Promise<Post[]> {
  return prisma.post.findMany({
    where: { published: true },
    orderBy: { views: "desc" },
    take: 5,
    select: {
      id: true, title: true, slug: true, excerpt: true,
      eyecatch: true, published: true, views: true, createdAt: true,
    },
  });
}

/** 管理画面で設定されたバナーのみ取得 */
async function getBanners(): Promise<Banner[]> {
  return prisma.banner.findMany({
    orderBy: { order: "asc" },
    select: { id: true, label: true, url: true, imageUrl: true, order: true },
  });
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const q = params.q?.trim() || undefined;

  let data: { posts: Post[]; total: number; page: number; totalPages: number };
  let pickupPosts: Post[];
  let recommended: Post[];
  let banners: Banner[];

  try {
    [data, pickupPosts, recommended, banners] = await Promise.all([
      getPosts(page, q),
      getPickupPosts(),
      getRecommendedForTop(),
      getBanners(),
    ]);
  } catch {
    // DB接続エラー等で落ちないようフォールバック（Vercel等）
    data = { posts: [], total: 0, page: 1, totalPages: 0 };
    pickupPosts = [];
    recommended = [];
    banners = [];
  }

  return (
    <div className="min-h-screen flex flex-col bg-white page-top">
      <Header />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* 検索バー：SP/タブレットは上部、PCはサイドバー先頭 */}
          <div className="lg:hidden pt-6 pb-4 border-b border-black/10">
            <form action="/" method="get" className="relative max-w-2xl">
              <input type="hidden" name="page" value="1" />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </span>
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="どんな記事をお探しですか?"
                className="w-full pl-10 pr-2 py-1.5 bg-black/5 border border-black/10 rounded-lg text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20"
                aria-label="記事を検索"
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-sm font-medium text-black/60 hover:text-black">
                検索
              </button>
            </form>
          </div>

          <div className="lg:flex lg:gap-10">
            {/* メインコンテンツ */}
            <div className="flex-1 min-w-0">
              {/* PickUp 人気記事（検索時は非表示） */}
              {!q && pickupPosts.length > 0 && (
                <section className="pt-8 pb-6 border-b border-black/10">
                  <div className="flex items-baseline gap-3 mb-6">
                    <h2 className="text-2xl md:text-3xl font-black tracking-tight text-black">PickUp</h2>
                    <p className="text-sm text-black/40">人気記事</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {pickupPosts.map((post: Post) => (
                      <PostCard key={post.id} post={post} variant="pickup" />
                    ))}
                  </div>
                </section>
              )}

              {/* Latest 新着記事 / 検索時は「検索：〇〇」 */}
              <section className="pt-8 pb-6">
                <div className="flex items-baseline gap-3 mb-6">
                  {q ? (
                    <>
                      <h2 className="text-2xl md:text-3xl font-black tracking-tight text-black">検索：{q}</h2>
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl md:text-3xl font-black tracking-tight text-black">Latest</h2>
                      <p className="text-sm text-black/40">新着記事</p>
                    </>
                  )}
                </div>

              {data.posts.length > 0 ? (
                <>
                  <div className="hidden md:block">
                    {data.posts.map((post: Post) => (
                      <PostCard key={post.id} post={post} variant="list" />
                    ))}
                  </div>
                  <div className="md:hidden grid grid-cols-2 gap-x-4 gap-y-6 pt-6">
                    {data.posts.map((post: Post) => (
                      <PostCard key={post.id} post={post} variant="grid" />
                    ))}
                  </div>
                  <Pagination currentPage={data.page} totalPages={data.totalPages} />
                </>
              ) : (
                <div className="text-center py-20">
                  <span className="font-black text-5xl text-black/10">iPS</span>
                  <h2 className="text-lg font-bold text-black mt-4">記事はまだありません</h2>
                  <p className="text-black/40 text-sm mt-1">{q ? "検索条件に一致する記事がありません" : "管理画面から記事を投稿してください"}</p>
                </div>
              )}
              </section>
            </div>

            {/* サイドバー: PCは検索を一番上に、おすすめ＋バナー */}
            <aside className="hidden lg:block w-[320px] shrink-0 pt-10">
              <div className="mb-6">
                <form action="/" method="get" className="relative">
                  <input type="hidden" name="page" value="1" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  </span>
                  <input
                    type="search"
                    name="q"
                    defaultValue={q}
                    placeholder="記事を検索"
                    className="w-full pl-10 pr-3 py-2.5 text-sm bg-black/5 border border-black/10 rounded-lg text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20"
                    aria-label="記事を検索"
                  />
                  <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-medium text-black/60 hover:text-black">
                    検索
                  </button>
                </form>
              </div>
              {recommended.length > 0 && (
                <section className="mb-8">
                  <h2 className="text-lg font-black text-black mb-4">あなたにおすすめの記事</h2>
                  <ul className="space-y-4">
                    {recommended.map((post) => (
                      <li key={post.id} className="border-b border-black/5 last:border-0 pb-4 last:pb-0">
                        <Link href={`/posts/${post.slug}`} className="group flex gap-3">
                          <div className="w-28 h-20 shrink-0 rounded-sm overflow-hidden bg-black/5">
                            {post.eyecatch ? (
                              <Image
                                src={post.eyecatch}
                                alt={post.title}
                                width={112}
                                height={80}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="font-black text-lg text-black/20">iPS</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-black leading-snug line-clamp-2 group-hover:opacity-60">{post.title}</p>
                            <time className="text-xs text-black/40 mt-1 block">{formatDate(post.createdAt)}</time>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {banners.length > 0 && (
                <section>
                  <h2 className="text-lg font-black text-black mb-4">バナー</h2>
                  <ul className="space-y-3">
                    {banners.map((b) => (
                      <li key={b.id}>
                        <a href={b.url} target="_blank" rel="noopener noreferrer" className="block border border-black/10 rounded-sm overflow-hidden hover:opacity-90 transition-opacity">
                          {b.imageUrl ? (
                            <div className="aspect-[2/1] relative bg-black/5">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={b.imageUrl} alt={b.label} className="w-full h-full object-cover" />
                            </div>
                          ) : null}
                          <p className={`font-medium text-sm text-black text-center ${b.imageUrl ? "py-2" : "py-3 px-3"} bg-white`}>
                            {b.label}
                          </p>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
