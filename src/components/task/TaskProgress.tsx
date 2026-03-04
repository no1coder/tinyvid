import { cn } from "@/lib/cn";

interface TaskProgressProps {
  percent: number;
  status: string;
}

export function TaskProgress({ percent, status }: TaskProgressProps) {
  const isActive = status === "running";
  const isComplete = status === "completed";

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          isComplete && "bg-green-500",
          isActive && "bg-primary",
          !isActive && !isComplete && "bg-muted-foreground",
        )}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}
