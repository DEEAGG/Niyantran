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

  const isLeftAligned = className.includes('text-left') || className.includes('justify-start');

  return (
    <h1
      ref={localRef}
      aria-label={text}
      style={{ perspective: 1000 }}
      className={cn(
        "text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-text-primary leading-[1.22] flex flex-wrap justify-center gap-x-[0.3em] gap-y-[0.25em] overflow-visible select-none",
        className
      )}
    >
      {wordData.map((item, wordIndex) => {
        return (
          <span
            key={wordIndex}
            className={cn(
              "inline-flex whitespace-nowrap overflow-visible py-0.5",
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
                  isLeftAligned={isLeftAligned}
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
  isLeftAligned = false,
}) => {
  // Distance from horizontal center of the headline
  const distanceFromCenter = globalIndex - centerIndex;

  // CharacterV1 Dispersion Transformation:
  // - Initial state (scrollYProgress = 0, on load / top of page): perfectly normal (0 displacement, 0 rotation, opacity 1)
  // - On scroll down (scrollYProgress -> 0.5): characters disperse outwards (left moves left, right moves right)
  // - On scroll up: smoothly returns back to 0 (normal, readable state)
  // Left-aligned multiline headings use restrained left displacement to prevent left-padding clipping and multiline overlap
  const maxDispersedX = isLeftAligned
    ? (distanceFromCenter < 0
        ? Math.max(distanceFromCenter * 2.2, -22)
        : Math.min(distanceFromCenter * 3.2, 46))
    : Math.sign(distanceFromCenter) * Math.min(Math.abs(distanceFromCenter) * 5.8, 65);

  const maxDispersedRotateX = isLeftAligned
    ? Math.sign(distanceFromCenter) * Math.min(Math.abs(distanceFromCenter) * 0.9, 14)
    : Math.sign(distanceFromCenter) * Math.min(Math.abs(distanceFromCenter) * 1.5, 20);

  const maxDispersedY = isLeftAligned
    ? Math.min(Math.abs(distanceFromCenter) * 0.28, 4.5)
    : Math.min(Math.abs(distanceFromCenter) * 0.7, 10);

  const x = useTransform(scrollYProgress, [0, 0.5], [0, maxDispersedX]);
  const rotateX = useTransform(scrollYProgress, [0, 0.5], [0, maxDispersedRotateX]);
  const y = useTransform(scrollYProgress, [0, 0.5], [0, maxDispersedY]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0.75]);

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
