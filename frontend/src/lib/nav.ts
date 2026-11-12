// Single source for site navigation. Labels live in messages/*/nav.json.
export const PRIMARY = [
  { href: "/catalog", key: "catalog" },
  { href: "/exhibitions", key: "exhibitions" },
  { href: "/memory", key: "memory" },
  { href: "/news", key: "news" },
  { href: "/branches", key: "branches" },
  { href: "/help", key: "help" },
] as const;

export const GROUPS = [
  {
    key: "archive",
    items: [
      { href: "/about", key: "about" },
      { href: "/about/contacts", key: "contacts" },
      { href: "/compliance", key: "compliance" },
      { href: "/legal", key: "legal" },
      { href: "/publications", key: "publications" },
    ],
  },
  {
    key: "collections",
    items: [
      { href: "/catalog", key: "catalog" },
      { href: "/catalog/funds", key: "funds" },
      { href: "/exhibitions", key: "exhibitions" },
      { href: "/memory/collections", key: "memoryCollections" },
      { href: "/memory/persons", key: "persons" },
      { href: "/memory/timeline", key: "timeline" },
      { href: "/memory/map", key: "memoryMap" },
    ],
  },
  {
    key: "services",
    items: [
      { href: "/services/state", key: "stateService" },
      { href: "/services/paid", key: "paidServices" },
      { href: "/help/reading-room", key: "readingRoom" },
      { href: "/help/faq", key: "faq" },
      { href: "/branches", key: "branches" },
    ],
  },
  {
    key: "useful",
    items: [
      { href: "/news", key: "news" },
      { href: "/calendar", key: "calendar" },
      { href: "/symbols", key: "symbols" },
      { href: "/links", key: "links" },
    ],
  },
] as const;
