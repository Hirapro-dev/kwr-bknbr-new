import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/** GET: 公開用。設定されたバナー一覧を表示順で返す */
export async function GET() {
  const banners = await prisma.banner.findMany({
    orderBy: { order: "asc" },
    select: { id: true, label: true, url: true, imageUrl: true, order: true },
  });
  return NextResponse.json(banners);
}

/** POST: 管理画面用。バナー追加 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });
  try {
    const body = await request.json();
    const { label, url, imageUrl, order } = body;
    if (!label || !url) return NextResponse.json({ error: "label と url は必須です" }, { status: 400 });
    const banner = await prisma.banner.create({
      data: {
        label: String(label),
        url: String(url),
        imageUrl: imageUrl ? String(imageUrl) : null,
        order: typeof order === "number" ? order : 0,
      },
    });
    return NextResponse.json(banner);
  } catch {
    return NextResponse.json({ error: "作成に失敗しました" }, { status: 500 });
  }
}
