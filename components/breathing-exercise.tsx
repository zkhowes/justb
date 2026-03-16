"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type BreathPhase = "inhale" | "hold" | "exhale";

const PHASE_DURATION: Record<BreathPhase, number> = {
  inhale: 3000,
  hold: 3000,
  exhale: 6000,
};

const PHASE_LABEL: Record<BreathPhase, string> = {
  inhale: "Breathe in...",
  hold: "Hold...",
  exhale: "Breathe out...",
};

const TOTAL_BREATHS = 3;

export function BreathingExercise({
  onStart,
  onComplete,
  isNight,
}: {
  onStart: () => void;
  onComplete: () => void;
  isNight: boolean;
}) {
  const [started, setStarted] = useState(false);
  const [breathIndex, setBreathIndex] = useState(0);
  const [phase, setPhase] = useState<BreathPhase>("inhale");
  const [done, setDone] = useState(false);

  const handleClick = useCallback(() => {
    setStarted(true);
    onStart();
  }, [onStart]);

  useEffect(() => {
    if (!started || done) return;

    const timer = setTimeout(() => {
      if (phase === "inhale") {
        setPhase("hold");
      } else if (phase === "hold") {
        setPhase("exhale");
      } else {
        // exhale done
        if (breathIndex < TOTAL_BREATHS - 1) {
          setBreathIndex((i) => i + 1);
          setPhase("inhale");
        } else {
          setDone(true);
        }
      }
    }, PHASE_DURATION[phase]);

    return () => clearTimeout(timer);
  }, [started, phase, breathIndex, done]);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(onComplete, 600);
    return () => clearTimeout(timer);
  }, [done, onComplete]);

  const circleScale = !started
    ? 1
    : phase === "inhale"
      ? 1
      : phase === "hold"
        ? 1
        : 0.6;

  const circleTransition = !started
    ? { duration: 2, repeat: Infinity, repeatType: "reverse" as const, ease: "easeInOut" as const }
    : { duration: PHASE_DURATION[phase] / 1000, ease: "easeInOut" as const };

  const textColor = isNight ? "text-indigo-200" : "text-[var(--text-secondary)]";
  const mutedColor = isNight ? "text-indigo-400" : "text-[var(--text-muted)]";
  const ringColor = isNight
    ? "border-indigo-400/40"
    : "border-stone-300/60";
  const glowColor = isNight
    ? "shadow-indigo-500/20"
    : "shadow-stone-400/20";

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      animate={done ? { opacity: 0, scale: 0.95 } : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {!started ? (
        <motion.button
          onClick={handleClick}
          className={`w-40 h-40 rounded-full border-2 ${ringColor} flex items-center justify-center shadow-lg ${glowColor} transition-colors`}
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          whileTap={{ scale: 0.97 }}
        >
          <span className={`font-serif text-lg font-semibold ${textColor}`}>
            Ready to JustB?
          </span>
        </motion.button>
      ) : (
        <div className="flex flex-col items-center gap-8">
          <motion.div
            className={`w-40 h-40 rounded-full border-2 ${ringColor} shadow-lg ${glowColor}`}
            animate={{ scale: circleScale }}
            transition={circleTransition}
            initial={{ scale: 0.6 }}
          />

          <div className="h-12 flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={phase}
                className={`font-serif text-xl ${textColor}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                {PHASE_LABEL[phase]}
              </motion.p>
            </AnimatePresence>
            <p className={`text-xs mt-2 ${mutedColor}`}>
              {breathIndex + 1} of {TOTAL_BREATHS}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
