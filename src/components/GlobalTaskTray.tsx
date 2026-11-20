import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Download, Loader2, X } from 'lucide-react';
import { useTaskStore } from '../stores/useTaskStore';

export function GlobalTaskTray() {
  const tasks = useTaskStore((s) => s.tasks);
  const cancelTask = useTaskStore((s) => s.cancelTask);
  const dismissTask = useTaskStore((s) => s.dismissTask);
  const redownloadTask = useTaskStore((s) => s.redownloadTask);

  // Auto-dismiss completed/cancelled task cards after 4.5s so they never linger
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    tasks.forEach((t) => {
      if (t.status === 'completed' || t.status === 'cancelled') {
        const elapsed = Date.now() - (t.finishedAt ?? Date.now());
        const remaining = Math.max(400, 4500 - elapsed);
        timers.push(setTimeout(() => dismissTask(t.id), remaining));
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [tasks, dismissTask]);

  // Keep running/failed tasks visible, plus at most 1 most-recent completed/cancelled card
  const activeTasks = tasks.filter((t) => t.status === 'running' || t.status === 'failed');
  const latestDone = tasks.find((t) => t.status === 'completed' || t.status === 'cancelled');
  const visibleTasks = latestDone ? [...activeTasks.slice(0, 2), latestDone] : activeTasks.slice(0, 3);
  if (!visibleTasks.length) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-4 z-50 flex w-[308px] max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {visibleTasks.map((task) => {
          const pct =
            task.progress && task.progress.total > 0
              ? Math.min(100, Math.round((task.progress.current / task.progress.total) * 100))
              : null;

          return (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto rounded-2xl border px-3 py-2.5"
              style={{
                background: 'var(--bg-surface)',
                borderColor:
                  task.status === 'running'
                    ? 'var(--accent-border)'
                    : task.status === 'failed'
                      ? 'var(--danger)'
                      : 'var(--line)',
                boxShadow: 'var(--shadow-float)'
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {task.status === 'running' && <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: 'var(--accent)' }} />}
                  {task.status === 'completed' && <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--success)' }} />}
                  {(task.status === 'failed' || task.status === 'cancelled') && (
                    <AlertCircle className="h-4 w-4 shrink-0" style={{ color: task.status === 'failed' ? 'var(--danger)' : 'var(--muted)' }} />
                  )}
                  <span className="truncate text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                    {task.title}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {task.status === 'completed' && task.downloadBlob && task.downloadName && (
                    <button
                      type="button"
                      onClick={() => redownloadTask(task.id)}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-semibold transition-colors hover:opacity-85"
                      style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
                    >
                      <Download className="h-3 w-3" />
                      <span>下载</span>
                    </button>
                  )}
                  {task.status === 'running' ? (
                    <button
                      type="button"
                      onClick={() => cancelTask(task.id)}
                      className="shrink-0 rounded-full border px-2 py-0.5 text-[12.5px] font-semibold transition-colors hover:opacity-80"
                      style={{ background: 'var(--danger-soft)', borderColor: 'transparent', color: 'var(--danger)' }}
                    >
                      取消
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => dismissTask(task.id)}
                      aria-label="关闭任务通知"
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors hover:opacity-80"
                      style={{ color: 'var(--muted)' }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-1 truncate text-[12.5px] leading-snug" style={{ color: task.status === 'failed' ? 'var(--danger)' : 'var(--muted)' }}>
                {task.status === 'completed' ? task.summary : task.error || task.stage}
              </p>

              {task.status === 'running' && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--bg-well)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: pct !== null ? `${Math.max(8, pct)}%` : '38%',
                      background: 'var(--gemini-grad)'
                    }}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
