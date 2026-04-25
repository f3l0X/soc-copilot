async function getApiHealth() {
  const url =
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8080";
  try {
    const res = await fetch(`${url}/api/health`, { cache: "no-store" });
    return res.ok ? await res.json() : { status: "unreachable" };
  } catch {
    return { status: "unreachable" };
  }
}

export default async function Home() {
  const health = await getApiHealth();
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 gap-6">
      <h1 className="text-4xl font-bold tracking-tight">SOC Copilot</h1>
      <p className="text-slate-400">AI Copilot para Analistas SOC Junior</p>
      <div className="rounded-lg border border-slate-800 px-4 py-2 text-sm">
        API status:{" "}
        <span
          className={
            health.status === "ok" ? "text-green-400" : "text-amber-400"
          }
        >
          {health.status}
        </span>
      </div>
      <ul className="text-sm text-slate-400 list-disc pl-5">
        <li>/dashboard — KPIs y alertas (pendiente)</li>
        <li>/alerts — Alert Explainer (pendiente)</li>
        <li>/respond — Next Step Recommender (pendiente)</li>
        <li>/chat — Chat IA (pendiente)</li>
      </ul>
    </main>
  );
}
