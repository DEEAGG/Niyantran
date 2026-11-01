import React, { useEffect, useRef, useState } from 'react';

/**
 * ScrollReveal - High-performance scroll-triggered reveal component.
 * Inspired by Google's modern editorial websites:
 * - Immediate reveal if already visible in viewport on mount (no blank flash)
 * - Restrained upward glide (14px) and smooth fade-in
 * - Fires once when scrolled into view
 * - Fully respects prefers-reduced-motion
 * - Zero layout shift or scroll-jacking
 */
export default function ScrollReveal({
  children,
  className = '',
  stagger = 0, // 0, 1, 2, 3, 4
  threshold = 0.05,
  as: Component = 'div',
  ...props
}) {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // 1. Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    // 2. Immediate viewport check on mount:
    // If element is already within the visible viewport, reveal immediately
    if (typeof window !== 'undefined') {
      const rect = element.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top <= windowHeight * 0.95 && rect.bottom >= 0) {
        setRevealed(true);
        return;
      }
    }

    // 3. Fallback if IntersectionObserver is not supported
    if (!('IntersectionObserver' in window)) {
      setRevealed(true);
      return;
    }

    // 4. Observe scroll entry with slight bottom offset
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            setRevealed(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold,
        rootMargin: '0px 0px -20px 0px',
      }
    );

    observer.observe(element);

    return () => {
      if (element) observer.unobserve(element);
    };
  }, [threshold]);

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
export function useScrollReveal(threshold = 0.05) {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    if (typeof window !== 'undefined') {
      const rect = element.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top <= windowHeight * 0.95 && rect.bottom >= 0) {
        setRevealed(true);
        return;
      }
    }

    if (!('IntersectionObserver' in window)) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            setRevealed(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold,
        rootMargin: '0px 0px -20px 0px',
      }
    );

    observer.observe(element);
    return () => {
      if (element) observer.unobserve(element);
    };
  }, [threshold]);

  return { ref, revealed, className: `reveal-on-scroll ${revealed ? 'is-revealed' : ''}` };
}
