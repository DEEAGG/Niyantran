import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * EditorialScrollHeading - Restrained Character-Scroll Animation
 * 
 * Art-directed for "Quiet intelligence. Clear decisions."
 * - Words wrap naturally across screen widths without breaking layout
 * - Restrained vertical offset and subtle opacity reveal
 * - Accessible aria-label for screen readers
 * - Full reduced-motion fallback
 */
export const EditorialScrollHeading = ({
  text = "Turn Documents into Clear Decisions",
  highlightWord = "Documents",
  className = "",
  containerRef = null,
}) => {
  const localRef = useRef(null);
  const targetRef = containerRef || localRef;
  const shouldReduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start 90%", "start 25%"],
  });

  const words = text.split(" ");

  if (shouldReduceMotion) {
    return (
      <h1 className={cn("text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-text-primary", className)}>
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
      ref={localRef}
      aria-label={text}
      className={cn(
        "text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-text-primary leading-[1.08] flex flex-wrap gap-x-[0.3em] gap-y-[0.1em]",
        className
      )}
    >
      {words.map((word, wordIndex) => {
        const letters = word.split("");
        const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
        const isHighlighted = highlightWord && cleanWord.toLowerCase() === highlightWord.toLowerCase();

        return (
          <span
            key={wordIndex}
            className={cn(
              "inline-flex whitespace-nowrap overflow-visible",
              isHighlighted ? "text-[#E43D12]" : "text-text-primary"
            )}
          >
            {letters.map((char, charIndex) => {
              const globalIndex = wordIndex * 6 + charIndex;
              // Subtle stagger from globalIndex
              return (
                <CharacterSpan
                  key={charIndex}
                  char={char}
                  index={globalIndex}
                  scrollYProgress={scrollYProgress}
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

const CharacterSpan = ({ char, index, scrollYProgress, isHighlighted = false }) => {
  // Slight offset that smoothly settles into 0 with scroll
  const offset = ((index % 7) - 3) * 6; // max +/- 18px
  const y = useTransform(scrollYProgress, [0, 0.45], [offset, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.35], [0.65, 1]);

  return (
    <motion.span
      style={{ y, opacity }}
      className={cn(
        "inline-block will-change-transform transition-colors duration-150",
        isHighlighted ? "text-[#E43D12]" : "text-text-primary"
      )}
      aria-hidden="true"
    >
      {char}
    </motion.span>
  );
};

export const Skiper31 = ({ text = "Turn documents into clear decisions." }) => {
  return <EditorialScrollHeading text={text} />;
};

export default EditorialScrollHeading;
