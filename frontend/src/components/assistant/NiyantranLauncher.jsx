import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useAssistant } from '../../context/AssistantContext';

export default function NiyantranLauncher() {
  const { isDocked, isOpen, openAssistant, launcherRef } = useAssistant();
  const [showTooltip, setShowTooltip] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  if (isDocked) {
    return (
      <div
        ref={launcherRef}
        className="fixed bottom-6 right-6 w-12 h-12 pointer-events-none opacity-0 invisible"
        aria-hidden="true"
      />
    );
  }

  return (
    <motion.div
      ref={launcherRef}
      drag
      dragMomentum={false}
      dragElastic={0.15}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => {
        // Small timeout to prevent triggering click immediately after drag
        setTimeout(() => setIsDragging(false), 80);
      }}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 select-none touch-none cursor-grab active:cursor-grabbing"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
    >
      {/* Shortcut Pill */}
      {showTooltip && !isOpen && (
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1C232B] text-white text-[11px] font-sans shadow-lg border border-white/10 animate-in fade-in slide-in-from-right-2 duration-150 pointer-events-none">
          <span className="font-semibold text-accent">NIYANTRAN</span>
          <span className="text-white/40">•</span>
          <span className="text-white/80">Press ⌘/</span>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => {
          if (!isDragging) {
            openAssistant();
          }
        }}
        aria-label="Open NIYANTRAN Guide"
        className="relative group p-3.5 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border border-white/20 flex items-center justify-center"
      >
        {/* Subtle radiating glow ring */}
        <span className="absolute -inset-1 rounded-2xl bg-indigo-600 opacity-35 group-hover:opacity-65 blur-xs transition-opacity animate-pulse" />

        <div className="relative flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>

        {/* Live Active Pill Indicator */}
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white" />
        </span>
      </button>
    </motion.div>
  );
}
