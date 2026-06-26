import { useNavigate } from "react-router-dom";
import { agents, getAgent } from "../agents/agentsConfig";
import AgentAvatar from "../components/AgentAvatar";

const actions = [
  {
    icon: "🎯",
    iconBg: "#DBEAFE",
    title: "Générer un plan de prospection",
    description: "Scout leads qualifiés sur LinkedIn et Instagram",
    agentId: "axel",
    duration: "5 min",
    prompt: "Génère-moi un plan de prospection complet pour aujourd'hui : 5 fiches prospects qualifiées avec accroches personnalisées.",
  },
  {
    icon: "✍️",
    iconBg: "#FCE7F3",
    title: "Créer un post LinkedIn viral",
    description: "Framework AIDA ou PAS pour maximiser l'engagement",
    agentId: "lea",
    duration: "3 min",
    prompt: "Rédige un post LinkedIn viral sur les chatbots IA pour e-commerçants. Utilise le framework PAS. 2 variantes de hook.",
  },
  {
    icon: "📄",
    iconBg: "#FEF3C7",
    title: "Analyser un contrat",
    description: "Identifier les clauses risquées et recommandations",
    agentId: "juris",
    duration: "5 min",
    prompt: "Analyse ce contrat et identifie toutes les clauses à risque. Donne un verdict Signer/Négocier/Refuser : [colle le texte]",
  },
  {
    icon: "🔎",
    iconBg: "#CFFAFE",
    title: "Audit SEO complet",
    description: "Score, recommandations priorisées, quick wins",
    agentId: "scout",
    duration: "5 min",
    prompt: "Fais un audit SEO complet de ce site et donne les quick wins + plan d'action 30 jours : [URL]",
  },
  {
    icon: "💰",
    iconBg: "#ECFCCB",
    title: "Analyser ma trésorerie",
    description: "Tableau de bord financier et détection de fuites",
    agentId: "felix",
    duration: "3 min",
    prompt: "Analyse ma trésorerie, détecte les zones de fuite et donne tes recommandations : [entre tes chiffres]",
  },
  {
    icon: "📸",
    iconBg: "#D1FAE5",
    title: "Plan Instagram quotidien",
    description: "10 comptes à engager + actions précises",
    agentId: "nova",
    duration: "2 min",
    prompt: "Plan d'action Instagram complet pour aujourd'hui.",
  },
  {
    icon: "📋",
    iconBg: "#EDE9FE",
    title: "Brief du jour",
    description: "Priorités du jour + relances en attente",
    agentId: "aria",
    duration: "1 min",
    prompt: "Brief du jour",
  },
  {
    icon: "✉️",
    iconBg: "#EDE9FE",
    title: "Rédiger un email de relance",
    description: "Ton professionnel et persuasif",
    agentId: "aria",
    duration: "2 min",
    prompt: "Rédige un email de relance professionnel pour un prospect qui n'a pas répondu depuis 5 jours : [contexte]",
  },
];

export default function SuperPouvoirs() {
  const navigate = useNavigate();

  const handleStart = (action) => {
    navigate(`/conversation/${action.agentId}?q=${encodeURIComponent(action.prompt)}`);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF" }}>
      <div style={{ padding: "20px 32px", borderBottom: "1px solid #F0F0F0" }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#1A1A1A" }}>Super-pouvoirs</h1>
      </div>

      <div style={{ padding: "24px 32px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>Actions rapides</div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {actions.map((action, i) => {
            const agent = getAgent(action.agentId);
            return (
              <div key={i} style={{
                background: "#FFFFFF", border: "1px solid #F0F0F0", borderRadius: "12px",
                padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = "#FAFAFA"; e.currentTarget.style.borderColor = "#E0E0E0"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.borderColor = "#F0F0F0"; }}
              >
                {/* Icon */}
                <div style={{
                  width: "44px", height: "44px", borderRadius: "10px",
                  background: action.iconBg, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "20px", flexShrink: 0,
                }}>{action.icon}</div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#1A1A1A", marginBottom: "3px" }}>{action.title}</div>
                  <div style={{ fontSize: "12px", color: "#888" }}>{action.description}</div>
                  {agent && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                      <AgentAvatar agent={agent} size={18} />
                      <span style={{ fontSize: "11px", color: "#888" }}>{agent.name}, {agent.role}</span>
                      <span style={{ fontSize: "11px", color: "#CCC" }}>·</span>
                      <span style={{ fontSize: "11px", color: "#AAA" }}>Création en {action.duration}</span>
                    </div>
                  )}
                </div>

                {/* Button */}
                <button onClick={() => handleStart(action)} style={{
                  background: "#000", color: "white", border: "none", borderRadius: "8px",
                  padding: "9px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer", flexShrink: 0,
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "#222"}
                  onMouseLeave={e => e.currentTarget.style.background = "#000"}
                >Démarrer</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
