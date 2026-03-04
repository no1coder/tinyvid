import { useTranslation } from "react-i18next";
import { BarChart3 } from "lucide-react";
import type { TaskInfo } from "@/types";
import { formatFileSize, formatCompressionRatio } from "@/lib/format";

interface ComparisonViewProps {
  tasks: TaskInfo[];
}

export function ComparisonView({ tasks }: ComparisonViewProps) {
  const { t } = useTranslation();

  const completedTasks = tasks.filter(
    (t) => t.status === "completed" && t.outputSize != null,
  );

  if (completedTasks.length === 0) return null;

  const totalOriginal = completedTasks.reduce((sum, t) => sum + t.inputSize, 0);
  const totalCompressed = completedTasks.reduce(
    (sum, t) => sum + (t.outputSize ?? 0),
    0,
  );
  const totalSaved = totalOriginal - totalCompressed;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold">{t("comparison.title")}</h3>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase">
            {t("comparison.original")}
          </p>
          <p className="text-sm font-semibold">{formatFileSize(totalOriginal)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase">
            {t("comparison.compressed")}
          </p>
          <p className="text-sm font-semibold text-primary">
            {formatFileSize(totalCompressed)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase">
            {t("comparison.saved")}
          </p>
          <p className="text-sm font-semibold text-green-500">
            {formatFileSize(totalSaved)} (
            {formatCompressionRatio(totalOriginal, totalCompressed)})
          </p>
        </div>
      </div>

      {/* Per-file results */}
      {completedTasks.length > 1 && (
        <div className="mt-3 border-t border-border pt-3">
          {completedTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between py-1 text-[10px]"
            >
              <span className="truncate max-w-[200px]">{task.fileName}</span>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span>{formatFileSize(task.inputSize)}</span>
                <span>→</span>
                <span className="text-primary">
                  {formatFileSize(task.outputSize ?? 0)}
                </span>
                <span className="text-green-500 font-medium">
                  {formatCompressionRatio(task.inputSize, task.outputSize ?? 0)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
