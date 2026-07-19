import { useState, useCallback } from "react";
import { Search, X, CheckCircle, Loader, Eye, EyeOff } from "lucide-react";
import {
  testSmtp,
  saveConnection,
  removeConnection,
  getConnections,
} from "../api/oauth";
import { connectGoogleSheets, connectGmail } from "../api/integrations";

/* ── CATALOGUE ────────────────────────────────────────────────────────────── */
const CATALOGUE = [
  {
    id: "gmail",
    name: "Gmail",
    icon: "📧",
    iconBg: "#FEF2F2",
    color: "#EA4335",
    category: "Email",
    description: "Gérez et envoyez vos emails directement depuis Aria.",
    type: "google",
    agents: ["Aria"],
  },
  {
    id: "sheets",
    name: "Google Sheets",
    icon: "📊",
    iconBg: "#F0FDF4",
    color: "#34A853",
    category: "Productivité",
    description: "Exportez vos données prospects, rapports Nova et analyses Felix.",
    type: "google",
    agents: ["Aria", "Nova", "Felix"],
  },
  {
    id: "calendar",
    name: "Google Calendar",
    icon: "📅",
    iconBg: "#EFF6FF",
    color: "#1A73E8",
    category: "Productivité",
    description: "Synchronisez votre agenda pour la gestion des relances par Aria.",
    type: "google",
    agents: ["Aria"],
  },
  {
    id: "ionos",
    name: "Ionos Email",
    icon: "✉️",
    iconBg: "#FFF7ED",
    color: "#F97316",
    category: "Email",
    description: "Connectez votre boîte email professionnelle Ionos via IMAP/SMTP.",
    type: "smtp",
    agents: ["Aria"],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "💼",
    iconBg: "#EFF6FF",
    color: "#0A66C2",
    category: "Réseaux sociaux",
    description: "Prospectez avec Axel et développez votre réseau professionnel.",
    type: "manual",
    agents: ["Axel", "Nova"],
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "📸",
    iconBg: "#FDF2F8",
    color: "#E1306C",
    category: "Réseaux sociaux",
    description: "Générez vos 100 prospects quotidiens avec Nova.",
    type: "manual",
    agents: ["Nova"],
  },
  {
    id: "notion",
    name: "Notion",
    icon: "📝",
    iconBg: "#F5F5F5",
    color: "#000000",
    category: "Productivité",
    description: "Exportez vos documents et notes vers Notion.",
    type: "soon",
    agents: [],
  },
  {
    id: "stripe",
    name: "Stripe",
    icon: "💳",
    iconBg: "#F5F4FF",
    color: "#635BFF",
    category: "Finance",
    description: "Analysez vos revenus et abonnements avec Felix.",
    type: "soon",
    agents: ["Felix"],
  },
  {
    id: "slack",
    name: "Slack",
    icon: "💬",
    iconBg: "#F9F5FF",
    color: "#4A154B",
    category: "Communication",
    description: "Recevez les rapports de vos agents dans Slack.",
    type: "soon",
    agents: [],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    icon: "🎯",
    iconBg: "#FFF7ED",
    color: "#FF7A59",
    category: "CRM",
    description: "Synchronisez vos prospects qualifiés par Axel dans HubSpot.",
    type: "soon",
    agents: ["Axel"],
  },
  {
    id: "shopify",
    name: "Shopify",
    icon: "🛍️",
    iconBg: "#F7FEE7",
    color: "#96BF48",
    category: "E-commerce",
    description: "Connectez vos données e-commerce pour des analyses approfondies.",
    type: "soon",
    agents: ["Felix"],
  },
  {
    id: "zapier",
    name: "Zapier",
    icon: "⚡",
    iconBg: "#FFF7ED",
    color: "#FF4A00",
    category: "Automatisation",
    description: "Automatisez vos workflows avec 5 000+ apps via Zapier.",
    type: "soon",
    agents: [],
  },
];

/* ── BADGE HELPERS ────────────────────────────────────────────────────────── */
function getBadge(integ, connections) {
  if (connections[integ.id]?.connected) return { label: "Connecté", color: "#16A34A", bg: "#ECFDF5", dot: true };
  if (integ.type === "manual") return { label: "Mode guidé", color: "#2563EB", bg: "#EFF6FF" };
  if (integ.type === "soon") return { label: "Bientôt", color: "#AAA", bg: "#F5F5F5" };
  if (integ.type === "google") return { label: "OAuth Google", color: "#7C3AED", bg: "#EDE9FE" };
  if (integ.type === "smtp") return { label: "IMAP/SMTP", color: "#F97316", bg: "#FFF7ED" };
  return { label: "Disponible", color: "#888", bg: "#F5F5F5" };
}

/* ── CARD ─────────────────────────────────────────────────────────────────── */
function IntegCard({ integ, connections, onClick }) {
  const badge = getBadge(integ, connections);
  const conn = connections[integ.id];
  const clickable = integ.type !== "soon";

  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        background: "#FFFFFF", border: "1px solid #F0F0F0", borderRadius: "12px",
        padding: "18px", display: "flex", flexDirection: "column", gap: "12px",
        cursor: clickable ? "pointer" : "default",
        opacity: integ.type === "soon" ? 0.55 : 1,
      }}
      onMouseEnter={e => { if (clickable) { e.currentTarget.style.background = "#FAFAFA"; e.currentTarget.style.borderColor = "#E0E0E0"; } }}
      onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.borderColor = "#F0F0F0"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: integ.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>
          {integ.icon}
        </div>
        <span style={{ fontSize: "10px", fontWeight: 600, color: badge.color, background: badge.bg, padding: "3px 9px", borderRadius: "99px", display: "flex", alignItems: "center", gap: "4px" }}>
          {badge.dot && <span style={{ width: "5px", height: "5px", background: "#22C55E", borderRadius: "50%", display: "inline-block" }} />}
          {badge.label}
        </span>
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: "14px", color: "#1A1A1A", marginBottom: "3px" }}>{integ.name}</div>
        <div style={{ fontSize: "12px", color: "#888", lineHeight: "1.5" }}>{integ.description}</div>
      </div>
      {conn?.email && (
        <div style={{ fontSize: "11px", color: "#059669", fontWeight: 600 }}>✓ {conn.email}</div>
      )}
      {integ.agents.length > 0 && (
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {integ.agents.map(a => (
            <span key={a} style={{ fontSize: "10px", background: "#F5F5F5", color: "#666", padding: "2px 7px", borderRadius: "99px" }}>{a}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── SHARED MODAL SHELL ───────────────────────────────────────────────────── */
function ModalShell({ integ, onClose, children }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
      onClick={onClose}
    >
      <div
        style={{ background: "white", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "480px", position: "relative", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", color: "#AAA", padding: "4px" }}>
          <X size={18} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: integ.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>
            {integ.icon}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "17px", color: "#1A1A1A" }}>{integ.name}</div>
            <div style={{ fontSize: "12px", color: "#888" }}>{integ.category}</div>
          </div>
        </div>
        {children}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── SHARED SUB-VIEWS ─────────────────────────────────────────────────────── */
function ConnectedView({ conn, onDisconnect }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "14px", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "10px", padding: "16px", marginBottom: "20px" }}>
        {conn.picture
          ? <img src={conn.picture} alt="" style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }} />
          : <CheckCircle size={32} color="#22C55E" />
        }
        <div>
          <div style={{ fontWeight: 600, fontSize: "14px", color: "#059669" }}>Connecté</div>
          {conn.name && <div style={{ fontSize: "13px", color: "#065f46" }}>{conn.name}</div>}
          <div style={{ fontSize: "12px", color: "#6EE7B7" }}>{conn.email}</div>
        </div>
      </div>
      <button
        onClick={onDisconnect}
        style={{ background: "none", border: "1px solid #E0E0E0", borderRadius: "8px", padding: "10px 18px", fontSize: "13px", color: "#888", cursor: "pointer", width: "100%" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#EF4444"; e.currentTarget.style.color = "#EF4444"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#E0E0E0"; e.currentTarget.style.color = "#888"; }}
      >
        Déconnecter ce compte
      </button>
    </div>
  );
}

function SuccessView({ email, name, onClose }) {
  return (
    <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
      <CheckCircle size={44} color="#22C55E" style={{ marginBottom: "14px" }} />
      <div style={{ fontWeight: 700, fontSize: "17px", color: "#1A1A1A", marginBottom: "6px" }}>Connexion réussie !</div>
      {name && <div style={{ fontSize: "14px", color: "#444", marginBottom: "2px" }}>{name}</div>}
      {email && <div style={{ fontSize: "13px", color: "#888", marginBottom: "20px" }}>{email}</div>}
      <button onClick={onClose} style={{ background: "#059669", color: "white", border: "none", borderRadius: "8px", padding: "11px 24px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
        Parfait !
      </button>
    </div>
  );
}

/* ── PIPEDREAM CONNECT MODAL ──────────────────────────────────────────────── */
function GoogleModal({ integ, conn, onClose, onSave, onDisconnect }) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const PERMS = {
    gmail: ["Lire vos emails", "Envoyer des emails en votre nom"],
    sheets: ["Lire vos feuilles de calcul", "Créer et modifier des feuilles"],
    calendar: ["Lire vos événements calendrier"],
  };

  const handleConnect = async () => {
    setStatus("connecting");
    setError("");
    try {
      const connect = integ.id === "gmail" ? connectGmail : connectGoogleSheets;
      await connect();
      const saved = { email: `compte ${integ.name}` };
      onSave(integ.id, saved);
      setStatus("ok");
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  };

  if (conn?.connected) return <ModalShell integ={integ} onClose={onClose}><ConnectedView conn={conn} onDisconnect={() => { onDisconnect(integ.id); onClose(); }} /></ModalShell>;
  if (status === "ok") return <ModalShell integ={integ} onClose={onClose}><SuccessView email={conn?.email || `compte ${integ.name}`} onClose={onClose} /></ModalShell>;

  return (
    <ModalShell integ={integ} onClose={onClose}>
      <p style={{ fontSize: "13px", color: "#444", lineHeight: "1.65", marginBottom: "20px" }}>{integ.description}</p>

      <div style={{ background: "#F5F5F5", borderRadius: "10px", padding: "14px 16px", marginBottom: "20px" }}>
        <div style={{ fontWeight: 600, fontSize: "12px", color: "#1A1A1A", marginBottom: "6px" }}>Permissions demandées</div>
        <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "#666", lineHeight: "2" }}>
          {(PERMS[integ.id] || []).map(p => <li key={p}>{p}</li>)}
        </ul>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#DC2626", marginBottom: "14px" }}>
          ⚠️ {error}
          {error.includes("VITE_PIPEDREAM_URL") && (
            <div style={{ marginTop: "8px", background: "#FFF1F1", padding: "8px 10px", borderRadius: "6px", fontFamily: "monospace", fontSize: "11px" }}>
              Ajoutez dans <strong>.env</strong> :<br />
              VITE_PIPEDREAM_URL=https://votre-projet.pipedream.net
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={status === "connecting"}
        style={{
          background: status === "connecting" ? "#CCC" : "#1A1A1A",
          color: "white", border: "none", borderRadius: "8px",
          padding: "12px", fontSize: "14px", fontWeight: 600,
          cursor: status === "connecting" ? "not-allowed" : "pointer",
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
        }}
        onMouseEnter={e => { if (status !== "connecting") e.currentTarget.style.background = "#333"; }}
        onMouseLeave={e => { if (status !== "connecting") e.currentTarget.style.background = "#1A1A1A"; }}
      >
        {status === "connecting"
          ? <><Loader size={15} style={{ animation: "spin 1s linear infinite" }} /> Connexion en cours…</>
          : <>Connecter {integ.name}</>
        }
      </button>
      <p style={{ fontSize: "11px", color: "#AAA", textAlign: "center", margin: "12px 0 0" }}>
        Une fenêtre Pipedream s'ouvrira pour vous authentifier en toute sécurité.
      </p>
    </ModalShell>
  );
}

/* ── SMTP MODAL ───────────────────────────────────────────────────────────── */
function SmtpModal({ integ, conn, onClose, onSave, onDisconnect }) {
  const [form, setForm] = useState({ host: "smtp.ionos.fr", port: "587", email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleTest = async () => {
    if (!form.email.trim() || !form.password.trim()) return;
    setStatus("testing");
    setError("");
    try {
      const res = await testSmtp(form);
      if (res.success) {
        onSave(integ.id, { email: form.email, host: form.host, port: form.port });
        setStatus("ok");
      } else {
        setError(res.error || "Connexion SMTP échouée");
        setStatus("error");
      }
    } catch (e) {
      setError(e.message.includes("fetch") ? "Backend Python inaccessible — vérifiez que le serveur tourne." : e.message);
      setStatus("error");
    }
  };

  if (conn?.connected) return <ModalShell integ={integ} onClose={onClose}><ConnectedView conn={conn} onDisconnect={() => { onDisconnect(integ.id); onClose(); }} /></ModalShell>;
  if (status === "ok") return <ModalShell integ={integ} onClose={onClose}><SuccessView email={form.email} onClose={onClose} /></ModalShell>;

  return (
    <ModalShell integ={integ} onClose={onClose}>
      <p style={{ fontSize: "13px", color: "#444", lineHeight: "1.65", marginBottom: "20px" }}>{integ.description}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Serveur SMTP", key: "host", placeholder: "smtp.ionos.fr", type: "text" },
          { label: "Port", key: "port", placeholder: "587", type: "number" },
          { label: "Adresse email", key: "email", placeholder: "vous@votredomaine.fr", type: "email" },
        ].map(f => (
          <div key={f.key}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>{f.label}</div>
            <input
              type={f.type}
              value={form[f.key]}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              style={{ width: "100%", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: "8px", padding: "9px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit" }}
              onFocus={e => e.currentTarget.style.borderColor = "#1A1A1A"}
              onBlur={e => e.currentTarget.style.borderColor = "#E0E0E0"}
            />
          </div>
        ))}
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Mot de passe</div>
          <div style={{ position: "relative" }}>
            <input
              type={showPwd ? "text" : "password"}
              value={form.password}
              onChange={e => set("password", e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleTest()}
              placeholder="••••••••"
              style={{ width: "100%", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: "8px", padding: "9px 38px 9px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit" }}
              onFocus={e => e.currentTarget.style.borderColor = "#1A1A1A"}
              onBlur={e => e.currentTarget.style.borderColor = "#E0E0E0"}
            />
            <button onClick={() => setShowPwd(v => !v)} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#AAA", padding: "2px" }}>
              {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#DC2626", marginBottom: "14px" }}>
          ⚠️ {error}
        </div>
      )}

      <button
        onClick={handleTest}
        disabled={status === "testing" || !form.email.trim() || !form.password.trim()}
        style={{
          background: (status === "testing" || !form.email.trim() || !form.password.trim()) ? "#CCC" : "#1A1A1A",
          color: "white", border: "none", borderRadius: "8px",
          padding: "12px", fontSize: "14px", fontWeight: 600,
          cursor: (status === "testing" || !form.email.trim()) ? "not-allowed" : "pointer",
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
        }}
        onMouseEnter={e => { if (status !== "testing" && form.email.trim()) e.currentTarget.style.background = "#333"; }}
        onMouseLeave={e => { if (status !== "testing" && form.email.trim()) e.currentTarget.style.background = "#1A1A1A"; }}
      >
        {status === "testing"
          ? <><Loader size={15} style={{ animation: "spin 1s linear infinite" }} /> Test de connexion…</>
          : "Tester la connexion SMTP"
        }
      </button>
    </ModalShell>
  );
}

/* ── MANUAL GUIDE MODAL ───────────────────────────────────────────────────── */
function ManualModal({ integ, onClose }) {
  const steps = integ.id === "linkedin"
    ? ["Ouvrez LinkedIn sur votre navigateur", "Accédez au profil ou post ciblé", "Copiez l'URL ou le contenu", "Collez dans Axel ou Nova pour générer votre action", "Exécutez l'action directement sur LinkedIn"]
    : ["Ouvrez Instagram sur mobile ou navigateur", 'Utilisez Nova → "Plan du jour" pour votre plan d\'action quotidien', 'Utilisez Nova → "Rapport du jour" pour vos 100 prospects', "Copiez-collez les textes générés dans Instagram", "Exécutez les actions d'engagement directement"];

  return (
    <ModalShell integ={integ} onClose={onClose}>
      <p style={{ fontSize: "13px", color: "#444", lineHeight: "1.65", marginBottom: "16px" }}>
        <strong>{integ.name}</strong> ne permet pas l'automatisation directe via API. Voici comment utiliser vos agents en mode guidé :
      </p>
      <div style={{ background: "#F5F5F5", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
        <ol style={{ margin: 0, paddingLeft: "18px", fontSize: "13px", color: "#444", lineHeight: "2.2" }}>
          {steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      </div>
      <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#92400E", marginBottom: "20px" }}>
        ⚠️ Exécution manuelle recommandée pour protéger votre compte.
      </div>
      <button
        onClick={onClose}
        style={{ background: "#1A1A1A", color: "white", border: "none", borderRadius: "8px", padding: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer", width: "100%" }}
        onMouseEnter={e => e.currentTarget.style.background = "#333"}
        onMouseLeave={e => e.currentTarget.style.background = "#1A1A1A"}
      >
        J'ai compris, commencer
      </button>
    </ModalShell>
  );
}

/* ── MAIN PAGE ────────────────────────────────────────────────────────────── */
export default function Integrations() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("catalogue");
  const [modal, setModal] = useState(null);
  const [connections, setConnections] = useState(() => getConnections());

  const refresh = useCallback(() => setConnections(getConnections()), []);

  const handleSave = (id, data) => {
    saveConnection(id, data);
    refresh();
  };

  const handleDisconnect = (id) => {
    removeConnection(id);
    refresh();
  };

  const connectedList = CATALOGUE.filter(i => connections[i.id]?.connected);
  const filtered = CATALOGUE.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase())
  );
  const displayList = activeTab === "connectes" ? connectedList : filtered;

  const renderModal = () => {
    if (!modal) return null;
    const conn = connections[modal.id];
    const shared = { integ: modal, conn, onClose: () => setModal(null), onSave: handleSave, onDisconnect: handleDisconnect };
    if (modal.type === "google") return <GoogleModal {...shared} />;
    if (modal.type === "smtp") return <SmtpModal {...shared} />;
    if (modal.type === "manual") return <ManualModal integ={modal} onClose={() => setModal(null)} />;
    return null;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF" }}>
      {/* Header + tabs */}
      <div style={{ padding: "20px 32px 0", borderBottom: "1px solid #F0F0F0" }}>
        <div style={{ display: "flex" }}>
          {[
            { key: "catalogue", label: "Catalogue" },
            { key: "connectes", label: `Comptes connectés [${connectedList.length}]` },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "14px 16px 12px", fontSize: "14px",
              fontWeight: activeTab === t.key ? 600 : 400,
              color: activeTab === t.key ? "#1A1A1A" : "#888",
              borderBottom: activeTab === t.key ? "2px solid #1A1A1A" : "2px solid transparent",
              marginBottom: "-1px",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "24px 32px" }}>
        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", gap: "16px" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: "360px" }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#AAA" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher des intégrations…"
              style={{ width: "100%", background: "#F5F5F5", border: "none", borderRadius: "8px", padding: "9px 14px 9px 36px", fontSize: "13px", color: "#1A1A1A", outline: "none", fontFamily: "inherit" }}
            />
          </div>
          <span style={{ fontSize: "13px", color: "#888" }}>{displayList.length} apps</span>
        </div>

        {/* Connected empty state */}
        {activeTab === "connectes" && connectedList.length === 0 && (
          <div style={{ background: "#F9F9F9", borderRadius: "14px", padding: "56px 32px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔌</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#1A1A1A", marginBottom: "6px" }}>Aucun service connecté</div>
            <div style={{ fontSize: "13px", color: "#888", marginBottom: "20px" }}>Connectez vos outils depuis le catalogue pour les utiliser avec vos agents.</div>
            <button onClick={() => setActiveTab("catalogue")} style={{ background: "#1A1A1A", color: "white", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              Voir le catalogue
            </button>
          </div>
        )}

        {/* Grid */}
        {displayList.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
            {displayList.map(integ => (
              <IntegCard key={integ.id} integ={integ} connections={connections} onClick={() => { if (integ.type !== "soon") setModal(integ); }} />
            ))}
          </div>
        )}
      </div>

      {renderModal()}
    </div>
  );
}
