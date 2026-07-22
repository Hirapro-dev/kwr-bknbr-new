"use client";

import { useEffect, useRef } from "react";
import {
  CHANNEL_COOKIE,
  CHANNEL_COOKIE_MAX_AGE,
  CHANNEL_PARAM,
  normalizeChannel,
  type Channel,
} from "@/lib/tracking";

/** Cookieから配信チャネルを読む */
function readChannelCookie(): Channel | null {
  const hit = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CHANNEL_COOKIE}=`));
  return normalizeChannel(hit?.slice(CHANNEL_COOKIE.length + 1));
}

/** 配信チャネルをCookieに保存（30日・サイト全体で共有） */
function writeChannelCookie(channel: Channel) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CHANNEL_COOKIE}=${channel}; path=/; max-age=${CHANNEL_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

/**
 * 配信チャネルを決定する。
 * URLに `?ch=` があればそれを採用しCookieを上書き（ラストタッチ方式）、
 * なければ以前の着地で保存したCookieを引き継ぐ。
 */
function resolveChannel(): Channel | null {
  const fromUrl = normalizeChannel(
    new URLSearchParams(location.search).get(CHANNEL_PARAM)
  );
  if (fromUrl) {
    writeChannelCookie(fromUrl);
    return fromUrl;
  }
  return readChannelCookie();
}

/** 閲覧元: 一般会員(gen) / 正会員(vip) / 仮想通貨長者(vc) / ウェルネス(wel) */
export default function ClickTracker({ postId, source }: { postId: number; source: "gen" | "vip" | "vc" | "wel" }) {
  const tracked = useRef(false);
  // クリック時に最新のチャネルを参照できるよう保持（Cookie読み取りを毎回走らせない）
  const channelRef = useRef<Channel | null>(null);

  // 閲覧数記録（source で媒体を、channel で配信チャネルを別計測）
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    const channel = resolveChannel();
    channelRef.current = channel;
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, source, channel }),
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
          source,
          // 着地時に確定したチャネル。未確定ならCookieから読み直す
          channel: channelRef.current ?? readChannelCookie(),
        }),
      }).catch(() => {});
    };

    const content = document.querySelector("[data-article-content]");
    content?.addEventListener("click", handler as EventListener);
    return () => content?.removeEventListener("click", handler as EventListener);
  }, [postId, source]);

  return null;
}
