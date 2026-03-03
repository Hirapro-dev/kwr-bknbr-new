import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/** GET: バナー一覧を表示順で返す（media クエリパラメータで媒体フィルター可） */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const media = searchParams.get("media"); // "gen" | "vip" | "vc" | null

  const banners = await prisma.banner.findMany({
    where: media ? { OR: [{ media }, { media: "all" }] } : {},
    orderBy: { order: "asc" },
    select: { id: true, label: true, url: true, imageUrl: true, media: true, order: true },
  });
  return NextResponse.json(banners);
}

/** POST: 管理画面用。バナー追加 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });
  try {
    const body = await request.json();
    const { label, url, imageUrl, order, media } = body;
    if (!label || !url) return NextResponse.json({ error: "label と url は必須です" }, { status: 400 });
    const validMedia = ["all", "gen", "vip", "vc"].includes(media) ? media : "all";
    const banner = await prisma.banner.create({
      data: {
        label: String(label),
        url: String(url),
        imageUrl: imageUrl ? String(imageUrl) : null,
        media: validMedia,
        order: typeof order === "number" ? order : 0,
      },
    });
    return NextResponse.json(banner);
  } catch {
    return NextResponse.json({ error: "作成に失敗しました" }, { status: 500 });
  }
}
