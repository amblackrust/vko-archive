/** Структура меню. Подписи: layout.nav.groups.<id> и layout.nav.items.<id>. */
export interface NavItem {
  id: string;
  href: string;
}

export interface NavGroup {
  id: string;
  items: NavItem[];
}

export const catalogHref = "/catalog";
export const searchHref = "/search";

export const navGroups: NavGroup[] = [
  {
    id: "catalog",
    items: [
      { id: "search", href: searchHref },
      { id: "documents", href: catalogHref },
      { id: "funds", href: "/catalog/funds" },
      { id: "personalFunds", href: "/catalog/funds?type=personal" },
      { id: "newspapers", href: "/catalog/newspapers" },
    ],
  },
  {
    id: "services",
    items: [
      { id: "services", href: "/services" },
      { id: "navigator", href: "/navigator" },
      { id: "stateService", href: "/services/state" },
      { id: "paidServices", href: "/services/paid" },
      { id: "readingRoom", href: "/help/reading-room" },
      { id: "legal", href: "/legal" },
      { id: "compliance", href: "/compliance" },
    ],
  },
  {
    id: "history",
    items: [
      { id: "memory", href: "/memory" },
      { id: "exhibitions", href: "/exhibitions" },
      { id: "timeline", href: "/memory/timeline" },
      { id: "historyMap", href: "/memory/map" },
      { id: "calendar", href: "/calendar" },
    ],
  },
  {
    id: "about",
    items: [
      { id: "about", href: "/about" },
      { id: "branches", href: "/branches" },
      { id: "news", href: "/news" },
      { id: "publications", href: "/publications" },
      { id: "contacts", href: "/contacts" },
    ],
  },
  {
    id: "help",
    items: [
      { id: "help", href: "/help" },
      { id: "faq", href: "/help/faq" },
      { id: "assistant", href: "/assistant" },
      { id: "symbols", href: "/symbols" },
      { id: "links", href: "/links" },
    ],
  },
];

/** Короткая навигация в подвале: самые востребованные разделы. */
export const footerLinks: NavItem[] = [
  { id: "documents", href: catalogHref },
  { id: "funds", href: "/catalog/funds" },
  { id: "stateService", href: "/services/state" },
  { id: "branches", href: "/branches" },
  { id: "exhibitions", href: "/exhibitions" },
  { id: "memory", href: "/memory" },
  { id: "help", href: "/help" },
];
