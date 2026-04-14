import { notFound } from "next/navigation";
import HarnessDetailView from "@/components/HarnessDetail";
import { getAllHarnessIds, getHarnessDetail } from "@/lib/data";

export function generateStaticParams() {
  return getAllHarnessIds().map((id) => ({ id }));
}

export default async function HarnessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const harness = getHarnessDetail(id);

  if (!harness) {
    notFound();
  }

  return <HarnessDetailView harness={harness} />;
}
