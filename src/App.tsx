import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GlobalTaskTray } from './components/GlobalTaskTray';
import { HomeView } from './components/HomeView';
import { ImageWorkspace } from './components/ImageWorkspace';
import { PdfWorkspace } from './components/PdfWorkspace';
import { SettingsView } from './components/SettingsView';
import { Topbar } from './components/Topbar';
import { useAppStore } from './stores/useAppStore';
import { useImageStore } from './stores/useImageStore';
import { usePdfStore } from './stores/usePdfStore';

export function App() {
  const route = useAppStore((s) => s.route);
  const setRoute = useAppStore((s) => s.setRoute);
  const toast = useAppStore((s) => s.toast);
  const [dragging, setDragging] = useState(false);

  // Global drag-and-drop & Cmd/Ctrl+V paste routing
  useEffect(() => {
    let depth = 0;
    const onDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        depth += 1;
        setDragging(true);
      }
    };
    const onDragLeave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      depth = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (!files.length) return;
      e.preventDefault();
      const pdfs = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
      const images = files.filter((f) => !pdfs.includes(f));
      if (pdfs.length && images.length) {
        useAppStore.getState().notify('请分开拖入图片和 PDF 文件', 'error');
        return;
      }
      if (pdfs.length) {
        setRoute('pdf');
        if (usePdfStore.getState().tool === 'image-to-pdf') usePdfStore.getState().setTool('compress');
        usePdfStore.getState().importFiles(pdfs);
      } else if (images.length) {
        if (useAppStore.getState().route === 'pdf' && usePdfStore.getState().tool === 'image-to-pdf') {
          usePdfStore.getState().importPdfImages(images);
        } else {
          setRoute('image');
          useImageStore.getState().importFiles(images);
        }
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const imgs = items
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((f): f is File => Boolean(f));
      if (!imgs.length) return;
      e.preventDefault();
      if (useAppStore.getState().route === 'pdf' && usePdfStore.getState().tool === 'image-to-pdf') {
        usePdfStore.getState().importPdfImages(imgs);
      } else {
        setRoute('image');
        useImageStore.getState().importFiles(imgs);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const tag = document.activeElement?.tagName;
      const inField = Boolean(tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag));
      const curRoute = useAppStore.getState().route;
      if (curRoute === 'image') {
        const imgState = useImageStore.getState();
        if (mod && e.key.toLowerCase() === 's') {
          if (e.repeat) {
            e.preventDefault();
            return;
          }
          if (imgState.items.length) {
            e.preventDefault();
            imgState.exportCurrent();
          }
          return;
        }
        if (mod && e.shiftKey && e.key.toLowerCase() === 'c') {
          if (e.repeat) {
            e.preventDefault();
            return;
          }
          if (imgState.items.length) {
            e.preventDefault();
            imgState.copyCurrentPng();
          }
          return;
        }
        if (!inField && !mod && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && imgState.items.length > 1 && imgState.tool !== 'stitch') {
          const idx = imgState.items.findIndex((i) => i.id === imgState.selectedId);
          const curIdx = idx >= 0 ? idx : 0;
          const next = imgState.items[(curIdx + (e.key === 'ArrowRight' ? 1 : -1) + imgState.items.length) % imgState.items.length];
          if (next) {
            e.preventDefault();
            imgState.selectItem(next.id);
          }
        }
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    window.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [setRoute]);

  return (
    <div className="relative flex min-h-dvh w-full flex-col gap-2.5 p-2.5 sm:px-4 sm:py-3 lg:h-dvh lg:overflow-hidden">
      <Topbar />

      <main className="flex min-h-0 flex-1 flex-col">
        {route === 'home' && <HomeView />}
        {route === 'image' && <ImageWorkspace />}
        {route === 'pdf' && <PdfWorkspace />}
        {route === 'settings' && <SettingsView />}
      </main>

      <GlobalTaskTray />

      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-3 z-50 grid place-items-center rounded-3xl border-2 border-dashed backdrop-blur-xs"
            style={{
              background: 'color-mix(in srgb, var(--accent-soft) 72%, transparent)',
              borderColor: 'var(--accent)'
            }}
          >
            <div
              className="rounded-2xl border px-6 py-4 text-center"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent-border)', boxShadow: 'var(--shadow-float)' }}
            >
              <p className="text-[15px] font-bold" style={{ color: 'var(--accent)' }}>
                松开鼠标即可导入
              </p>
              <p className="mt-1 text-[12px]" style={{ color: 'var(--muted)' }}>
                图片进入图片工作台 · PDF 进入 PDF 工作台
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            role="status"
            className="pointer-events-none fixed top-[112px] left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-1.5 text-[12px] font-semibold text-white shadow-xl"
            style={{
              background: toast.tone === 'error' ? 'var(--danger)' : 'rgba(15, 23, 42, 0.92)'
            }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
