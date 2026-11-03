import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  ArrowRight,
  ArrowUpRight,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Compass,
  BookOpen,
  Activity,
  CheckSquare,
  UploadCloud,
  GitCompare,
  Printer,
  FileSpreadsheet,
  Layers,
  ChevronDown,
  ChevronUp,
  Scale,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAssistant } from '../../context/AssistantContext';
import { assistantService } from '../../services/assistantService';

const ICON_MAP = {
  Activity,
  CheckSquare,
  UploadCloud,
  GitCompare,
  Printer,
  ShieldCheck,
  BookOpen,
  ArrowRight,
  FileSpreadsheet,
  Layers,
  AlertTriangle,
  Scale,
};

export default function NiyantranPanel({ applicationId = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOpen, closeAssistant, minimizeToNavbar, messages, setMessages, clearMessages } = useAssistant();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState([]);
  const [workflowStatus, setWorkflowStatus] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const toggleCard = (id) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Scroll Isolation - Lock body background scrolling while chatbot is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = '';
      };
    }
  }, [isOpen]);

  // Isolated Mousewheel / Touch scroll handler inside conversation container
  const handleChatScroll = (e) => {
    const el = scrollContainerRef.current;
    if (!el) return;

    // Never let this wheel event bubble to parent windows or background page
    e.stopPropagation();

    const { scrollTop, scrollHeight, clientHeight } = el;
    const isScrollingUp = e.deltaY < 0;
    const isScrollingDown = e.deltaY > 0;

    // Stop chaining when reaching scroll limits
    if (isScrollingUp && scrollTop <= 0) {
      e.preventDefault();
    } else if (isScrollingDown && scrollTop + clientHeight >= scrollHeight - 1) {
      e.preventDefault();
    }
  };

  // Load contextual prompts & active workflow status
  useEffect(() => {
    let active = true;

    async function fetchContextData() {
      try {
        const prompts = await assistantService.getSuggestedPrompts(location.pathname);
        if (active && prompts) setSuggestedPrompts(prompts);
      } catch (err) {
        // non-blocking
      }

      try {
        const wf = await assistantService.getWorkflowStatus(applicationId);
        if (active && wf) setWorkflowStatus(wf);
      } catch (err) {
        // non-blocking
      }
    }

    if (isOpen) {
      fetchContextData();
    }

    return () => {
      active = false;
    };
  }, [isOpen, location.pathname, applicationId]);

  const handleSendMessage = async (textToSend) => {
    const queryText = (textToSend || input).trim();
    if (!queryText || loading) return;

    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      message: queryText,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await assistantService.sendMessage(queryText, {
        current_path: location.pathname,
        application_id: applicationId,
      });

      const assistantMsg = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        message: res.message,
        suggested_actions: res.suggested_actions || [],
        citations: res.citations || [],
        evidence_card: res.evidence_card || null,
        response_type: res.response_type || 'standard',
        intent: res.intent,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        message: `### ⚠️ Assistant Connectivity Notice\n\n${err.message || 'Unable to communicate with backend statutory engine. Please verify local connection.'}`,
        suggested_actions: [],
        citations: [],
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (action) => {
    if (action.query) {
      handleSendMessage(action.query);
      return;
    }
    if (action.path) {
      navigate(action.path);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="NIYANTRAN Regulatory Intelligence Guide"
    >
      {/* Soft backdrop blur and focus on left/main content */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300 pointer-events-auto"
        onClick={closeAssistant}
        onWheel={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      />

      {/* Floating Drawer Panel with Spacing, 4 Rounded Corners, Harmonized Brand Palette */}
      <div
        className="fixed top-3 bottom-3 right-3 sm:top-5 sm:bottom-5 sm:right-5 md:top-6 md:bottom-6 md:right-6 w-[calc(100vw-1.5rem)] sm:w-[440px] md:w-[470px] max-w-[calc(100vw-1.5rem)] z-[1201] pointer-events-auto flex flex-col"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div className="relative w-full h-full rounded-2xl sm:rounded-3xl bg-[#0D1117] border border-[#283242] shadow-2xl shadow-black/70 flex flex-col justify-between overflow-hidden font-sans">

          {/* Header: Warm Charcoal Navy with Signature NIYANTRAN Vermilion-Yellow accents */}
          <div className="px-5 py-3.5 border-b border-[#263042] bg-[#161B24]/95 backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#E43D12] via-[#FF5E36] to-[#EFB112] flex items-center justify-center text-white shadow-md shadow-[#E43D12]/30">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white tracking-tight">NIYANTRAN</h2>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-[#E43D12]/15 text-[#FF5E36] border border-[#E43D12]/30 font-semibold">
                    Statutory Grounded
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Regulatory Guide • AICTE APH 2024-27
                </p>
              </div>
            </div>

            {/* Action controls */}
            <div className="flex items-center gap-1">
              {/* AYUR-Intel Style Diagonal Minimize to Navbar Control */}
              <button
                type="button"
                onClick={minimizeToNavbar}
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#FF5E36] hover:bg-[#202736] transition-colors cursor-pointer"
                title="Minimize & Dock to Topbar"
                aria-label="Dock to Navbar"
              >
                <ArrowUpRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={clearMessages}
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#FF5E36] hover:bg-[#202736] transition-colors cursor-pointer"
                title="Reset Conversation"
                aria-label="Reset Conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={closeAssistant}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#202736] transition-colors cursor-pointer"
                title="Close"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Workflow Status Banner Strip */}
          {workflowStatus?.has_application && (
            <div className="px-4 py-2 bg-[#261410] border-b border-[#E43D12]/30 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-1.5 truncate">
                <Compass className="w-3.5 h-3.5 text-[#FF5E36] shrink-0" />
                <span className="font-semibold text-slate-200 text-[11px] truncate">
                  {workflowStatus.institution_name}: Step {workflowStatus.current_step} of 5
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E43D12]/20 text-[#FF5E36] border border-[#E43D12]/30">
                {workflowStatus.step_name}
              </span>
            </div>
          )}

          {/* Message Stream with Isolated Scrolling & overscroll-contain */}
          <div
            ref={scrollContainerRef}
            onWheel={handleChatScroll}
            className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 text-xs font-sans bg-[#0D1117]/80"
            style={{ overscrollBehavior: 'contain' }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#E43D12] via-[#FF5E36] to-[#EFB112] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm shadow-[#E43D12]/30">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 space-y-2.5 leading-relaxed shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-[#E43D12] to-[#FF5E36] text-white rounded-br-xs shadow-md shadow-[#E43D12]/20'
                      : 'bg-[#161B26] border border-[#263042] text-slate-100 rounded-bl-xs'
                  }`}
                >
                  {/* Message body */}
                  <div className="space-y-1.5 whitespace-pre-wrap">
                    {msg.message.split('\n\n').map((paragraph, pIdx) => {
                      if (paragraph.startsWith('### ')) {
                        return (
                          <h4
                            key={pIdx}
                            className={`font-bold text-[13px] tracking-tight pb-1 border-b ${
                              msg.sender === 'user'
                                ? 'border-white/20 text-white'
                                : 'border-[#263042] text-[#FF5E36]'
                            }`}
                          >
                            {paragraph.replace('### ', '')}
                          </h4>
                        );
                      }
                      if (paragraph.startsWith('> ')) {
                        return (
                          <div
                            key={pIdx}
                            className="p-2.5 rounded-lg bg-[#10141E] border-l-2 border-[#E43D12] text-[11px] text-slate-300 italic my-1"
                          >
                            {paragraph.replace('> ', '')}
                          </div>
                        );
                      }

                      const lines = paragraph.split('\n');
                      return (
                        <div key={pIdx} className="space-y-1">
                          {lines.map((line, idx) => {
                            if (line.startsWith('- **') || line.startsWith('• **')) {
                              const match = line.match(/[-•]\s*\*\*(.*?)\*\*(.*)/);
                              if (match) {
                                return (
                                  <div key={idx} className="pl-2 border-l-2 border-[#E43D12]/50 py-0.5">
                                    <span className="font-bold text-[#FF5E36]">{match[1]}</span>
                                    <span className="text-slate-300">{match[2]}</span>
                                  </div>
                                );
                              }
                            }
                            return (
                              <div
                                key={idx}
                                className={msg.sender === 'user' ? 'text-white' : 'text-slate-300'}
                              >
                                {line}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>

                  {/* Structured Regulatory Evidence Card */}
                  {msg.evidence_card && (
                    <div className="pt-2 border-t border-[#263042] space-y-2">
                      <div className="p-3 rounded-xl bg-[#121622] border border-[#263042] space-y-2.5 shadow-sm">
                        {/* Header: Title and Status Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Scale className="w-4 h-4 text-[#E43D12] shrink-0" />
                            <span className="font-bold text-[12px] text-slate-100 leading-tight truncate">
                              {msg.evidence_card.title}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase font-bold shrink-0 border ${
                              msg.evidence_card.status === 'COMPLIANT'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : msg.evidence_card.status === 'NON-COMPLIANT'
                                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                : msg.evidence_card.status === 'PARTIALLY COMPLIANT'
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : 'bg-[#E43D12]/15 text-[#FF5E36] border border-[#E43D12]/30'
                            }`}
                          >
                            {msg.evidence_card.status}
                          </span>
                        </div>

                        {/* Source Provenance */}
                        <div className="text-[10px] text-slate-400 font-mono bg-[#0A0E16] px-2 py-1 rounded border border-[#212A3A] flex items-center justify-between">
                          <span className="truncate">{msg.evidence_card.source}</span>
                          <span className="shrink-0 font-semibold text-[#FF5E36] ml-1">
                            {msg.evidence_card.clause}{msg.evidence_card.page ? ` • Pg ${msg.evidence_card.page}` : ''}
                          </span>
                        </div>

                        {/* Structured Parameters Grid */}
                        {msg.evidence_card.parameters && Object.keys(msg.evidence_card.parameters).length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                            {Object.entries(msg.evidence_card.parameters).map(([key, val], pIdx) => (
                              <div key={pIdx} className="bg-[#0A0E16] px-2 py-1 rounded border border-[#212A3A] text-[10.5px]">
                                <span className="text-slate-400 text-[10px] block font-mono">{key}</span>
                                <span className="font-semibold text-slate-100">{val}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Expandable Details Accordion */}
                        {msg.evidence_card.details && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => toggleCard(msg.id)}
                              className="w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-[#181E2B] hover:bg-[#202838] border border-[#283346] text-[10px] font-mono text-slate-200 transition-colors cursor-pointer"
                            >
                              <span className="font-semibold">
                                {expandedCards[msg.id] ? 'Hide Statutory Analysis' : 'View Calculation & Verbatim Excerpt'}
                              </span>
                              {expandedCards[msg.id] ? (
                                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </button>

                            {/* Expanded Content */}
                            {expandedCards[msg.id] && (
                              <div className="mt-2 p-2.5 rounded-lg bg-[#0A0E16] border border-[#212A3A] space-y-2 text-[10.5px]">
                                {msg.evidence_card.details.calculation && (
                                  <div>
                                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-0.5">
                                      Calculation Breakdown
                                    </span>
                                    <div className="p-2 rounded bg-[#0D111A] border border-[#263042] font-mono text-[10px] text-[#FF5E36] whitespace-pre-wrap">
                                      {msg.evidence_card.details.calculation}
                                    </div>
                                  </div>
                                )}

                                {msg.evidence_card.details.conditions && (
                                  <div>
                                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-0.5">
                                      Applicable Conditions
                                    </span>
                                    <p className="text-slate-300 leading-relaxed">
                                      {msg.evidence_card.details.conditions}
                                    </p>
                                  </div>
                                )}

                                {msg.evidence_card.details.verbatim && (
                                  <div>
                                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-0.5">
                                      Verbatim Statutory Text
                                    </span>
                                    <blockquote className="p-2 rounded bg-[#0D111A] border-l-2 border-[#E43D12] text-[10px] font-mono text-slate-300 italic">
                                      "{msg.evidence_card.details.verbatim}"
                                    </blockquote>
                                  </div>
                                )}

                                {msg.evidence_card.details.source_url && msg.evidence_card.details.source_url !== 'None' && (
                                  <div className="pt-1 border-t border-[#263042]">
                                    <a
                                      href={msg.evidence_card.details.source_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] text-[#FF5E36] hover:text-[#E43D12] hover:underline flex items-center gap-1 font-mono"
                                    >
                                      <span>View Official Statutory Source</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Fallback Regulatory Citations Card */}
                  {!msg.evidence_card && msg.citations && msg.citations.length > 0 && (
                    <div className="pt-2 border-t border-[#263042] space-y-2">
                      <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        <BookOpen className="w-3 h-3 text-[#E43D12]" />
                        <span>Official Grounded Citations ({msg.citations.length})</span>
                      </div>
                      <div className="space-y-1.5">
                        {msg.citations.map((c, cIdx) => (
                          <div key={cIdx} className="p-2.5 rounded-lg bg-[#121622] border border-[#263042] text-[11px] space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-100 truncate">{c.title || c.source}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-semibold ${
                                  c.status === 'VERIFIED'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                }`}
                              >
                                {c.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                              <span>Ref: {c.clause}</span>
                              {c.page && <span>• Pg {c.page}</span>}
                            </div>
                            {c.url && c.url !== 'None' ? (
                              <a
                                href={c.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-[#FF5E36] hover:text-[#E43D12] hover:underline flex items-center gap-1 font-mono pt-0.5"
                              >
                                <span>Official Source Link</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : (
                              <div className="text-[9.5px] text-slate-500 font-mono italic pt-0.5">
                                <span>Internal statutory record</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Navigation Action Buttons */}
                  {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                    <div className="pt-2 border-t border-[#263042] flex flex-wrap gap-1.5">
                      {msg.suggested_actions.map((act, actIdx) => {
                        const IconComponent = ICON_MAP[act.icon] || ArrowRight;
                        const isPrimary = act.variant === 'primary';
                        return (
                          <button
                            key={actIdx}
                            type="button"
                            onClick={() => handleActionClick(act)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95 ${
                              isPrimary
                                ? 'bg-gradient-to-r from-[#E43D12] to-[#FF5E36] text-white hover:from-[#C5300B] hover:to-[#E43D12] shadow-sm shadow-[#E43D12]/25'
                                : 'bg-[#1C2330] text-slate-200 hover:bg-[#252E3E] border border-[#2B364A]'
                            }`}
                          >
                            <span>{act.label}</span>
                            <IconComponent className="w-3 h-3 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-end text-[9px] text-slate-400 font-mono pt-0.5">
                    {msg.timestamp}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-[#261410] border border-[#E43D12]/30 flex items-center justify-center text-[#FF5E36] shrink-0 mt-0.5 shadow-2xs font-mono font-bold text-xs">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 items-start">
                <div className="w-7 h-7 rounded-lg bg-[#261410] border border-[#E43D12]/40 flex items-center justify-center text-[#FF5E36] shrink-0">
                  <Bot className="w-3.5 h-3.5 animate-pulse" />
                </div>
                <div className="p-3 bg-[#161B26] border border-[#263042] rounded-2xl rounded-bl-xs flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E43D12] animate-ping" />
                  <span>Synthesizing statutory evidence &amp; navigation...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Carousel Bar */}
          {suggestedPrompts.length > 0 && (
            <div className="px-4 py-2 border-t border-[#263042] bg-[#161B24]/90 shrink-0">
              <div className="text-[10px] font-mono uppercase text-[#FF5E36] mb-1.5 flex items-center gap-1">
                <Compass className="w-3 h-3 text-[#FF5E36]" />
                <span>Suggested Questions</span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {suggestedPrompts.map((p, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => handleSendMessage(p)}
                    className="px-2.5 py-1 rounded-full text-[11px] bg-[#1C2330] border border-[#2B364A] text-slate-300 hover:text-white hover:border-[#E43D12]/50 hover:bg-[#261612] whitespace-nowrap transition-colors cursor-pointer shrink-0 shadow-2xs"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Bar: Deep Charcoal with Original Vermilion-Yellow Send Button */}
          <div className="p-3 border-t border-[#263042] bg-[#161B24] shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about regulations, next step, or where to go..."
                disabled={loading}
                className="flex-1 bg-[#0A0E16] border border-[#283346] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#E43D12] focus:ring-1 focus:ring-[#E43D12]/40 font-sans transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-gradient-to-r from-[#E43D12] to-[#FF5E36] hover:from-[#C5300B] hover:to-[#E43D12] text-white font-semibold disabled:opacity-40 transition-all cursor-pointer shadow-md shadow-[#E43D12]/30 active:scale-95"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 px-1 font-mono">
              <span>Grounding: AICTE APH 2024-27</span>
              <span>Every Decision Backed by Evidence</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
