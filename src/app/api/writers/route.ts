import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/** GET: 執筆者一覧（表示順） */
export async function GET() {
  const writers = await prisma.writer.findMany({
    orderBy: { order: "asc" },
    select: { id: true, name: true, avatarUrl: true, order: true },
  });
  return NextResponse.json(writers);
}

/** POST: 執筆者を追加 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });
  try {
    const body = await request.json();
    const { name, avatarUrl, order } = body;
    if (!name) return NextResponse.json({ error: "名前は必須です" }, { status: 400 });
    const writer = await prisma.writer.create({
      data: {
        name: String(name),
        avatarUrl: avatarUrl ? String(avatarUrl) : null,
        order: typeof order === "number" ? order : 0,
      },
    });
    return NextResponse.json(writer);
  } catch {
    return NextResponse.json({ error: "作成に失敗しました" }, { status: 500 });
  }
}
