import Dashboard from "@/components/Dashboard";
import { getAllHarnesses, getStats } from "@/lib/data";

export default function Home() {
  const harnesses = getAllHarnesses();
  const stats = getStats();

  return <Dashboard harnesses={harnesses} stats={stats} />;
}
