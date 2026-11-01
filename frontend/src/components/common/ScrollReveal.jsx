import React, { useEffect, useRef, useState } from 'react';

/**
 * ScrollReveal - Smooth scroll-triggered reveal component.
 * - Starts with opacity: 0 and translateY(16px).
 * - Triggers when scrolled into the visible viewport.
 * - Staggers child cards with reveal-stagger-* classes.
 * - Unobserves once revealed for maximum performance.
 * - Completely respects prefers-reduced-motion.
 */
export default function ScrollReveal({
  children,
  className = '',
  stagger = 0, // 0, 1, 2, 3, 4
  threshold = 0.1,
  rootMargin = '0px 0px -30px 0px',
  as: Component = 'div',
  ...props
}) {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // 1. Respect prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    // 2. Fallback if IntersectionObserver is not supported
    if (!('IntersectionObserver' in window)) {
      setRevealed(true);
      return;
    }

    // 3. Observe scroll entry
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(element);

    return () => {
      if (element) observer.unobserve(element);
    };
  }, [threshold, rootMargin]);

  const staggerClass = stagger ? `reveal-stagger-${stagger}` : '';

  return (
    <Component
      ref={ref}
      className={`reveal-on-scroll ${staggerClass} ${revealed ? 'is-revealed' : ''} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

/**
 * Hook to attach scroll reveal to any ref
 */
export function useScrollReveal(threshold = 0.1, rootMargin = '0px 0px -30px 0px') {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    if (!('IntersectionObserver' in window)) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(element);
    return () => {
      if (element) observer.unobserve(element);
    };
  }, [threshold, rootMargin]);

  return { ref, revealed, className: `reveal-on-scroll ${revealed ? 'is-revealed' : ''}` };
}
