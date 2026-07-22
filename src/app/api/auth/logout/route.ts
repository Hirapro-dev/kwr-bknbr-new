import { NextResponse } from "next/server";

/**
 * ログアウト。
 * auth_token は HttpOnly Cookie のためブラウザのJSからは削除できず、
 * サーバー側で maxAge 0 の Cookie を上書きして破棄する必要がある。
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("auth_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
