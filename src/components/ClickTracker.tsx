"use client";

import { useEffect, useRef } from "react";

/** 閲覧元: 公開トップ / 一般会員(g) / 正会員(v) */
export default function ClickTracker({ postId, source }: { postId: number; source?: "public" | "general" | "full" }) {
  const tracked = useRef(false);

  // 閲覧数記録（source で一般会員/正会員を別計測）
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, source: source ?? "public" }),
    }).catch(() => {});
  }, [postId, source]);

  // リンククリック追跡
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");
      if (!link) return;
      const url = link.href;
      if (!url || url.startsWith("#")) return;

      fetch("/api/clicks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          url,
          label: link.textContent?.trim().slice(0, 100) || null,
        }),
      }).catch(() => {});
    };

    const content = document.querySelector("[data-article-content]");
    content?.addEventListener("click", handler as EventListener);
    return () => content?.removeEventListener("click", handler as EventListener);
  }, [postId]);

  return null;
}
