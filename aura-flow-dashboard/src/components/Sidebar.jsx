import { NavLink, useLocation } from "react-router-dom";
import { agents } from "../agents/agentsConfig";

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#4C1D95] flex flex-col z-50 shadow-2xl">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-purple-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-[#4C1D95] font-black text-lg shadow">
            A
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-tight">Aura Flow</h1>
            <p className="text-purple-300 text-xs">AI Dashboard</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {/* Dashboard link */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-sm font-medium transition-all ${
              isActive
                ? "bg-white/20 text-white"
                : "text-purple-200 hover:bg-white/10 hover:text-white"
            }`
          }
        >
          <span className="text-base">🏠</span>
          <span>Tableau de bord</span>
        </NavLink>

        <p className="text-purple-400 text-xs font-semibold uppercase tracking-wider px-3 mt-4 mb-2">
          Mes Agents
        </p>

        {agents.map((agent) => (
          <NavLink
            key={agent.id}
            to={`/agent/${agent.id}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-sm font-medium transition-all ${
                isActive
                  ? "bg-white/20 text-white"
                  : "text-purple-200 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            <span className="text-base">{agent.icon}</span>
            <span className="truncate">{agent.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-purple-700">
        <p className="text-purple-400 text-xs">Aura Flow AI © 2025</p>
      </div>
    </aside>
  );
}
