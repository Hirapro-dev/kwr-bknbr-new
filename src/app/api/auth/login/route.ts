import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";

/** 「ログイン情報を保存」あり = 90日、なし = 従来どおり7日 */
const MAX_AGE_REMEMBER = 60 * 60 * 24 * 90;
const MAX_AGE_DEFAULT = 60 * 60 * 24 * 7;

export async function POST(request: NextRequest) {
  try {
    const { username, password, remember } = await request.json();

    const admin = await prisma.admin.findUnique({ where: { username } });
    if (!admin) {
      return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
    }

    const token = signToken({ id: admin.id, username: admin.username }, remember === true);

    const response = NextResponse.json({ success: true });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: remember === true ? MAX_AGE_REMEMBER : MAX_AGE_DEFAULT,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}
