"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Leaflet работает только в браузере: без SSR.
const BranchMap = dynamic(() => import("./branch-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-lg" />,
});

export { BranchMap };
