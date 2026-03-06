import { useTranslation } from "react-i18next";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { formatFileSize, formatETA } from "@/lib/format";
import type { TaskInfo, UnifiedFileItem } from "@/types";

type Phase = "running" | "done";

interface StatsBarProps {
  tasks: TaskInfo[];
  items: UnifiedFileItem[];
  phase: Phase;
}

export function StatsBar({ tasks, items, phase }: StatsBarProps) {
  const { t } = useTranslation();

  if (phase === "running") {
    const completedTasks = tasks.filter((tk) => tk.status === "completed");
    const totalTasks = tasks.length;
    const runningTask = tasks.find((tk) => tk.status === "running");
    const speed = runningTask?.speed ?? 0;
    const eta = runningTask?.eta ?? 0;

    return (
      <div className="flex items-center gap-3 text-[13px]">
        <RefreshCw size={16} className="animate-spin-slow text-primary" />
        <span className="font-medium">
          {t("stats.compressing", {
            current: completedTasks.length + 1,
            total: totalTasks,
          })}
        </span>
        {speed > 0 && (
          <span className="text-muted-foreground">
            {t("task.speed", { speed: speed.toFixed(1) })}
          </span>
        )}
        {eta > 0 && (
          <span className="text-muted-foreground">
            {t("task.eta", { time: formatETA(eta) })}
          </span>
        )}
      </div>
    );
  }

  // Phase: done
  const completedTasks = tasks.filter((tk) => tk.status === "completed");
  const totalOriginal = items.reduce((sum, item) => sum + item.size, 0);
  const totalCompressed = completedTasks.reduce(
    (sum, tk) => sum + (tk.outputSize ?? 0),
    0,
  );
  const totalSaved = totalOriginal - totalCompressed;
  const savedPercent =
    totalOriginal > 0 ? ((totalSaved / totalOriginal) * 100).toFixed(0) : "0";

  return (
    <div className="flex items-center gap-3 text-[13px]">
      <CheckCircle2 size={16} className="text-success" />
      <span className="font-medium">
        {t("stats.successCount", { count: completedTasks.length })}
      </span>
      {totalSaved > 0 && (
        <span className="text-xs text-success">
          ({formatFileSize(totalSaved)} saved, -{savedPercent}%)
        </span>
      )}
    </div>
  );
}
