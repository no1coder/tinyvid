import { useEffect } from "react";
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import type { Toast } from "@/stores/appStore";

const ICON_MAP = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const COLOR_MAP = {
  success: "bg-[#34c75926] text-success",
  error: "bg-[#ff3b3026] text-destructive",
  warning: "bg-[#ffcc0026] text-[#ffcc00]",
  info: "bg-[#0a84ff26] text-primary",
} as const;

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useAppStore();
  const Icon = ICON_MAP[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  return (
    <div
      className={`animate-slide-in-top flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs shadow-xl backdrop-blur-xl ${COLOR_MAP[toast.type]}`}
      style={{ border: "0.5px solid rgba(255,255,255,0.1)" }}
    >
      <Icon size={14} className="shrink-0" />
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useAppStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-14 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
