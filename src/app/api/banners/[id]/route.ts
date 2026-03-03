import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });
  const id = parseInt((await params).id);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const body = await request.json();
    const { label, url, imageUrl, order } = body;
    const banner = await prisma.banner.update({
      where: { id },
      data: {
        ...(label !== undefined && { label: String(label) }),
        ...(url !== undefined && { url: String(url) }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl ? String(imageUrl) : null }),
        ...(typeof order === "number" && { order }),
      },
    });
    return NextResponse.json(banner);
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
  const id = parseInt((await params).id);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    await prisma.banner.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
