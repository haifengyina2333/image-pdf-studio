import { create } from 'zustand';

export type RouteId = 'home' | 'image' | 'pdf' | 'settings';
export type ThemeMode = 'light' | 'dark';
export type CopyImageFormat = 'image/png' | 'image/jpeg';

export interface ToastItem {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface AppState {
  route: RouteId;
  theme: ThemeMode;
  copyMaxEdge: number;
  copyFormat: CopyImageFormat;
  toast: ToastItem | null;
  setRoute: (route: RouteId) => void;
  toggleTheme: () => void;
  setCopyMaxEdge: (edge: number) => void;
  setCopyFormat: (fmt: CopyImageFormat) => void;
  notify: (message: string, tone?: 'info' | 'success' | 'error') => void;
}

const getInitialTheme = (): ThemeMode => {
  try {
    return localStorage.getItem('toolbox-v2-theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

const getInitialCopyEdge = (): number => {
  try {
    const saved = localStorage.getItem('toolbox-v2-copy-edge');
    if (saved === null) return 4096;
    const raw = Number(saved);
    return [0, 1600, 2048, 3072, 4096].includes(raw) ? raw : 4096;
  } catch {
    return 4096;
  }
};

const getInitialCopyFormat = (): CopyImageFormat => {
  try {
    return localStorage.getItem('toolbox-v2-copy-format') === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  } catch {
    return 'image/png';
  }
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;
let themeTimer: ReturnType<typeof setTimeout> | undefined;

export const useAppStore = create<AppState>((set, get) => ({
  route: 'home',
  theme: getInitialTheme(),
  copyMaxEdge: getInitialCopyEdge(),
  copyFormat: getInitialCopyFormat(),
  toast: null,

  setRoute: (route) => set({ route }),

  toggleTheme: () => {
    const next: ThemeMode = get().theme === 'dark' ? 'light' : 'dark';
    const apply = () => {
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem('toolbox-v2-theme', next);
      } catch {}
      set({ theme: next });
    };

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (!reduceMotion && typeof document.startViewTransition === 'function') {
      const transition = document.startViewTransition(apply);
      transition.ready
        .then(() => {
          document.documentElement.animate(
            { opacity: [0, 1] },
            { duration: 1050, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
          );
        })
        .catch(() => {});
      return;
    }

    document.documentElement.classList.add('is-theme-switching');
    apply();
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => document.documentElement.classList.remove('is-theme-switching'), 1100);
  },

  setCopyMaxEdge: (edge) => {
    try {
      localStorage.setItem('toolbox-v2-copy-edge', String(edge));
    } catch {}
    set({ copyMaxEdge: edge });
  },

  setCopyFormat: (copyFormat) => {
    try {
      localStorage.setItem('toolbox-v2-copy-format', copyFormat);
    } catch {}
    set({ copyFormat });
  },

  notify: (message, tone = 'info') => {
    const id = Date.now() + Math.random();
    set({ toast: { id, message, tone } });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, 3000);
  }
}));
