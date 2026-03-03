"use client";

import { useState, useRef, useEffect } from "react";
import {
  FiEye, FiCode, FiBold, FiItalic, FiList, FiLink, FiImage, FiType,
  FiAlignLeft, FiYoutube, FiMessageSquare, FiBookOpen, FiMousePointer,
  FiChevronDown, FiStar,
} from "react-icons/fi";

type EditorMode = "visual" | "code";

type CustomEditorItem = { id: number; name: string; icon: string; html: string };

type ToolbarProps = {
  mode: EditorMode;
  uploading: boolean;
  customEditors?: CustomEditorItem[];
  onToggleMode: () => void;
  onExecCommand: (command: string, value?: string) => void;
  onInsertHeading: (level: number) => void;
  onInsertLink: () => void;
  onInsertImage: () => void;
  onInsertYoutube: () => void;
  onInsertNote: (color?: string) => void;
  onInsertQuote: (color?: string) => void;
  onInsertButton: (color?: string) => void;
  onInsertCustomHtml: (html: string) => void;
};

function Dropdown({ label, icon, children, dark = false }: { label: string; icon: React.ReactNode; children: React.ReactNode; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors text-xs ${dark ? "text-slate-300 hover:text-white hover:bg-slate-600" : "text-slate-500 hover:text-blue-600 hover:bg-blue-50"}`} title={label}>
        {icon}<FiChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[140px] py-1">
          <div onClick={() => setOpen(false)}>{children}</div>
        </div>
      )}
    </div>
  );
}

function DropdownItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">{children}</button>;
}

function ColorPicker({ label, icon, onSelect }: { label: string; icon: React.ReactNode; onSelect: (color: string) => void }) {
  const colors = [
    "#000000","#434343","#666666","#999999","#cccccc",
    "#ef4444","#f97316","#eab308","#22c55e","#14b8a6",
    "#3b82f6","#6366f1","#a855f7","#ec4899","#f43f5e",
    "#1e40af","#0f766e","#854d0e","#991b1b","#ffffff",
  ];
  return (
    <Dropdown label={label} icon={icon}>
      <div className="p-2 grid grid-cols-5 gap-1 w-[160px]">
        {colors.map((c) => (
          <button key={c} onClick={() => onSelect(c)} className="w-6 h-6 rounded border border-slate-200 hover:scale-110 transition-transform" style={{ background: c }} title={c} />
        ))}
      </div>
    </Dropdown>
  );
}

const BLOCK_COLORS = [
  { label: "ブルー", border: "#3b82f6", bg: "#eff6ff", text: "#1e40af" },
  { label: "グリーン", border: "#22c55e", bg: "#f0fdf4", text: "#166534" },
  { label: "レッド", border: "#ef4444", bg: "#fef2f2", text: "#991b1b" },
  { label: "オレンジ", border: "#f97316", bg: "#fff7ed", text: "#9a3412" },
  { label: "パープル", border: "#a855f7", bg: "#faf5ff", text: "#6b21a8" },
  { label: "グレー", border: "#6b7280", bg: "#f9fafb", text: "#374151" },
];

const BUTTON_COLORS = [
  { label: "ブルー", bg: "#1e40af", gradient: "linear-gradient(to right, #007adf, #00ecbc)", cls: "btn-c" },
  { label: "ブラック", bg: "#111827", gradient: "linear-gradient(to right, #1f2937, #374151, #1f2937)", cls: "btn-k" },
  { label: "グリーン", bg: "#16a34a", gradient: "linear-gradient(to right, #38a169, #48bb78, #68d391)", cls: "btn-g" },
  { label: "レッド", bg: "#dc2626", gradient: "linear-gradient(to right, #e53e3e, #f56565, #fc8181)", cls: "btn-r" },
  { label: "オレンジ", bg: "#ea580c", gradient: "linear-gradient(to right, #dd6b20, #ed8936, #f6ad55)", cls: "btn-o" },
  { label: "パープル", bg: "#7c3aed", gradient: "linear-gradient(to right, #805ad5, #9f7aea, #b794f4)", cls: "btn-p" },
];

const TB = "p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors";

export default function EditorToolbar({
  mode, uploading, customEditors = [],
  onToggleMode, onExecCommand, onInsertHeading, onInsertLink, onInsertImage,
  onInsertYoutube, onInsertNote, onInsertQuote, onInsertButton, onInsertCustomHtml,
}: ToolbarProps) {
  return (
    <div className={`fixed top-14 left-0 right-0 z-40 border-b shadow-sm ${mode === "code" ? "bg-slate-800 border-slate-600" : "bg-white border-slate-200"}`}>
      <div className="max-w-4xl mx-auto px-4 py-1.5 flex items-center gap-0.5 flex-wrap">
        <button onClick={onToggleMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === "code" ? "bg-slate-800 text-white" : "bg-blue-50 text-blue-600"}`}>
          {mode === "visual" ? <><FiEye size={13} /> ビジュアル</> : <><FiCode size={13} /> コード</>}
        </button>

        {/* コードモード用ショートカット（ワードプレス風） */}
        {mode === "code" && (
          <>
            <div className="w-px h-5 bg-slate-300 mx-1" />
            <button onClick={() => onInsertCustomHtml("<p><br></p>")} className="px-2 py-1.5 text-xs font-mono bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors" title="段落">p</button>
            <button onClick={onInsertLink} className="px-2 py-1.5 text-xs font-mono bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors" title="リンク">a</button>
            <button onClick={onInsertImage} disabled={uploading} className={`px-2 py-1.5 text-xs font-mono rounded transition-colors ${uploading ? "bg-slate-800 text-slate-500" : "bg-slate-700 hover:bg-slate-600 text-slate-200"}`} title="画像">img</button>
            <button onClick={onInsertYoutube} className="px-2 py-1.5 text-xs font-mono bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors" title="YouTube">video</button>
            <button onClick={() => onInsertCustomHtml("<ul>\n<li>項目</li>\n</ul>")} className="px-2 py-1.5 text-xs font-mono bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors" title="箇条書き">ul</button>
            <button onClick={() => onInsertCustomHtml("<ol>\n<li>項目</li>\n</ol>")} className="px-2 py-1.5 text-xs font-mono bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors" title="番号リスト">ol</button>
            <button onClick={() => onInsertCustomHtml("<li></li>")} className="px-2 py-1.5 text-xs font-mono bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors" title="リスト項目">li</button>
            <button onClick={() => onInsertCustomHtml("<h2></h2>")} className="px-2 py-1.5 text-xs font-mono bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors" title="H2">h2</button>
            <button onClick={() => onInsertCustomHtml("<h3></h3>")} className="px-2 py-1.5 text-xs font-mono bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors" title="H3">h3</button>
            <button onClick={() => onInsertCustomHtml("<h4></h4>")} className="px-2 py-1.5 text-xs font-mono bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors" title="H4">h4</button>
            <button onClick={() => onInsertCustomHtml('<br class="sp-only">')} className="px-2 py-1.5 text-xs font-mono bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors" title="スマホでここ改行">sp改行</button>
            <div className="w-px h-5 bg-slate-300 mx-1" />
            <Dropdown label="引用" icon={<FiBookOpen size={14} />} dark>
              {BLOCK_COLORS.map((c) => (
                <DropdownItem key={c.label} onClick={() => onInsertQuote(c.border)}>
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm" style={{ background: c.border }} />
                    {c.label}
                  </span>
                </DropdownItem>
              ))}
            </Dropdown>
            <Dropdown label="注釈" icon={<FiMessageSquare size={14} />} dark>
              {BLOCK_COLORS.map((c) => (
                <DropdownItem key={c.label} onClick={() => onInsertNote(c.border)}>
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm" style={{ background: c.border }} />
                    {c.label}
                  </span>
                </DropdownItem>
              ))}
            </Dropdown>
            <Dropdown label="ボタン" icon={<FiMousePointer size={14} />} dark>
              {BUTTON_COLORS.map((c) => (
                <DropdownItem key={c.label} onClick={() => onInsertButton(JSON.stringify({ bg: c.bg, gradient: c.gradient, cls: c.cls }))}>
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm" style={{ background: c.gradient || c.bg }} />
                    {c.label}
                  </span>
                </DropdownItem>
              ))}
            </Dropdown>
            {customEditors.length > 0 && (
              <>
                <div className="w-px h-5 bg-slate-300 mx-1" />
                {customEditors.map((ce) => (
                  <button key={ce.id} onClick={() => onInsertCustomHtml(ce.html)} className="px-2 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors" title={ce.name}>
                    <span className="text-sm">{ce.icon || "⚡"}</span>
                  </button>
                ))}
              </>
            )}
          </>
        )}

        {mode === "visual" && (
          <>
            <div className="w-px h-5 bg-slate-200 mx-1" />

            <Dropdown label="見出し" icon={<FiType size={14} />}>
              <DropdownItem onClick={() => onInsertHeading(2)}>H2 見出し</DropdownItem>
              <DropdownItem onClick={() => onInsertHeading(3)}>H3 見出し</DropdownItem>
              <DropdownItem onClick={() => onInsertHeading(4)}>H4 見出し</DropdownItem>
              <DropdownItem onClick={() => onExecCommand("formatBlock", "p")}>段落</DropdownItem>
            </Dropdown>

            <Dropdown label="サイズ" icon={<span className="text-xs font-bold">A</span>}>
              <DropdownItem onClick={() => onExecCommand("fontSize", "1")}>極小</DropdownItem>
              <DropdownItem onClick={() => onExecCommand("fontSize", "2")}>小</DropdownItem>
              <DropdownItem onClick={() => onExecCommand("fontSize", "3")}>標準</DropdownItem>
              <DropdownItem onClick={() => onExecCommand("fontSize", "4")}>大</DropdownItem>
              <DropdownItem onClick={() => onExecCommand("fontSize", "5")}>特大</DropdownItem>
            </Dropdown>

            <div className="w-px h-5 bg-slate-200 mx-1" />

            <button onClick={() => onExecCommand("bold")} className={TB} title="太字"><FiBold size={14} /></button>
            <button onClick={() => onExecCommand("italic")} className={TB} title="斜体"><FiItalic size={14} /></button>
            <button onClick={() => onExecCommand("underline")} className={TB} title="下線"><span className="text-xs font-bold underline">U</span></button>
            <button onClick={() => onExecCommand("strikeThrough")} className={TB} title="取り消し線"><span className="text-xs font-bold line-through">S</span></button>

            <ColorPicker label="文字色" icon={<span className="text-xs font-bold border-b-2 border-red-500">A</span>} onSelect={(c) => onExecCommand("foreColor", c)} />
            <ColorPicker label="背景色" icon={<span className="text-xs font-bold bg-yellow-200 px-0.5 rounded">A</span>} onSelect={(c) => onExecCommand("hiliteColor", c)} />

            <div className="w-px h-5 bg-slate-200 mx-1" />

            <button onClick={() => onExecCommand("insertUnorderedList")} className={TB} title="箇条書き"><FiList size={14} /></button>
            <button onClick={() => onExecCommand("insertOrderedList")} className={TB} title="番号リスト"><FiAlignLeft size={14} /></button>

            <div className="w-px h-5 bg-slate-200 mx-1" />

            <button onClick={onInsertLink} className={TB} title="リンク"><FiLink size={14} /></button>
            <button onClick={onInsertImage} disabled={uploading} className={`${TB} disabled:opacity-50`} title="画像"><FiImage size={14} /></button>
            <button onClick={onInsertYoutube} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="YouTube"><FiYoutube size={14} /></button>

            <div className="w-px h-5 bg-slate-200 mx-1" />

            {/* 引用（色選択付き） */}
            <Dropdown label="引用" icon={<FiBookOpen size={14} />}>
              {BLOCK_COLORS.map((c) => (
                <DropdownItem key={c.label} onClick={() => onInsertQuote(c.border)}>
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm" style={{ background: c.border }} />
                    {c.label}
                  </span>
                </DropdownItem>
              ))}
            </Dropdown>

            {/* 注釈（色選択付き） */}
            <Dropdown label="注釈" icon={<FiMessageSquare size={14} />}>
              {BLOCK_COLORS.map((c) => (
                <DropdownItem key={c.label} onClick={() => onInsertNote(c.border)}>
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm" style={{ background: c.border }} />
                    {c.label}
                  </span>
                </DropdownItem>
              ))}
            </Dropdown>

            {/* ボタン（色選択付き） */}
            <Dropdown label="ボタン" icon={<FiMousePointer size={14} />}>
              {BUTTON_COLORS.map((c) => (
                <DropdownItem key={c.label} onClick={() => onInsertButton(JSON.stringify({ bg: c.bg, gradient: c.gradient, cls: c.cls }))}>
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm" style={{ background: c.gradient || c.bg }} />
                    {c.label}
                  </span>
                </DropdownItem>
              ))}
            </Dropdown>

            {/* スマホでここ改行（スマホ表示時のみ改行される位置を挿入） */}
            <button onClick={() => onInsertCustomHtml('<br class="sp-only">')} className={TB} title="スマホでここ改行（スマホ表示時のみこの位置で改行）">
              <span className="text-xs font-medium">sp改行</span>
            </button>

            {/* カスタムエディタ */}
            {customEditors.length > 0 && (
              <>
                <div className="w-px h-5 bg-slate-200 mx-1" />
                {customEditors.map((ce) => (
                  <button key={ce.id} onClick={() => onInsertCustomHtml(ce.html)}
                    className={TB} title={ce.name}>
                    <span className="text-sm">{ce.icon || "⚡"}</span>
                  </button>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
