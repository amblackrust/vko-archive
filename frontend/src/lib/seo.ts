import { api, type Schema } from "@/lib/api/client";

/** Title and description from the public document; a missing or closed one yields no metadata. */
export async function generateDocMeta(id: string, lang: string) {
  const doc = await api.get<Schema["DocumentDetail"]>(`/api/catalog/documents/${id}`, { query: { lang } }).catch(() => null);
  return doc ? { title: doc.title, description: doc.summary?.slice(0, 160) } : {};
}
