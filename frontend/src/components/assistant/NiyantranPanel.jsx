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
};

export default function NiyantranPanel({ applicationId = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOpen, closeAssistant, minimizeToNavbar, messages, setMessages, clearMessages } = useAssistant();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState([]);
  const [workflowStatus, setWorkflowStatus] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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
      className="fixed inset-0 z-[1200] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="NIYANTRAN Regulatory Intelligence Guide"
    >
      {/* Semi-transparent Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={closeAssistant}
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10 z-[1201]">
        <div className="w-screen max-w-md bg-white border-l border-[#E4E2DC] shadow-2xl flex flex-col justify-between transform transition-transform duration-200 ease-out font-sans">

          {/* Header */}
          <div className="px-5 py-3.5 border-b border-[#E4E2DC] bg-[#FAF9F5] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#E43D12] to-[#EFB112] flex items-center justify-center text-white shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-text-primary tracking-tight">NIYANTRAN</h2>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 font-semibold">
                    Statutory Grounded
                  </span>
                </div>
                <p className="text-[11px] text-text-muted">
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
                className="p-1.5 rounded-lg text-text-muted hover:text-[#E43D12] hover:bg-[#F2EFE9] transition-colors cursor-pointer"
                title="Minimize & Dock to Topbar"
                aria-label="Dock to Navbar"
              >
                <ArrowUpRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={clearMessages}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-[#F2EFE9] transition-colors cursor-pointer"
                title="Reset Conversation"
                aria-label="Reset Conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={closeAssistant}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-[#F2EFE9] transition-colors cursor-pointer"
                title="Close"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Workflow Status Banner Strip */}
          {workflowStatus?.has_application && (
            <div className="px-4 py-2 bg-[#FDF1EE] border-b border-[#E43D12]/20 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-1.5 truncate">
                <Compass className="w-3.5 h-3.5 text-[#E43D12] shrink-0" />
                <span className="font-semibold text-text-primary text-[11px] truncate">
                  {workflowStatus.institution_name}: Step {workflowStatus.current_step} of 5
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E43D12]/15 text-[#C5300B]">
                {workflowStatus.step_name}
              </span>
            </div>
          )}

          {/* Message Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans bg-[#F7F6F2]/30">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#E43D12] to-[#FF5E36] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-2xs">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 space-y-2.5 leading-relaxed shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-[#E43D12] text-white rounded-br-xs'
                      : 'bg-white border border-[#E4E2DC] text-text-primary rounded-bl-xs'
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
                                : 'border-[#E4E2DC] text-[#C5300B]'
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
                            className="p-2.5 rounded-lg bg-[#FAF9F5] border-l-2 border-[#E43D12] text-[11px] text-text-secondary italic my-1"
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
                                  <div key={idx} className="pl-2 border-l-2 border-[#E43D12]/40 py-0.5">
                                    <span className="font-bold text-[#C5300B]">{match[1]}</span>
                                    <span className="text-text-secondary">{match[2]}</span>
                                  </div>
                                );
                              }
                            }
                            return (
                              <div
                                key={idx}
                                className={msg.sender === 'user' ? 'text-white' : 'text-text-secondary'}
                              >
                                {line}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>

                  {/* Regulatory Citations Card */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-2 border-t border-[#E4E2DC] space-y-2">
                      <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-text-muted">
                        <BookOpen className="w-3 h-3 text-[#E43D12]" />
                        <span>Official Grounded Citations ({msg.citations.length})</span>
                      </div>
                      <div className="space-y-1.5">
                        {msg.citations.map((c, cIdx) => (
                          <div key={cIdx} className="p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E4E2DC] text-[11px] space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-text-primary truncate">{c.title || c.source}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-semibold ${
                                  c.status === 'VERIFIED'
                                    ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-700 border border-amber-500/30'
                                }`}
                              >
                                {c.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-text-muted font-mono">
                              <span>Ref: {c.clause}</span>
                              {c.page && <span>• Pg {c.page}</span>}
                            </div>
                            {c.url && c.url !== 'None' ? (
                              <a
                                href={c.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-[#C5300B] hover:underline flex items-center gap-1 font-mono pt-0.5"
                              >
                                <span>Official Source Link</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : (
                              <div className="text-[9.5px] text-text-muted/80 font-mono italic pt-0.5">
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
                    <div className="pt-2 border-t border-[#E4E2DC] flex flex-wrap gap-1.5">
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
                                ? 'bg-[#E43D12] text-white hover:bg-[#C5300B]'
                                : 'bg-[#F2EFE9] text-text-primary hover:bg-[#EAE6DF] border border-[#E4E2DC]'
                            }`}
                          >
                            <span>{act.label}</span>
                            <IconComponent className="w-3 h-3 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-end text-[9px] text-text-muted font-mono pt-0.5">
                    {msg.timestamp}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-[#0B1329] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-2xs">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 items-start">
                <div className="w-7 h-7 rounded-lg bg-[#E43D12]/10 border border-[#E43D12]/30 flex items-center justify-center text-[#E43D12] shrink-0">
                  <Bot className="w-3.5 h-3.5 animate-pulse" />
                </div>
                <div className="p-3 bg-white border border-[#E4E2DC] rounded-2xl rounded-bl-xs flex items-center gap-2 text-xs text-text-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E43D12] animate-ping" />
                  <span>Synthesizing statutory evidence &amp; navigation...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Carousel Bar */}
          {suggestedPrompts.length > 0 && (
            <div className="px-4 py-2 border-t border-[#E4E2DC] bg-[#FAF9F5] shrink-0">
              <div className="text-[10px] font-mono uppercase text-text-muted mb-1.5 flex items-center gap-1">
                <Compass className="w-3 h-3 text-[#E43D12]" />
                <span>Suggested Questions</span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {suggestedPrompts.map((p, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => handleSendMessage(p)}
                    className="px-2.5 py-1 rounded-full text-[11px] bg-white border border-[#E4E2DC] text-text-secondary hover:text-text-primary hover:border-[#E43D12]/40 whitespace-nowrap transition-colors cursor-pointer shrink-0 shadow-2xs"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Bar */}
          <div className="p-3 border-t border-[#E4E2DC] bg-white shrink-0">
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
                className="flex-1 bg-[#FAF9F5] border border-[#E4E2DC] rounded-xl px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#E43D12] font-sans transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-[#E43D12] text-white font-semibold hover:bg-[#C5300B] disabled:opacity-40 disabled:hover:bg-[#E43D12] transition-all cursor-pointer shadow-xs active:scale-95"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center justify-between text-[10px] text-text-muted mt-2 px-1 font-mono">
              <span>Grounding: AICTE APH 2024-27</span>
              <span>Every Decision Backed by Evidence</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
