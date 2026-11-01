import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * EditorialScrollHeading - True CharacterV1 Scroll-Linked Convergence Animation
 * 
 * Based on the Framer Motion CharacterV1 reference:
 * - Computes distanceFromCenter = globalIndex - centerIndex
 * - Characters on left and right progressively glide horizontally toward the center
 * - Restrained rotateX and subtle vertical settling
 * - Scoped to the hero/section container for responsive native scroll tracking
 * - Identical font size, font weight, line height, and baseline across all words
 * - Fully accessible with aria-label and complete reduced-motion fallback
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

  const isHeroContainer = Boolean(containerRef);
  const offsetConfig = isHeroContainer
    ? ["start start", "end start"]
    : ["start 90%", "center 50%"];

  // Scroll tracking: scoped to the target container or heading viewport entry
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: offsetConfig,
  });

  const words = text.split(" ");

  // Count total characters across words to determine the true horizontal center
  let charCounter = 0;
  const wordData = words.map((word) => {
    const letters = word.split("");
    const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
    const isHighlighted = highlightWord && cleanWord.toLowerCase() === highlightWord.toLowerCase();
    const charsWithIndices = letters.map((char) => {
      const globalIdx = charCounter;
      charCounter += 1;
      return { char, globalIdx, isHighlighted };
    });
    // Add 1 for the space between words
    charCounter += 1;
    return { word, charsWithIndices, isHighlighted };
  });

  const totalChars = Math.max(1, charCounter - 1);
  const centerIndex = (totalChars - 1) / 2;

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
      ref={localRef}
      aria-label={text}
      style={{ perspective: 1000 }}
      className={cn(
        "text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-text-primary leading-[1.08] flex flex-wrap justify-center gap-x-[0.3em] gap-y-[0.1em] overflow-visible select-none",
        className
      )}
    >
      {wordData.map((item, wordIndex) => {
        return (
          <span
            key={wordIndex}
            className={cn(
              "inline-flex whitespace-nowrap overflow-visible",
              item.isHighlighted ? "text-[#E43D12]" : "text-text-primary"
            )}
          >
            {item.charsWithIndices.map(({ char, globalIdx, isHighlighted }) => {
              return (
                <CharacterV1Span
                  key={globalIdx}
                  char={char}
                  globalIndex={globalIdx}
                  centerIndex={centerIndex}
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

const CharacterV1Span = ({
  char,
  globalIndex,
  centerIndex,
  scrollYProgress,
  isHighlighted = false,
}) => {
  // Distance from horizontal center of the headline
  const distanceFromCenter = globalIndex - centerIndex;

  // CharacterV1 core transformation:
  // Left characters start with negative X, right characters with positive X.
  // As user scrolls from scrollYProgress 0 -> 0.5, characters converge toward 0.
  // Maximum horizontal displacement is bounded to keep text readable on all screens.
  const initialX = Math.sign(distanceFromCenter) * Math.min(Math.abs(distanceFromCenter) * 7.5, 95);
  const initialRotateX = Math.sign(distanceFromCenter) * Math.min(Math.abs(distanceFromCenter) * 2, 28);
  const initialY = Math.min(Math.abs(distanceFromCenter) * 1.2, 16);

  const x = useTransform(scrollYProgress, [0, 0.5], [initialX, 0]);
  const rotateX = useTransform(scrollYProgress, [0, 0.5], [initialRotateX, 0]);
  const y = useTransform(scrollYProgress, [0, 0.5], [initialY, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.45], [0.85, 1]);

  return (
    <motion.span
      style={{
        x,
        y,
        rotateX,
        opacity,
        display: 'inline-block',
        willChange: 'transform, opacity',
      }}
      className={cn(
        "inline-block transition-colors duration-150",
        // EXACT same font weight, font size, and line height as the surrounding sentence
        isHighlighted ? "text-[#E43D12]" : "text-text-primary"
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
