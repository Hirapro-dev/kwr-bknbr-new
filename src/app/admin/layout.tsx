"use client";

import { usePathname } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";

/**
 * サイドバーを出さない画面。
 * - ログイン画面     … ナビゲーションを見せる意味がない
 * - 記事の作成・編集 … 独自の固定ヘッダー（保存・公開）を持ち、執筆に集中させたいため全画面
 */
function isBareLayout(pathname: string): boolean {
  if (pathname === "/admin/login") return true;
  if (pathname === "/admin/posts/new") return true;
  return pathname.startsWith("/admin/posts/") && pathname.endsWith("/edit");
}

/** 管理画面の共通レイアウト */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isBareLayout(pathname)) return <>{children}</>;
  return <AdminShell>{children}</AdminShell>;
}
