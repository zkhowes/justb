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
  inhale: "Breathe in",
  hold: "Hold",
  exhale: "Breathe out",
};

const PHASE_HINT: Record<BreathPhase, string> = {
  inhale: "fill from the belly up",
  hold: "just for a beat",
  exhale: "let the shoulders drop. let the day arrive.",
};

const TOTAL_BREATHS = 2;
const PRESS_DURATION = 2000;

// Disc geometry for Arrive (280px) + Breathe (220px)
const ARRIVE_DISC = 280;
const ARRIVE_RING_R = 139; // (280 - strokeWidth) / 2 roughly
const ARRIVE_CIRC = 2 * Math.PI * ARRIVE_RING_R;

const BREATHE_DISC = 220;

export function BreathingExercise({
  onStart,
  onComplete,
  city,
  dateLabel,
  almanac,
  isNight = false,
}: {
  onStart: () => void;
  onComplete: () => void;
  /** Optional masthead context — falls back to a clean disc-only layout if absent */
  city?: string;
  dateLabel?: string;
  almanac?: string[];
  isNight?: boolean;
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
    ? {
        duration: 2,
        repeat: Infinity,
        repeatType: "reverse" as const,
        ease: "easeInOut" as const,
      }
    : { duration: PHASE_DURATION[phase] / 1000, ease: "easeInOut" as const };

  return (
    <motion.div
      className="min-h-screen flex flex-col relative"
      animate={done ? { opacity: 0, scale: 0.97 } : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Sky wash — taller on Breathe screen */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{
          height: started ? 340 : 260,
          background: "var(--sky-wash)",
        }}
      />

      {/* Night moon (Arrive only) */}
      {!started && isNight && (
        <div
          aria-hidden
          className="absolute"
          style={{
            top: 80,
            right: 60,
            width: 38,
            height: 38,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 35% 35%, #f1e8c8 0%, #d2c290 60%, #8d7b48 100%)",
            boxShadow: "0 0 30px rgba(241,232,200,0.15)",
          }}
        />
      )}

      {!started ? (
        <ArriveScreen
          city={city}
          dateLabel={dateLabel}
          almanac={almanac}
          progress={progress}
          pressing={pressing}
          isNight={isNight}
          onPressStart={handlePressStart}
          onPressEnd={handlePressEnd}
        />
      ) : (
        <BreatheScreen
          phase={phase}
          breathIndex={breathIndex}
          circleScale={circleScale}
          circleTransition={circleTransition}
          isNight={isNight}
        />
      )}
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Arrive — press-and-hold

function ArriveScreen({
  city,
  dateLabel,
  almanac,
  progress,
  pressing,
  isNight,
  onPressStart,
  onPressEnd,
}: {
  city?: string;
  dateLabel?: string;
  almanac?: string[];
  progress: number;
  pressing: boolean;
  isNight: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
}) {
  return (
    <>
      {/* Masthead */}
      <div className="relative" style={{ padding: "72px 28px 0" }}>
        {(city || dateLabel) && (
          <p
            className="text-center font-sans uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.28em",
              color: "var(--text-muted)",
            }}
          >
            {[city, dateLabel].filter(Boolean).join(" · ")}
          </p>
        )}
        <h1
          className="text-center font-display"
          style={{
            fontSize: 30,
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
            marginTop: 14,
            color: "var(--text-primary)",
          }}
        >
          Two slow breaths,
          <br />
          <em
            className="font-serif italic font-light"
            style={{ color: "var(--accent)" }}
          >
            then today.
          </em>
        </h1>
      </div>

      {/* Disc */}
      <div className="flex-1 flex items-center justify-center relative">
        <button
          onPointerDown={onPressStart}
          onPointerUp={onPressEnd}
          onPointerLeave={onPressEnd}
          className="relative select-none touch-none"
          style={{
            width: ARRIVE_DISC,
            height: ARRIVE_DISC,
            borderRadius: "50%",
            border: "1px solid var(--rule-strong)",
            background: "transparent",
            boxShadow: isNight
              ? "inset 0 0 60px rgba(232,226,211,0.02), 0 8px 30px rgba(0,0,0,0.25)"
              : "inset 0 0 60px rgba(28,26,22,0.03), 0 8px 30px rgba(28,26,22,0.06)",
          }}
          aria-label="Press and hold for 2 seconds to begin"
        >
          {/* Progress ring */}
          <svg
            className="absolute inset-0 -rotate-90 pointer-events-none"
            width={ARRIVE_DISC}
            height={ARRIVE_DISC}
            viewBox={`0 0 ${ARRIVE_DISC} ${ARRIVE_DISC}`}
          >
            <circle
              cx={ARRIVE_DISC / 2}
              cy={ARRIVE_DISC / 2}
              r={ARRIVE_RING_R}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.5}
              strokeDasharray={ARRIVE_CIRC}
              strokeDashoffset={ARRIVE_CIRC * (1 - progress)}
              strokeLinecap="round"
              opacity={0.85}
            />
          </svg>

          {/* Center label stack */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
            <span
              className="font-sans uppercase"
              style={{
                fontSize: 9.5,
                letterSpacing: "0.28em",
                color: "var(--accent)",
              }}
            >
              {pressing ? "Holding" : "Press & hold"}
            </span>
            <span
              className="font-display"
              style={{
                fontSize: 26,
                lineHeight: 1,
                marginTop: 10,
                textAlign: "center",
                color: "var(--text-primary)",
              }}
            >
              Hold to
              <br />
              begin
            </span>
            <span
              className="font-serif italic"
              style={{
                fontSize: 12,
                marginTop: 14,
                color: "var(--text-secondary)",
              }}
            >
              two seconds
            </span>
          </div>
        </button>
      </div>

      {/* Almanac footer */}
      {almanac && almanac.length > 0 && (
        <div
          className="font-sans"
          style={{
            padding: "0 28px 32px",
            fontSize: 11,
            color: "var(--text-secondary)",
            textAlign: "center",
          }}
        >
          {almanac.map((item, i) => (
            <span key={i}>
              {item}
              {i < almanac.length - 1 && (
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: 2,
                    borderRadius: "50%",
                    background: "var(--text-muted)",
                    margin: "0 8px",
                    verticalAlign: "middle",
                  }}
                />
              )}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Breathe — active phases

function BreatheScreen({
  phase,
  breathIndex,
  circleScale,
  circleTransition,
  isNight,
}: {
  phase: BreathPhase;
  breathIndex: number;
  circleScale: number;
  circleTransition:
    | { duration: number; ease: "easeInOut" }
    | {
        duration: number;
        repeat: typeof Infinity;
        repeatType: "reverse";
        ease: "easeInOut";
      };
  isNight: boolean;
}) {
  return (
    <>
      <div className="flex-1 flex items-center justify-center relative">
        <motion.div
          style={{
            width: BREATHE_DISC,
            height: BREATHE_DISC,
            borderRadius: "50%",
            border: "1px solid var(--rule)",
            background: isNight
              ? "rgba(232,226,211,0.02)"
              : "rgba(255,255,255,0.4)",
            boxShadow:
              "0 8px 40px rgba(28,26,22,0.05), inset 0 0 60px rgba(28,26,22,0.02)",
          }}
          animate={{ scale: circleScale }}
          transition={circleTransition}
          initial={{ scale: 0.6 }}
        />
      </div>

      <div
        className="flex flex-col items-center"
        style={{ padding: "0 28px 80px" }}
      >
        <AnimatePresence mode="wait">
          <motion.p
            key={phase}
            className="font-display text-center"
            style={{
              fontSize: 30,
              lineHeight: 1.05,
              color: "var(--text-primary)",
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {PHASE_LABEL[phase]}
            <span style={{ color: "var(--accent)" }}>…</span>
          </motion.p>
        </AnimatePresence>

        <div className="flex items-center gap-2" style={{ marginTop: 16 }}>
          <span
            aria-hidden
            style={{
              width: 18,
              height: 1,
              background: "var(--text-muted)",
              display: "inline-block",
            }}
          />
          <span
            className="font-sans uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.24em",
              color: "var(--text-secondary)",
            }}
          >
            Breath {breathIndex + 1}{" "}
            <span style={{ color: "var(--text-muted)" }}>of</span>{" "}
            {TOTAL_BREATHS}
          </span>
          <span
            aria-hidden
            style={{
              width: 18,
              height: 1,
              background: "var(--text-muted)",
              display: "inline-block",
            }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={`hint-${phase}`}
            className="font-serif italic text-center"
            style={{
              fontSize: 14,
              fontWeight: 300,
              maxWidth: 240,
              marginTop: 14,
              color: "var(--text-secondary)",
              lineHeight: 1.4,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {PHASE_HINT[phase]}
          </motion.p>
        </AnimatePresence>
      </div>
    </>
  );
}
