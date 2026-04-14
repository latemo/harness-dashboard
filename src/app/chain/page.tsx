import { getAllHarnesses, getHarnessOutputs } from "@/lib/data";
import ChainDashboard from "@/components/chain/ChainDashboard";

export default function ChainPage() {
  const harnesses = getAllHarnesses();

  // 각 하네스의 산출물 파일 목록을 미리 로드
  const outputsMap: Record<string, string[]> = {};
  for (const h of harnesses) {
    outputsMap[h.id] = getHarnessOutputs(h.id);
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ChainDashboard harnesses={harnesses} outputsMap={outputsMap} />
      </div>
    </main>
  );
}
