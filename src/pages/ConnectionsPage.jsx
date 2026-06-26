import { Mail, Users, Camera, Calendar, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

const connections = [
  {
    id: "gmail",
    name: "Gmail",
    Icon: Mail,
    color: "#EA4335",
    bg: "#FEF2F2",
    status: "connected",
    description: "Lecture et envoi d'emails pour Aria (Agent Pilote)",
    guide: null,
  },
  {
    id: "calendar",
    name: "Google Calendar",
    Icon: Calendar,
    color: "#1A73E8",
    bg: "#EFF6FF",
    status: "pending",
    description: "Synchronisation des relances et rappels automatiques",
    guide: "Connectez votre compte Google pour activer le suivi de relances automatique avec Aria.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    Icon: Users,
    color: "#0A66C2",
    bg: "#EFF6FF",
    status: "manual",
    description: "Prospection et croissance — Axel & Nova",
    guide: `LinkedIn ne dispose pas d'API publique pour l'automatisation. Voici comment procéder :

1. Ouvrez LinkedIn sur votre navigateur ou l'app mobile
2. Accédez au profil ciblé
3. Copiez l'URL ou décrivez le profil
4. Collez-le dans Axel avec la commande : "Analyse ce profil : [URL]"
5. Axel génère la fiche prospect et l'accroche personnalisée
6. Envoyez le message directement depuis LinkedIn

Pour Nova, utilisez "Plan du jour" pour obtenir les 3 commentaires LinkedIn à rédiger et les 10 profils à engager.`,
  },
  {
    id: "instagram",
    name: "Instagram",
    Icon: Camera,
    color: "#E1306C",
    bg: "#FDF2F8",
    status: "manual",
    description: "Croissance organique — Nova & Léa",
    guide: `Instagram limite l'accès API. Workflow manuel recommandé :

1. Ouvrez l'app Instagram sur mobile ou navigateur
2. Utilisez Nova avec la commande "Plan du jour" pour le plan d'action complet
3. Exécutez les actions (follows, likes, commentaires) directement sur Instagram
4. Pour le contenu, utilisez Léa : "Caption Instagram sur [sujet]" ou "Script Reel"
5. Copiez-collez le contenu généré dans votre publication Instagram`,
  },
];

function StatusBadge({ status }) {
  if (status === "connected") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#ECFDF5", color: "#16A34A", fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "99px" }}>
      <CheckCircle size={11} /> Connecté
    </span>
  );
  if (status === "pending") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#FFFBEB", color: "#D97706", fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "99px" }}>
      <AlertCircle size={11} /> En attente
    </span>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "rgba(26,26,26,0.05)", color: "#666", fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "99px" }}>
      <ExternalLink size={11} /> Mode guidé
    </span>
  );
}

export default function ConnectionsPage() {
  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "56px 40px 80px" }}>
      <div style={{ marginBottom: "40px" }}>
        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "32px", fontWeight: 700, color: "#1A1A1A", margin: "0 0 8px",
        }}>Connexions</h1>
        <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>Intégrations actives et guides d'utilisation manuelle</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {connections.map(conn => (
          <div key={conn.id} style={{ background: "white", borderRadius: "14px", border: "1px solid rgba(26,26,26,0.08)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "11px", background: conn.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <conn.Icon size={20} color={conn.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "3px" }}>
                  <span style={{ fontWeight: 700, fontSize: "14px", color: "#1A1A1A" }}>{conn.name}</span>
                  <StatusBadge status={conn.status} />
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: "#888" }}>{conn.description}</p>
              </div>
              {conn.status === "connected" && (
                <button style={{ background: "rgba(26,26,26,0.04)", border: "1px solid rgba(26,26,26,0.08)", borderRadius: "8px", padding: "7px 14px", fontSize: "12px", color: "#666", cursor: "pointer" }}>
                  Déconnecter
                </button>
              )}
              {conn.status === "pending" && (
                <button style={{ background: "#1A1A1A", border: "none", borderRadius: "8px", padding: "7px 16px", fontSize: "12px", color: "white", cursor: "pointer", fontWeight: 600 }}>
                  Connecter
                </button>
              )}
            </div>

            {conn.guide && (
              <div style={{ borderTop: "1px solid rgba(26,26,26,0.06)", padding: "16px 24px", background: "rgba(26,26,26,0.015)" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>Guide d'utilisation</div>
                <pre style={{ margin: 0, fontSize: "12px", color: "#555", lineHeight: "1.75", whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{conn.guide}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
