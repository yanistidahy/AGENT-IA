import { useNavigate } from "react-router-dom";

export default function AgentCard({ agent }) {
  const navigate = useNavigate();

  const colorMap = {
    violet: "bg-violet-100 text-violet-700 border-violet-200",
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    green: "bg-emerald-100 text-emerald-700 border-emerald-200",
    pink: "bg-pink-100 text-pink-700 border-pink-200",
    orange: "bg-orange-100 text-orange-700 border-orange-200",
    cyan: "bg-cyan-100 text-cyan-700 border-cyan-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
  };

  const iconBg = colorMap[agent.color] || colorMap.violet;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 p-5 flex flex-col gap-4 group">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl border ${iconBg}`}
        >
          {agent.icon}
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
          Actif
        </span>
      </div>

      {/* Content */}
      <div className="flex-1">
        <h3 className="font-semibold text-gray-800 text-base mb-1">{agent.name}</h3>
        <p className="text-gray-500 text-sm leading-relaxed">{agent.role}</p>
      </div>

      {/* Button */}
      <button
        onClick={() => navigate(`/agent/${agent.id}`)}
        className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium py-2.5 rounded-xl transition-colors duration-150"
      >
        Ouvrir l'agent →
      </button>
    </div>
  );
}
