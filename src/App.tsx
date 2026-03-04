import { AppLayout } from "@/components/layout/AppLayout";
import { DropZone } from "@/components/import/DropZone";
import { FileList } from "@/components/import/FileList";
import { ParameterPanel } from "@/components/settings/ParameterPanel";
import { TaskQueue } from "@/components/task/TaskQueue";
import { ComparisonView } from "@/components/comparison/ComparisonView";
import { useTaskStore } from "@/stores/taskStore";
import { useFileImport } from "@/hooks/useFileImport";
import { useCompression } from "@/hooks/useCompression";
import { useHardwareInfo } from "@/hooks/useHardwareInfo";

export default function App() {
  useHardwareInfo();

  const { videos, tasks, removeVideo, clearVideos } = useTaskStore();
  const { importFiles, isProbing } = useFileImport();
  const { isCompressing, start, cancelAll, clearCompleted } = useCompression();

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Left panel - Import & Settings */}
        <div className="flex w-[360px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-border p-4">
          <DropZone
            onFilesSelected={importFiles}
            disabled={isProbing || isCompressing}
          />
          <FileList
            videos={videos}
            onRemove={removeVideo}
            onClearAll={clearVideos}
          />
          <ParameterPanel />
        </div>

        {/* Right panel - Tasks & Results */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <TaskQueue
            tasks={tasks}
            videos={videos}
            isCompressing={isCompressing}
            onStart={start}
            onCancelAll={cancelAll}
            onClearCompleted={clearCompleted}
          />
          <ComparisonView tasks={tasks} />
        </div>
      </div>
    </AppLayout>
  );
}
