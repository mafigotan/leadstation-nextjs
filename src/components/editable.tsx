"use client";

import { createElement, useLayoutEffect, useRef } from "react";

/**
 * Inline text editing in the draft (contentEditable). The text is kept as a plain string;
 * with `rich`, **bold** and [label](url) markup are shown as bold text and links.
 */

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function markupToHtml(s: string): string {
  return escHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\n/g, "<br>");
}

function nodeToMarkup(node: Node, rich: boolean, top = false): string {
  let out = "";
  node.childNodes.forEach((n, idx) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out += (n.textContent ?? "").replace(/ /g, " ");
      return;
    }
    if (!(n instanceof HTMLElement)) return;
    const tag = n.tagName;
    const inner = nodeToMarkup(n, rich);
    if (tag === "BR") out += "\n";
    else if (tag === "DIV" || tag === "P") out += (idx > 0 || !top ? "\n" : "") + inner;
    else if (rich && (tag === "B" || tag === "STRONG")) out += inner.trim() ? `**${inner}**` : inner;
    else if (rich && tag === "A" && /^https?:\/\//.test(n.getAttribute("href") ?? "")) out += `[${inner}](${n.getAttribute("href")})`;
    else out += inner;
  });
  return out;
}

export function Editable({
  value,
  onChange,
  as = "div",
  className = "",
  placeholder = "",
  rich = false,
  single = false,
  onEnter,
  onRemoveEmpty,
  edKey,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  as?: string;
  className?: string;
  placeholder?: string;
  rich?: boolean;
  /** Enter does nothing (titles, labels). */
  single?: boolean;
  /** Enter adds the next item (lists). */
  onEnter?: () => void;
  /** Backspace in an empty item removes it (lists). */
  onRemoveEmpty?: () => void;
  edKey?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const html = rich ? markupToHtml(value) : escHtml(value).replace(/\n/g, "<br>");
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [value, rich]);

  return createElement(as, {
    ref,
    contentEditable: true,
    suppressContentEditableWarning: true,
    "data-ed": edKey,
    "data-ph": placeholder,
    style,
    className: `ls-editable cursor-text outline-none ${className}`,
    onInput: (e: React.FormEvent<HTMLElement>) => {
      const el = e.currentTarget;
      let v = nodeToMarkup(el, rich, true).replace(/\n$/, "");
      if (single) v = v.replace(/\n/g, " ");
      if (!el.textContent) el.innerHTML = "";
      onChange(v);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
        if (onEnter) {
          e.preventDefault();
          onEnter();
        } else if (single) e.preventDefault();
      }
      if (e.key === "Backspace" && onRemoveEmpty && !e.currentTarget.textContent) {
        e.preventDefault();
        onRemoveEmpty();
      }
    },
    onPaste: (e: React.ClipboardEvent<HTMLElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, single ? text.replace(/\s*\n\s*/g, " ") : text);
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      // Re-render the stored text so markup typed by hand (**bold**) shows formatted.
      const el = e.currentTarget;
      if (rich) {
        const html = markupToHtml(value);
        if (el.innerHTML !== html) el.innerHTML = html;
      }
    },
  });
}

/** Moves the caret into the element with this data-ed key (after it renders). */
export function focusEd(key: string, atEnd = true) {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`[data-ed="${CSS.escape(key)}"]`);
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(!atEnd);
    sel.removeAllRanges();
    sel.addRange(r);
  });
}
