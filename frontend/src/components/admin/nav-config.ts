import {
  BookOpenText, Building2, ChartColumn, FileSpreadsheet, History, Images, Landmark, Languages, LayoutDashboard, Library,
  Settings, ShieldCheck, Sparkles, Users, type LucideIcon,
} from "lucide-react";
import { can, type Me } from "@/lib/api/admin";

/** Группы меню по задачам сотрудника; подписи — admin.nav.groups.<group>. */
export const NAV_GROUPS = ["content", "catalog", "memory", "access", "system"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

export interface AdminNavItem {
  /** Ключ подписи в messages admin.nav.<key>. */
  key: string;
  /** Путь внутри админки без локали. */
  href: string;
  icon: LucideIcon;
  /** Без группы — пункт «Обзор» над группами. */
  group?: NavGroup;
  /** Нужно любое из прав; пусто — доступно всем вошедшим. Это только видимость пункта: сервер проверяет права сам. */
  anyOf?: string[];
  superOnly?: boolean;
}

const adminNav: AdminNavItem[] = [
  { key: "dashboard", href: "/admin", icon: LayoutDashboard },
  { key: "content", href: "/admin/content", icon: BookOpenText, group: "content", anyOf: ["content.view"] },
  { key: "branches", href: "/admin/branches", icon: Building2, group: "content", anyOf: ["branches.view"] },
  { key: "translations", href: "/admin/translations", icon: Languages, group: "content", anyOf: ["catalog.view", "content.view", "branches.view"] },
  { key: "catalog", href: "/admin/catalog", icon: Library, group: "catalog", anyOf: ["catalog.view"] },
  { key: "import", href: "/admin/import", icon: FileSpreadsheet, group: "catalog", anyOf: ["catalog.import", "catalog.export"] },
  { key: "aiTools", href: "/admin/ai-tools", icon: Sparkles, group: "catalog", anyOf: ["ai.use"] },
  { key: "memory", href: "/admin/memory", icon: Landmark, group: "memory", anyOf: ["content.view"] },
  { key: "exhibitions", href: "/admin/exhibitions", icon: Images, group: "memory", anyOf: ["content.view"] },
  { key: "users", href: "/admin/users", icon: Users, group: "access", anyOf: ["users.view"] },
  { key: "roles", href: "/admin/roles", icon: ShieldCheck, group: "access", superOnly: true },
  { key: "analytics", href: "/admin/analytics", icon: ChartColumn, group: "system", anyOf: ["analytics.view"] },
  { key: "audit", href: "/admin/audit", icon: History, group: "system", anyOf: ["audit.view"] },
  { key: "settings", href: "/admin/settings", icon: Settings, group: "system", anyOf: ["settings.edit"] },
];

const allowed = (me: Me, item: AdminNavItem) =>
  (!item.superOnly || me.is_super) && (!item.anyOf || item.anyOf.some((permission) => can(me, permission)));

/** Меню для сотрудника: «Обзор» и непустые группы в заданном порядке. */
export function visibleNav(me: Me): { group: NavGroup | null; items: AdminNavItem[] }[] {
  const items = adminNav.filter((item) => allowed(me, item));
  return [
    { group: null, items: items.filter((item) => !item.group) },
    ...NAV_GROUPS.map((group) => ({ group, items: items.filter((item) => item.group === group) })),
  ].filter((section) => section.items.length > 0);
}

/** Пункт меню, которому принадлежит путь (для заголовка в верхней панели). */
export function navItemFor(pathname: string): AdminNavItem {
  return adminNav.find((item) => item.href !== "/admin" && pathname.startsWith(item.href)) ?? adminNav[0];
}
