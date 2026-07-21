"use client";

import { useCallback, useEffect, useState } from "react";
import { FiX } from "react-icons/fi";

/** 別ウィンドウのサイズ上限（画面が小さい場合は画面サイズに収める） */
const WINDOW_WIDTH = 1000;
const WINDOW_HEIGHT = 800;

/**
 * 記事本文内の「ポップアップ表示ボタン」を処理する。
 * 対象: [data-article-content] 配下の <a data-popup="window|modal">
 * - window ... 小さめの別ウィンドウ（window.open）で開く
 * - modal  ... 記事上に重ねたモーダル内のiframeで開く
 * いずれも target="_blank" を併記しておくことで、JS無効時やポップアップ
 * ブロック時は「別タブで開く」に自動フォールバックする。
 */
export default function PopupLinkHandler() {
  const [modalUrl, setModalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const closeModal = useCallback(() => {
    setModalUrl(null);
    setLoading(false);
  }, []);

  // 本文内のポップアップボタンのクリックを捕捉
  useEffect(() => {
    const content = document.querySelector("[data-article-content]");
    if (!content) return;

    const handler = (e: MouseEvent) => {
      // 修飾キー付きクリック・中クリックはブラウザ既定の挙動を優先
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      const link = target?.closest?.("a[data-popup]") as HTMLAnchorElement | null;
      if (!link) return;

      const mode = link.getAttribute("data-popup");
      const url = link.href;
      if (!url || url.startsWith("#")) return;

      if (mode === "window") {
        const w = Math.min(WINDOW_WIDTH, window.screen.availWidth);
        const h = Math.min(WINDOW_HEIGHT, window.screen.availHeight);
        const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
        const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
        const win = window.open(
          url,
          "kwr_popup",
          `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );
        // 開けた場合のみ既定動作（別タブ遷移）を止める。
        // ブロックされた場合は何もせず target="_blank" のまま別タブで開かせる。
        if (win) {
          e.preventDefault();
          win.focus();
        }
        return;
      }

      if (mode === "modal") {
        e.preventDefault();
        setLoading(true);
        setModalUrl(url);
      }
    };

    content.addEventListener("click", handler as EventListener);
    return () => content.removeEventListener("click", handler as EventListener);
  }, []);

  // モーダル表示中はEscで閉じる／背面のスクロールを止める
  useEffect(() => {
    if (!modalUrl) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal(); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [modalUrl, closeModal]);

  if (!modalUrl) return null;

  return (
    <div className="popup-modal-overlay" onClick={closeModal} role="dialog" aria-modal="true">
      <div className="popup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="popup-modal-bar">
          <button type="button" onClick={closeModal} className="popup-modal-close" aria-label="閉じる">
            <FiX size={18} />
          </button>
        </div>
        <div className="popup-modal-body">
          {loading && <div className="popup-modal-loading">読み込み中…</div>}
          <iframe
            src={modalUrl}
            title="ポップアップ表示"
            className="popup-modal-frame"
            onLoad={() => setLoading(false)}
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  );
}
