"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type BreathPhase = "inhale" | "hold" | "exhale";

const PHASE_DURATION: Record<BreathPhase, number> = {
  inhale: 3000,
  hold: 1000,
  exhale: 6000,
};

const PHASE_LABEL: Record<BreathPhase, string> = {
  inhale: "Breathe in...",
  hold: "Hold...",
  exhale: "Breathe out...",
};

const TOTAL_BREATHS = 2;
const PRESS_DURATION = 2000;
const CIRCLE_RADIUS = 78;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

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
  const [pressing, setPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);
  const pressStartRef = useRef<number>(0);

  const handleClick = useCallback(() => {
    setStarted(true);
    onStart();
  }, [onStart]);

  const handlePressEnd = useCallback(() => {
    if (!pressing) return;
    setPressing(false);
    setProgress(0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, [pressing]);

  const handlePressStart = useCallback(() => {
    if (started) return;
    setPressing(true);
    pressStartRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - pressStartRef.current;
      const p = Math.min(elapsed / PRESS_DURATION, 1);
      setProgress(p);
      if (p >= 1) {
        setPressing(false);
        setProgress(0);
        handleClick();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [started, handleClick]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

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
          onPointerDown={handlePressStart}
          onPointerUp={handlePressEnd}
          onPointerLeave={handlePressEnd}
          className={`relative w-40 h-40 rounded-full border-2 ${ringColor} flex items-center justify-center shadow-lg ${glowColor} transition-colors select-none touch-none overflow-hidden`}
          animate={pressing ? { scale: 0.97 } : { scale: [1, 1.03, 1] }}
          transition={pressing ? { duration: 0.15 } : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
          aria-label="Press and hold for 2 seconds to begin"
        >
          {/* Fill gauge — rises from bottom */}
          {progress > 0 && (
            <div
              className="absolute inset-0 pointer-events-none rounded-full"
              style={{
                background: isNight
                  ? "rgba(129, 140, 248, 0.15)"
                  : "rgba(168, 162, 158, 0.15)",
                clipPath: `inset(${(1 - progress) * 100}% 0 0 0)`,
              }}
            />
          )}
          {/* Progress ring around perimeter */}
          <svg
            className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
            viewBox="0 0 160 160"
          >
            <circle
              cx="80"
              cy="80"
              r={CIRCLE_RADIUS}
              fill="none"
              stroke={isNight ? "#818cf8" : "#a8a29e"}
              strokeWidth="3"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
              strokeLinecap="round"
              opacity={progress > 0 ? 1 : 0}
            />
          </svg>
          <span className={`relative font-serif text-lg font-semibold ${textColor}`}>
            {pressing ? "Hold..." : "Ready to JustB?"}
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
