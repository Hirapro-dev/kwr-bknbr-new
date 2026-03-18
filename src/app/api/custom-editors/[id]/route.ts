import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });

  const { id } = await params;
  try {
    const { name, icon, html, order, defaultInsert, defaultPosition } = await request.json();
    const data: { name?: string; icon?: string; html?: string; order?: number; defaultInsert?: boolean; defaultPosition?: string } = {};
    if (name !== undefined) data.name = name;
    if (icon !== undefined) data.icon = icon;
    if (html !== undefined) data.html = html;
    if (order !== undefined) data.order = order;
    if (defaultInsert !== undefined) data.defaultInsert = !!defaultInsert;
    if (defaultPosition !== undefined) data.defaultPosition = defaultPosition === "top" ? "top" : "bottom";
    const editor = await prisma.customEditor.update({
      where: { id: parseInt(id) },
      data,
    });
    return NextResponse.json(editor);
  } catch {
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.customEditor.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
