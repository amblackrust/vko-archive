import { API_URL } from "./client";

/** Контракты публичного API филиалов (backend/app/schemas/branches.py). */
export type BranchType = "head" | "district" | "city" | "personnel";

export interface Branch {
  slug: string;
  href: string;
  name: string;
  name_lang: string;
  type: BranchType;
  address: string;
  phone: string | null;
  email: string | null;
  director: string;
  hours: string;
  description: string;
  funds_summary: string;
  /** null — филиал скрыт с карты или без координат. */
  lat: number | null;
  lng: number | null;
  coords_verified: boolean;
  show_on_map: boolean;
}

export async function fetchBranches(lang: string): Promise<Branch[]> {
  const response = await fetch(`${API_URL}/api/branches?lang=${lang}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`branches: ${response.status}`);
  return ((await response.json()) as { items: Branch[] }).items;
}

/** 404 -> null (не опубликован или не существует). */
export async function fetchBranch(slug: string, lang: string): Promise<Branch | null> {
  const response = await fetch(`${API_URL}/api/branches/${encodeURIComponent(slug)}?lang=${lang}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`branch: ${response.status}`);
  return (await response.json()) as Branch;
}
