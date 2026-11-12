import { notFound } from "next/navigation";
import { byKey } from "@/lib/admin-config";
import { ResourceList } from "@/components/admin/resource-list";

export default async function AdminListPage({ params }: { params: Promise<{ res: string }> }) {
  const res = byKey((await params).res);
  if (!res || res.key === "exhibit") notFound();
  return <ResourceList res={res} />;
}
