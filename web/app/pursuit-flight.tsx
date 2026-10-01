"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Flight = {
  id: number;
  from: { left: number; top: number; width: number; height: number };
  to: { left: number; top: number; width: number; height: number } | null;
};

let nextFlight = 1;

/** Envelope that leaves a card and lands on the Pursuing tab. */
export function PursuitFlights() {
  const [flights, setFlights] = useState<Flight[]>([]);

  useEffect(() => {
    const onMail = (event: Event) => {
      const detail = (event as CustomEvent<Omit<Flight, "id">>).detail;
      if (!detail?.from) return;
      setFlights((current) => [...current, { ...detail, id: nextFlight++ }]);
    };
    window.addEventListener("ll-file-listing", onMail);
    return () => window.removeEventListener("ll-file-listing", onMail);
  }, []);

  if (flights.length === 0) return null;
  return createPortal(
    <>
      {flights.map((flight) => (
        <FlyingEnvelope
          key={flight.id}
          flight={flight}
          onDone={() => {
            document.getElementById("pursuing-tab")?.classList.add("pursuit-hit");
            window.setTimeout(() => {
              document.getElementById("pursuing-tab")?.classList.remove("pursuit-hit");
            }, 600);
            setFlights((current) => current.filter((item) => item.id !== flight.id));
          }}
        />
      ))}
    </>,
    document.body,
  );
}

function FlyingEnvelope({ flight, onDone }: { flight: Flight; onDone: () => void }) {
  const finish = useRef(onDone);
  finish.current = onDone;

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      finish.current();
      return;
    }
    const node = document.getElementById(`mail-${flight.id}`);
    if (!node) return;
    const fromX = flight.from.left + flight.from.width / 2;
    const fromY = flight.from.top + flight.from.height / 2;
    const dest = flight.to ?? { left: fromX, top: 72, width: 0, height: 0 };
    const rawX = dest.left + dest.width / 2;
    const rawY = dest.top + dest.height / 2;
    // Land on the tab when it is on screen. Otherwise exit just past the
    // edge nearest the tab, so the envelope is still seen leaving the board.
    const pad = 28;
    const toX = Math.min(window.innerWidth + pad, Math.max(-pad, rawX));
    const toY = Math.min(window.innerHeight + pad, Math.max(-pad, rawY));
    const dx = toX - fromX;
    const dy = toY - fromY;
    const animation = node.animate(
      [
        { transform: "translate(-50%, -50%) scale(1) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(calc(-50% + ${dx * 0.35}px), calc(-50% + ${dy * 0.15 - 36}px)) scale(0.9) rotate(-11deg)`,
          opacity: 1,
          offset: 0.42,
        },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.28) rotate(8deg)`,
          opacity: 0,
        },
      ],
      { duration: 720, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
    );
    animation.onfinish = () => finish.current();
    return () => animation.cancel();
  }, [flight]);

  const fromX = flight.from.left + flight.from.width / 2;
  const fromY = flight.from.top + flight.from.height / 2;

  return (
    <div
      id={`mail-${flight.id}`}
      aria-hidden
      className="pointer-events-none fixed z-[70] drop-shadow-[0_12px_16px_rgb(22_20_18/0.28)]"
      style={{ left: fromX, top: fromY }}
    >
      <Envelope />
    </div>
  );
}

export function Envelope({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 88 60" className={`h-14 w-20 ${className}`} aria-hidden>
      <rect x="1" y="10" width="86" height="48" fill="#f7f4ee" stroke="#161412" strokeWidth="1.5" />
      <path d="M1 12 44 40 87 12" fill="none" stroke="#6e5220" strokeWidth="1.5" />
      <path d="M1 56 32 32" fill="none" stroke="#161412" strokeWidth="1.2" />
      <path d="M87 56 56 32" fill="none" stroke="#161412" strokeWidth="1.2" />
      <path d="M8 8h72l-8 10H16Z" fill="#c6a15b" stroke="#161412" strokeWidth="1.2" />
    </svg>
  );
}
