import type { IconType } from "react-icons";
import {
  FiBarChart2, FiFileText, FiGrid, FiImage, FiPlus,
  FiSettings, FiShield, FiTag, FiUsers,
} from "react-icons/fi";

export type NavItem = {
  href: string;
  label: string;
  icon: IconType;
  /** この接頭辞で始まるパスでもこの項目をアクティブ扱いにする */
  activePrefix?: string;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

/**
 * 管理画面のナビゲーション定義。
 * サイドバー（PC）・ドロワー（スマホ）・ページ見出しの3箇所で共有する。
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "記事",
    items: [
      { href: "/admin/dashboard", label: "記事一覧", icon: FiFileText, activePrefix: "/admin/posts/" },
      { href: "/admin/posts/new", label: "新規作成", icon: FiPlus },
      { href: "/admin/analytics", label: "アクセス解析", icon: FiBarChart2 },
    ],
  },
  {
    title: "サイト設定",
    items: [
      { href: "/admin/categories", label: "カテゴリ", icon: FiTag },
      { href: "/admin/writers", label: "執筆者", icon: FiUsers },
      { href: "/admin/banners", label: "バナー", icon: FiImage },
      { href: "/admin/services", label: "サービス", icon: FiGrid },
      { href: "/admin/custom-editors", label: "編集ボタン", icon: FiSettings },
    ],
  },
  {
    title: "システム",
    items: [
      { href: "/admin/settings", label: "アカウント設定", icon: FiShield },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** スマホのボトムタブに常設する3項目（4つ目は「メニュー」ボタン） */
export const BOTTOM_TAB_HREFS = ["/admin/dashboard", "/admin/posts/new", "/admin/analytics"];

/**
 * 現在のパスに対応するナビ項目を返す。
 * 記事の編集画面のように専用の項目がないパスは activePrefix で親項目に寄せる。
 */
export function findActiveItem(pathname: string): NavItem | null {
  // 完全一致を優先（/admin/posts/new が /admin/posts/ の接頭辞に吸われないように）
  const exact = NAV_ITEMS.find((i) => i.href === pathname);
  if (exact) return exact;
  return NAV_ITEMS.find((i) => i.activePrefix && pathname.startsWith(i.activePrefix)) ?? null;
}

/** ページ見出しに出すタイトル（該当がなければ「管理画面」） */
export function pageTitle(pathname: string): string {
  if (pathname.startsWith("/admin/posts/") && pathname.endsWith("/edit")) return "記事を編集";
  return findActiveItem(pathname)?.label ?? "管理画面";
}
