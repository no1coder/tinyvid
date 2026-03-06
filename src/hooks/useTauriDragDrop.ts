import { useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

interface DragDropState {
  isDragging: boolean;
  droppedPaths: string[];
}

// Global singleton to avoid multiple listeners
let listenerSetup = false;
const subscribers = new Set<(state: Partial<DragDropState>) => void>();

function setupGlobalListener() {
  if (listenerSetup) return;
  listenerSetup = true;

  getCurrentWebview()
    .onDragDropEvent((event) => {
      if (event.payload.type === "enter" || event.payload.type === "over") {
        for (const sub of subscribers) {
          sub({ isDragging: true });
        }
      } else if (event.payload.type === "drop") {
        for (const sub of subscribers) {
          sub({ isDragging: false, droppedPaths: event.payload.paths });
        }
      } else if (event.payload.type === "leave") {
        for (const sub of subscribers) {
          sub({ isDragging: false });
        }
      }
    })
    .catch((err) => {
      console.error("Failed to setup drag-drop listener:", err);
      listenerSetup = false;
    });
}

export function useTauriDragDrop(
  onDrop: (paths: string[]) => void,
  enabled = true,
) {
  const [isDragging, setIsDragging] = useState(false);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  useEffect(() => {
    if (!enabled) return;

    setupGlobalListener();

    const handler = (state: Partial<DragDropState>) => {
      if (state.isDragging !== undefined) {
        setIsDragging(state.isDragging);
      }
      if (state.droppedPaths && state.droppedPaths.length > 0) {
        onDropRef.current(state.droppedPaths);
      }
    };

    subscribers.add(handler);
    return () => {
      subscribers.delete(handler);
    };
  }, [enabled]);

  return { isDragging };
}
