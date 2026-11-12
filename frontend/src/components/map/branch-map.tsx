"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapBranch = { slug: string; name: string; lat: number; lng: number; head?: boolean };

type Props = {
  branches: MapBranch[];
  activeSlug?: string | null;
  onSelect?: (slug: string) => void;
  /** The card pinned to the selected marker. It follows the marker while the map moves. Without it the marker only highlights. */
  renderCard?: (slug: string) => React.ReactNode;
  /** Clicking the bare map clears the selection. */
  onClose?: () => void;
  /** The detail sheet is open: zoom in closer on the marker and keep it above the sheet. */
  detail?: boolean;
  /** When false, activeSlug only highlights the pin (hover); the map does not move. */
  follow?: boolean;
  className?: string;
  scrollZoom?: boolean;
};

const ZOOM_SELECT = 11;
const ZOOM_DETAIL = 14;

/** Leaflet map (OpenStreetMap tiles, no keys). The selected marker carries a card that is positioned from the
 * marker's screen point on every map frame, so it stays attached while the map flies and when markers swap. */
export default function BranchMap({ branches, activeSlug, onSelect, renderCard, onClose, detail = false, follow = true, className, scrollZoom = false }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const active = useRef<string | null>(null);
  const callbacks = useRef({ onSelect, onClose });
  callbacks.current = { onSelect, onClose };
  active.current = activeSlug ?? null;

  /** Moves the card to the selected marker's current screen point. */
  const place = () => {
    const m = map.current;
    const node = card.current;
    const marker = active.current ? markers.current.get(active.current) : undefined;
    if (!m || !node || !marker) return;
    const p = m.latLngToContainerPoint(marker.getLatLng());
    node.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
  };

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { scrollWheelZoom: scrollZoom, zoomControl: false, attributionControl: true });
    L.control.zoom({ position: "bottomright" }).addTo(m);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    map.current = m;
    const pins = markers.current;
    m.on("move zoom viewreset resize", place);
    m.on("click", () => callbacks.current.onClose?.());
    return () => {
      m.remove();
      map.current = null;
      pins.clear();
    };
  }, [scrollZoom]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current.clear();
    const points: L.LatLngTuple[] = [];
    for (const b of branches) {
      const icon = L.divIcon({
        className: "",
        html: `<span class="map-pin${b.head ? " map-pin--head" : ""}"></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const marker = L.marker([b.lat, b.lng], { icon, title: b.name, alt: b.name, bubblingMouseEvents: false });
      marker.on("click", () => callbacks.current.onSelect?.(b.slug));
      marker.addTo(m);
      markers.current.set(b.slug, marker);
      points.push([b.lat, b.lng]);
    }
    if (points.length) m.fitBounds(points, { padding: [40, 40], maxZoom: 9 });
    // Re-fit only when the set of branches changes.
  }, [branches]);

  useEffect(() => {
    const m = map.current;
    markers.current.forEach((marker, slug) => {
      marker.getElement()?.classList.toggle("map-pin-active", slug === activeSlug);
    });
    const marker = activeSlug ? markers.current.get(activeSlug) : undefined;
    if (!follow || !m || !marker) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const at = marker.getLatLng();
    const zoom = detail ? ZOOM_DETAIL : Math.max(Math.min(m.getZoom(), ZOOM_DETAIL), ZOOM_SELECT);
    const height = m.getSize().y;
    // Where the marker should rest, measured down from the map centre: with the card above it the marker sits
    // below the centre; with the detail sheet covering the lower part it rises into the free upper area.
    const rest = detail ? -height * 0.2 : 150;
    const centre = m.unproject(m.project(at, zoom).add([0, -rest]), zoom);
    m.flyTo(centre, zoom, { animate: !reduced, duration: detail ? 1.1 : 0.9, easeLinearity: 0.35 });
    place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlug, detail, branches]);

  return (
    <div className={className}>
      <div ref={el} className="absolute inset-0" />
      {renderCard && (
        <div ref={card} className="pointer-events-none absolute left-0 top-0 z-[600] will-change-transform">
          <AnimatePresence mode="popLayout">
            {activeSlug && !detail && (
              <motion.div
                key={activeSlug}
                initial={{ opacity: 0, scale: 0.86, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 6 }}
                transition={{ type: "spring", visualDuration: 0.35, bounce: 0.18 }}
                style={{ transformOrigin: "50% 100%" }}
                className="pointer-events-auto absolute bottom-5 left-0 w-[min(19rem,78vw)] -translate-x-1/2"
              >
                <div className="glass relative rounded-[22px] border border-line p-4 shadow-lift-high">
                  {renderCard(activeSlug)}
                  <span aria-hidden className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 border-b border-r border-line bg-paper" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
