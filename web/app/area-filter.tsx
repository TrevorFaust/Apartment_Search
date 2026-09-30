"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import type * as Leaflet from "leaflet";
import { encodeAreas, parseAreas, type Coordinates } from "@/lib/geo";
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

  const rings = parseAreas(area);
  const summary = !rings
    ? "Draw on map"
    : rings.length === 1
      ? "1 drawn area"
      : `${rings.length} drawn areas`;

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
        <span className="truncate">{summary}</span>
        <PencilIcon />
      </button>
      {open &&
        createPortal(
          <AreaDrawer
            initial={rings}
            centers={centers}
            onCancel={() => setOpen(false)}
            onApply={(next) => apply(next?.length ? encodeAreas(next) : "")}
          />,
          document.body,
        )}
    </div>
  );
}

type MapTool = "draw" | "pan" | "erase";

function AreaDrawer({
  initial,
  centers,
  onCancel,
  onApply,
}: {
  initial: Coordinates[][] | null;
  centers: Coordinates[];
  onCancel: () => void;
  onApply: (rings: Coordinates[][] | null) => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const [shapes, setShapes] = useState<Coordinates[][]>(initial ?? []);
  const [tool, setTool] = useState<MapTool>(initial?.length ? "pan" : "draw");
  const toolRef = useRef(tool);
  const setToolMode = useRef<(next: MapTool) => void>(() => {});
  const clearShapes = useRef<() => void>(() => {});

  useEffect(() => {
    toolRef.current = tool;
    setToolMode.current(tool);
  }, [tool]);

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
      const eraseStyle = { color: "#6e2e24", weight: 3, fillColor: "#c9a35a", fillOpacity: 0.28 };
      const saved: Array<{ coords: Coordinates[]; layer: Leaflet.Polygon }> = [];
      let draft: Leaflet.Polyline | null = null;

      const publish = () => setShapes(saved.map((item) => item.coords));

      const restyle = (next: MapTool) => {
        for (const item of saved) item.layer.setStyle(next === "erase" ? eraseStyle : style);
      };

      const addShape = (coords: Coordinates[]) => {
        const layer = L.polygon(
          coords.map((p) => [p.lat, p.lng] as [number, number]),
          style,
        ).addTo(map!);
        const item = { coords, layer };
        saved.push(item);
        layer.on("click", (event) => {
          if (toolRef.current !== "erase") return;
          L.DomEvent.stopPropagation(event);
          layer.remove();
          const index = saved.indexOf(item);
          if (index >= 0) saved.splice(index, 1);
          publish();
        });
      };

      if (initial?.length) {
        for (const ring of initial) addShape(ring);
        const group = L.featureGroup(saved.map((item) => item.layer));
        map.fitBounds(group.getBounds(), { padding: [40, 40] });
      } else if (centers.length === 1) {
        map.setView([centers[0]!.lat, centers[0]!.lng], 13);
      } else if (centers.length > 1) {
        map.setView([centers[0]!.lat, centers[0]!.lng], 12);
      } else {
        map.setView([39.5, -98.35], 4);
      }

      clearShapes.current = () => {
        draft?.remove();
        draft = null;
        for (const item of saved) item.layer.remove();
        saved.length = 0;
        publish();
      };

      const container = map.getContainer();
      setToolMode.current = (next) => {
        if (!map) return;
        restyle(next);
        if (next === "draw") {
          map.dragging.disable();
          container.style.cursor = "crosshair";
          container.style.touchAction = "none";
        } else {
          map.dragging.enable();
          container.style.cursor = next === "erase" ? "pointer" : "grab";
          container.style.touchAction = "";
        }
      };
      setToolMode.current(toolRef.current);

      let trace: Coordinates[] = [];
      let tracing = false;

      const toLatLng = (e: PointerEvent) => {
        const ll = map!.mouseEventToLatLng(e as unknown as MouseEvent);
        return { lat: ll.lat, lng: ll.lng };
      };

      container.addEventListener("pointerdown", (e) => {
        if (toolRef.current !== "draw" || e.button !== 0) return;
        if ((e.target as HTMLElement).closest?.(".leaflet-control")) return;
        e.preventDefault();
        try {
          container.setPointerCapture(e.pointerId);
        } catch {
          /* A cancelled pointer doesn't need capture for the trace to finish. */
        }
        tracing = true;
        trace = [toLatLng(e)];
        draft?.remove();
        draft = L.polyline([[trace[0]!.lat, trace[0]!.lng]], style).addTo(map!);
      });

      container.addEventListener("pointermove", (e) => {
        if (!tracing || !draft) return;
        const point = toLatLng(e);
        trace.push(point);
        draft.addLatLng([point.lat, point.lng]);
      });

      const finish = () => {
        if (!tracing) return;
        tracing = false;
        draft?.remove();
        draft = null;
        if (trace.length < 3) return;
        addShape(trace);
        publish();
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
              {tool === "draw"
                ? "Press and drag to add an area. Draw again for another."
                : tool === "erase"
                  ? "Click an outline to remove it."
                  : "Drag to move the map. Scroll, or use the + control, to zoom."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={tool === "draw"}
              onClick={() => setTool("draw")}
              className={toolClass(tool === "draw")}
            >
              Draw
            </button>
            <button
              type="button"
              aria-pressed={tool === "pan"}
              onClick={() => setTool("pan")}
              className={toolClass(tool === "pan")}
            >
              Move
            </button>
            <button
              type="button"
              aria-pressed={tool === "erase"}
              onClick={() => setTool("erase")}
              className={toolClass(tool === "erase")}
            >
              Erase
            </button>
            {shapes.length > 0 && (
              <button
                type="button"
                onClick={() => clearShapes.current()}
                className="press min-h-10 border border-ink/20 px-3 text-xs uppercase tracking-[0.14em] text-ink-soft hover:border-ink hover:bg-ink hover:text-bg-elevated"
              >
                Clear
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
              disabled={shapes.length === 0 && (initial?.length ?? 0) === 0}
              onClick={() => onApply(shapes.length ? shapes : null)}
              className="press min-h-10 bg-ink px-4 text-xs uppercase tracking-[0.16em] text-bg-elevated hover:bg-metal hover:text-ink disabled:opacity-40"
            >
              {shapes.length ? `Apply ${shapes.length === 1 ? "area" : "areas"}` : "Remove areas"}
            </button>
          </div>
        </div>
        <div ref={mapEl} className="min-h-0 flex-1" />
      </div>
    </div>
  );
}

function toolClass(active: boolean) {
  return `press min-h-10 border px-3 text-xs uppercase tracking-[0.14em] ${
    active
      ? "border-ink bg-ink text-bg-elevated"
      : "border-ink/20 text-ink-soft hover:border-ink hover:bg-ink hover:text-bg-elevated"
  }`;
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
