import { useEffect } from "react";

interface ShortcutMap {
  [key: string]: () => void;
}

/**
 * Register global keyboard shortcuts.
 * Keys use format: "ctrl+s", "meta+enter", "escape", "space", etc.
 * Modifier keys: ctrl, meta (cmd), alt, shift
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("ctrl");
      if (e.metaKey) parts.push("meta");
      if (e.altKey) parts.push("alt");
      if (e.shiftKey) parts.push("shift");

      const key = e.key.toLowerCase();
      if (!["control", "meta", "alt", "shift"].includes(key)) {
        parts.push(key === " " ? "space" : key);
      }

      const combo = parts.join("+");
      const action = shortcuts[combo];
      if (action) {
        e.preventDefault();
        action();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
