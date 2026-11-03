import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { assistantService } from '../services/assistantService';

const AssistantContext = createContext(null);

const DEFAULT_WELCOME = {
  id: 'welcome-msg',
  sender: 'assistant',
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  message: (
    "### Namaste! Welcome to NIYANTRAN\n\n"
    + "I am your statutory intelligence guide for AICTE Approval Process Handbook (APH 2024-27) norms, in-app navigation, and institutional filing progression.\n\n"
    + "How can I assist your workflow today?"
  ),
  suggested_actions: [
    { label: "What should I do next?", path: null, query: "What should I do next?", variant: "primary" },
    { label: "Where is Monitoring?", path: "/monitoring", variant: "secondary" },
    { label: "Explain Land Area norms", path: null, query: "Explain Land Area requirements under AICTE norms", variant: "secondary" }
  ],
  citations: []
};

export function AssistantProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDocked, setIsDocked] = useState(() => {
    try {
      return localStorage.getItem('niyantran_dock_state') === 'docked';
    } catch {
      return false;
    }
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem('niyantran_messages');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [DEFAULT_WELCOME];
  });

  const launcherRef = useRef(null);
  const dockBtnRef = useRef(null);

  // Sync messages to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('niyantran_messages', JSON.stringify(messages));
    } catch {
      // storage full or disabled
    }
  }, [messages]);

  // Global keyboard shortcut to toggle assistant: Cmd+/ or Ctrl+/
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        if (isDocked) {
          restoreFromNavbar();
        } else {
          setIsOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDocked]);

  const openAssistant = () => setIsOpen(true);
  const closeAssistant = () => setIsOpen(false);

  const clearMessages = () => {
    setMessages([DEFAULT_WELCOME]);
    sessionStorage.removeItem('niyantran_messages');
  };

  /**
   * Smooth Flight Animation: Floating Launcher/Panel -> CommandNavbar Dock
   */
  const minimizeToNavbar = () => {
    if (isAnimating) return;
    setIsOpen(false);

    const launcherEl = launcherRef.current;
    const dockEl = dockBtnRef.current;
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || !launcherEl || !dockEl) {
      setIsDocked(true);
      try {
        localStorage.setItem('niyantran_dock_state', 'docked');
      } catch {}
      return;
    }

    setIsAnimating(true);
    dockEl.style.display = 'inline-flex';
    dockEl.style.visibility = 'hidden';

    const startRect = launcherEl.getBoundingClientRect();
    const destRect = dockEl.getBoundingClientRect();

    // Create flying clone
    const clone = document.createElement('div');
    clone.className = 'niyantran-flying-clone fixed pointer-events-none z-[9999] flex items-center justify-center rounded-2xl shadow-2xl';
    clone.style.left = `${startRect.left}px`;
    clone.style.top = `${startRect.top}px`;
    clone.style.width = `${startRect.width}px`;
    clone.style.height = `${startRect.height}px`;
    clone.style.background = 'linear-gradient(135deg, #E43D12 0%, #EFB112 100%)';
    clone.style.border = '1px solid rgba(255, 255, 255, 0.4)';
    clone.style.boxShadow = '0 10px 25px -5px rgba(228, 61, 18, 0.5)';
    clone.innerHTML = '<span style="color:white; font-size: 18px; font-weight: bold;">✦</span>';
    document.body.appendChild(clone);

    const dx = destRect.left - startRect.left;
    const dy = destRect.top - startRect.top;
    const targetScale = destRect.height && startRect.height ? destRect.height / startRect.height : 0.75;

    const keyframes = [
      { transform: 'translate3d(0, 0, 0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate3d(${dx * 0.32 - 25}px, ${dy * 0.40}px, 0) scale(1) rotate(-4deg)`, opacity: 0.95, offset: 0.35 },
      { transform: `translate3d(${dx * 0.72 - 10}px, ${dy * 0.78}px, 0) scale(${(1 + targetScale) / 2}) rotate(-2deg)`, opacity: 0.95, offset: 0.72 },
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${targetScale}) rotate(0deg)`, opacity: 1 },
    ];

    const onFinish = () => {
      clone.remove();
      dockEl.style.visibility = 'visible';
      dockEl.classList.add('niyantran-landing-pulse');
      setTimeout(() => {
        dockEl.classList.remove('niyantran-landing-pulse');
      }, 500);
      setIsDocked(true);
      setIsAnimating(false);
      try {
        localStorage.setItem('niyantran_dock_state', 'docked');
      } catch {}
    };

    if (typeof clone.animate === 'function') {
      const anim = clone.animate(keyframes, {
        duration: 550,
        easing: 'cubic-bezier(0.25, 1, 0.4, 1)',
        fill: 'forwards',
      });
      anim.onfinish = onFinish;
    } else {
      setTimeout(onFinish, 550);
    }
  };

  /**
   * Smooth Reverse Flight Animation: CommandNavbar Dock -> Floating Launcher
   */
  const restoreFromNavbar = () => {
    if (isAnimating) return;

    const launcherEl = launcherRef.current;
    const dockEl = dockBtnRef.current;
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || !launcherEl || !dockEl) {
      setIsDocked(false);
      setIsOpen(true);
      try {
        localStorage.setItem('niyantran_dock_state', 'floating');
      } catch {}
      return;
    }

    setIsAnimating(true);
    const startRect = dockEl.getBoundingClientRect();

    // Temporarily unhide launcher to read layout coordinates
    launcherEl.style.visibility = 'hidden';
    setIsDocked(false);

    requestAnimationFrame(() => {
      const destRect = launcherEl.getBoundingClientRect();
      launcherEl.style.visibility = 'visible';

      const clone = document.createElement('div');
      clone.className = 'niyantran-flying-clone fixed pointer-events-none z-[9999] flex items-center justify-center rounded-2xl shadow-2xl';
      clone.style.left = `${startRect.left}px`;
      clone.style.top = `${startRect.top}px`;
      clone.style.width = `${startRect.width}px`;
      clone.style.height = `${startRect.height}px`;
      clone.style.background = 'linear-gradient(135deg, #E43D12 0%, #EFB112 100%)';
      clone.style.border = '1px solid rgba(255, 255, 255, 0.4)';
      clone.style.boxShadow = '0 10px 25px -5px rgba(228, 61, 18, 0.5)';
      clone.innerHTML = '<span style="color:white; font-size: 16px; font-weight: bold;">✦</span>';
      document.body.appendChild(clone);

      const dx = destRect.left - startRect.left;
      const dy = destRect.top - startRect.top;
      const startScale = startRect.height && destRect.height ? startRect.height / destRect.height : 0.75;

      const keyframes = [
        { transform: 'translate3d(0, 0, 0) scale(1) rotate(0deg)', opacity: 1 },
        { transform: `translate3d(${dx * 0.28 + 15}px, ${dy * 0.35}px, 0) scale(${(1 + startScale) / 2}) rotate(3deg)`, opacity: 0.95, offset: 0.35 },
        { transform: `translate3d(${dx * 0.68 + 8}px, ${dy * 0.72}px, 0) scale(1) rotate(1deg)`, opacity: 0.95, offset: 0.72 },
        { transform: `translate3d(${dx}px, ${dy}px, 0) scale(1) rotate(0deg)`, opacity: 1 },
      ];

      const onFinish = () => {
        clone.remove();
        setIsAnimating(false);
        setIsOpen(true);
        try {
          localStorage.setItem('niyantran_dock_state', 'floating');
        } catch {}
      };

      if (typeof clone.animate === 'function') {
        const anim = clone.animate(keyframes, {
          duration: 550,
          easing: 'cubic-bezier(0.25, 1, 0.4, 1)',
          fill: 'forwards',
        });
        anim.onfinish = onFinish;
      } else {
        setTimeout(onFinish, 550);
      }
    });
  };

  return (
    <AssistantContext.Provider
      value={{
        isOpen,
        isDocked,
        isAnimating,
        messages,
        setMessages,
        clearMessages,
        openAssistant,
        closeAssistant,
        minimizeToNavbar,
        restoreFromNavbar,
        launcherRef,
        dockBtnRef,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
}

export default AssistantContext;
