import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/** GET: カテゴリ一覧（表示順） */
export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    select: { id: true, name: true, slug: true, order: true },
  });
  return NextResponse.json(categories);
}

/** POST: カテゴリを追加 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });
  try {
    const body = await request.json();
    const { name, order } = body;
    if (!name) return NextResponse.json({ error: "名前は必須です" }, { status: 400 });
    // slugはnameからローマ字/英語ベースで自動生成（日本語の場合はencodeURIComponent）
    const slug = name.toLowerCase().replace(/[^a-z0-9\u3040-\u9fff]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || `cat-${Date.now()}`;
    const category = await prisma.category.create({
      data: {
        name: String(name),
        slug,
        order: typeof order === "number" ? order : 0,
      },
    });
    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: "作成に失敗しました" }, { status: 500 });
  }
}
