import { notFound } from "next/navigation";
import { byKey } from "@/lib/admin-config";
import { ResourceForm } from "@/components/admin/resource-form";

export default async function AdminFormPage({ params }: { params: Promise<{ res: string; id: string }> }) {
  const { res: key, id } = await params;
  const res = byKey(key);
  if (!res) notFound();
  return <ResourceForm key={`${key}-${id}`} res={res} id={id} />;
}
