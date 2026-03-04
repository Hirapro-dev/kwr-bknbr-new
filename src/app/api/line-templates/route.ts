import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET: テンプレート一覧取得（デフォルトテンプレートを優先）
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });

  try {
    const templates = await prisma.lineTemplate.findMany({
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
    return NextResponse.json(templates);
  } catch {
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

// POST: テンプレートを保存（新規作成 or デフォルト設定）
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });

  try {
    const { name, styles, setAsDefault } = await request.json();
    if (!styles) return NextResponse.json({ error: "styles は必須です" }, { status: 400 });

    // デフォルトに設定する場合、既存のデフォルトを解除
    if (setAsDefault) {
      await prisma.lineTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.lineTemplate.create({
      data: {
        name: name || "テンプレート",
        styles: JSON.stringify(styles),
        isDefault: setAsDefault || false,
      },
    });

    return NextResponse.json(template);
  } catch {
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}

// PUT: 既存テンプレートを更新
export async function PUT(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "未認証" }, { status: 401 });

  try {
    const { id, name, styles, setAsDefault } = await request.json();
    if (!id) return NextResponse.json({ error: "id は必須です" }, { status: 400 });

    if (setAsDefault) {
      await prisma.lineTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.lineTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(styles ? { styles: JSON.stringify(styles) } : {}),
        ...(setAsDefault !== undefined ? { isDefault: setAsDefault } : {}),
      },
    });

    return NextResponse.json(template);
  } catch {
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}
