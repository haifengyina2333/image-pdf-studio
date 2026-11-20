import { motion } from 'motion/react';
import { FileText, Home, Image as ImageIcon, Loader2, Moon, Settings, Sparkles, Sun } from 'lucide-react';
import { RouteId, useAppStore } from '../stores/useAppStore';
import { useTaskStore } from '../stores/useTaskStore';

const NAV_ITEMS: { id: RouteId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'image', label: '图片', icon: ImageIcon },
  { id: 'pdf', label: 'PDF', icon: FileText },
  { id: 'settings', label: '设置', icon: Settings }
];

export function Topbar() {
  const route = useAppStore((s) => s.route);
  const setRoute = useAppStore((s) => s.setRoute);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const tasks = useTaskStore((s) => s.tasks);
  const runningTasks = tasks.filter((t) => t.status === 'running');

  return (
    <header
      className="flex min-h-[50px] shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border px-3.5 py-1.5 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-3 md:py-0"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--line)',
        boxShadow: 'var(--shadow-card)'
      }}
    >
      <button
        type="button"
        onClick={() => setRoute('home')}
        className="flex w-fit items-center gap-2.5 text-left transition-opacity hover:opacity-85"
      >
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white"
          style={{ background: 'var(--gemini-grad)', boxShadow: 'var(--gemini-glow)' }}
        >
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="truncate text-[14.5px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
          图片 PDF 工作台
        </span>
        <span
          className="hidden rounded-full border px-2 py-0.5 font-mono text-[11.5px] font-bold sm:inline-block"
          style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)', color: 'var(--muted)' }}
        >
          v2 Studio
        </span>
      </button>

      <nav aria-label="主导航" className="relative flex items-center gap-1 rounded-full p-1" style={{ background: 'var(--bg-well)' }}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = route === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setRoute(id)}
              aria-current={active ? 'page' : undefined}
              data-active={active || undefined}
              className="studio-tab relative flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold"
            >
              {active && (
                <motion.span
                  layoutId="primary-nav-pill"
                  transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                  className="absolute inset-0 rounded-full border"
                  style={{
                    background: 'var(--bg-surface)',
                    borderColor: 'var(--line)',
                    boxShadow: '0 1px 4px rgba(15, 23, 42, 0.08)'
                  }}
                />
              )}
              <Icon className="relative z-10 h-3.5 w-3.5" />
              <span className="relative z-10">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex items-center justify-end gap-2">
        {runningTasks.length > 0 ? (
          <div
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-semibold"
            style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
            title="后台任务运行中，切换页面不会中断"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="max-w-[140px] truncate">{runningTasks[0].stage}</span>
          </div>
        ) : (
          <div
            className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] md:flex"
            style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)', color: 'var(--muted)' }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--success)' }} />
            <span>仅本地处理</span>
          </div>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="切换浅色或深色主题"
          title="切换浅色 / 深色主题"
          className="studio-icon-btn grid h-8 w-8 place-items-center rounded-full border hover:scale-105 active:scale-95"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
