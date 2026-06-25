import { agents } from "../agents/agentsConfig";
import AgentCard from "../components/AgentCard";

export default function Dashboard() {
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[#7C3AED] text-sm font-medium capitalize mb-1">{today}</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mes Agents IA</h1>
        <p className="text-gray-500">
          {agents.length} agents disponibles · Tous actifs
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
          <p className="text-3xl font-bold text-[#7C3AED]">{agents.length}</p>
          <p className="text-gray-500 text-sm mt-1">Agents déployés</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
          <p className="text-3xl font-bold text-emerald-500">{agents.length}</p>
          <p className="text-gray-500 text-sm mt-1">Agents actifs</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
          <p className="text-3xl font-bold text-gray-800">24/7</p>
          <p className="text-gray-500 text-sm mt-1">Disponibilité</p>
        </div>
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}
