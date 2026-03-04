import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthUser, signToken } from "@/lib/auth";

export async function PUT(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "未認証" }, { status: 401 });
  }

  try {
    const { currentPassword, newUsername, newPassword } = await request.json();

    // 現在のパスワードで本人確認
    const admin = await prisma.admin.findUnique({ where: { id: user.id } });
    if (!admin) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }

    const valid = await bcrypt.compare(currentPassword, admin.password);
    if (!valid) {
      return NextResponse.json({ error: "現在のパスワードが正しくありません" }, { status: 401 });
    }

    // 更新データを構築
    const updateData: { username?: string; password?: string } = {};

    if (newUsername && newUsername !== admin.username) {
      // ユーザー名の重複チェック
      const existing = await prisma.admin.findUnique({ where: { username: newUsername } });
      if (existing) {
        return NextResponse.json({ error: "そのユーザー名は既に使用されています" }, { status: 409 });
      }
      updateData.username = newUsername;
    }

    if (newPassword) {
      if (newPassword.length < 4) {
        return NextResponse.json({ error: "パスワードは4文字以上にしてください" }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "変更内容がありません" }, { status: 400 });
    }

    const updated = await prisma.admin.update({
      where: { id: user.id },
      data: updateData,
    });

    // 新しいトークンを発行（ユーザー名が変わった場合に対応）
    const token = signToken({ id: updated.id, username: updated.username });
    const response = NextResponse.json({ success: true, username: updated.username });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}
