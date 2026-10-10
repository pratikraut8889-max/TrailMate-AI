"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ActivityType, Adventure, MoodType } from "@/types/adventure";

/* ------------------------------------------------------------------ */

/*  Data                                                               */

/* ------------------------------------------------------------------ */

const activities: {

  value: ActivityType;

  icon: string;

  title: string;

  description: string;

}[] = [

  { value: "nature-walk", icon: "🌿", title: "Nature Walk", description: "Discover nature around you" },

  { value: "walking", icon: "🚶", title: "Walking", description: "Enjoy a refreshing walk" },

  { value: "running", icon: "🏃", title: "Running", description: "Get moving outdoors" },

  { value: "explore", icon: "🔎", title: "Explore", description: "Notice something new" },

  { value: "mindfulness", icon: "🧘", title: "Mindfulness", description: "Slow down and recharge" },

];

const moods: { value: MoodType; title: string; icon: string }[] = [

  { value: "relax", title: "Relax", icon: "🌱" },

  { value: "explore", title: "Curious", icon: "🔍" },

  { value: "challenge", title: "Challenge me", icon: "⚡" },

];

const DURATIONS = [20, 30, 45, 60];

const DIFFICULTY_STYLES: Record<string, string> = {

  easy: "bg-[#e6f1dd] text-[#3f6338] ring-[#cbe0bd]",

  medium: "bg-[#fdf2da] text-[#8a6a1f] ring-[#f0dfae]",

  hard: "bg-[#fbe3de] text-[#8f3b2c] ring-[#f2c9c0]",

};

/* Deterministic (SSR-safe — no Math.random during render) */

const CONFETTI = Array.from({ length: 20 }, (_, i) => ({

  left: (i * 53) % 100,

  delay: (i % 7) * 0.11,

  duration: 1.5 + (i % 5) * 0.28,

  drift: ((i % 5) - 2) * 16,

  size: 6 + (i % 4) * 2,

  color: ["#54764b", "#8fb06a", "#d9c26a", "#6d8b55", "#c2d8a8"][i % 5],

}));

/* ------------------------------------------------------------------ */

/*  Guards                                                             */

/* ------------------------------------------------------------------ */

function isAdventure(value: unknown): value is Adventure {

  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;

  const validDifficulty = ["easy", "medium", "hard"].includes(String(candidate.difficulty));

  return (

    typeof candidate.title === "string" &&

    typeof candidate.description === "string" &&

    typeof candidate.duration === "number" &&

    validDifficulty &&

    Array.isArray(candidate.missions) &&

    candidate.missions.every((mission: unknown) => {

      if (typeof mission !== "object" || mission === null) return false;

      const item = mission as Record<string, unknown>;

      return (

        typeof item.id === "string" &&

        typeof item.title === "string" &&

        typeof item.description === "string" &&

        typeof item.duration === "number"

      );

    })

  );

}

function getErrorMessage(result: unknown): string | null {

  if (

    typeof result === "object" &&

    result !== null &&

    "error" in result &&

    typeof result.error === "string"

  ) {

    return result.error;

  }

  return null;

}

/* ------------------------------------------------------------------ */

/*  Hooks                                                              */

/* ------------------------------------------------------------------ */

function usePrefersReducedMotion() {

  const [reduced, setReduced] = useState(false);

  useEffect(() => {

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

    const update = () => setReduced(mq.matches);

    update();

    mq.addEventListener("change", update);

    return () => mq.removeEventListener("change", update);

  }, []);

  return reduced;

}

/***

*&#xA0;* Pointer-driven 3D tilt. Writes transforms straight to the DOM inside*

*&#xA0;* requestAnimationFrame so React never re-renders on mouse move.*

*&#xA0;*/

function useTilt3D<T extends HTMLElement>(intensity = 6) {

  const ref = useRef<T | null>(null);

  const frame = useRef<number | null>(null);

  const reduced = usePrefersReducedMotion();

  const reset = useCallback(() => {

    const el = ref.current;

    if (!el) return;

    if (frame.current !== null) cancelAnimationFrame(frame.current);

    frame.current = null;

    el.style.transform = "";

    el.style.setProperty("--tm-go", "0");

  }, []);

  const onMouseMove = useCallback(

    (event: React.MouseEvent<T>) => {

      if (reduced) return;

      const el = ref.current;

      if (!el) return;

      const rect = el.getBoundingClientRect();

      if (!rect.width || !rect.height) return;

      const px = (event.clientX - rect.left) / rect.width;

      const py = (event.clientY - rect.top) / rect.height;

      if (frame.current !== null) cancelAnimationFrame(frame.current);

      frame.current = requestAnimationFrame(() => {

        const rotateY = (px - 0.5) * intensity * 2;

        const rotateX = (0.5 - py) * intensity * 2;

        el.style.transform =

          `perspective(1100px) rotateX(${rotateX.toFixed(2)}deg) ` +

          `rotateY(${rotateY.toFixed(2)}deg) translate3d(0,-6px,22px) scale(1.02)`;

        el.style.setProperty("--tm-gx", `${(px * 100).toFixed(1)}%`);

        el.style.setProperty("--tm-gy", `${(py * 100).toFixed(1)}%`);

        el.style.setProperty("--tm-go", "1");

      });

    },

    [intensity, reduced]

  );

  useEffect(

    () => () => {

      if (frame.current !== null) cancelAnimationFrame(frame.current);

    },

    []

  );

  return { ref, onMouseMove, onMouseLeave: reset, onBlur: reset };

}

/* ------------------------------------------------------------------ */

/*  3D primitives                                                      */

/* ------------------------------------------------------------------ */

type TiltButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {

  intensity?: number;

};

function TiltButton({ children, className = "", intensity = 6, ...rest }: TiltButtonProps) {

  const { ref, onMouseMove, onMouseLeave, onBlur } = useTilt3D<HTMLButtonElement>(intensity);

  return (

    <button

      {...rest}

      ref={ref}

      type="button"

      onMouseMove={onMouseMove}

      onMouseLeave={onMouseLeave}

      onBlur={onBlur}

      className={`tm-tilt ${className}`}

    >

      {children}

    </button>

  );

}

type TiltPanelProps = React.HTMLAttributes<HTMLDivElement> & { intensity?: number };

function TiltPanel({ children, className = "", intensity = 4, ...rest }: TiltPanelProps) {

  const { ref, onMouseMove, onMouseLeave, onBlur } = useTilt3D<HTMLDivElement>(intensity);

  return (

    <div

      {...rest}

      ref={ref}

      onMouseMove={onMouseMove}

      onMouseLeave={onMouseLeave}

      onBlur={onBlur}

      className={`tm-tilt ${className}`}

    >

      {children}

    </div>

  );

}

/* ------------------------------------------------------------------ */

/*  Backdrop                                                           */

/* ------------------------------------------------------------------ */

function AmbientBackdrop() {

  return (

    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">

      <div

        className="absolute -left-40 -top-24 h-[440px] w-[440px] rounded-full bg-[#bcd9a5] opacity-45 blur-[120px]"

        style={{ animation: "tm-orb-a 22s ease-in-out infinite" }}

      />

      <div

        className="absolute -right-32 top-24 h-[380px] w-[380px] rounded-full bg-[#d9e6b8] opacity-40 blur-[110px]"

        style={{ animation: "tm-orb-b 26s ease-in-out infinite" }}

      />

      <div

        className="absolute bottom-[-140px] left-1/3 h-[420px] w-[420px] rounded-full bg-[#a9c9c0] opacity-30 blur-[130px]"

        style={{ animation: "tm-orb-c 30s ease-in-out infinite" }}

      />

      <div

        className="absolute inset-0 opacity-[0.045]"

        style={{

          backgroundImage:

            "linear-gradient(#23382b 1px, transparent 1px), linear-gradient(90deg, #23382b 1px, transparent 1px)",

          backgroundSize: "58px 58px",

          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 20%, transparent 75%)",

          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 20%, transparent 75%)",

        }}

      />

    </div>

  );

}

/* ------------------------------------------------------------------ */

/*  Page                                                               */

/* ------------------------------------------------------------------ */

export default function Home() {

  const [activity, setActivity] = useState<ActivityType>("nature-walk");

  const [duration, setDuration] = useState<number>(30);

  const [mood, setMood] = useState<MoodType>("relax");

  const [adventure, setAdventure] = useState<Adventure | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [completedMissionIds, setCompletedMissionIds] = useState<string[]>([]);

  const adventureRef = useRef<HTMLElement | null>(null);

  const reducedMotion = usePrefersReducedMotion();

  function clearCurrentAdventure() {

    setAdventure(null);

    setCompletedMissionIds([]);

    setError(null);

  }

  function toggleMission(missionId: string) {
    if (!missionId) return;

    setCompletedMissionIds((current) =>
      current.includes(missionId)
        ? current.filter((id) => id !== missionId)
        : [...current, missionId]
    );
  }

  async function generateAdventure() {

    setIsGenerating(true);

    setError(null);

    setAdventure(null);

    setCompletedMissionIds([]);

    try {

      const response = await fetch("/api/generate-adventure", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ activity, duration, mood }),

      });

      let result: unknown;

      try {

        result = await response.json();

      } catch {

        throw new Error("The server returned an unreadable response. Please try again.");

      }

      if (!response.ok) {

        throw new Error(

          getErrorMessage(result) ?? "Could not generate your adventure. Please try again."

        );

      }

      if (!isAdventure(result)) {

        throw new Error("The server returned an unexpected adventure format. Please try again.");

      }

      setAdventure(result);

      requestAnimationFrame(() => {

        adventureRef.current?.scrollIntoView({

          behavior: reducedMotion ? "auto" : "smooth",

          block: "start",

        });

      });

    } catch (err) {

      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");

    } finally {

      setIsGenerating(false);

    }

  }

  const completedCount = adventure

    ? adventure.missions.filter((mission) => completedMissionIds.includes(mission.id)).length

    : 0;

  const progress = adventure?.missions.length

    ? Math.round((completedCount / adventure.missions.length) * 100)

    : 0;

  const moodLabel = moods.find((m) => m.value === mood)?.title ?? mood;

  return (

    <main className="relative min-h-screen overflow-x-hidden bg-[#f6f6ef] text-[#23382b] antialiased">

      {/* ================= global styles ================= */}

      <style>{`

        .tm-tilt {

          position: relative;

          transform-style: preserve-3d;

          transition:

            transform 440ms cubic-bezier(0.22, 1, 0.36, 1),

            box-shadow 440ms cubic-bezier(0.22, 1, 0.36, 1),

            border-color 260ms ease,

            background-color 260ms ease;

          will-change: transform;

          backface-visibility: hidden;

        }

        .tm-tilt::after {

          content: "";

          position: absolute;

          inset: 0;

          border-radius: inherit;

          background: radial-gradient(

            260px circle at var(--tm-gx, 50%) var(--tm-gy, 50%),

            rgba(255, 255, 255, 0.6),

            rgba(255, 255, 255, 0) 62%

          );

          opacity: var(--tm-go, 0);

          transition: opacity 320ms ease;

          pointer-events: none;

        }

        .tm-depth { transform: translateZ(38px); }

        .tm-depth-sm { transform: translateZ(20px); }

        @keyframes tm-orb-a {

          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }

          50%      { transform: translate3d(46px, -46px, 0) scale(1.1); }

        }

        @keyframes tm-orb-b {

          0%, 100% { transform: translate3d(0, 0, 0) scale(1.05); }

          50%      { transform: translate3d(-52px, 38px, 0) scale(0.92); }

        }

        @keyframes tm-orb-c {

          0%, 100% { transform: translate3d(0, 0, 0) scale(0.95); }

          50%      { transform: translate3d(34px, -30px, 0) scale(1.08); }

        }

        @keyframes tm-bob3d {

          0%, 100% { transform: rotateX(10deg) rotateY(-14deg) translate3d(0, 0, 0); }

          50%      { transform: rotateX(10deg) rotateY(-14deg) translate3d(0, -12px, 0); }

        }

        @keyframes tm-rise {

          from { opacity: 0; transform: translate3d(0, 26px, 0) scale(0.985); }

          to   { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }

        }

        @keyframes tm-sheen {

          0%   { transform: translateX(-160%); }

          100% { transform: translateX(360%); }

        }

        @keyframes tm-pop {

          0%   { opacity: 0; transform: scale(0.72); }

          60%  { opacity: 1; transform: scale(1.06); }

          100% { opacity: 1; transform: scale(1); }

        }

        @keyframes tm-spin { to { transform: rotate(360deg); } }

        @keyframes tm-confetti {

          0%   { transform: translate3d(0, -24px, 0) rotate(0deg); opacity: 0; }

          15%  { opacity: 1; }

          100% { transform: translate3d(var(--tm-dx, 0px), 220px, 0) rotate(620deg); opacity: 0; }

        }

        @keyframes tm-glow-pulse {

          0%, 100% { box-shadow: 0 0 0 0 rgba(109, 139, 85, 0.35); }

          50%      { box-shadow: 0 0 0 12px rgba(109, 139, 85, 0); }

        }

        .tm-rise { animation: tm-rise 620ms cubic-bezier(0.22, 1, 0.36, 1) both; }

        .tm-pop  { animation: tm-pop 520ms cubic-bezier(0.22, 1, 0.36, 1) both; }

        @media (prefers-reduced-motion: reduce) {

          *, *::before, *::after {

            animation-duration: 0.001ms !important;

            animation-iteration-count: 1 !important;

            transition-duration: 0.001ms !important;

            scroll-behavior: auto !important;

          }

          .tm-tilt { transform: none !important; }

        }

      `}</style>

      <AmbientBackdrop />

      <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-4 sm:px-8 sm:pt-6">

        {/* ================= nav ================= */}

        <nav className="sticky top-3 z-30 flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-[0_10px_34px_-18px_rgba(35,56,43,0.55)] backdrop-blur-xl">

          <a

            href="/"

            className="group flex items-center gap-2 rounded-lg text-lg font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-[#6d8b55] focus-visible:ring-offset-2"

            aria-label="TrailMate home"

          >

            <span

              className="text-2xl transition-transform duration-500 group-hover:rotate-[18deg] group-hover:scale-110"

              aria-hidden="true"

            >

              🌿

            </span>

            TrailMate

          </a>

          <span className="hidden rounded-full border border-[#d9dfd3] bg-white/80 px-4 py-1.5 text-xs font-medium text-[#52614f] sm:inline-block">

            Made for the outdoors

          </span>

        </nav>

        {/* ================= hero ================= */}

        <header className="relative py-14 text-center sm:py-20">

          <div

            className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-white to-[#e8f0dd] text-4xl ring-1 ring-white/80"

            style={{

              animation: "tm-bob3d 5.5s ease-in-out infinite",

              boxShadow:

                "0 26px 46px -22px rgba(35,56,43,0.65), inset 0 1px 0 rgba(255,255,255,0.9)",

              transformStyle: "preserve-3d",

            }}

            aria-hidden="true"

          >

            🧭

          </div>

          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-[#63815c]">

            Less scrolling. More living.

          </p>

          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-[1.06] tracking-tight sm:text-6xl">

            Your next adventure

            <br />

            <span className="bg-gradient-to-r from-[#6d8b55] via-[#4f7a45] to-[#7fa05f] bg-clip-text text-transparent">

              starts outside.

            </span>

          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-[#69766b] sm:text-lg">

            Tell us how you feel and how much time you have. We&apos;ll help you turn an

            ordinary day into an outdoor adventure.

          </p>

        </header>

        {/* ================= builder ================= */}

        <section

          aria-labelledby="activity-heading"

          aria-busy={isGenerating}

          className="rounded-[32px] border border-[#e6e9de] bg-white/85 p-5 shadow-[0_30px_70px_-40px_rgba(35,56,43,0.55)] backdrop-blur-xl sm:p-8"

        >

          {/* --- activity --- */}

          <div className="mb-7">

            <h2 id="activity-heading" className="text-xl font-bold">

              What would you like to do?

            </h2>

            <p className="mt-1 text-sm text-[#778176]">

              Choose an experience that feels right for you.

            </p>

          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

            {activities.map((item) => {

              const selected = activity === item.value;

              return (

                <TiltButton

                  key={item.value}

                  intensity={7}

                  disabled={isGenerating}

                  onClick={() => {

                    setActivity(item.value);

                    clearCurrentAdventure();

                  }}

                  aria-pressed={selected}

                  className={`rounded-2xl border p-4 text-left outline-none disabled:cursor-not-allowed disabled:opacity-55 focus-visible:ring-2 focus-visible:ring-[#6d8b55] focus-visible:ring-offset-2 ${

                    selected

                      ? "border-[#54764b] bg-gradient-to-br from-[#f2f7ea] to-[#e7f0dc] shadow-[0_20px_40px_-22px_rgba(84,118,75,0.85)] ring-1 ring-[#54764b]"

                      : "border-[#e7e9e2] bg-white shadow-[0_10px_26px_-20px_rgba(35,56,43,0.6)] hover:border-[#a7b79c]"

                  }`}

                >

                  <span className="tm-depth block text-2xl" aria-hidden="true">

                    {item.icon}

                  </span>

                  <h3 className="mt-3 font-semibold">{item.title}</h3>

                  <p className="mt-1 text-sm text-[#778176]">{item.description}</p>

                </TiltButton>

              );

            })}

          </div>

          {/* --- duration --- */}

          <div className="mt-10">

            <h2 className="text-lg font-bold">How much time do you have?</h2>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">

              {DURATIONS.map((minutes) => {

                const selected = duration === minutes;

                return (

                  <TiltButton

                    key={minutes}

                    intensity={5}

                    disabled={isGenerating}

                    onClick={() => {

                      setDuration(minutes);

                      clearCurrentAdventure();

                    }}

                    aria-pressed={selected}

                    className={`rounded-xl border px-2 py-3 text-sm font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-55 focus-visible:ring-2 focus-visible:ring-[#6d8b55] focus-visible:ring-offset-2 sm:text-base ${

                      selected

                        ? "border-[#54764b] bg-[#54764b] text-white shadow-[0_16px_30px_-16px_rgba(84,118,75,0.95)]"

                        : "border-[#e3e6dc] bg-white hover:border-[#a7b79c]"

                    }`}

                  >

                    {minutes} min

                  </TiltButton>

                );

              })}

            </div>

          </div>

          {/* --- mood --- */}

          <div className="mt-10">

            <h2 className="text-lg font-bold">What&apos;s your mood?</h2>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">

              {moods.map((item) => {

                const selected = mood === item.value;

                return (

                  <TiltButton

                    key={item.value}

                    intensity={6}

                    disabled={isGenerating}

                    onClick={() => {

                      setMood(item.value);

                      clearCurrentAdventure();

                    }}

                    aria-pressed={selected}

                    className={`rounded-xl border px-4 py-3 font-medium outline-none disabled:cursor-not-allowed disabled:opacity-55 focus-visible:ring-2 focus-visible:ring-[#6d8b55] focus-visible:ring-offset-2 ${

                      selected

                        ? "border-[#54764b] bg-gradient-to-br from-[#f2f7ea] to-[#e7f0dc] shadow-[0_18px_36px_-22px_rgba(84,118,75,0.9)]"

                        : "border-[#e3e6dc] bg-white hover:border-[#a7b79c]"

                    }`}

                  >

                    <span className="mr-2" aria-hidden="true">

                      {item.icon}

                    </span>

                    {item.title}

                  </TiltButton>

                );

              })}

            </div>

          </div>

          {/* --- generate --- */}

          <TiltButton

            intensity={4}

            onClick={generateAdventure}

            disabled={isGenerating}

            className="mt-10 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-[#2f5139] via-[#294633] to-[#1e3527] px-6 py-4 font-semibold text-white shadow-[0_22px_44px_-20px_rgba(41,70,51,0.95)] outline-none transition-colors hover:from-[#35593f] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-[#6d8b55] focus-visible:ring-offset-2"

            style={

              !isGenerating && !adventure

                ? { animation: "tm-glow-pulse 3.2s ease-in-out infinite" }

                : undefined

            }

          >

            {isGenerating && (

              <span

                className="h-4 w-4 rounded-full border-2 border-white/35 border-t-white"

                style={{ animation: "tm-spin 0.7s linear infinite" }}

                aria-hidden="true"

              />

            )}

            {isGenerating

              ? "Creating your adventure..."

              : adventure

                ? "Generate Another Adventure →"

                : "Create My Adventure →"}

          </TiltButton>

          <p className="mt-3 text-center text-xs leading-5 text-[#899187]">

            Your adventure is a starting point. Choose safe, accessible places and adapt

            activities to your surroundings.

          </p>

        </section>

        {/* ================= error ================= */}

        {error && (

          <p

            role="alert"

            className="tm-rise mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-700 shadow-[0_16px_34px_-24px_rgba(185,28,28,0.7)] backdrop-blur"

          >

            <span aria-hidden="true">⚠️</span>

            <span>{error}</span>

          </p>

        )}

        {/* ================= loading skeleton ================= */}

        {isGenerating && (

          <section

            aria-hidden="true"

            className="tm-rise mt-8 rounded-[32px] border border-[#e6e9de] bg-white/85 p-5 shadow-[0_30px_70px_-40px_rgba(35,56,43,0.5)] backdrop-blur-xl sm:p-8"

          >

            <div className="flex items-center gap-4">

              <span

                className="h-10 w-10 shrink-0 rounded-full border-2 border-[#dfe6d7] border-t-[#54764b]"

                style={{ animation: "tm-spin 0.85s linear infinite" }}

              />

              <div>

                <p className="font-semibold">Crafting your adventure…</p>

                <p className="text-sm text-[#778176]">

                  Matching {duration} minutes of {moodLabel.toLowerCase()} energy.

                </p>

              </div>

            </div>

            <div className="mt-6 space-y-3">

              {[0, 1, 2].map((i) => (

                <div

                  key={i}

                  className="relative overflow-hidden rounded-2xl border border-[#eef0e8] bg-[#f8f9f5] p-5"

                >

                  <div className="h-4 w-1/3 rounded-full bg-[#e6eadf]" />

                  <div className="mt-3 h-3 w-3/4 rounded-full bg-[#eef1e9]" />

                  <div className="mt-2 h-3 w-1/2 rounded-full bg-[#eef1e9]" />

                  <span

                    className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/80 to-transparent"

                    style={{ animation: `tm-sheen 1.7s ease-in-out ${i * 0.18}s infinite` }}

                  />

                </div>

              ))}

            </div>

          </section>

        )}

        {/* ================= adventure ================= */}

        {adventure && !isGenerating && (

          <section

            ref={adventureRef}

            aria-labelledby="adventure-title"

            aria-live="polite"

            className="tm-rise mt-8 scroll-mt-24 rounded-[32px] border border-[#e6e9de] bg-white/85 p-5 shadow-[0_36px_80px_-44px_rgba(35,56,43,0.6)] backdrop-blur-xl sm:p-8"

          >

            <div className="flex flex-wrap items-start justify-between gap-4">

              <div className="max-w-2xl">

                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#63815c]">

                  Your adventure

                </p>

                <h2

                  id="adventure-title"

                  className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl"

                >

                  {adventure.title}

                </h2>

                <p className="mt-3 leading-7 text-[#69766b]">{adventure.description}</p>

              </div>

              <div className="flex flex-wrap gap-2 text-sm">

                <span className="rounded-full bg-[#f0f4e9] px-3 py-1.5 font-medium text-[#36553b] ring-1 ring-[#dfe8d5]">

                  ⏱ {adventure.duration} min

                </span>

                <span

                  className={`rounded-full px-3 py-1.5 font-medium capitalize ring-1 ${

                    DIFFICULTY_STYLES[adventure.difficulty] ??

                    "bg-[#f6f6ef] text-[#52614f] ring-[#e3e6dc]"

                  }`}

                >

                  {adventure.difficulty} difficulty

                </span>

              </div>

            </div>

            {/* --- progress --- */}

            <div className="mt-8">

              <div className="mb-2 flex items-center justify-between gap-3 text-sm">

                <span className="font-semibold">Your progress</span>

                <span className="tabular-nums text-[#69766b]">

                  {completedCount} of {adventure.missions.length} missions · {progress}%

                </span>

              </div>

              <div

                className="relative h-3 w-full overflow-hidden rounded-full bg-[#e9ece4] shadow-[inset_0_2px_4px_rgba(35,56,43,0.12)]"

                role="progressbar"

                aria-label="Adventure completion"

                aria-valuemin={0}

                aria-valuemax={100}

                aria-valuenow={progress}

              >

                <div

                  className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#6d8b55] to-[#3f6338] transition-[width] duration-700 ease-out"

                  style={{ width: `${progress}%` }}

                >

                  <span

                    className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent"

                    style={{ animation: "tm-sheen 2.4s ease-in-out infinite" }}

                  />

                </div>

              </div>

            </div>

            {/* --- missions --- */}

            <div className="mt-8 space-y-3">

              {adventure.missions.map((mission, index) => {

                const isCompleted = completedMissionIds.includes(mission.id);

                return (

                  <TiltPanel

                    key={mission.id}

                    intensity={3}

                    className={`rounded-2xl border p-4 sm:p-5 ${

                      isCompleted

                        ? "border-[#c9d8bf] bg-gradient-to-br from-[#f7faf3] to-[#eef4e7] shadow-[0_16px_34px_-26px_rgba(84,118,75,0.9)]"

                        : "border-[#e7e9e2] bg-white shadow-[0_14px_32px_-26px_rgba(35,56,43,0.7)]"

                    }`}

                  >

                    <div className="flex items-start gap-3">

                      <span

                        className={`tm-depth-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${

                          isCompleted

                            ? "bg-[#54764b] text-white shadow-[0_10px_20px_-10px_rgba(84,118,75,1)]"

                            : "bg-[#f0f4e9] text-[#36553b]"

                        }`}

                        style={isCompleted ? { animation: "tm-pop 480ms ease-out both" } : undefined}

                        aria-label={isCompleted ? "Completed" : `Mission ${index + 1}`}

                      >

                        {isCompleted ? "✓" : index + 1}

                      </span>

                      <div className="min-w-0 flex-1">

                        <div className="flex flex-wrap items-center justify-between gap-2">

                          <h3

                            className={`font-semibold transition-colors ${

                              isCompleted ? "text-[#63815c] line-through" : "text-[#23382b]"

                            }`}

                          >

                            {mission.title}

                          </h3>

                          <span className="whitespace-nowrap rounded-full bg-[#f6f6ef] px-3 py-1 text-xs font-medium text-[#69766b]">

                            {mission.duration} min

                          </span>

                        </div>

                        <p className="mt-2 text-sm leading-6 text-[#69766b]">

                          {mission.description}

                        </p>

                        <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              toggleMission(mission.id);
                            }}
                            aria-pressed={isCompleted}
                            className={`mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border px-3.5 py-2 text-sm font-semibold outline-none transition-all duration-200 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#6d8b55] focus-visible:ring-offset-2 ${
                              isCompleted
                                ? "border-[#c9d8bf] bg-white text-[#36553b] shadow-[0_10px_22px_-18px_rgba(35,56,43,0.9)] hover:bg-[#f0f4e9]"
                                : "border-[#54764b] bg-[#294633] text-white shadow-[0_14px_28px_-16px_rgba(41,70,51,0.95)] hover:bg-[#1f3828]"
                            }`}
                          >
                            {isCompleted ? "✓ Completed — Undo" : "Mark as completed"}
                          </button>

                      </div>

                    </div>

                  </TiltPanel>

                );

              })}

            </div>

            {/* --- completion --- */}

            {progress === 100 && (

              <div className="tm-pop relative mt-7 overflow-hidden rounded-2xl border border-[#c9d8bf] bg-gradient-to-br from-[#f2f7ea] to-[#e4efd8] p-6 text-center shadow-[0_22px_50px_-30px_rgba(84,118,75,1)]">

                <div className="pointer-events-none absolute inset-0 overflow-hidden">

                  {CONFETTI.map((c, i) => (

                    <span

                      key={i}

                      className="absolute top-0 block rounded-[2px]"

                      style={

                        {

                          left: `${c.left}%`,

                          width: c.size,

                          height: c.size,

                          background: c.color,

                          "--tm-dx": `${c.drift}px`,

                          animation: `tm-confetti ${c.duration}s ease-in ${c.delay}s infinite`,

                        } as React.CSSProperties

                      }

                    />

                  ))}

                </div>

                <p className="relative text-3xl" aria-hidden="true">

                  🎉

                </p>

                <h3 className="relative mt-2 text-lg font-bold">Adventure completed!</h3>

                <p className="relative mt-1 text-sm text-[#52614f]">

                  Great job getting outside and making the most of your time.

                </p>

              </div>

            )}

          </section>

        )}

        <footer className="py-10 text-center text-sm text-[#899187]">

          Built for more moments in the real world. 🌎

        </footer>

      </div>

    </main>

  );

}
