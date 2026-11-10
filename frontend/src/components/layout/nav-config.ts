/**
 * Структура мега-меню. Подписи: layout.nav.groups.<id> и layout.nav.items.<id>.
 * Маршруты разделов, которых ещё нет, временно отдают 404 (их делают пачки этапа 5).
 */
export interface NavItem {
  id: string;
  href: string;
}

export interface NavGroup {
  id: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    id: "about",
    items: [
      { id: "about", href: "/about" },
      { id: "branches", href: "/branches" },
      { id: "readingRoom", href: "/reading-room" },
      { id: "contacts", href: "/contacts" },
      { id: "help", href: "/help" },
    ],
  },
  {
    id: "services",
    items: [
      { id: "stateService", href: "/services/state" },
      { id: "paidServices", href: "/services/paid" },
      { id: "legal", href: "/legal" },
      { id: "compliance", href: "/compliance" },
    ],
  },
  {
    id: "memory",
    items: [
      { id: "memory", href: "/memory" },
      { id: "timeline", href: "/memory/timeline" },
      { id: "historyMap", href: "/memory/map" },
      { id: "exhibitions", href: "/exhibitions" },
    ],
  },
  {
    id: "media",
    items: [
      { id: "news", href: "/news" },
      { id: "publications", href: "/publications" },
    ],
  },
];

export const catalogHref = "/catalog";
export const searchHref = "/search";
