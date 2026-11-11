import { Building2, Images, Library, LayoutDashboard, Users, type LucideIcon } from "lucide-react";
import { FileSpreadsheet, Languages } from "lucide-react";
import { BarChart3, Sparkles } from "lucide-react";
import { can, type Me } from "@/lib/api/admin";

export interface AdminNavItem {
  /** Ключ подписи в messages admin.nav.<key>. */
  key: string;
  /** Путь внутри админки без локали. Новые разделы B14/B15 добавляют строку сюда. */
  href: string;
  icon: LucideIcon;
  /** Нужно любое из прав; пусто — доступно всем вошедшим. Это только видимость пункта: сервер проверяет права сам. */
  anyOf?: string[];
  superOnly?: boolean;
}

export const adminNav: AdminNavItem[] = [
  { key: "dashboard", href: "/admin", icon: LayoutDashboard },
  { key: "catalog", href: "/admin/catalog", icon: Library, anyOf: ["catalog.view"] },
  { key: "branches", href: "/admin/branches", icon: Building2, anyOf: ["branches.view"] },
  { key: "exhibitions", href: "/admin/exhibitions", icon: Images, anyOf: ["content.view"] },
  { key: "users", href: "/admin/users", icon: Users, anyOf: ["users.view"] },
  { key: "import", href: "/admin/import", icon: FileSpreadsheet, anyOf: ["catalog.import", "catalog.export"] },
  { key: "translations", href: "/admin/translations", icon: Languages, anyOf: ["catalog.view", "content.view", "branches.view"] },
  { key: "aiTools", href: "/admin/ai-tools", icon: Sparkles, anyOf: ["ai.use"] },
  { key: "analytics", href: "/admin/analytics", icon: BarChart3, anyOf: ["analytics.view"] },
];

export function visibleNav(me: Me): AdminNavItem[] {
  return adminNav.filter(
    (item) => (!item.superOnly || me.is_super) && (!item.anyOf || item.anyOf.some((permission) => can(me, permission))),
  );
}
