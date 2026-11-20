(() => {
  const ns = window.Toolbox ??= {};
  let sequence = 0;

  class TaskController {
    constructor(onChange = () => {}) { this.onChange = onChange; this.activeTask = null; }
    create(tool, resourceScope) {
      if (this.activeTask?.status === 'running') this.cancel(this.activeTask.id);
      const task = { id: `task_${Date.now()}_${++sequence}`, tool, status: 'queued', stage: 'prepare', progress: { current: 0, total: 0, percent: 0 }, error: null, abortController: new AbortController(), resourceScope, startedAt: null, completedAt: null };
      this.activeTask = task; this.emit(task); return task;
    }
    start(task, stage = 'decode') { task.status = 'running'; task.stage = stage; task.startedAt = Date.now(); this.emit(task); }
    stage(task, stage) { if (!this.isActive(task)) return; task.stage = stage; this.emit(task); }
    progress(task, current, total) { if (!this.isActive(task)) return; task.progress = { current, total, percent: total ? Math.round(current / total * 100) : 0 }; this.emit(task); }
    complete(task) { if (!this.isActive(task)) return; task.status = 'completed'; task.stage = 'done'; task.completedAt = Date.now(); this.emit(task); }
    fail(task, error) { if (!this.isActive(task)) return; task.status = 'failed'; task.error = error; task.completedAt = Date.now(); this.emit(task); }
    cancel(id = this.activeTask?.id) { const task = this.activeTask; if (!task || task.id !== id || task.status !== 'running') return false; task.abortController.abort(); task.status = 'cancelled'; task.stage = 'cancelled'; task.completedAt = Date.now(); this.emit(task); return true; }
    isActive(task) { return Boolean(task) && this.activeTask?.id === task.id && task.status === 'running'; }
    clear() { this.activeTask = null; this.onChange(null); }
    emit(task) { this.onChange({ ...task }); }
  }
  ns.TaskController = TaskController;
})();
