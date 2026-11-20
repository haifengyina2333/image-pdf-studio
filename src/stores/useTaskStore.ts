import { create } from 'zustand';
import { triggerBlobDownload } from '../bridge/engine';

export type TaskStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface BackgroundTask {
  id: string;
  kind:
    | 'image-export'
    | 'image-batch'
    | 'image-copy'
    | 'image-face-detect'
    | 'image-split'
    | 'image-project'
    | 'pdf-compress'
    | 'pdf-merge'
    | 'pdf-split'
    | 'pdf-organize'
    | 'pdf-watermark'
    | 'pdf-image-to-pdf'
    | 'pdf-to-image';
  title: string;
  status: TaskStatus;
  stage: string;
  progress: { current: number; total: number } | null;
  summary?: string;
  error?: string;
  downloadBlob?: Blob;
  downloadName?: string;
  startedAt: number;
  finishedAt?: number;
}

interface TaskContext {
  signal: AbortSignal;
  report: (stage: string, progress?: { current: number; total: number } | null) => void;
}

interface TaskResult {
  summary: string;
  downloadBlob?: Blob;
  downloadName?: string;
}

interface TaskState {
  tasks: BackgroundTask[];
  runTask: (
    meta: { kind: BackgroundTask['kind']; title: string; initialStage?: string },
    executor: (ctx: TaskContext) => Promise<TaskResult>
  ) => Promise<void>;
  cancelTask: (id: string) => void;
  dismissTask: (id: string) => void;
  redownloadTask: (id: string) => void;
}

// Controllers stay outside Zustand serialization and outside any React component tree.
const controllers = new Map<string, AbortController>();

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],

  runTask: async ({ kind, title, initialStage = '准备中…' }, executor) => {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const controller = new AbortController();
    controllers.set(id, controller);

    const nextTask: BackgroundTask = {
      id,
      kind,
      title,
      status: 'running',
      stage: initialStage,
      progress: null,
      startedAt: Date.now()
    };

    set((state) => {
      const all = [nextTask, ...state.tasks];
      const running = all.filter((t) => t.status === 'running');
      const finished = all.filter((t) => t.status !== 'running').slice(0, 6);
      return { tasks: [...running, ...finished] };
    });

    const report = (stage: string, progress: { current: number; total: number } | null = null) => {
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id && t.status === 'running' ? { ...t, stage, progress } : t))
      }));
    };

    try {
      const result = await executor({ signal: controller.signal, report });
      if (controller.signal.aborted) throw new DOMException('任务已取消', 'AbortError');

      if (result.downloadBlob && result.downloadName) {
        triggerBlobDownload(result.downloadBlob, result.downloadName);
      }

      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                status: 'completed',
                stage: '已完成',
                summary: result.summary,
                downloadBlob: result.downloadBlob,
                downloadName: result.downloadName,
                finishedAt: Date.now()
              }
            : t
        )
      }));
    } catch (err) {
      const aborted = controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError');
      const message = err instanceof Error ? err.message : '处理失败，请重试。';
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                status: aborted ? 'cancelled' : 'failed',
                stage: aborted ? '已取消' : '处理失败',
                error: aborted ? undefined : message,
                finishedAt: Date.now()
              }
            : t
        )
      }));
    } finally {
      controllers.delete(id);
    }
  },

  cancelTask: (id) => {
    controllers.get(id)?.abort();
  },

  dismissTask: (id) => {
    if (controllers.has(id)) return; // Don't dismiss a running task without cancelling
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
  },

  redownloadTask: (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (task?.downloadBlob && task.downloadName) {
      triggerBlobDownload(task.downloadBlob, task.downloadName);
    }
  }
}));
