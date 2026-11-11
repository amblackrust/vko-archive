"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Leaflet обращается к window при импорте: карта загружается только в браузере.
export const HistoryMap = dynamic(() => import("./history-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});
