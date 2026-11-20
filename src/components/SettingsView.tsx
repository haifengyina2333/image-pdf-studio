import { motion } from 'motion/react';
import { Loader2, Moon, ShieldCheck, Sun } from 'lucide-react';
import { supportsNativeJpegClipboard } from '../bridge/engine';
import { CopyImageFormat, useAppStore } from '../stores/useAppStore';
import { useTaskStore } from '../stores/useTaskStore';

const COPY_EDGES = [
  { value: 1600, label: '1600 px（超轻量，微信/钉钉秒贴）' },
  { value: 2048, label: '2048 px（更快，适合聊天软件）' },
  { value: 3072, label: '3072 px（清晰均衡）' },
  { value: 4096, label: '4096 px（默认推荐）' },
  { value: 0, label: '原始尺寸（不缩放）' }
];

export function SettingsView() {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const copyMaxEdge = useAppStore((s) => s.copyMaxEdge);
  const setCopyMaxEdge = useAppStore((s) => s.setCopyMaxEdge);
  const copyFormat = useAppStore((s) => s.copyFormat);
  const setCopyFormat = useAppStore((s) => s.setCopyFormat);
  const tasks = useTaskStore((s) => s.tasks);
  const runningTasks = tasks.filter((t) => t.status === 'running');
  const nativeJpeg = supportsNativeJpegClipboard();

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto w-full max-w-[760px] flex-1 py-4"
    >
      <div
        className="rounded-3xl border p-6 sm:p-8"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--line)',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <span
          className="inline-block rounded-full border px-2.5 py-0.5 text-[12.5px] font-bold"
          style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
        >
          应用偏好设置
        </span>
        <h1 className="mt-2 text-[22px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
          外观与本地性能
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--muted)' }}>
          设置仅保存在当前浏览器。切换到此页面不会中断任何正在进行的图片导出或 PDF 压缩任务。
        </p>

        {runningTasks.length > 0 && (
          <div
            className="mt-4 flex items-center gap-2.5 rounded-2xl border p-3.5 text-[13.5px] font-semibold"
            style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
          >
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            <span>
              后台仍有 {runningTasks.length} 项任务正在稳定运行（{runningTasks[0].title}：{runningTasks[0].stage}），左下角可随时查看进度或取消。
            </span>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div
            className="flex items-center justify-between rounded-2xl border p-4"
            style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)' }}
          >
            <div>
              <p className="text-[14px] font-bold" style={{ color: 'var(--ink)' }}>
                界面主题
              </p>
              <p className="mt-0.5 text-[13px]" style={{ color: 'var(--muted)' }}>
                当前为{theme === 'dark' ? '深色 Studio 工作台' : '浅色 Gemini Studio'}，支持 1.05 秒柔和慢溶切换。
              </p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="studio-secondary-btn inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[13.5px] font-semibold"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span>切到{theme === 'dark' ? '浅色' : '深色'}</span>
            </button>
          </div>

          <div className="rounded-2xl border p-4" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[14px] font-bold" style={{ color: 'var(--ink)' }}>
                剪贴板复制格式
              </p>
              <span
                className="rounded-full border px-2.5 py-0.5 text-[12px] font-semibold"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--line)', color: 'var(--muted)' }}
              >
                当前浏览器原生支持：PNG ✅ · JPG {nativeJpeg ? '✅' : '⚠️ 需兼容模式'}
              </span>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
              主流浏览器（Chrome / Edge / Safari）的系统剪贴板接口底层仅原生放行 PNG。选择「JPG 优先」时，若浏览器支持原生 JPG 则直写 JPG；否则自动以轻量 JPG 写入富文本（Word / 邮件 / 飞书文档直接获得小体积 JPG）并附带兼容 PNG（保证微信/QQ 粘贴不报错）。
            </p>
            <div className="mt-3 grid max-w-md grid-cols-2 gap-1.5 rounded-xl p-1" style={{ background: 'var(--bg-well)' }}>
              {(
                [
                  ['image/png', 'PNG（无损通用）'],
                  ['image/jpeg', 'JPG 优先（更省空间）']
                ] as [CopyImageFormat, string][]
              ).map(([fmt, label]) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setCopyFormat(fmt)}
                  data-active={copyFormat === fmt || undefined}
                  className="studio-seg-btn h-8.5 rounded-lg text-[13px] font-semibold"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-4" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)' }}>
            <label htmlFor="v2CopyEdge" className="block text-[14px] font-bold" style={{ color: 'var(--ink)' }}>
              复制图片最长边上限（最直接控制粘贴体积）
            </label>
            <p className="mt-0.5 text-[13px]" style={{ color: 'var(--muted)' }}>
              超过上限时等比缩小后再写入剪贴板，调小到 1600–2048 px 可减少 70% 以上剪贴板体积；不影响文件导出分辨率。
            </p>
            <select
              id="v2CopyEdge"
              value={copyMaxEdge}
              onChange={(e) => setCopyMaxEdge(Number(e.target.value))}
              className="mt-3 h-9 w-full max-w-sm rounded-xl border px-3 text-[13.5px]"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
            >
              {COPY_EDGES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--muted)' }}>
            <ShieldCheck className="h-4 w-4" style={{ color: 'var(--success)' }} />
            <span>所有图像处理与 PDF 压缩均在你的浏览器内存中完成，零服务器上传。</span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
