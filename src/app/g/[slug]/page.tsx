import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostCard from "@/components/PostCard";
import ClickTracker from "@/components/ClickTracker";
import { formatDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { FiArrowLeft, FiCalendar } from "react-icons/fi";

type Writer = {
  id: number;
  name: string;
  avatarUrl: string | null;
};

type Post = {
  id: number;
  slug: string;
  title: string;
  content: string;
  excerpt: string | null;
  eyecatch: string | null;
  published: boolean;
  createdAt: Date;
  showForGeneral?: boolean;
  writer?: Writer | null;
};

async function getPost(slug: string): Promise<(Post & { showForGeneral?: boolean }) | null> {
  try {
    return await prisma.post.findUnique({
      where: { slug },
      include: { writer: true },
    }) as (Post & { showForGeneral?: boolean }) | null;
  } catch {
    const row = await prisma.post.findUnique({
      where: { slug },
      select: {
        id: true, title: true, slug: true, content: true, excerpt: true,
        eyecatch: true, published: true, createdAt: true, writerId: true,
        writer: true, showForGeneral: true,
      },
    });
    return row as (Post & { showForGeneral?: boolean }) | null;
  }
}

function toComparableText(excerpt: string | null, content: string, maxLen = 1200): string {
  const raw = (excerpt || content).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return raw.slice(0, maxLen);
}

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
  a.forEach((ng) => { if (b.has(ng)) match++; });
  return a.size > 0 ? match / a.size : 0;
}

async function getRecommendedPosts(slug: string): Promise<Omit<Post, "content">[]> {
  const current = await prisma.post.findUnique({
    where: { slug, published: true, showForGeneral: true },
    select: { id: true, excerpt: true, content: true },
  });
  if (!current) return [];

  const currentText = toComparableText(current.excerpt, current.content);
  const candidates = await prisma.post.findMany({
    where: { published: true, showForGeneral: true, id: { not: current.id } } as Prisma.PostWhereInput,
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true, title: true, slug: true, excerpt: true,
      eyecatch: true, published: true, createdAt: true, content: true,
    },
  });

  const withScore = candidates.map((p) => {
    const text = toComparableText(p.excerpt, p.content);
    const { content: _c, ...rest } = p;
    return { ...rest, score: similarityScore(currentText, text) };
  });
  withScore.sort((a, b) => b.score - a.score);
  return withScore.slice(0, 3).map(({ score: _s, ...p }) => p);
}

export default async function GPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const post = await getPost(slug);

  if (!post || !post.published) notFound();
  if (post.showForGeneral === false) notFound();

  const recommendedPosts = await getRecommendedPosts(post.slug);
  const isHtml = post.content.includes("<") && post.content.includes(">");

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header homeHref="/g" />
      <ClickTracker postId={post.id} source="general" />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-10 w-full">

        <article className="article-detail">
          {post.eyecatch && (
            <div className="aspect-[16/9] relative rounded-sm overflow-hidden mb-8">
              <Image
                src={post.eyecatch}
                alt={post.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 720px"
              />
            </div>
          )}

          <h1 className="text-black mb-2 leading-tight">
            {post.title}
          </h1>

          <div className="flex items-center gap-2 text-sm text-black/40 mb-4">
            <FiCalendar size={14} />
            <time>{formatDate(post.createdAt)}</time>
          </div>

          <hr className="border-0 border-t border-solid my-6" style={{ borderColor: "#eee" }} />

          {post.writer?.avatarUrl && (
            <div className="mb-8">
              <Image
                src={post.writer.avatarUrl}
                alt={post.writer.name}
                width={230}
                height={230}
                className="object-contain w-[150px] md:w-[230px] h-auto"
              />
            </div>
          )}

          <div className="prose max-w-none" data-article-content>
            {isHtml ? (
              <div dangerouslySetInnerHTML={{ __html: post.content }} />
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {post.content}
              </ReactMarkdown>
            )}
          </div>
        </article>

        {recommendedPosts.length > 0 && (
          <section className="mt-16 pt-10 border-t border-black/10">
            <h2 className="text-xl font-black text-black mb-6">あなたにおすすめの記事</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {recommendedPosts.map((p) => (
                <PostCard key={p.id} post={p} variant="grid" basePath="/g" />
              ))}
            </div>
          </section>
        )}

        <Link
          href="/g"
          className="inline-flex items-center gap-1 text-sm text-black/40 hover:text-black transition-colors mb-4"
        >
          <FiArrowLeft size={14} />
          記事一覧に戻る
        </Link>
      </main>

      <Footer />
    </div>
  );
}
