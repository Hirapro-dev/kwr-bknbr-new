import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  const editors = await prisma.customEditor.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json(editors);
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });

  try {
    const { name, icon, html, defaultInsert, defaultPosition } = await request.json();
    const count = await prisma.customEditor.count();
    const editor = await prisma.customEditor.create({
      data: {
        name, icon, html, order: count,
        defaultInsert: defaultInsert === true,
        defaultPosition: defaultPosition === "top" ? "top" : "bottom",
      },
    });
    return NextResponse.json(editor, { status: 201 });
  } catch {
    return NextResponse.json({ error: "作成に失敗しました" }, { status: 500 });
  }
}
