"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FiExternalLink, FiLogOut, FiMenu, FiX } from "react-icons/fi";
import { BOTTOM_TAB_HREFS, NAV_GROUPS, NAV_ITEMS, findActiveItem, pageTitle } from "./nav";

/** サイドバーの幅（PC）。コンテンツ側の左余白と揃える */
const SIDEBAR_W = "16rem";

/**
 * 管理画面の共通シェル。
 * - PC   … 左に固定サイドバー
 * - スマホ … 上部バー（ページ名 + メニュー）＋ 下部タブバー ＋ スライド式ドロワー
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [username, setUsername] = useState("");

  const activeItem = findActiveItem(pathname);
  const title = pageTitle(pathname);

  // ログイン中のユーザー名を表示用に取得
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.user?.username) setUsername(d.user.username); })
      .catch(() => {});
  }, []);

  // ドロワー表示中は背面のスクロールを止め、Escで閉じられるようにする
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  const handleLogout = async () => {
    // auth_token は HttpOnly のためJSからは消せない。サーバー側で破棄する
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/admin/login");
    router.refresh();
  };

  const navLinkClass = (href: string) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      activeItem?.href === href
        ? "bg-blue-50 text-blue-700"
        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
    }`;

  /** リンクを押したらドロワーを閉じる（PCのサイドバーでは何も起きない） */
  const closeDrawer = () => setDrawerOpen(false);

  /** サイドバー・ドロワー共通の中身 */
  const navContent = (
    <>
      <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 shrink-0">
        <Link href="/admin/dashboard" onClick={closeDrawer} className="font-bold text-sm text-slate-900">
          KAWARA版 <span className="text-slate-400 font-semibold">管理</span>
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          className="lg:hidden p-2 -mr-2 text-slate-400 hover:text-slate-900"
          aria-label="メニューを閉じる"
        >
          <FiX size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-1.5 text-[10px] font-bold text-slate-400 tracking-wide">{group.title}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={closeDrawer} className={navLinkClass(item.href)}>
                    <item.icon size={16} className="shrink-0" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3 space-y-0.5 shrink-0">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <FiExternalLink size={16} className="shrink-0" />
          サイトを表示
        </a>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <FiLogOut size={16} className="shrink-0" />
          ログアウト
        </button>
        {username && (
          <p className="px-3 pt-2 text-[11px] text-slate-400 truncate">ログイン中: {username}</p>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* PC: 固定サイドバー */}
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col bg-white border-r border-slate-200"
        style={{ width: SIDEBAR_W }}
      >
        {navContent}
      </aside>

      {/* スマホ: ドロワー */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex flex-col bg-white w-64 max-w-[80vw] h-full shadow-xl">
            {navContent}
          </div>
        </div>
      )}

      {/* スマホ: 上部バー */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 bg-white border-b border-slate-200 flex items-center gap-2 px-3">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="p-2 -ml-1 text-slate-500 hover:text-slate-900"
          aria-label="メニューを開く"
        >
          <FiMenu size={20} />
        </button>
        <span className="font-bold text-sm text-slate-900 truncate">{title}</span>
      </header>

      {/* コンテンツ（上部バー・下部タブの高さ分だけ余白を確保） */}
      <div className="lg:pl-64 pt-14 lg:pt-0 pb-20 lg:pb-0">
        {/* PC: ページ見出し */}
        <div className="hidden lg:block bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="h-14 flex items-center px-6">
            <h1 className="font-bold text-sm text-slate-900">{title}</h1>
          </div>
        </div>
        {children}
      </div>

      {/* スマホ: 下部タブバー */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex pb-[env(safe-area-inset-bottom)]">
        {BOTTOM_TAB_HREFS.map((href) => {
          const item = NAV_ITEMS.find((i) => i.href === href)!;
          const active = activeItem?.href === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
                active ? "text-blue-600" : "text-slate-400"
              }`}
            >
              <item.icon size={19} />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold text-slate-400"
        >
          <FiMenu size={19} />
          メニュー
        </button>
      </nav>
    </div>
  );
}
