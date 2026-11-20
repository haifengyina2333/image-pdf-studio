import { ReactNode } from 'react';

interface WorkbenchShellProps {
  sources: ReactNode;
  showSources?: boolean;
  stage: ReactNode;
  inspectorHeader: ReactNode;
  inspectorBody: ReactNode;
  inspectorFooter: ReactNode;
}

/**
 * Unified 3-column Studio Workbench shared across Image & PDF tools.
 * Desktop (>=1024px): locked to single-viewport 3-column layout.
 * Narrow (<1024px): naturally scrollable vertical stack with bounded queue strip so Export is never clipped!
 */
export function WorkbenchShell({
  sources,
  showSources = true,
  stage,
  inspectorHeader,
  inspectorBody,
  inspectorFooter
}: WorkbenchShellProps) {
  return (
    <section
      className="grid min-h-0 flex-1 grid-cols-1 rounded-2xl border lg:grid-cols-[224px_minmax(0,1fr)_332px] lg:overflow-hidden"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--line)',
        boxShadow: 'var(--shadow-card)',
        gridTemplateColumns: showSources ? undefined : 'minmax(0, 1fr) 332px'
      }}
    >
      {/* Left Sources / Queue Rail */}
      {showSources && (
        <aside
          className="flex max-h-[190px] min-h-0 flex-col border-b lg:max-h-none lg:border-r lg:border-b-0"
          style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)' }}
        >
          {sources}
        </aside>
      )}

      {/* Center Preview Stage */}
      <div className="studio-dot-stage relative flex min-h-[340px] min-w-0 flex-col overflow-hidden lg:min-h-0">
        {stage}
      </div>

      {/* Right Compact Inspector with Sticky Header + Pinned Export Footer */}
      <aside
        className="flex min-h-0 flex-col border-t lg:border-t-0 lg:border-l"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--line)' }}
      >
        <div className="shrink-0 border-b px-3.5 py-2.5" style={{ borderColor: 'var(--line)' }}>
          {inspectorHeader}
        </div>
        <div className="min-h-0 flex-1 px-3.5 py-3 lg:overflow-y-auto">{inspectorBody}</div>
        <div
          className="shrink-0 border-t px-3.5 py-3"
          style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)' }}
        >
          {inspectorFooter}
        </div>
      </aside>
    </section>
  );
}
