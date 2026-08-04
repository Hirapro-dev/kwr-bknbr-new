import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { BUTTON_ICON_PRESETS, isValidSavedIconLabel, SAVED_ICON_LABEL_MAX } from "@/lib/button-icons";
import { prisma } from "@/lib/prisma";

/** アイコン選択一覧の状態を返す（非表示にしたプリセット + AI生成の登録済みアイコン） */
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const [hiddenIcons, savedIcons] = await Promise.all([
    prisma.hiddenButtonIcon.findMany({ select: { key: true } }),
    prisma.buttonIcon.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { key: true, label: true, imageUrl: true, order: true },
    }),
  ]);

  return NextResponse.json({ hiddenKeys: hiddenIcons.map(({ key }) => key), savedIcons });
}

/** AI生成したアイコンを選択一覧に追加する */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { label?: unknown; imageUrl?: unknown }
    | null;
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";

  if (!isValidSavedIconLabel(label)) {
    return NextResponse.json(
      { error: `名前は1〜${SAVED_ICON_LABEL_MAX}文字で入力してください` },
      { status: 400 }
    );
  }
  // 保存先はS3にアップロード済みの画像に限る（外部URLの埋め込みを防ぐ）
  if (!imageUrl.startsWith("https://")) {
    return NextResponse.json({ error: "アイコン画像のURLが不正です" }, { status: 400 });
  }

  // 同じ画像を二重登録しない（同じ画像で生成し直したときの取り違えを防ぐ）
  const duplicated = await prisma.buttonIcon.findFirst({ where: { imageUrl } });
  if (duplicated) {
    return NextResponse.json({ error: "このアイコンは既に一覧に追加されています" }, { status: 409 });
  }

  // 並び順は末尾に追加する
  const last = await prisma.buttonIcon.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
  // プリセットのvalueと衝突しないよう "saved-" を接頭辞にする
  const key = `saved-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const icon = await prisma.buttonIcon.create({
    data: { key, label, imageUrl, order: (last?.order ?? 0) + 1 },
    select: { key: true, label: true, imageUrl: true, order: true },
  });

  return NextResponse.json({ icon });
}

/**
 * アイコンを選択一覧から消す。
 * - プリセット（コード側）… 非表示リストに追加するだけ（画像は残す）
 * - AI生成の登録済みアイコン … レコードを削除する（S3の画像は既存記事が参照するため残す）
 */
export async function DELETE(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { key?: unknown } | null;
  const key = typeof body?.key === "string" ? body.key : "";

  if (BUTTON_ICON_PRESETS.some((preset) => preset.value === key)) {
    await prisma.hiddenButtonIcon.upsert({
      where: { key },
      update: {},
      create: { key },
    });
    return NextResponse.json({ success: true });
  }

  const saved = await prisma.buttonIcon.findUnique({ where: { key }, select: { key: true } });
  if (saved) {
    await prisma.buttonIcon.delete({ where: { key } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "削除対象のアイコンが見つかりません" }, { status: 400 });
}
