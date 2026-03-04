import { describe, it, expect, beforeEach } from "vitest";
import { useTaskStore } from "../taskStore";
import type { VideoInfo, ProgressEvent } from "@/types";

const mockVideo: VideoInfo = {
  path: "/test/video.mp4",
  fileName: "video.mp4",
  size: 1000000,
  duration: 60.0,
  width: 1920,
  height: 1080,
  codec: "h264",
  bitrate: 5000000,
  fps: 30,
  audioCodec: "aac",
  audioBitrate: 128000,
};

describe("taskStore", () => {
  beforeEach(() => {
    useTaskStore.setState({ videos: [], tasks: [] });
  });

  describe("videos", () => {
    it("addVideos adds unique videos", () => {
      useTaskStore.getState().addVideos([mockVideo]);
      expect(useTaskStore.getState().videos).toHaveLength(1);

      // Adding same video again should not duplicate
      useTaskStore.getState().addVideos([mockVideo]);
      expect(useTaskStore.getState().videos).toHaveLength(1);
    });

    it("addVideos creates new array (immutable)", () => {
      const before = useTaskStore.getState().videos;
      useTaskStore.getState().addVideos([mockVideo]);
      const after = useTaskStore.getState().videos;
      expect(before).not.toBe(after);
    });

    it("removeVideo removes by path", () => {
      useTaskStore.getState().addVideos([mockVideo]);
      useTaskStore.getState().removeVideo("/test/video.mp4");
      expect(useTaskStore.getState().videos).toHaveLength(0);
    });

    it("clearVideos removes all", () => {
      useTaskStore.getState().addVideos([mockVideo]);
      useTaskStore.getState().clearVideos();
      expect(useTaskStore.getState().videos).toHaveLength(0);
    });
  });

  describe("tasks", () => {
    it("setTasks adds tasks", () => {
      const tasks = [
        {
          id: "task_1",
          inputPath: "/test/video.mp4",
          outputPath: "/test/video_compressed.mp4",
          fileName: "video.mp4",
          status: "pending" as const,
          progress: 0,
          inputSize: 1000000,
          outputSize: null,
          error: null,
        },
      ];
      useTaskStore.getState().setTasks(tasks);
      expect(useTaskStore.getState().tasks).toHaveLength(1);
    });

    it("handleProgressEvent updates task status (immutable)", () => {
      const task = {
        id: "task_1",
        inputPath: "/test/video.mp4",
        outputPath: "/test/video_compressed.mp4",
        fileName: "video.mp4",
        status: "pending" as const,
        progress: 0,
        inputSize: 1000000,
        outputSize: null,
        error: null,
      };
      useTaskStore.getState().setTasks([task]);
      const before = useTaskStore.getState().tasks;

      const event: ProgressEvent = {
        type: "progress",
        taskId: "task_1",
        percent: 50,
      };
      useTaskStore.getState().handleProgressEvent(event);

      const after = useTaskStore.getState().tasks;
      expect(after[0].progress).toBe(50);
      expect(after[0].status).toBe("running");
      expect(before).not.toBe(after); // immutable
    });

    it("handleProgressEvent handles completed", () => {
      useTaskStore.getState().setTasks([
        {
          id: "task_1",
          inputPath: "/a.mp4",
          outputPath: "/a_compressed.mp4",
          fileName: "a.mp4",
          status: "running" as const,
          progress: 80,
          inputSize: 1000000,
          outputSize: null,
          error: null,
        },
      ]);

      useTaskStore.getState().handleProgressEvent({
        type: "completed",
        taskId: "task_1",
        outputPath: "/a_compressed.mp4",
        outputSize: 500000,
      });

      const task = useTaskStore.getState().tasks[0];
      expect(task.status).toBe("completed");
      expect(task.progress).toBe(100);
      expect(task.outputSize).toBe(500000);
    });

    it("clearCompletedTasks removes finished tasks", () => {
      useTaskStore.getState().setTasks([
        {
          id: "task_1",
          inputPath: "/a.mp4",
          outputPath: "",
          fileName: "a.mp4",
          status: "completed" as const,
          progress: 100,
          inputSize: 100,
          outputSize: 50,
          error: null,
        },
        {
          id: "task_2",
          inputPath: "/b.mp4",
          outputPath: "",
          fileName: "b.mp4",
          status: "running" as const,
          progress: 30,
          inputSize: 200,
          outputSize: null,
          error: null,
        },
      ]);

      useTaskStore.getState().clearCompletedTasks();
      const tasks = useTaskStore.getState().tasks;
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe("task_2");
    });
  });
});
