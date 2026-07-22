import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

/**
 * ログイントークンを発行する。
 * remember=true（ログイン情報を保存）のときは Cookie の maxAge と同じ90日にする。
 * ここを揃えないと、Cookieは残っているのにトークンだけ失効して突然ログアウトになる。
 */
export function signToken(payload: { id: number; username: string }, remember = false) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: remember ? "90d" : "7d" });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: number; username: string };
  } catch {
    return null;
  }
}

export async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}
