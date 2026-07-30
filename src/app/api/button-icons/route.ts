import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { BUTTON_ICON_PRESETS } from "@/lib/button-icons";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const hiddenIcons = await prisma.hiddenButtonIcon.findMany({
    select: { key: true },
  });

  return NextResponse.json({ hiddenKeys: hiddenIcons.map(({ key }) => key) });
}

export async function DELETE(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { key?: unknown } | null;
  const key = typeof body?.key === "string" ? body.key : "";
  const presetExists = BUTTON_ICON_PRESETS.some((preset) => preset.value === key);

  if (!presetExists) {
    return NextResponse.json({ error: "削除対象のアイコンが見つかりません" }, { status: 400 });
  }

  await prisma.hiddenButtonIcon.upsert({
    where: { key },
    update: {},
    create: { key },
  });

  return NextResponse.json({ success: true });
}
