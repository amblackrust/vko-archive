"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window`, so it only loads in the browser.
export const BranchMap = dynamic(() => import("./branch-map"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-paper-2" />,
});
