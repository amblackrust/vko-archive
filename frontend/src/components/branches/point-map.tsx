"use client";

import { BranchMap } from "@/components/map/branch-map-lazy";

/** One marker on a map; a client component so the page can stay on the server. */
export function PointMap({ slug, name, lat, lng, head }: { slug: string; name: string; lat: number; lng: number; head?: boolean }) {
  return <BranchMap branches={[{ slug, name, lat, lng, head }]} className="absolute inset-0" />;
}
