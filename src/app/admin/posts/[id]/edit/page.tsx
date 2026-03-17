"use client";

import { useState, useRef, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FiSave, FiEye, FiArrowLeft, FiUploadCloud, FiClock } from "react-icons/fi";
import { compressAndUpload } from "@/lib/upload";
import { prettyPrintHtml, normalizeHtmlForVisual } from "@/lib/editor-html";
import EditorToolbar from "@/components/EditorToolbar";
import ThumbnailGenerator from "@/components/ThumbnailGenerator";
import LineImageGenerator from "@/components/LineImageGenerator";

type EditorMode = "visual" | "code";
type CustomEditor = { id: number; name: string; icon: string; html: string };
type Writer = { id: number; name: string; avatarUrl: string | null };

export default function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [eyecatch, setEyecatch] = useState("");
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<EditorMode>("visual");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [eyecatchDragOver, setEyecatchDragOver] = useState(false);
  const [editorDragOver, setEditorDragOver] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [customEditors, setCustomEditors] = useState<CustomEditor[]>([]);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkNewTab, setLinkNewTab] = useState(false);
  const [linkColor, setLinkColor] = useState("");
  const [buttonDialogOpen, setButtonDialogOpen] = useState(false);
  const [buttonText, setButtonText] = useState("詳しくはこちら");
  const [buttonUrl, setButtonUrl] = useState("");
  const [buttonNewTab, setButtonNewTab] = useState(true);
  const [buttonColor, setButtonColor] = useState("#1e40af");
  const [writers, setWriters] = useState<Writer[]>([]);
  const [writerId, setWriterId] = useState("");
  const [isPickup, setIsPickup] = useState(false);
  const [showForGen, setShowForGen] = useState(true);
  const [showForVip, setShowForVip] = useState(true);
  const [showForVC, setShowForVC] = useState(false);
  const [googleDocDialogOpen, setGoogleDocDialogOpen] = useState(false);
  const [googleDocUrl, setGoogleDocUrl] = useState("");
  const [googleDocLoading, setGoogleDocLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eyecatchInputRef = useRef<HTMLInputElement>(null);
  const lastEnterInBlock = useRef<{ time: number; node: Node | null }>({ time: 0, node: null });
  const savedSelectionRef = useRef<Range | null>(null);
  const editingLinkAnchorRef = useRef<HTMLAnchorElement | null>(null);
  const editingButtonAnchorRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const init = async () => {
      const authRes = await fetch("/api/auth/me");
      if (!authRes.ok) { router.push("/admin/login"); return; }
      const [res, ceRes, wRes] = await Promise.all([
        fetch(`/api/posts/${id}`),
        fetch("/api/custom-editors"),
        fetch("/api/writers"),
      ]);
      if (res.ok) {
        const post = await res.json();
        setTitle(post.title); setContent(post.content); setEyecatch(post.eyecatch || ""); setPublished(post.published); setIsPickup(post.isPickup ?? false);
        setShowForGen(post.showForGen !== false);
        setShowForVip(post.showForVip !== false);
        setShowForVC(post.showForVC === true);
        if (post.scheduledAt) {
          // UTC→JST変換してdatetime-local用の文字列にする
          const jstDate = new Date(new Date(post.scheduledAt).getTime() + 9 * 60 * 60 * 1000);
          setScheduledAt(jstDate.toISOString().slice(0, 16));
          setShowSchedule(true);
        }
        if (post.writerId) setWriterId(String(post.writerId));
      } else {
        setLoadError(true);
      }
      if (ceRes.ok) setCustomEditors(await ceRes.json());
      if (wRes.ok) setWriters(await wRes.json());
      setLoading(false);
    };
    init();
  }, [id, router]);

  useEffect(() => {
    if (!loading && mode === "visual" && editorRef.current) {
      const normalized = normalizeHtmlForVisual(content);
      if (editorRef.current.innerHTML !== normalized) editorRef.current.innerHTML = normalized;
    }
  }, [loading, mode, content]);

  const syncFromVisual = () => { if (editorRef.current) setContent(editorRef.current.innerHTML); };

  const importFromGoogleDoc = async () => {
    const url = googleDocUrl.trim();
    if (!url) return;
    setGoogleDocLoading(true);
    try {
      const res = await fetch("/api/import-google-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "取り込みに失敗しました");
      setTitle(data.title ?? "");
      const html = data.content ?? "";
      setContent(html);
      if (mode === "visual" && editorRef.current) {
        editorRef.current.innerHTML = normalizeHtmlForVisual(html);
      }
      setGoogleDocDialogOpen(false);
      setGoogleDocUrl("");
      // 文字化け検出アラート
      if (data.hasMojibake) {
        alert("⚠️ 文字化けが検出されました。取り込んだ内容を確認してください。\n\nGoogle ドキュメントの元データに文字コードの問題がある可能性があります。");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "取り込みに失敗しました");
    } finally {
      setGoogleDocLoading(false);
    }
  };

  // ブロック要素（引用・注釈）を取得
  const getQuoteOrNoteBlock = (): HTMLElement | null => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    let node: Node | null = sel.anchorNode;
    while (node && node !== editorRef.current) {
      if (node instanceof HTMLElement) {
        const tag = node.tagName.toLowerCase();
        if (tag === "blockquote" || (tag === "div" && node.style.borderLeft)) return node;
      }
      node = node.parentNode;
    }
    return null;
  };

  // ブロック末尾の空ノードを削除（2回目Enterで脱出時のクリーンアップ）
  const removeTrailingEmptyFromBlock = (blockEl: HTMLElement) => {
    while (blockEl.lastChild) {
      const last = blockEl.lastChild;
      const empty =
        (last instanceof HTMLElement && last.tagName === "BR") ||
        (last instanceof HTMLElement && (last.tagName === "DIV" || last.tagName === "BLOCKQUOTE") && last.innerHTML.replace(/<br\s*\/?>/gi, "").trim() === "") ||
        (last.nodeType === Node.TEXT_NODE && !last.textContent?.trim());
      if (!empty) break;
      blockEl.removeChild(last);
    }
  };

  // Enter=段落(<p>)、Shift+Enter=改行(<br>)。引用・注釈内は改行2回で解除。
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter") return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editorRef.current) return;

    const blockEl = getQuoteOrNoteBlock();

    // Shift+Enter または Cmd+Enter → 現在の<p>内に<br>を挿入
    if (e.shiftKey || e.metaKey) {
      e.preventDefault();
      const range = sel.getRangeAt(0);
      range.deleteContents();
      // カーソルが<p>の外にある場合は<p>で囲む
      let parentBlock: HTMLElement | null = range.startContainer instanceof HTMLElement ? range.startContainer : range.startContainer.parentElement;
      while (parentBlock && parentBlock !== editorRef.current && !["P", "DIV", "H1", "H2", "H3", "H4", "BLOCKQUOTE"].includes(parentBlock.tagName)) {
        parentBlock = parentBlock.parentElement;
      }
      // <p>の外（直下のdivやテキストノード）の場合、<p>で包む
      if (!parentBlock || parentBlock === editorRef.current) {
        const p = document.createElement("p");
        const startNode = range.startContainer;
        const textNode = startNode.nodeType === Node.TEXT_NODE ? startNode : startNode.childNodes[range.startOffset] || startNode;
        // 隣接するテキストノードやインライン要素をまとめて<p>に入れる
        let node: Node | null = textNode;
        while (node && node.parentNode === editorRef.current && node.nodeType === Node.TEXT_NODE) {
          node = node.previousSibling;
        }
        node = node ? node.nextSibling : editorRef.current.firstChild;
        const nodesToWrap: Node[] = [];
        while (node && node.parentNode === editorRef.current) {
          const next = node.nextSibling;
          if (node instanceof HTMLElement && ["P", "H1", "H2", "H3", "H4", "BLOCKQUOTE", "DIV"].includes(node.tagName)) break;
          nodesToWrap.push(node);
          node = next;
        }
        if (nodesToWrap.length > 0) {
          editorRef.current.insertBefore(p, nodesToWrap[0]);
          for (const n of nodesToWrap) p.appendChild(n);
        }
        // <p>内にカーソルを再配置
        const newRange = document.createRange();
        newRange.setStart(p, p.childNodes.length);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
      // <br>を挿入してカーソルをその後ろに移動
      const brRange = sel.getRangeAt(0);
      const br = document.createElement("br");
      brRange.insertNode(br);
      // カーソルを<br>の後ろに移動
      const afterBr = document.createRange();
      afterBr.setStartAfter(br);
      afterBr.collapse(true);
      sel.removeAllRanges();
      sel.addRange(afterBr);
      syncFromVisual();
      return;
    }

    // 引用・注釈ブロック内: 2回目のEnterで脱出
    if (blockEl) {
      const now = Date.now();
      const prev = lastEnterInBlock.current;
      if (prev.node === blockEl && now - prev.time < 1200) {
        e.preventDefault();
        removeTrailingEmptyFromBlock(blockEl);
        const p = document.createElement("p");
        p.innerHTML = "<br>";
        blockEl.parentNode?.insertBefore(p, blockEl.nextSibling);
        const newRange = document.createRange();
        newRange.setStart(p, 0);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        lastEnterInBlock.current = { time: 0, node: null };
        syncFromVisual();
        return;
      }
      lastEnterInBlock.current = { time: now, node: blockEl };
      return;
    }

    // 通常時: Enterで新段落。insertParagraph のあと div を p に正規化
    lastEnterInBlock.current = { time: 0, node: null };
    e.preventDefault();
    document.execCommand("insertParagraph", false);
    const anchor = sel.anchorNode;
    if (!anchor) { syncFromVisual(); return; }
    let block: HTMLElement | null = anchor instanceof HTMLElement ? anchor : anchor.parentElement;
    while (block && block !== editorRef.current && !["P", "DIV", "H1", "H2", "H3", "H4"].includes(block.tagName)) block = block.parentElement;
    if (block && block !== editorRef.current && block.tagName === "DIV") {
      const p = document.createElement("p");
      while (block.firstChild) p.appendChild(block.firstChild);
      block.parentNode?.replaceChild(p, block);
    }
    syncFromVisual();
  };

  const execCommand = (cmd: string, val?: string) => { document.execCommand(cmd, false, val); editorRef.current?.focus(); syncFromVisual(); };
  const insertHeading = (lv: number) => { document.execCommand("formatBlock", false, `h${lv}`); editorRef.current?.focus(); syncFromVisual(); };
  const saveSelection = () => {
    const sel = window.getSelection();
    const editor = editorRef.current;
    if (sel?.rangeCount && editor?.contains(sel.anchorNode)) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    } else savedSelectionRef.current = null;
  };
  const saveSelectionIfInEditor = () => {
    const sel = window.getSelection();
    const editor = editorRef.current;
    if (sel?.rangeCount && editor?.contains(sel.anchorNode)) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  };
  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor || !savedSelectionRef.current) return false;
    editor.focus();
    const sel = window.getSelection();
    if (!sel) return false;
    sel.removeAllRanges();
    sel.addRange(savedSelectionRef.current);
    savedSelectionRef.current = null;
    return true;
  };

  const getSelectedAnchor = (): HTMLAnchorElement | null => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editorRef.current) return null;
    let node: Node | null = sel.anchorNode;
    while (node && node !== editorRef.current) {
      if (node instanceof HTMLAnchorElement) return node;
      node = node.parentNode;
    }
    return null;
  };
  const getSelectedButtonAnchor = (): HTMLAnchorElement | null => {
    const a = getSelectedAnchor();
    if (!a) return null;
    if (a.classList.contains("btn") || (a.getAttribute("style") || "").includes("background")) return a;
    return null;
  };

  const insertLink = () => {
    editingLinkAnchorRef.current = null;
    setLinkUrl("");
    setLinkNewTab(false);
    setLinkColor("");
    if (mode === "visual" && editorRef.current) {
      const anchor = getSelectedAnchor();
      if (anchor) {
        editingLinkAnchorRef.current = anchor;
        setLinkUrl(anchor.getAttribute("href") || "");
        setLinkNewTab(anchor.target === "_blank");
        const c = anchor.style.color || "";
        setLinkColor(c);
      }
    }
    setLinkDialogOpen(true);
  };
  const submitLink = () => {
    const u = linkUrl.trim();
    if (!u) return;
    setLinkDialogOpen(false);
    if (mode === "visual" && editorRef.current) {
      const anchor = editingLinkAnchorRef.current;
      if (anchor && editorRef.current.contains(anchor)) {
        anchor.href = u;
        anchor.target = linkNewTab ? "_blank" : "";
        anchor.rel = linkNewTab ? "noopener noreferrer" : "";
        if (linkColor.trim()) anchor.style.color = linkColor.trim();
        else anchor.style.removeProperty("color");
        editingLinkAnchorRef.current = null;
        syncFromVisual();
        return;
      }
      editingLinkAnchorRef.current = null;
      if (!restoreSelection()) return;
      document.execCommand("createLink", false, u);
      if (linkNewTab) {
        const sel = window.getSelection();
        if (sel?.rangeCount) {
          let node: Node | null = sel.anchorNode;
          while (node && node !== editorRef.current) {
            if (node instanceof HTMLAnchorElement) { node.target = "_blank"; node.rel = "noopener noreferrer"; break; }
            node = node.parentNode;
          }
        }
      }
      if (linkColor.trim()) {
        const sel = window.getSelection();
        if (sel?.rangeCount) {
          let node: Node | null = sel.anchorNode;
          while (node && node !== editorRef.current) {
            if (node instanceof HTMLAnchorElement) { node.style.color = linkColor.trim(); break; }
            node = node.parentNode;
          }
        }
      }
      syncFromVisual();
    } else setContent((p) => p + (p.trim() ? "\n\n" : "") + `<a href="${u}"${linkNewTab ? ' target="_blank" rel="noopener noreferrer"' : ""}${linkColor.trim() ? ` style="color:${linkColor}"` : ""}>リンク</a>\n\n`);
  };

  const insertHtml = (html: string) => {
    if (mode === "visual") { document.execCommand("insertHTML", false, html); syncFromVisual(); }
    else setContent((p) => (p.trim() ? p.trimEnd() + "\n\n" : "") + html + "\n\n");
  };

  const blockColorClass = (hex: string) => {
    const m: Record<string, string> = { "#3b82f6": "blue", "#22c55e": "green", "#ef4444": "red", "#f97316": "orange", "#a855f7": "purple", "#6b7280": "gray" };
    return m[hex.toLowerCase()] ?? "blue";
  };
  const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const insertYoutube = () => {
    const u = prompt("YouTubeのURLを入力:"); if (!u) return;
    const m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    if (!m) { alert("有効なYouTube URLを入力してください"); return; }
    insertHtml(`<div class="youtube-wrap"><iframe src="https://www.youtube.com/embed/${m[1]}" allowfullscreen></iframe></div>`);
  };

  const insertNote = (color = "#3b82f6") => {
    const t = prompt("注釈テキスト:"); if (!t) return;
    const c = blockColorClass(color);
    insertHtml(`<div class="note note--${c}"><strong>📝 注釈:</strong> ${escHtml(t)}</div>`);
  };
  const insertQuote = (color = "#3b82f6") => {
    const t = prompt("引用テキスト:"); if (!t) return; const s = prompt("引用元（任意）:");
    const c = blockColorClass(color);
    insertHtml(`<blockquote class="quote quote--${c}">${escHtml(t)}${s ? `<cite>― ${escHtml(s)}</cite>` : ""}</blockquote>`);
  };
  const insertButton = (colorData = "#1e40af") => {
    editingButtonAnchorRef.current = null;
    setButtonText("詳しくはこちら");
    setButtonUrl("");
    setButtonNewTab(true);
    setButtonColor(colorData);
    if (mode === "visual" && editorRef.current) {
      const anchor = getSelectedButtonAnchor();
      if (anchor) {
        editingButtonAnchorRef.current = anchor;
        setButtonText(anchor.textContent?.replace(/\s*\|\s*/g, "|").trim() || "詳しくはこちら");
        setButtonUrl(anchor.getAttribute("href") || "");
        setButtonNewTab(anchor.target === "_blank");
        const cls = anchor.className;
        const styleBg = anchor.style.background || "";
        if (cls.includes("btn-c")) setButtonColor(JSON.stringify({ cls: "btn-c" }));
        else if (cls.includes("btn-k")) setButtonColor(JSON.stringify({ cls: "btn-k" }));
        else if (cls.includes("btn-r")) setButtonColor(JSON.stringify({ cls: "btn-r" }));
        else if (cls.includes("btn-g")) setButtonColor(JSON.stringify({ cls: "btn-g" }));
        else if (cls.includes("btn-o")) setButtonColor(JSON.stringify({ cls: "btn-o" }));
        else if (cls.includes("btn-p")) setButtonColor(JSON.stringify({ cls: "btn-p" }));
        else if (styleBg) setButtonColor(styleBg.split(/[\s,]+/)[0] || "#1e40af");
      }
    }
    setButtonDialogOpen(true);
  };
  const submitButton = () => {
    const t = buttonText.trim();
    const u = buttonUrl.trim();
    if (!t || !u) return;
    setButtonDialogOpen(false);
    const inner = t
      .split("||")
      .map((seg) => seg.split("|").map((s) => escHtml(s)).join('<br class="sp-only">'))
      .join("<br>");
    const targetAttr = buttonNewTab ? ' target="_blank" rel="noopener noreferrer"' : "";
    let btnClass = "btn";
    try {
      const parsed = JSON.parse(buttonColor);
      if (parsed.cls) btnClass = `btn ${parsed.cls}`;
    } catch { /* legacy: plain color string */ }
    if (mode === "visual" && editorRef.current) {
      const anchor = editingButtonAnchorRef.current;
      if (anchor && editorRef.current.contains(anchor)) {
        anchor.href = u;
        anchor.target = buttonNewTab ? "_blank" : "";
        anchor.rel = buttonNewTab ? "noopener noreferrer" : "";
        anchor.className = btnClass;
        anchor.innerHTML = inner;
        editingButtonAnchorRef.current = null;
        syncFromVisual();
        return;
      }
      editingButtonAnchorRef.current = null;
    }
    const html = `<div class="btn-wrap"><a href="${u}"${targetAttr} class="${btnClass}">${inner}</a></div>`;
    if (mode === "visual" && editorRef.current) {
      const editor = editorRef.current;
      const wrapper = document.createElement("div");
      wrapper.innerHTML = html;
      const fragment = document.createDocumentFragment();
      while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);
      restoreSelection();
      const sel = window.getSelection();
      if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(fragment);
        range.collapse(false);
      } else {
        editor.appendChild(fragment);
      }
      syncFromVisual();
    } else setContent((p) => (p.trim() ? p.trimEnd() + "\n\n" : "") + html + "\n\n");
  };

  const insertImageToEditor = useCallback(async (file: File) => {
    setUploading(true); setUploadProgress("圧縮中...");
    try { const url = await compressAndUpload(file); setUploadProgress(""); insertHtml(`<img src="${url}" alt="${file.name}" />`); }
    catch (e) { alert(e instanceof Error ? e.message : "失敗"); setUploadProgress(""); }
    finally { setUploading(false); }
  }, [mode]);

  const uploadEyecatch = useCallback(async (file: File) => {
    setUploading(true); setUploadProgress("圧縮中...");
    try { const url = await compressAndUpload(file); setEyecatch(url); setUploadProgress(""); }
    catch (e) { alert(e instanceof Error ? e.message : "失敗"); setUploadProgress(""); }
    finally { setUploading(false); }
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) insertImageToEditor(f); e.target.value = ""; };
  const handleEyecatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) uploadEyecatch(f); e.target.value = ""; };
  const getImageFile = (e: React.DragEvent): File | null => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; return f?.type.startsWith("image/") ? f : null; };
  const handleEyecatchDrop = (e: React.DragEvent) => { setEyecatchDragOver(false); const f = getImageFile(e); if (f) uploadEyecatch(f); };
  const handleEditorDrop = (e: React.DragEvent) => { setEditorDragOver(false); const f = getImageFile(e); if (f) { e.stopPropagation(); insertImageToEditor(f); } };

  const handleSave = async (shouldPublish?: boolean) => {
    if (!title.trim()) { alert("タイトルを入力してください"); return; }
    if (mode === "visual" && editorRef.current) syncFromVisual();
    setSaving(true);
    try {
      const finalContent = mode === "visual" && editorRef.current ? editorRef.current.innerHTML : content;
      const res = await fetch(`/api/posts/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: finalContent, eyecatch: eyecatch || null, published: shouldPublish ?? published, isPickup, showForGen, showForVip, showForVC, scheduledAt: scheduledAt ? new Date(scheduledAt + ":00+09:00").toISOString() : null, writerId: writerId || null }),
      });
      if (res.ok) router.push("/admin/dashboard");
      else { const d = await res.json(); alert(d.error || "保存に失敗"); }
    } catch { alert("保存に失敗"); } finally { setSaving(false); }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-400">読み込み中...</p></div>;

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <p className="text-slate-600 font-medium">記事の読み込みに失敗しました</p>
        <p className="text-slate-400 text-sm mt-1">通信エラーや記事が存在しない可能性があります</p>
        <button onClick={() => router.push("/admin/dashboard")} className="mt-6 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 text-sm font-medium">
          ダッシュボードに戻る
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-2 md:px-4 h-12 md:h-14 flex items-center justify-between">
          <div className="flex items-center gap-1.5 md:gap-3 min-w-0">
            <button onClick={() => router.push("/admin/dashboard")} className="p-1.5 md:p-2 text-slate-400 hover:text-blue-600 rounded-lg flex-shrink-0"><FiArrowLeft size={16} /></button>
            <span className="font-bold text-xs md:text-sm text-slate-900 truncate">記事を編集</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            {uploadProgress && <span className="text-[10px] md:text-xs text-blue-600 animate-pulse mr-1">{uploadProgress}</span>}
            <button onClick={() => setShowSchedule(!showSchedule)} className={`p-1.5 md:p-2 rounded-lg transition-colors ${showSchedule ? "text-amber-600 bg-amber-50" : "text-slate-400 hover:text-amber-600"}`} title="公開日時を指定（未来なら予約）"><FiClock size={14} /></button>
            <button onClick={() => handleSave(false)} disabled={saving || uploading} className="px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"><FiSave size={12} /> <span className="hidden sm:inline">下書き</span><span className="sm:hidden">保存</span></button>
            <button onClick={() => handleSave(true)} disabled={saving || uploading} className="px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs bg-black hover:bg-black/80 text-white rounded-lg disabled:opacity-50 flex items-center gap-1"><FiEye size={12} /> 公開</button>
          </div>
        </div>
        {showSchedule && (
          <div className="bg-amber-50 border-t border-amber-200 px-4 py-2.5 flex flex-wrap items-center gap-3">
            <FiClock size={14} className="text-amber-600" />
            <span className="text-xs text-amber-700 font-medium">公開日時:</span>
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="text-xs border border-amber-300 rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500" />
            {scheduledAt && <button onClick={() => { setScheduledAt(""); setShowSchedule(false); }} className="text-xs text-amber-600 hover:text-amber-800">クリア</button>}
            <span className="text-[11px] text-amber-700/80">未指定または過去＝今すぐ公開、未来の日時＝自動で公開予約になります</span>
          </div>
        )}
      </header>

      <EditorToolbar mode={mode} uploading={uploading} customEditors={customEditors}
        onToggleMode={() => {
          if (mode === "visual") {
            syncFromVisual();
            const raw = editorRef.current?.innerHTML ?? content;
            setContent(prettyPrintHtml(raw));
          }
          setMode(mode === "visual" ? "code" : "visual");
        }}
        onExecCommand={execCommand} onInsertHeading={insertHeading} onInsertLink={insertLink}
        onInsertImage={() => fileInputRef.current?.click()} onInsertYoutube={insertYoutube}
        onInsertNote={insertNote} onInsertQuote={insertQuote} onInsertButton={insertButton}
        onInsertCustomHtml={insertHtml} />

      {/* モバイル: ヘッダー48px + ツールバー約44px = 92px + 余白、デスクトップ: 56px + ツールバー約68px = 124px */}
      <main className={`max-w-4xl mx-auto px-3 md:px-4 py-4 md:py-8 ${showSchedule ? "pt-[140px] md:pt-[160px]" : "pt-[104px] md:pt-[124px]"}`}>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="記事タイトルを入力..."
          className="w-full text-xl md:text-2xl lg:text-3xl font-black border-none outline-none bg-transparent mb-4 md:mb-6 placeholder:text-slate-300" />

        {writers.length > 0 && (
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-500 mb-2">執筆者</label>
            <select value={writerId} onChange={(e) => setWriterId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white">
              <option value="">選択しない</option>
              {writers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        )}

        <div className="mb-4 md:mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isPickup} onChange={(e) => setIsPickup(e.target.checked)} className="rounded border-slate-300 text-amber-500 focus:ring-amber-400" />
            <span className="text-xs md:text-sm font-medium text-slate-700">人気記事<span className="hidden md:inline">に設定する（トップの PickUp に表示）</span></span>
          </label>
        </div>

        <div className="mb-4 md:mb-6">
          <p className="text-xs font-semibold text-slate-500 mb-2">表示先会員</p>
          <div className="flex flex-wrap gap-3 md:gap-4">
            <label className="flex items-center gap-1.5 md:gap-2 cursor-pointer">
              <input type="checkbox" checked={showForGen} onChange={(e) => setShowForGen(e.target.checked)} className="rounded border-slate-300 text-blue-500 focus:ring-blue-400" />
              <span className="text-xs md:text-sm font-medium text-slate-700">一般<span className="hidden md:inline">会員</span></span>
            </label>
            <label className="flex items-center gap-1.5 md:gap-2 cursor-pointer">
              <input type="checkbox" checked={showForVip} onChange={(e) => setShowForVip(e.target.checked)} className="rounded border-slate-300 text-blue-500 focus:ring-blue-400" />
              <span className="text-xs md:text-sm font-medium text-slate-700">正会員</span>
            </label>
            <label className="flex items-center gap-1.5 md:gap-2 cursor-pointer">
              <input type="checkbox" checked={showForVC} onChange={(e) => setShowForVC(e.target.checked)} className="rounded border-slate-300 text-blue-500 focus:ring-blue-400" />
              <span className="text-xs md:text-sm font-medium text-slate-700">VC<span className="hidden md:inline">長者</span></span>
            </label>
          </div>
        </div>

        <div className="mb-4 md:mb-6">
          <label className="block text-xs font-semibold text-slate-500 mb-2">アイキャッチ画像</label>
          <ThumbnailGenerator
            title={title}
            content={mode === "visual" && editorRef.current ? editorRef.current.innerHTML : content}
            onApply={(url) => setEyecatch(url)}
          />
          {eyecatch ? (
            <div className="relative rounded-lg overflow-hidden border border-slate-200">
              <div className="aspect-[16/9] relative"><Image src={eyecatch} alt="アイキャッチ" fill className="object-cover" sizes="800px" /></div>
              <button onClick={() => setEyecatch("")} className="absolute top-3 right-3 bg-white/90 hover:bg-white text-red-500 px-3 py-1 rounded-lg text-xs font-medium shadow-sm">削除</button>
            </div>
          ) : (
            <div onClick={() => eyecatchInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setEyecatchDragOver(true); }} onDragLeave={() => setEyecatchDragOver(false)} onDrop={handleEyecatchDrop}
              className={`w-full border-2 border-dashed rounded-lg py-6 md:py-10 flex flex-col items-center gap-1.5 md:gap-2 cursor-pointer transition-colors ${eyecatchDragOver ? "border-blue-400 bg-blue-50/50" : "border-slate-200 hover:border-blue-400"}`}>
              {uploading ? <><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><span className="text-blue-600 text-xs">{uploadProgress || "アップロード中..."}</span></> :
              <><FiUploadCloud size={24} className="text-slate-300" /><span className="text-slate-400 text-xs">タップして画像を選択</span></>}
            </div>
          )}
          <input ref={eyecatchInputRef} type="file" accept="image/*" onChange={handleEyecatchUpload} className="hidden" />
        </div>

        <LineImageGenerator
          title={title}
          content={mode === "visual" && editorRef.current ? editorRef.current.innerHTML : content}
          writerName={writers.find((w) => String(w.id) === writerId)?.name || ""}
          writerAvatarUrl={writers.find((w) => String(w.id) === writerId)?.avatarUrl || null}
          showForGen={showForGen}
          showForVip={showForVip}
          showForVC={showForVC}
        />

        <div className="mb-3">
          <button type="button" onClick={() => setGoogleDocDialogOpen(true)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            Google ドキュメントから取り込み
          </button>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div onDragOver={(e) => { e.preventDefault(); setEditorDragOver(true); }} onDragLeave={() => setEditorDragOver(false)} onDrop={handleEditorDrop} className="relative">
            {editorDragOver && <div className="absolute inset-0 bg-blue-50/80 border-2 border-dashed border-blue-400 rounded-lg z-10 flex items-center justify-center pointer-events-none"><FiUploadCloud size={36} className="text-blue-400" /></div>}
            {mode === "visual" ? (
              <div ref={editorRef} contentEditable onInput={syncFromVisual} onKeyDown={handleEditorKeyDown} onKeyUp={saveSelectionIfInEditor} onMouseUp={saveSelectionIfInEditor} className="min-h-[300px] md:min-h-[500px] px-3 md:px-6 py-3 md:py-4 prose max-w-none outline-none" style={{ whiteSpace: "pre-wrap" }} />
            ) : (
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="HTMLコードを入力...（&lt;p&gt;ごと改行・&lt;br&gt;で改行）" className="w-full min-h-[300px] md:min-h-[500px] px-3 md:px-6 py-3 md:py-4 font-mono text-sm bg-slate-900 text-green-400 outline-none resize-y leading-relaxed whitespace-pre-wrap" spellCheck={false} />
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </div>

        {googleDocDialogOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => !googleDocLoading && setGoogleDocDialogOpen(false)}>
            <div className="bg-white rounded-lg border border-slate-200 shadow-xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm font-semibold text-slate-800 mb-3">Google ドキュメントから取り込み</p>
              <p className="text-xs text-slate-500 mb-2">ドキュメントのURLを貼り付けてください。件名→タイトル、見出し2〜4→H2〜H4、太字・下線・色を反映します。画像は可能な範囲でアップロードします。</p>
              <input type="url" value={googleDocUrl} onChange={(e) => setGoogleDocUrl(e.target.value)} placeholder="https://docs.google.com/document/d/..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-blue-500" disabled={googleDocLoading} />
              <p className="text-xs text-amber-600 mb-3">※ ドキュメントを「リンクを知っている全員が閲覧可」にするか、サービスアカウントに共有してください。</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setGoogleDocDialogOpen(false)} disabled={googleDocLoading} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
                <button type="button" onClick={importFromGoogleDoc} disabled={googleDocLoading || !googleDocUrl.trim()} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {googleDocLoading ? "取り込み中..." : "取り込む"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* リンク挿入・編集ダイアログ */}
        {linkDialogOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => { setLinkDialogOpen(false); editingLinkAnchorRef.current = null; }}>
            <div className="bg-white rounded-lg border border-slate-200 shadow-xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm font-semibold text-slate-800 mb-3">{editingLinkAnchorRef.current ? "テキストリンクを編集" : "テキストリンク"}</p>
              <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="リンク先URL" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-blue-500" />
              <div className="mb-3">
                <label className="block text-xs text-slate-500 mb-1">色（任意）</label>
                <div className="flex items-center gap-2">
                  <input type="text" value={linkColor} onChange={(e) => setLinkColor(e.target.value)} placeholder="例: #1e40af" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  <input type="color" value={linkColor.startsWith("#") && linkColor.length >= 7 ? linkColor : "#1e40af"} onChange={(e) => setLinkColor(e.target.value)} className="w-10 h-9 rounded border border-slate-200 cursor-pointer" title="色選択" />
                </div>
              </div>
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input type="checkbox" checked={linkNewTab} onChange={(e) => setLinkNewTab(e.target.checked)} className="rounded border-slate-300" />
                <span className="text-sm text-slate-700">別タブで開く</span>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setLinkDialogOpen(false); editingLinkAnchorRef.current = null; }} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
                <button type="button" onClick={submitLink} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingLinkAnchorRef.current ? "更新" : "挿入"}</button>
              </div>
            </div>
          </div>
        )}

        {/* ボタンリンク挿入・編集ダイアログ */}
        {buttonDialogOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => { setButtonDialogOpen(false); editingButtonAnchorRef.current = null; }}>
            <div className="bg-white rounded-lg border border-slate-200 shadow-xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm font-semibold text-slate-800 mb-3">{editingButtonAnchorRef.current ? "ボタンリンクを編集" : "ボタンリンク"}</p>
              <input type="text" value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="ボタンテキスト" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-blue-500" />
              <p className="text-xs text-slate-500 mb-2">「|」でスマホのみ改行、「||」でPC・スマホ両方で改行</p>
              <input type="url" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} placeholder="リンク先URL" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-blue-500" />
              <div className="mb-3">
                <label className="block text-xs text-slate-500 mb-1.5">ボタン色</label>
                <div className="flex gap-2">
                  {[
                    { label: "ブルー", gradient: "linear-gradient(to right, #007adf, #00ecbc)", cls: "btn-c" },
                    { label: "ブラック", gradient: "linear-gradient(to right, #1f2937, #374151, #1f2937)", cls: "btn-k" },
                    { label: "グリーン", gradient: "linear-gradient(to right, #38a169, #48bb78, #68d391)", cls: "btn-g" },
                    { label: "レッド", gradient: "linear-gradient(to right, #e53e3e, #f56565, #fc8181)", cls: "btn-r" },
                    { label: "オレンジ", gradient: "linear-gradient(to right, #dd6b20, #ed8936, #f6ad55)", cls: "btn-o" },
                    { label: "パープル", gradient: "linear-gradient(to right, #805ad5, #9f7aea, #b794f4)", cls: "btn-p" },
                  ].map((c) => {
                    const isActive = (() => { try { return JSON.parse(buttonColor).cls === c.cls; } catch { return false; } })();
                    return (
                      <button key={c.cls} type="button" title={c.label}
                        onClick={() => setButtonColor(JSON.stringify({ cls: c.cls }))}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${isActive ? "border-blue-500 scale-110 ring-2 ring-blue-200" : "border-slate-200 hover:scale-105"}`}
                        style={{ background: c.gradient }} />
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input type="checkbox" checked={buttonNewTab} onChange={(e) => setButtonNewTab(e.target.checked)} className="rounded border-slate-300" />
                <span className="text-sm text-slate-700">別タブで開く</span>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setButtonDialogOpen(false); editingButtonAnchorRef.current = null; }} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
                <button type="button" onClick={submitButton} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingButtonAnchorRef.current ? "更新" : "挿入"}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
