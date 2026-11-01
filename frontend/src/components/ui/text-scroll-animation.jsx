import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * EditorialScrollHeading - CharacterV1 Scroll-Linked Convergence Animation
 * 
 * Adapted for NIYANTRAN: "Quiet intelligence. Clear decisions."
 * - As the user scrolls, characters in the highlighted statutory keyword ("Documents")
 *   progressively converge horizontally toward the center into perfect alignment.
 * - Gentle vertical settling (10px -> 0px) and opacity transition (0.85 -> 1.0).
 * - Driven by native window scrolling without artificial 210vh demo heights or smooth-scroll hijackers.
 * - Fully accessible with aria-label and complete reduced-motion fallback.
 */
export const EditorialScrollHeading = ({
  text = "Turn Documents into Clear Decisions",
  highlightWord = "Documents",
  className = "",
}) => {
  const shouldReduceMotion = useReducedMotion();
  const { scrollY } = useScroll();

  // Scroll range: 0px to 180px of native vertical scroll
  const scrollProgress = useTransform(scrollY, [0, 180], [0, 1]);

  const words = text.split(" ");

  if (shouldReduceMotion) {
    return (
      <h1 className={cn("text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-text-primary leading-[1.08]", className)}>
        {words.map((word, wordIndex) => {
          const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
          const isHighlighted = highlightWord && cleanWord.toLowerCase() === highlightWord.toLowerCase();
          return (
            <React.Fragment key={wordIndex}>
              <span className={isHighlighted ? "text-[#E43D12]" : ""}>{word}</span>
              {wordIndex < words.length - 1 ? ' ' : ''}
            </React.Fragment>
          );
        })}
      </h1>
    );
  }

  return (
    <h1
      aria-label={text}
      className={cn(
        "text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-text-primary leading-[1.08] flex flex-wrap justify-center gap-x-[0.3em] gap-y-[0.1em]",
        className
      )}
    >
      {words.map((word, wordIndex) => {
        const letters = word.split("");
        const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
        const isHighlighted = highlightWord && cleanWord.toLowerCase() === highlightWord.toLowerCase();
        const centerIdx = (letters.length - 1) / 2;

        return (
          <span
            key={wordIndex}
            className={cn(
              "inline-flex whitespace-nowrap overflow-visible",
              isHighlighted ? "text-[#E43D12]" : "text-text-primary"
            )}
          >
            {letters.map((char, charIndex) => {
              return (
                <ConvergingCharacterSpan
                  key={charIndex}
                  char={char}
                  charIndex={charIndex}
                  centerIndex={centerIdx}
                  scrollProgress={scrollProgress}
                  isHighlighted={isHighlighted}
                />
              );
            })}
          </span>
        );
      })}
    </h1>
  );
};

const ConvergingCharacterSpan = ({
  char,
  charIndex,
  centerIndex,
  scrollProgress,
  isHighlighted = false,
}) => {
  // CharacterV1 convergence:
  // Characters to the left of the center offset negative; to the right offset positive.
  // As scrollProgress goes from 0 -> 1, x moves smoothly to 0.
  const distance = charIndex - centerIndex;
  const initialX = isHighlighted ? distance * 4.5 : distance * 1.5; // Subtle horizontal convergence
  const initialY = isHighlighted ? 10 : 5; // Subtle upward glide

  const x = useTransform(scrollProgress, [0, 1], [initialX, 0]);
  const y = useTransform(scrollProgress, [0, 1], [initialY, 0]);
  const opacity = useTransform(scrollProgress, [0, 0.8], [isHighlighted ? 0.82 : 0.92, 1]);

  return (
    <motion.span
      style={{ x, y, opacity }}
      className={cn(
        "inline-block will-change-transform transition-colors duration-150",
        isHighlighted ? "text-[#E43D12] font-extrabold" : "text-text-primary font-bold"
      )}
      aria-hidden="true"
    >
      {char}
    </motion.span>
  );
};

export const Skiper31 = ({ text = "Turn Documents into Clear Decisions" }) => {
  return <EditorialScrollHeading text={text} />;
};

export default EditorialScrollHeading;
