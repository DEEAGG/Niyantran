import React from 'react';
import { Layers, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PagePlaceholder({ 
  title, 
  subtitle, 
  category = "ReguTrace Module",
  actions = []
}) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#273244]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5B8CFF] bg-[#5B8CFF]/10 px-2 py-0.5 rounded border border-[#5B8CFF]/20 font-mono">
              {category}
            </span>
            <span className="text-xs text-[#64748B] font-mono">Regulatory Workspace</span>
          </div>
          <h1 className="text-2xl font-bold text-[#F1F5F9] tracking-tight">{title}</h1>
          <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">{subtitle}</p>
        </div>

        {actions.length > 0 && (
          <div className="flex items-center gap-2.5">
            {actions.map((act, idx) => (
              act.to ? (
                <Link
                  key={idx}
                  to={act.to}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    act.variant === 'primary'
                      ? 'bg-[#5B8CFF] text-white hover:bg-[#4375ED] shadow-subtle'
                      : 'border border-[#273244] bg-[#111722] text-[#F1F5F9] hover:bg-[#182130] shadow-subtle'
                  }`}
                >
                  {act.icon && <act.icon className="w-4 h-4" />}
                  {act.label}
                </Link>
              ) : (
                <button
                  key={idx}
                  onClick={act.onClick}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    act.variant === 'primary'
                      ? 'bg-[#5B8CFF] text-white hover:bg-[#4375ED] shadow-subtle'
                      : 'border border-[#273244] bg-[#111722] text-[#F1F5F9] hover:bg-[#182130] shadow-subtle'
                  }`}
                >
                  {act.icon && <act.icon className="w-4 h-4" />}
                  {act.label}
                </button>
              )
            ))}
          </div>
        )}
      </div>

      {/* Dark Workspace Card */}
      <div className="bg-[#111722] rounded-2xl border border-[#273244] p-8 shadow-surface flex flex-col items-center justify-center text-center min-h-[360px]">
        <div className="w-12 h-12 rounded-xl bg-[#182130] border border-[#273244] flex items-center justify-center mb-4 text-[#5B8CFF]">
          <Layers className="w-6 h-6 stroke-[1.8]" />
        </div>
        <h3 className="text-base font-semibold text-[#F1F5F9] mb-1">{title} Interface</h3>
        <p className="text-xs text-[#94A3B8] max-w-md mb-6 leading-relaxed">
          NIYANTRAN verification workspace initialized. High-fidelity components and live ReguTrace mock services are connected.
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#182130] border border-[#273244] text-[#94A3B8] text-xs font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-[#42C6B7]" />
          <span>ReguTrace Engine Active &bull; Mock Service Connectors Ready</span>
        </div>
      </div>
    </div>
  );
}
