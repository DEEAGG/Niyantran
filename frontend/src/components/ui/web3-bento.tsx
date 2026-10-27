"use client";

import * as React from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Web3Allocation {
  symbol: string;
  value: number;
}

export interface Web3Activity {
  id: string;
  kind: "swap" | "bridge" | "stake" | "mint" | "receive";
  title: string;
  detail: string;
  amount: string;
  status: "confirmed" | "pending" | "failed";
  time: string;
}

export interface Web3Card {
  id: string;
  label: string;
  last4: string;
  holder?: string;
  expiry?: string;
  balance?: string;
  logo?: React.ReactNode;
  color: string;
  color2: string;
  ink: string;
}

export interface Web3BentoProps {
  account?: string;
  network?: string;
  history?: number[];
  benchmark?: number[];
  allocation?: Web3Allocation[];
  staking?: { asset: string; staked: number; apy: number; rewards: number; usdPrice: number };
  liquidity?: { pair: string; fee: string; min: number; max: number; price: number; fees: number };
  activity?: Web3Activity[];
  cards?: Web3Card[];
  accent?: string;
  accent2?: string;
  locale?: string;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Demo data                                                          */
/* ------------------------------------------------------------------ */

function walk(seed: number, n: number, start: number, drift: number, vol: number) {
  let h = seed;
  const rnd = () => {
    h = (h * 16807) % 2147483647;
    return h / 2147483647;
  };
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    v *= 1 + drift + (rnd() - 0.5) * vol;
    out.push(v);
  }
  return out.map((_, i) => {
    const w = out.slice(Math.max(0, i - 3), i + 1);
    return w.reduce((s, x) => s + x, 0) / w.length;
  });
}

export const DEMO = {
  account: "regulatory.audit",
  network: "ReguTrace Mainnet",
  history: walk(7, 365, 61000, 0.0011, 0.045),
  benchmark: walk(11, 365, 61000, 0.0006, 0.05),
  allocation: [
    { symbol: "Land Deeds", value: 58200 },
    { symbol: "Affiliation", value: 21400 },
    { symbol: "Building NOC", value: 9800 },
    { symbol: "Faculty List", value: 6100 },
    { symbol: "Financials", value: 4300 },
  ],
  staking: { asset: "COMPLIANCE", staked: 32, apy: 98.42, rewards: 0.41837215, usdPrice: 3368.5 },
  liquidity: { pair: "AICTE / UGC", fee: "0.05%", min: 3120, max: 3640, price: 3368.5, fees: 412.8 },
  activity: [
    { id: "a1", kind: "bridge", title: "Verify Land Deed", detail: "APP-2026-003", amount: "5.2 Acres", status: "confirmed", time: "now" },
    { id: "a2", kind: "swap", title: "OCR Hash Verified", detail: "SHA-256 Match", amount: "Valid", status: "confirmed", time: "12m" },
    { id: "a3", kind: "stake", title: "Gazette Policy Replay", detail: "v2026.2", amount: "Passed", status: "confirmed", time: "2h" },
    { id: "a4", kind: "mint", title: "Evidence Passport Issued", detail: "Dossier #003", amount: "Anchored", status: "confirmed", time: "1d" },
  ] as Web3Activity[],
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function useReducedMotion() {
  const [r, setR] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const u = () => setR(mq.matches);
    u();
    mq.addEventListener("change", u);
    return () => mq.removeEventListener("change", u);
  }, []);
  return r;
}

function useMounted() {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return on;
}

function useCountUp(target: number, enabled: boolean, duration = 1300) {
  const [v, setV] = React.useState(enabled ? 0 : target);
  React.useEffect(() => {
    if (!enabled) return setV(target);
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setV(target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, duration]);
  return v;
}

function smooth(pts: ReadonlyArray<readonly [number, number]>) {
  return pts
    .map(([x, y], i) => {
      if (i === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      const [px, py] = pts[i - 1];
      const m = (px + x) / 2;
      return `C ${m.toFixed(1)} ${py.toFixed(1)}, ${m.toFixed(1)} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

type Fmt = { usd: (v: number, d?: number) => string; num: (v: number, d?: number) => string };

function Tile({
  title,
  action,
  className,
  style,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cx("relative flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-[#E4E2DC] bg-[#FFFFFF] p-5 text-[#171A20] shadow-sm", className)}
      style={style}
    >
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h3 className="text-[13px] font-semibold text-[#696C73] uppercase tracking-wider">{title}</h3>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

function Pills<T extends string>({ value, options, onChange, label }: { value: T; options: T[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-[#E4E2DC] bg-[#F7F6F2] p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
          onClick={() => onChange(o)}
          className={cx(
            "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none",
            o === value ? "bg-[#171A20] text-[#FFFFFF]" : "text-[#696C73] hover:text-[#171A20]"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function HeroTile({ account, history, fmt, accent, accent2, reduced }: { account: string; history: number[]; fmt: Fmt; accent: string; accent2: string; reduced: boolean }) {
  const mounted = useMounted();
  const value = history[history.length - 1];
  const shown = useCountUp(value, !reduced);
  const month = history.slice(-31);
  const daily = month.slice(1).map((v, i) => (v / month[i] - 1) * 100);
  const maxAbs = Math.max(...daily.map(Math.abs), 0.01);
  const change = value - month[0];
  const pct = (value / month[0] - 1) * 100;
  const [hover, setHover] = React.useState<number | null>(null);
  const today = new Date();
  const dayLabel = (i: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (daily.length - 1 - i));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Tile className="sm:col-span-2 lg:col-span-2 lg:col-start-1 lg:row-start-1">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[26px] font-bold leading-[1.1] tracking-tight sm:text-[30px] text-[#171A20]">
            Regulatory Status: <span style={{ color: accent }}>{account}</span>
          </p>
          <p className="mt-1 text-sm text-[#696C73]">Evidence-backed validation ledger active.</p>
        </div>
        <div className="text-right">
          <p className="text-[12px] text-[#696C73]">Verified Records</p>
          <p className="font-mono text-[32px] font-bold leading-none tracking-tight tabular-nums sm:text-[36px] text-[#171A20]">{Math.round(shown).toLocaleString()}</p>
          <p className="mt-1.5 font-mono text-[12px] tabular-nums">
            <span style={{ color: change >= 0 ? '#18794E' : '#CE2C31' }}>
              {change >= 0 ? "+" : "−"}
              {Math.abs(Math.round(change))} ({pct.toFixed(1)}%)
            </span>
            <span className="text-[#696C73]"> · 30d audit</span>
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-1 flex-col">
        <div className="flex flex-1 items-end gap-[3px]" style={{ minHeight: 64 }} onPointerLeave={() => setHover(null)}>
          {daily.map((d, i) => {
            const h = 18 + (Math.abs(d) / maxAbs) * 82;
            const up = d >= 0;
            return (
              <button
                key={i}
                type="button"
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${dayLabel(i)}: ${up ? "+" : "−"}${Math.abs(d).toFixed(2)}%`}
                className="relative flex-1 rounded-[3px] focus-visible:outline-none"
                style={{
                  height: mounted ? `${h}%` : "6%",
                  background: up ? accent : '#D1CEC5',
                  opacity: hover === null ? 0.4 + (Math.abs(d) / maxAbs) * 0.6 : hover === i ? 1 : 0.2,
                  transition: `height 900ms ${EASE} ${i * 18}ms, opacity 200ms ease`,
                }}
              />
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-[#696C73]">
          <span>{dayLabel(0)}</span>
          <span className="text-[#171A20] font-medium" aria-live="polite">
            {hover !== null ? `${dayLabel(hover)} · ${daily[hover] >= 0 ? "+" : "−"}${Math.abs(daily[hover]).toFixed(2)}%` : "Validation Frequency"}
          </span>
          <span>Today</span>
        </div>
      </div>
    </Tile>
  );
}

function CardFace({ c }: { c: Web3Card; glare: number }) {
  return (
    <>
      <span
        aria-hidden
        className="absolute inset-0 overflow-hidden rounded-[14px]"
        style={{
          background: `linear-gradient(135deg, ${c.color} 0%, ${c.color2} 100%)`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 0 0 1px rgba(0,0,0,0.08)",
        }}
      />
      <span className="relative flex items-center justify-between gap-3 px-4 pt-4">
        <span className="truncate text-[13px] font-bold tracking-tight text-white">{c.label}</span>
        <span className="shrink-0 font-mono text-[12px] font-semibold text-white/90">ID: {c.last4}</span>
      </span>
      <span className="absolute bottom-3.5 left-4 text-[11px] font-mono text-white/80">
        {c.holder || 'AICTE Verified'}
      </span>
    </>
  );
}

function CardsTile({ cards, reduced }: { cards: Web3Card[]; reduced: boolean }) {
  const [order, setOrder] = React.useState(() => cards.map((c) => c.id));
  const mounted = useMounted();
  const PEEK = 38;
  const depth = order.length - 1;
  const front = cards.find((c) => c.id === order[order.length - 1])!;

  return (
    <Tile
      title={
        <span>
          Case Dossiers <sup className="font-mono text-[10px]">{cards.length}</sup>
        </span>
      }
      className="lg:col-start-3 lg:row-start-1"
    >
      <div className="relative -mx-5 -mb-5 flex flex-1 flex-col justify-end overflow-hidden pt-1">
        <div className="relative">
          {order.map((id, pos) => {
            const c = cards.find((x) => x.id === id)!;
            const fromFront = order.length - 1 - pos;
            const isFront = fromFront === 0;
            return (
              <button
                key={id}
                type="button"
                onClick={() => !isFront && setOrder((o) => [...o.filter((x) => x !== id), id])}
                className="group absolute left-1/2 block w-[calc(100%-32px)] max-w-[280px] rounded-[14px] p-0 text-left"
                style={{
                  top: (depth - fromFront) * PEEK,
                  zIndex: pos + 1,
                  transform: `translateX(-50%) scale(${1 - fromFront * 0.055}) translateY(${mounted ? 0 : 20}px)`,
                  transformOrigin: "top center",
                  opacity: mounted ? 1 : 0,
                  boxShadow: "0 8px 24px -8px rgba(0,0,0,0.18)",
                  transition: reduced
                    ? "none"
                    : `top 650ms cubic-bezier(0.34, 1.35, 0.64, 1), transform 650ms cubic-bezier(0.34, 1.35, 0.64, 1), opacity 500ms ease`,
                  cursor: isFront ? "default" : "pointer",
                }}
              >
                <span className="relative block w-full" style={{ paddingTop: "56%" }}>
                  <span className="absolute inset-0 block">
                    <CardFace c={c} glare={30} />
                  </span>
                </span>
              </button>
            );
          })}

          <div aria-hidden className="invisible mx-auto w-[calc(100%-32px)] max-w-[280px] shrink-0" style={{ marginTop: depth * PEEK }}>
            <div style={{ paddingTop: "26%" }} />
          </div>
        </div>

        <div
          className="relative z-10 flex shrink-0 items-end justify-between gap-3 px-5 pb-4 border-t border-[#E4E2DC] bg-[#FFFFFF]/90 backdrop-blur-sm"
          style={{ height: 80 }}
        >
          <div className="min-w-0">
            <p className="truncate font-mono text-[14px] font-semibold text-[#171A20]">{front.label}</p>
            <p className="mt-0.5 truncate text-[11px] text-[#696C73]">
              {front.holder ?? 'Exemplar Case'} · Status: Verified
            </p>
          </div>
        </div>
      </div>
    </Tile>
  );
}

function GasTile({ accent, reduced }: { accent: string; reduced: boolean }) {
  const [val, setVal] = React.useState(94.2);
  const [tier, setTier] = React.useState<"Strict" | "Standard" | "Flexible">("Standard");

  const t = Math.min(1, val / 100);
  const R = 62;
  const len = Math.PI * R;
  const angle = -90 + t * 180;

  return (
    <Tile title="Statutory Compliance" className="lg:col-start-4 lg:row-start-1" action={<span className="font-mono text-[11px] text-[#18794E]">Gazette v2026.2</span>}>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative" style={{ width: 150, height: 86 }}>
          <svg width="150" height="86" viewBox="0 0 150 86" aria-hidden>
            <path d="M 13 78 A 62 62 0 0 1 137 78" fill="none" strokeWidth="10" strokeLinecap="round" style={{ stroke: "#ECEAE4" }} />
            <path
              d="M 13 78 A 62 62 0 0 1 137 78"
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={len}
              style={{ stroke: accent, strokeDashoffset: len * (1 - t), transition: `stroke-dashoffset 900ms ${EASE}` }}
            />
            <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "75px 78px", transition: `transform 900ms ${EASE}` }}>
              <line x1="75" y1="78" x2="75" y2="30" strokeWidth="2.5" strokeLinecap="round" style={{ stroke: "#171A20" }} />
            </g>
            <circle cx="75" cy="78" r="5" style={{ fill: "#171A20" }} />
          </svg>
        </div>
        <p className="mt-2 font-mono text-[26px] font-bold leading-none text-[#171A20]">
          {val.toFixed(1)}% <span className="text-xs text-[#696C73]">score</span>
        </p>
        <p className="mt-1 font-mono text-[11px] text-[#696C73]">AICTE / UGC Criteria Matched</p>
      </div>
      <div className="mt-4 flex justify-center">
        <Pills label="Mode" value={tier} options={["Strict", "Standard", "Flexible"]} onChange={setTier} />
      </div>
    </Tile>
  );
}

export function Web3Bento({
  account = "ReguTrace Engine",
  history = DEMO.history,
  benchmark = DEMO.benchmark,
  cards,
  accent = "#4357E8",
  accent2 = "#18794E",
  className,
}: Web3BentoProps) {
  const reduced = useReducedMotion();
  const fmt = React.useMemo<Fmt>(() => ({
    usd: (v) => v.toLocaleString(),
    num: (v) => v.toLocaleString(),
  }), []);

  return (
    <div className={cx("w-full max-w-[1180px] mx-auto", className)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroTile account={account} history={history} fmt={fmt} accent={accent} accent2={accent2} reduced={reduced} />
        <CardsTile
          reduced={reduced}
          cards={
            cards ?? [
              { id: "k1", label: "APP-2026-003", last4: "003", holder: "Green Valley Inst.", color: "#4357E8", color2: "#2A3BB8", ink: "#FFFFFF" },
              { id: "k2", label: "APP-2026-001", last4: "001", holder: "Apex Tech College", color: "#18794E", color2: "#0E5633", ink: "#FFFFFF" },
              { id: "k3", label: "APP-2026-002", last4: "002", holder: "St. Xavier Campus", color: "#696C73", color2: "#3D4148", ink: "#FFFFFF" },
            ]
          }
        />
        <GasTile accent={accent} reduced={reduced} />
      </div>
    </div>
  );
}

export default Web3Bento;
