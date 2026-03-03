import Link from "next/link";
import Image from "next/image";
import { formatDate } from "@/lib/utils";

type PostCardProps = {
  post: {
    slug: string;
    title: string;
    excerpt?: string | null;
    eyecatch?: string | null;
    createdAt: string | Date;
    writer?: { name: string; avatarUrl: string | null } | null;
  };
  variant?: "list" | "grid" | "pickup";
  /** 指定時は記事リンクを /posts/slug ではなく basePath/slug にする（例: /v, /g） */
  basePath?: string;
};

export default function PostCard({ post, variant = "grid", basePath }: PostCardProps) {
  const href = basePath ? `${basePath}/${post.slug}` : `/posts/${post.slug}`;
  if (variant === "pickup") {
    return (
      <Link href={href} className="group block">
        <article className="relative aspect-[16/10] rounded-lg overflow-hidden bg-black/20 shadow-md">
          {post.eyecatch ? (
            <Image
              src={post.eyecatch}
              alt={post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-200">
              <span className="font-black text-4xl text-black/20">iPS</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-white leading-snug line-clamp-2 drop-shadow-sm group-hover:opacity-90">
              {post.title}
            </h2>
            <div className="flex items-center gap-2 mt-3">
              {post.writer?.avatarUrl ? (
                <Image src={post.writer.avatarUrl} alt={post.writer.name} width={28} height={28} className="rounded-full object-cover" />
              ) : post.writer ? (
                <div className="w-7 h-7 rounded-full bg-white/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{post.writer.name.charAt(0)}</span>
                </div>
              ) : null}
              {post.writer && <span className="text-sm text-white/80">{post.writer.name}</span>}
              <time className="text-sm text-white/90">{formatDate(post.createdAt)}</time>
            </div>
          </div>
        </article>
      </Link>
    );
  }

  if (variant === "list") {
    // Desktop: 横並びリスト型（LIG PC版風）
    return (
      <Link href={href} className="group block">
        <article className="flex gap-6 py-8 border-b border-black/10">
          <div className="w-[360px] shrink-0 aspect-[16/10] relative rounded-sm overflow-hidden bg-black/5">
            {post.eyecatch ? (
              <Image
                src={post.eyecatch}
                alt={post.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="360px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-black/5">
                <span className="font-black text-3xl text-black/20">iPS</span>
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center flex-1 min-w-0">
            <h2 className="text-xl font-bold text-black leading-snug line-clamp-2 group-hover:opacity-60 transition-opacity">
              {post.title}
            </h2>
            <time className="mt-3 text-sm text-black/40 block">
              {formatDate(post.createdAt)}
            </time>
            {post.writer && (
              <div className="flex items-center gap-2 mt-2">
                {post.writer.avatarUrl ? (
                  <Image src={post.writer.avatarUrl} alt={post.writer.name} width={29} height={29} className="rounded-full object-cover" />
                ) : (
                  <div className="w-[29px] h-[29px] rounded-full bg-slate-100 flex items-center justify-center">
                    <span className="text-[11px] font-bold text-slate-400">{post.writer.name.charAt(0)}</span>
                  </div>
                )}
                <span className="text-sm text-black/50">{post.writer.name}</span>
              </div>
            )}
          </div>
        </article>
      </Link>
    );
  }

  // Mobile: グリッドカード型（LIG SP版風）
  return (
    <Link href={href} className="group block">
      <article>
        <div className="aspect-[16/10] relative rounded-sm overflow-hidden bg-black/5">
          {post.eyecatch ? (
            <Image
              src={post.eyecatch}
              alt={post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 768px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-black/5">
              <span className="font-black text-2xl text-black/20">iPS</span>
            </div>
          )}
        </div>
        <div className="mt-3">
          <h2 className="text-sm font-bold text-black leading-snug line-clamp-3 group-hover:opacity-60 transition-opacity">
            {post.title}
          </h2>
          <time className="mt-2 text-xs text-black/40 block">
            {formatDate(post.createdAt)}
          </time>
          {post.writer && (
            <div className="flex items-center gap-1.5 mt-1.5">
              {post.writer.avatarUrl ? (
                <Image src={post.writer.avatarUrl} alt={post.writer.name} width={24} height={24} className="rounded-full object-cover" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-slate-400">{post.writer.name.charAt(0)}</span>
                </div>
              )}
              <span className="text-xs text-black/50">{post.writer.name}</span>
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
