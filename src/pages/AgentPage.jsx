import { useParams, useNavigate } from "react-router-dom";
import { getAgent } from "../agents/agentsConfig";
import PromptEditor from "../components/PromptEditor";
import ChatInterface from "../components/ChatInterface";

const CONVERSATIONS_KEY = (id) => `aura_conversations_${id}`;

function ConversationHistory({ agentId }) {
  const stored = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY(agentId)) || "[]");

  if (stored.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 text-base mb-4">Historique</h2>
        <p className="text-gray-400 text-sm text-center py-6">
          Aucune conversation sauvegardée
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="font-semibold text-gray-800 text-base mb-4">
        Historique{" "}
        <span className="text-gray-400 text-sm font-normal">
          ({stored.length} conversation{stored.length > 1 ? "s" : ""})
        </span>
      </h2>
      <div className="space-y-3">
        {stored.map((conv) => (
          <div
            key={conv.id}
            className="border border-gray-100 rounded-xl p-4 hover:border-[#7C3AED]/30 hover:bg-purple-50/30 transition-all cursor-default"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">{conv.date}</span>
              <span className="text-xs text-gray-400">
                {conv.messages.length} msg
              </span>
            </div>
            <p className="text-sm text-gray-600 truncate">{conv.preview}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AgentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const agent = getAgent(id);

  if (!agent) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Agent introuvable.</p>
        <button
          onClick={() => navigate("/")}
          className="mt-4 text-[#7C3AED] underline text-sm"
        >
          Retour au tableau de bord
        </button>
      </div>
    );
  }

  const colorMap = {
    violet: "bg-violet-100 text-violet-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    pink: "bg-pink-100 text-pink-700",
    orange: "bg-orange-100 text-orange-700",
    cyan: "bg-cyan-100 text-cyan-700",
    amber: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start gap-5 mb-8">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 ${
            colorMap[agent.color]
          }`}
        >
          {agent.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => navigate("/")}
              className="text-gray-400 hover:text-gray-600 text-sm transition-colors"
            >
              ← Retour
            </button>
            <span className="text-gray-300">|</span>
            <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-medium border border-emerald-100">
              ● Actif
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{agent.name}</h1>
          <p className="text-gray-500 text-sm">{agent.description}</p>
        </div>
      </div>

      {/* 2-col layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left col */}
        <div className="flex flex-col gap-6">
          <PromptEditor agent={agent} />
          <ConversationHistory agentId={agent.id} />
        </div>

        {/* Right col — Chat */}
        <div>
          <ChatInterface agent={agent} />
        </div>
      </div>
    </div>
  );
}
