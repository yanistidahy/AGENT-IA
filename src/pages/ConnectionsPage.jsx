import { Mail, Users, Camera, Calendar, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

const connections = [
  {
    id: "gmail",
    name: "Gmail",
    Icon: Mail,
    color: "#EA4335",
    bg: "#FEF2F2",
    status: "connected",
    description: "Lecture et envoi d'emails pour l'Agent Pilote",
    guide: null,
  },
  {
    id: "calendar",
    name: "Google Calendar",
    Icon: Calendar,
    color: "#1A73E8",
    bg: "#EFF6FF",
    status: "pending",
    description: "Synchronisation des relances et rappels",
    guide: "Connectez votre compte Google pour activer le suivi de relances automatique.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    Icon: Users,
    color: "#0A66C2",
    bg: "#EFF6FF",
    status: "manual",
    description: "Prospection et croissance — Agent Commercial & Croissance",
    guide: `LinkedIn ne dispose pas d'API publique pour l'automatisation. Voici comment procéder manuellement :

1. Ouvrez LinkedIn sur votre navigateur
2. Accédez à la page du profil ciblé
3. Copiez l'URL et collez-la dans l'Agent Commercial avec la commande : "Analyse ce profil : [URL]"
4. L'agent génère la fiche prospect et l'accroche personnalisée
5. Envoyez le message directement depuis LinkedIn`,
  },
  {
    id: "instagram",
    name: "Instagram",
    Icon: Camera,
    color: "#E1306C",
    bg: "#FDF2F8",
    status: "manual",
    description: "Croissance organique — Agent Croissance & Marketing",
    guide: `Instagram limite l'accès API. Voici le workflow manuel recommandé :

1. Ouvrez l'app Instagram sur mobile ou web
2. Utilisez l'Agent Croissance avec la commande "Plan du jour" pour obtenir votre plan d'action quotidien
3. Exécutez les actions (follows, likes, commentaires) directement sur Instagram
4. Revenez dans l'Agent Croissance pour reporter les résultats`,
  },
];

function StatusBadge({ status }) {
  if (status === "connected") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#ECFDF5", color: "#059669", fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "99px", border: "1px solid #A7F3D0" }}>
      <CheckCircle size={11} /> Connecté
    </span>
  );
  if (status === "pending") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#FFF7ED", color: "#D97706", fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "99px", border: "1px solid #FED7AA" }}>
      <AlertCircle size={11} /> En attente
    </span>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#F3F4F6", color: "#6B7280", fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "99px" }}>
      <ExternalLink size={11} /> Manuel
    </span>
  );
}

export default function ConnectionsPage() {
  return (
    <div style={{ padding: "32px" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "#1E1B4B", letterSpacing: "-0.5px" }}>Connexions</h1>
        <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#6B7280" }}>Gérez les intégrations de vos agents IA</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {connections.map(conn => (
          <div key={conn.id} style={{ background: "white", borderRadius: "16px", border: "1px solid #E8E8F0", overflow: "hidden", boxShadow: "0 2px 8px rgba(30,27,75,0.05)" }}>
            <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: conn.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <conn.Icon size={22} color={conn.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 700, fontSize: "15px", color: "#1E1B4B" }}>{conn.name}</span>
                  <StatusBadge status={conn.status} />
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>{conn.description}</p>
              </div>
              {conn.status === "connected" && (
                <button style={{ background: "#F3F4F6", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", color: "#6B7280", cursor: "pointer", fontWeight: 500 }}>
                  Déconnecter
                </button>
              )}
              {conn.status === "pending" && (
                <button style={{ background: "#7C3AED", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", color: "white", cursor: "pointer", fontWeight: 600 }}>
                  Connecter
                </button>
              )}
            </div>

            {conn.guide && (
              <div style={{ borderTop: "1px solid #F3F4F6", padding: "16px 24px", background: "#F8F7FF" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#7C3AED", marginBottom: "8px" }}>Guide d'utilisation manuelle</div>
                <pre style={{ margin: 0, fontSize: "12px", color: "#374151", lineHeight: "1.7", whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{conn.guide}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
