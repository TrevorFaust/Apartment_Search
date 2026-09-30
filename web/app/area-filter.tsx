"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import type * as Leaflet from "leaflet";
import { encodeArea, parseArea, type Coordinates } from "@/lib/geo";
import { FieldLabel, submitClosestForm } from "./dropdown";

/**
 * "Draw on map" filter. The traced outline rides in the URL as `area`, and
 * the server keeps only listings whose pin falls inside it.
 */
export function AreaFilter({
  value,
  centers,
}: {
  value: string;
  centers: Coordinates[];
}) {
  const [area, setArea] = useState(value);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setArea(value);
  }, [value]);

  const apply = (next: string) => {
    flushSync(() => {
      setArea(next);
      setOpen(false);
    });
    submitClosestForm(anchorRef.current);
  };

  return (
    <div className="flex flex-col gap-1">
      <input ref={anchorRef} type="hidden" name="area" value={area} />
      <FieldLabel label="Map area" onClear={area ? () => apply("") : undefined} />
      <button
        type="button"
        suppressHydrationWarning
        onClick={() => setOpen(true)}
        className="field-control flex items-center justify-between gap-2 text-left hover:border-accent"
      >
        <span className="truncate">{area ? "Drawn area" : "Draw on map"}</span>
        <PencilIcon />
      </button>
      {open &&
        createPortal(
          <AreaDrawer
            initial={parseArea(area)}
            centers={centers}
            onCancel={() => setOpen(false)}
            onApply={(points) => apply(points ? encodeArea(points) : "")}
          />,
          document.body,
        )}
    </div>
  );
}

function AreaDrawer({
  initial,
  centers,
  onCancel,
  onApply,
}: {
  initial: Coordinates[] | null;
  centers: Coordinates[];
  onCancel: () => void;
  onApply: (points: Coordinates[] | null) => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<Coordinates[] | null>(initial);
  const [drawing, setDrawing] = useState(initial == null);
  const drawingRef = useRef(drawing);
  const setDrawMode = useRef<(on: boolean) => void>(() => {});
  const clearShape = useRef<() => void>(() => {});

  useEffect(() => {
    drawingRef.current = drawing;
    setDrawMode.current(drawing);
  }, [drawing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onCancel]);

  useEffect(() => {
    let map: Leaflet.Map | null = null;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapEl.current) return;

      map = L.map(mapEl.current, { zoomControl: true, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      const style = { color: "#8a6a2f", weight: 2, fillColor: "#c9a35a", fillOpacity: 0.18 };
      let shape: Leaflet.Polygon | Leaflet.Polyline | null = null;

      if (initial) {
        shape = L.polygon(initial.map((p) => [p.lat, p.lng] as [number, number]), style).addTo(map);
        map.fitBounds(shape.getBounds(), { padding: [40, 40] });
      } else if (centers.length === 1) {
        map.setView([centers[0]!.lat, centers[0]!.lng], 13);
      } else if (centers.length > 1) {
        map.setView([centers[0]!.lat, centers[0]!.lng], 12);
      } else {
        map.setView([39.5, -98.35], 4);
      }

      clearShape.current = () => {
        shape?.remove();
        shape = null;
      };

      const container = map.getContainer();
      setDrawMode.current = (on) => {
        if (!map) return;
        if (on) {
          map.dragging.disable();
          container.style.cursor = "crosshair";
          container.style.touchAction = "none";
        } else {
          map.dragging.enable();
          container.style.cursor = "";
          container.style.touchAction = "";
        }
      };
      setDrawMode.current(drawingRef.current);

      let trace: Coordinates[] = [];
      let tracing = false;

      const toLatLng = (e: PointerEvent) => {
        const ll = map!.mouseEventToLatLng(e as unknown as MouseEvent);
        return { lat: ll.lat, lng: ll.lng };
      };

      container.addEventListener("pointerdown", (e) => {
        if (!drawingRef.current || e.button !== 0) return;
        e.preventDefault();
        container.setPointerCapture(e.pointerId);
        tracing = true;
        trace = [toLatLng(e)];
        shape?.remove();
        shape = L.polyline([[trace[0]!.lat, trace[0]!.lng]], style).addTo(map!);
      });

      container.addEventListener("pointermove", (e) => {
        if (!tracing || !shape) return;
        const point = toLatLng(e);
        trace.push(point);
        (shape as Leaflet.Polyline).addLatLng([point.lat, point.lng]);
      });

      const finish = () => {
        if (!tracing) return;
        tracing = false;
        shape?.remove();
        shape = null;
        if (trace.length < 3) {
          setPoints(null);
          return;
        }
        shape = L.polygon(trace.map((p) => [p.lat, p.lng] as [number, number]), style).addTo(map!);
        setPoints(trace);
        setDrawing(false);
      };
      container.addEventListener("pointerup", finish);
      container.addEventListener("pointercancel", finish);
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
    // Map is built once per open; later prop changes don't move it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Draw a search area"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-3 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="flex h-full max-h-[48rem] w-full max-w-5xl flex-col border border-ink/20 bg-bg-elevated shadow-lift">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-brass">Map area</p>
            <p className="text-sm text-ink-soft">
              {drawing
                ? "Press and drag to outline the area you want."
                : points
                  ? "Only listings with a pin inside this outline will show."
                  : "Draw an outline, or cancel to keep the current filters."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                clearShape.current();
                setPoints(null);
                setDrawing(true);
              }}
              className="press min-h-10 border border-ink/20 px-3 text-xs uppercase tracking-[0.14em] text-ink-soft hover:border-ink hover:bg-ink hover:text-bg-elevated"
            >
              {points ? "Redraw" : drawing ? "Drawing…" : "Draw"}
            </button>
            {drawing && (
              <button
                type="button"
                onClick={() => setDrawing(false)}
                className="press min-h-10 border border-ink/20 px-3 text-xs uppercase tracking-[0.14em] text-ink-soft hover:border-ink hover:bg-ink hover:text-bg-elevated"
              >
                Pan map
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              className="press min-h-10 border border-ink/20 px-3 text-xs uppercase tracking-[0.14em] text-ink-soft hover:border-ink hover:bg-ink hover:text-bg-elevated"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!points && !initial}
              onClick={() => onApply(points)}
              className="press min-h-10 bg-ink px-4 text-xs uppercase tracking-[0.16em] text-bg-elevated hover:bg-metal hover:text-ink disabled:opacity-40"
            >
              {points ? "Apply area" : "Remove area"}
            </button>
          </div>
        </div>
        <div ref={mapEl} className="min-h-0 flex-1" />
      </div>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 shrink-0 text-ink-faint">
      <path
        d="M11.2 2.3a1.5 1.5 0 0 1 2.1 0l.4.4a1.5 1.5 0 0 1 0 2.1L5.5 13 2 14l1-3.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
