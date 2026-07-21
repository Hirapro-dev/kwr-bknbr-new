import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import ClickTracker from "@/components/ClickTracker";
import PopupLinkHandler from "@/components/PopupLinkHandler";
import { formatDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { FiArrowLeft, FiCalendar } from "react-icons/fi";
import WelHeader from "../_components/WelHeader";
import WelFooter from "../_components/WelFooter";
import WelPostCard from "../_components/WelPostCard";

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
  showForWel?: boolean;
  showDate?: boolean;
  writer?: Writer | null;
  categories?: { category: { name: string } }[];
};

async function getPost(slug: string): Promise<(Post & { showForWel?: boolean; showDate?: boolean }) | null> {
  try {
    return (await prisma.post.findUnique({
      where: { slug },
      include: { writer: true, categories: { select: { category: { select: { name: true } } } } },
    })) as (Post & { showForWel?: boolean; showDate?: boolean }) | null;
  } catch {
    const row = await prisma.post.findUnique({
      where: { slug },
      select: {
        id: true, title: true, slug: true, content: true, excerpt: true,
        eyecatch: true, published: true, createdAt: true, writerId: true,
        writer: true, showForWel: true,
        categories: { select: { category: { select: { name: true } } } },
      },
    });
    return row as (Post & { showForWel?: boolean; showDate?: boolean }) | null;
  }
}

function toComparableText(excerpt: string | null, content: string, maxLen = 500): string {
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

async function getRecommendedPosts(slug: string) {
  const current = await prisma.post.findUnique({
    where: { slug, published: true, showForWel: true },
    select: { id: true, excerpt: true, content: true },
  });
  if (!current) return [];

  const currentText = toComparableText(current.excerpt, current.content);
  const candidates = await prisma.post.findMany({
    where: { published: true, showForWel: true, id: { not: current.id } } as Prisma.PostWhereInput,
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true, title: true, slug: true, excerpt: true,
      eyecatch: true, published: true, createdAt: true, scheduledAt: true, showDate: true,
    },
  });

  const withScore = candidates.map((p) => {
    const text = toComparableText(p.excerpt, "");
    return { ...p, score: similarityScore(currentText, text) };
  });
  withScore.sort((a, b) => b.score - a.score);
  return withScore.slice(0, 3).map(({ score: _s, ...p }) => p);
}

export default async function WelPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const post = await getPost(slug);

  if (!post || !post.published) notFound();
  if (post.showForWel !== true) notFound();

  const recommendedPosts = await getRecommendedPosts(post.slug);
  const isHtml = post.content.includes("<") && post.content.includes(">");
  // 瓦版カテゴリの記事はタイトルを小さめに表示
  const isKawaraban = post.categories?.some((c) => c.category.name === "瓦版") === true;

  return (
    <div className="min-h-screen flex flex-col">
      <WelHeader />
      <ClickTracker postId={post.id} source="wel" />
      <PopupLinkHandler />

      <main className="flex-1 mx-auto px-4 sm:px-6 py-4 w-full">
        <div className="wel-box wel-box--article mx-auto">
        <article className={"article-detail" + (isKawaraban ? " article-detail--kawaraban" : "")}>
          {post.eyecatch && (
            <div className="hidden md:block aspect-video relative overflow-hidden mb-8" style={{ border: "1px solid var(--wel-line)" }}>
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

          <h1 className="wel-article-title text-2xl md:text-3xl mb-2">
            {post.title}
          </h1>

          {post.showDate !== false && (
            <div className="wel-article-meta flex items-center gap-2 text-sm mb-4">
              <FiCalendar size={14} />
              <time>{formatDate(post.createdAt)}</time>
            </div>
          )}

          <hr className="border-0 border-t border-solid my-6" style={{ borderColor: "var(--wel-line)" }} />

          {post.writer?.avatarUrl && (
            <div className="mb-8">
              <Image
                src={post.writer.avatarUrl}
                alt={post.writer.name}
                width={230}
                height={230}
                className="object-contain w-[100px] md:w-[150px] h-auto"
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
          <section className="mt-16 pt-10 wel-border-line border-t">
            <h2 className="wel-section-title text-xl mb-6">あなたにおすすめの記事</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {recommendedPosts.map((p) => (
                <WelPostCard key={p.id} post={p} variant="grid" />
              ))}
            </div>
          </section>
        )}

        <Link href="/wel" className="wel-back-link mt-10">
          <FiArrowLeft size={14} />
          記事一覧に戻る
        </Link>
        </div>
      </main>

      <WelFooter />
    </div>
  );
}
