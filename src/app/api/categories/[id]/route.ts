import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/** PUT: カテゴリ更新 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await request.json();
    const { name, order } = body;
    const data: { name?: string; order?: number } = {};
    if (name !== undefined) data.name = String(name);
    if (typeof order === "number") data.order = order;
    const category = await prisma.category.update({
      where: { id: parseInt(id) },
      data,
    });
    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}

/** DELETE: カテゴリ削除 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });
  const { id } = await params;
  try {
    await prisma.category.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
