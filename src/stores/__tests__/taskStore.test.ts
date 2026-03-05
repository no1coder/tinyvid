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

const makeTask = (overrides = {}) => ({
  id: "task_1",
  inputPath: "/test/video.mp4",
  outputPath: "/test/video_compressed.mp4",
  fileName: "video.mp4",
  status: "pending" as const,
  progress: 0,
  inputSize: 1000000,
  outputSize: null,
  error: null,
  fps: 0,
  speed: 0,
  eta: 0,
  currentSize: 0,
  timeElapsed: 0,
  estimatedOutputSize: null,
  estimatedTime: null,
  ...overrides,
});

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
    it("setTasks adds tasks with default fields", () => {
      useTaskStore.getState().setTasks([makeTask()]);
      const task = useTaskStore.getState().tasks[0];
      expect(task).toBeDefined();
      expect(task.fps).toBe(0);
      expect(task.speed).toBe(0);
      expect(task.eta).toBe(0);
      expect(task.estimatedOutputSize).toBeNull();
    });

    it("handleProgressEvent updates task with fps/speed/eta", () => {
      useTaskStore.getState().setTasks([makeTask()]);

      const event: ProgressEvent = {
        type: "progress",
        taskId: "task_1",
        percent: 50,
        fps: 30,
        speed: 2.5,
        eta: 15,
        currentSize: 500000,
        timeElapsed: 10,
      };
      useTaskStore.getState().handleProgressEvent(event);

      const task = useTaskStore.getState().tasks[0];
      expect(task.progress).toBe(50);
      expect(task.status).toBe("running");
      expect(task.fps).toBe(30);
      expect(task.speed).toBe(2.5);
      expect(task.eta).toBe(15);
      expect(task.currentSize).toBe(500000);
    });

    it("handleProgressEvent is immutable", () => {
      useTaskStore.getState().setTasks([makeTask()]);
      const before = useTaskStore.getState().tasks;

      useTaskStore.getState().handleProgressEvent({
        type: "progress",
        taskId: "task_1",
        percent: 50,
      });

      const after = useTaskStore.getState().tasks;
      expect(before).not.toBe(after);
    });

    it("handleProgressEvent handles completed (resets fps/speed/eta)", () => {
      useTaskStore.getState().setTasks([
        makeTask({ status: "running", progress: 80, fps: 30, speed: 2.5, eta: 5 }),
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
      expect(task.fps).toBe(0);
      expect(task.speed).toBe(0);
      expect(task.eta).toBe(0);
    });

    it("handleProgressEvent handles failed", () => {
      useTaskStore.getState().setTasks([makeTask({ status: "running" })]);

      useTaskStore.getState().handleProgressEvent({
        type: "failed",
        taskId: "task_1",
        error: "Disk full",
      });

      const task = useTaskStore.getState().tasks[0];
      expect(task.status).toBe("failed");
      expect(task.error).toBe("Disk full");
    });

    it("handleProgressEvent handles cancelled", () => {
      useTaskStore.getState().setTasks([makeTask({ status: "running" })]);

      useTaskStore.getState().handleProgressEvent({
        type: "cancelled",
        taskId: "task_1",
      });

      const task = useTaskStore.getState().tasks[0];
      expect(task.status).toBe("cancelled");
    });

    it("clearCompletedTasks removes finished tasks", () => {
      useTaskStore.getState().setTasks([
        makeTask({ id: "task_1", status: "completed", progress: 100 }),
        makeTask({ id: "task_2", status: "running", progress: 30 }),
      ]);

      useTaskStore.getState().clearCompletedTasks();
      const tasks = useTaskStore.getState().tasks;
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe("task_2");
    });

    it("removeTask removes by id", () => {
      useTaskStore.getState().setTasks([
        makeTask({ id: "task_1" }),
        makeTask({ id: "task_2", inputPath: "/b.mp4" }),
      ]);

      useTaskStore.getState().removeTask("task_1");
      expect(useTaskStore.getState().tasks).toHaveLength(1);
      expect(useTaskStore.getState().tasks[0].id).toBe("task_2");
    });

    it("handleProgressEvent handles started event", () => {
      useTaskStore.getState().setTasks([makeTask()]);

      useTaskStore.getState().handleProgressEvent({
        type: "started",
        taskId: "task_1",
      });

      const task = useTaskStore.getState().tasks[0];
      expect(task.status).toBe("running");
      expect(task.progress).toBe(0);
    });

    it("handleProgressEvent ignores unknown taskId", () => {
      useTaskStore.getState().setTasks([makeTask()]);

      useTaskStore.getState().handleProgressEvent({
        type: "progress",
        taskId: "unknown_task",
        percent: 50,
      });

      // Original task should be unchanged
      const task = useTaskStore.getState().tasks[0];
      expect(task.progress).toBe(0);
    });

    it("handleProgressEvent failed resets fps/speed/eta", () => {
      useTaskStore.getState().setTasks([
        makeTask({ status: "running", fps: 30, speed: 2.5, eta: 10 }),
      ]);

      useTaskStore.getState().handleProgressEvent({
        type: "failed",
        taskId: "task_1",
        error: "encoder crashed",
      });

      const task = useTaskStore.getState().tasks[0];
      expect(task.fps).toBe(0);
      expect(task.speed).toBe(0);
      expect(task.eta).toBe(0);
    });

    it("handleProgressEvent cancelled resets fps/speed/eta", () => {
      useTaskStore.getState().setTasks([
        makeTask({ status: "running", fps: 30, speed: 2.5, eta: 10 }),
      ]);

      useTaskStore.getState().handleProgressEvent({
        type: "cancelled",
        taskId: "task_1",
      });

      const task = useTaskStore.getState().tasks[0];
      expect(task.fps).toBe(0);
      expect(task.speed).toBe(0);
      expect(task.eta).toBe(0);
    });

    it("clearCompletedTasks also removes failed and cancelled", () => {
      useTaskStore.getState().setTasks([
        makeTask({ id: "task_1", status: "completed" }),
        makeTask({ id: "task_2", status: "failed" }),
        makeTask({ id: "task_3", status: "cancelled" }),
        makeTask({ id: "task_4", status: "running" }),
        makeTask({ id: "task_5", status: "pending" }),
      ]);

      useTaskStore.getState().clearCompletedTasks();
      const tasks = useTaskStore.getState().tasks;
      expect(tasks).toHaveLength(2);
      expect(tasks.map((t) => t.id)).toEqual(["task_4", "task_5"]);
    });
  });

  describe("updateEstimations", () => {
    it("updates pending task estimations", () => {
      const video = { ...mockVideo, path: "/test/video.mp4" };
      useTaskStore.getState().addVideos([video]);
      useTaskStore.getState().setTasks([
        makeTask({
          id: "task_1",
          inputPath: "/test/video.mp4",
          status: "pending",
        }),
      ]);

      const config = {
        codec: "h265",
        crf: 23,
        useHardware: true,
        resolution: "original",
        audioBitrate: "copy",
        outputDir: null,
        maxConcurrency: null,
      };
      const encoders = [
        {
          name: "hevc_videotoolbox",
          codec: "h265",
          isHardware: true,
          priority: 10,
        },
      ];

      useTaskStore.getState().updateEstimations(config, encoders);

      const task = useTaskStore.getState().tasks[0];
      expect(task.estimatedOutputSize).not.toBeNull();
      expect(task.estimatedTime).not.toBeNull();
      expect(task.estimatedOutputSize!).toBeGreaterThan(0);
      expect(task.estimatedTime!).toBeGreaterThan(0);
    });

    it("skips non-pending tasks", () => {
      useTaskStore.getState().addVideos([mockVideo]);
      useTaskStore.getState().setTasks([
        makeTask({ id: "task_1", status: "running" }),
      ]);

      useTaskStore.getState().updateEstimations(
        {
          codec: "h265",
          crf: 23,
          useHardware: true,
          resolution: "original",
          audioBitrate: "copy",
          outputDir: null,
        maxConcurrency: null,
        },
        [],
      );

      const task = useTaskStore.getState().tasks[0];
      expect(task.estimatedOutputSize).toBeNull();
    });
  });
});
