import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, CheckCircle2, XCircle, AlertCircle, Clock, FolderOpen, FileVideo } from "lucide-react";
import { useTaskStore } from "@/stores/taskStore";
import { useCompression } from "@/hooks/useCompression";
import { formatFileSize } from "@/lib/format";
import type { TaskStatusType } from "@/types";

type FilterType = "all" | "completed" | "failed" | "cancelled";

function StatusBadge({ status }: { status: TaskStatusType }) {
  switch (status) {
    case "completed":
      return (
        <span className="badge-success inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
          <CheckCircle2 size={10} />
        </span>
      );
    case "failed":
      return (
        <span className="badge-error inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
          <XCircle size={10} /> Failed
        </span>
      );
    case "cancelled":
      return (
        <span className="badge-cancelled inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
          <AlertCircle size={10} /> Cancelled
        </span>
      );
    case "running":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#0a84ff1a] px-2 py-0.5 text-[10px] font-medium text-primary">
          <Clock size={10} /> Running
        </span>
      );
    case "pending":
      return (
        <span className="badge-ready inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
          <Clock size={10} /> Pending
        </span>
      );
    default:
      return null;
  }
}

export function TaskHistoryPage() {
  const { t } = useTranslation();
  const { tasks } = useTaskStore();
  const { showInFolder } = useCompression();
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filter !== "all" && task.status !== filter) return false;
      if (search && !task.fileName.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [tasks, filter, search]);

  const counts = useMemo(() => {
    const completed = tasks.filter((tk) => tk.status === "completed").length;
    const failed = tasks.filter((tk) => tk.status === "failed").length;
    return { total: tasks.length, completed, failed };
  }, [tasks]);

  const filters: { id: FilterType; label: string; count?: number }[] = [
    { id: "all", label: t("taskHistory.all"), count: counts.total },
    { id: "completed", label: t("taskHistory.completed"), count: counts.completed },
    { id: "failed", label: t("taskHistory.failed"), count: counts.failed },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page header */}
      <div className="shrink-0 px-5 pb-3 pt-4">
        <h2 className="mb-0.5 text-lg font-semibold">{t("taskHistory.title")}</h2>
        <p className="text-xs text-muted-foreground">
          {t("taskHistory.subtitle")}
        </p>
      </div>

      {/* Filters + Search */}
      <div className="flex shrink-0 items-center justify-between px-5 pb-3">
        <div className="flex items-center gap-1.5">
          {filters.map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-all ${
                filter === id
                  ? "bg-[#0a84ff1a] text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {count !== undefined && (
                <span className="badge-ready rounded-full px-1.5 text-[10px]">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder={t("taskHistory.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-card h-7 w-40 rounded-lg pl-7 pr-3 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto px-5 pb-3">
        {filteredTasks.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {t("taskHistory.empty")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {filteredTasks.map((task) => {
              const savedPercent =
                task.status === "completed" &&
                task.outputSize !== null &&
                task.inputSize > 0
                  ? ((1 - task.outputSize / task.inputSize) * 100).toFixed(0)
                  : null;

              return (
                <div
                  key={task.id}
                  className="glass-card glass-card-hover flex items-center gap-3 rounded-[10px] px-4 py-3 transition-all"
                >
                  {/* File icon */}
                  <div className="icon-bg flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                    <FileVideo size={17} className="opacity-80" />
                  </div>

                  {/* File info */}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[14px] font-medium">
                      {task.fileName}
                    </span>
                    <span className="text-[12px] text-muted-foreground">
                      {formatFileSize(task.inputSize)}
                      {task.status === "completed" && task.outputSize !== null && (
                        <span className="text-success">
                          {" → "}{formatFileSize(task.outputSize)}
                        </span>
                      )}
                      {task.status === "failed" && task.error && (
                        <span className="text-destructive"> · {task.error}</span>
                      )}
                    </span>
                  </div>

                  {/* Saved badge */}
                  {savedPercent !== null && (
                    <span className="badge-success shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold">
                      -{savedPercent}%
                    </span>
                  )}

                  {/* Status */}
                  <StatusBadge status={task.status} />

                  {/* Actions */}
                  {task.status === "completed" && task.outputPath && (
                    <button
                      onClick={() => showInFolder(task.outputPath)}
                      className="delete-btn shrink-0 rounded-md p-1.5 transition-all hover:text-primary"
                      title={t("task.showInFolder")}
                    >
                      <FolderOpen size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
