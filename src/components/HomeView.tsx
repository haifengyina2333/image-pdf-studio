import { motion } from 'motion/react';
import {
  ArrowRight,
  Droplets,
  FileArchive,
  FileStack,
  Grid3X3,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Minimize2,
  ScanFace,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { ImageToolId, useImageStore } from '../stores/useImageStore';
import { PdfToolId, usePdfStore } from '../stores/usePdfStore';

export function HomeView() {
  const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  const pasteKey = isMac ? '⌘V' : 'Ctrl+V';
  const setRoute = useAppStore((s) => s.setRoute);
  const setImageTool = useImageStore((s) => s.setTool);
  const setPdfTool = usePdfStore((s) => s.setTool);

  const goImage = (tool: ImageToolId) => {
    setImageTool(tool);
    setRoute('image');
  };

  const goPdf = (tool: PdfToolId) => {
    setPdfTool(tool);
    setRoute('pdf');
  };

  const cards = [
    { title: '图片加水印', desc: '文字/Logo、办公模板、本地预设库', icon: Droplets, onClick: () => goImage('watermark') },
    { title: '人脸打码', desc: '本地 AI 识脸与表情联动可爱贴纸/马赛克', icon: ScanFace, onClick: () => goImage('redact') },
    { title: '拼接图片', desc: '纵/横/网格拼图，拖拉换位与工程存档', icon: Layers, onClick: () => goImage('stitch') },
    { title: '图片切割', desc: '自动识线或九宫格切图，支持拆散重拼', icon: Grid3X3, onClick: () => goImage('split') },
    { title: '压缩图片', desc: '单张或批量减小体积，支持 ZIP 打包', icon: Minimize2, onClick: () => goImage('compress') },
    { title: 'PDF 页面整理', desc: '缩略图拖拽调序、单页旋转与删页', icon: LayoutGrid, onClick: () => goPdf('organize') },
    { title: '压缩 PDF', desc: '无损整理或图像强力压缩，后台不中断', icon: FileArchive, onClick: () => goPdf('compress') },
    { title: '合并 PDF', desc: '多份文档自由排序，原样合为一份', icon: FileStack, onClick: () => goPdf('merge') }
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto flex w-full max-w-[980px] flex-1 flex-col justify-center py-3"
    >
      <div
        className="relative overflow-hidden rounded-3xl border p-6 sm:p-8"
        style={{
          background:
            'radial-gradient(520px 240px at 92% 0%, rgba(99, 102, 241, 0.14), transparent 72%), radial-gradient(420px 200px at 8% 100%, rgba(56, 189, 248, 0.1), transparent 72%), var(--bg-surface)',
          borderColor: 'var(--line)',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <h1 className="text-[26px] font-extrabold tracking-tight sm:text-[34px]" style={{ color: 'var(--ink)' }}>
          你想处理什么文件？
        </h1>
        <p className="mt-1.5 max-w-[620px] text-[13.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          选择下方任意工具，直接把图片或 PDF 拖到窗口，或按{' '}
          <kbd
            className="rounded-md border px-1.5 py-0.5 font-mono text-[13px] font-semibold"
            style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line-strong)', color: 'var(--ink-2)' }}
          >
            {pasteKey}
          </kbd>{' '}
          粘贴截图立即开始。
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => goImage('watermark')}
            className="gemini-btn inline-flex h-9 items-center gap-2 rounded-full px-5 text-[13px] font-semibold"
          >
            <ImageIcon className="h-4 w-4" />
            <span>打开图片工作台（9 工具）</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => goPdf('compress')}
            className="studio-secondary-btn inline-flex h-9 items-center gap-2 rounded-full border px-5 text-[13px] font-semibold hover:-translate-y-0.5 active:scale-95"
          >
            <FileArchive className="h-4 w-4" />
            <span>打开 PDF 工作台（8 工具）</span>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-[13px]" style={{ color: 'var(--muted)' }}>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} />
            纯本地运行，原文件不上传、不覆盖
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
            AI 人脸模型 / PDF / HEIC 全部按需加载 · 后台任务切换页面不中断
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ title, desc, icon: Icon, onClick }, index) => (
          <motion.button
            key={title}
            type="button"
            onClick={onClick}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.985 }}
            className="studio-home-card group flex items-start gap-3 rounded-2xl border p-3.5 text-left"
          >
            <span className="studio-home-icon grid h-9 w-9 shrink-0 place-items-center rounded-xl group-hover:scale-105">
              <Icon className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <strong className="studio-home-title block text-[13.5px] font-bold">
                {title}
              </strong>
              <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: 'var(--muted)' }}>
                {desc}
              </span>
            </div>
          </motion.button>
        ))}
      </div>

      <footer className="mt-8 text-center text-[12px] tracking-wide opacity-75" style={{ color: 'var(--muted)' }}>
        前端 Gemini Neon + 后端 GPT6.2Sol
      </footer>
    </motion.section>
  );
}
