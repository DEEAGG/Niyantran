import React from 'react';
import { Sparkles } from 'lucide-react';
import { useAssistant } from '../../context/AssistantContext';

export default function NiyantranNavbarDock() {
  const { isDocked, restoreFromNavbar, dockBtnRef } = useAssistant();

  return (
    <button
      ref={dockBtnRef}
      type="button"
      id="topbar-niyantran-dock"
      onClick={restoreFromNavbar}
      aria-label="Restore NIYANTRAN Guide"
      title="Restore NIYANTRAN Guide (Click to expand)"
      className={`items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95 ${
        isDocked
          ? 'inline-flex bg-[#FDF1EE] text-[#C5300B] border border-[#E43D12]/40 hover:bg-[#FBE4DF]'
          : 'hidden'
      }`}
    >
      <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-[#E43D12] to-[#EFB112] flex items-center justify-center text-white shrink-0">
        <Sparkles className="w-2.5 h-2.5" />
      </span>
      <span className="font-bold tracking-tight">NIYANTRAN</span>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
    </button>
  );
}
