import { useState, useRef } from "react";
import { Plus, Trash2, Save, Star, Eye, EyeOff, Wifi, WifiOff, Loader } from "lucide-react";
import { validateInstagram, scrapeProspects, getStoredCredentials, saveCredentials, clearCredentials } from "../api/nova";

const STORAGE_KEY = "nova_comptes_cibles";
const CATEGORIES = ["Outil ecom", "Concurrent", "Média", "Influenceur", "Marque DTC", "Autre"];

const DEFAULTS = [
  { handle: "@shopify_fr", categorie: "Outil ecom", priorite: "Haute" },
  { handle: "@businessoffashion", categorie: "Média", priorite: "Normale" },
  { handle: "@camilleleblanc_officiel", categorie: "Influenceur", priorite: "Haute" },
];

export function getComptesClient() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

/* ── TAB BAR ─────────────────────────────────────────────────────────────── */
function TabBar({ active, onChange }) {
  const tabs = [
    { key: "comptes", label: "Comptes cibles" },
    { key: "instagram", label: "Instagram" },
  ];
  return (
    <div style={{ display: "flex", borderBottom: "1px solid #F0F0F0", marginBottom: "24px" }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          background: "none", border: "none", cursor: "pointer",
          padding: "10px 16px 8px", fontSize: "13px",
          fontWeight: active === t.key ? 600 : 400,
          color: active === t.key ? "#059669" : "#888",
          borderBottom: active === t.key ? "2px solid #059669" : "2px solid transparent",
          marginBottom: "-1px",
        }}>{t.label}</button>
      ))}
    </div>
  );
}

/* ── INSTAGRAM CONNEXION TAB ─────────────────────────────────────────────── */
function InstagramTab({ comptes, filters, onProspectsDone }) {
  const stored = getStoredCredentials();
  const [username, setUsername] = useState(stored?.username || "");
  const [password, setPassword] = useState(stored?.password || "");
  const [showPwd, setShowPwd] = useState(false);
  const [connStatus, setConnStatus] = useState(stored ? "stored" : "idle");
  const [connInfo, setConnInfo] = useState(null);
  const [connError, setConnError] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState({ done: 0, total: 0, current: "" });
  const [scrapeError, setScrapeError] = useState("");
  const abortRef = useRef(false);

  const handleTest = async () => {
    if (!username.trim() || !password.trim()) return;
    setConnStatus("testing");
    setConnError("");
    try {
      const res = await validateInstagram(username.trim(), password.trim());
      if (res.success) {
        setConnStatus("ok");
        setConnInfo(res);
        saveCredentials(username.trim(), password.trim());
      } else {
        setConnStatus("error");
        setConnError(res.error || "Connexion échouée");
      }
    } catch (e) {
      setConnStatus("error");
      setConnError(e.message.includes("fetch") ? "Backend Python inaccessible — vérifiez que le serveur tourne sur le port 8000" : e.message);
    }
  };

  const handleDisconnect = () => {
    clearCredentials();
    setConnStatus("idle");
    setConnInfo(null);
    setUsername("");
    setPassword("");
  };

  const handleScrape = async () => {
    const creds = getStoredCredentials();
    if (!creds) { setScrapeError("Connectez votre compte Instagram d'abord"); return; }
    if (!comptes.length) { setScrapeError("Ajoutez au moins un compte cible"); return; }

    setScraping(true);
    setScrapeError("");
    abortRef.current = false;
    setScrapeProgress({ done: 0, total: comptes.length, current: comptes[0]?.handle || "" });

    try {
      // Simulate per-account progress while the real request runs
      let progressI = 0;
      const progressTimer = setInterval(() => {
        if (abortRef.current) { clearInterval(progressTimer); return; }
        progressI = Math.min(progressI + 1, comptes.length - 1);
        setScrapeProgress(p => ({
          ...p,
          done: progressI,
          current: comptes[progressI]?.handle || "",
        }));
      }, Math.round((10 * 60 * 1000) / comptes.length));

      const result = await scrapeProspects({
        comptes: comptes.map(c => c.handle),
        username: creds.username,
        password: creds.password,
        filters,
      });

      clearInterval(progressTimer);
      setScrapeProgress({ done: comptes.length, total: comptes.length, current: "" });

      if (result.success) {
        onProspectsDone(result.prospects);
      } else {
        setScrapeError(result.detail || "Scraping échoué");
      }
    } catch (e) {
      setScrapeError(e.message);
    } finally {
      setScraping(false);
      abortRef.current = true;
    }
  };

  const progressPct = scrapeProgress.total > 0
    ? Math.round((scrapeProgress.done / scrapeProgress.total) * 100)
    : 0;

  return (
    <div>
      {/* Section 1 — Connexion */}
      <div style={{ background: "#F9F9F9", borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#1A1A1A", marginBottom: "4px" }}>
          🔐 Connexion Instagram
        </div>
        <div style={{ fontSize: "12px", color: "#888", marginBottom: "16px" }}>
          Utilisez un compte secondaire pour protéger votre compte professionnel
        </div>

        {connStatus === "ok" || connStatus === "stored" ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "10px", padding: "12px 16px", marginBottom: "12px" }}>
              <Wifi size={16} color="#059669" />
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#059669" }}>
                  {connInfo ? `@${connInfo.username}` : `@${username}`}
                  {connInfo?.full_name && <span style={{ fontWeight: 400, color: "#065f46", marginLeft: "6px" }}>— {connInfo.full_name}</span>}
                </div>
                {connInfo?.follower_count != null && (
                  <div style={{ fontSize: "11px", color: "#065f46" }}>{connInfo.follower_count.toLocaleString()} abonnés</div>
                )}
              </div>
            </div>
            <button onClick={handleDisconnect} style={{
              background: "none", border: "1px solid #E0E0E0", borderRadius: "7px",
              padding: "7px 14px", fontSize: "12px", color: "#888", cursor: "pointer",
            }}>Se déconnecter</button>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Nom d'utilisateur</div>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="votre_compte_ig"
                  autoComplete="username"
                  style={{ width: "100%", background: "#FFF", border: "1px solid #E0E0E0", borderRadius: "8px", padding: "9px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit" }}
                  onFocus={e => e.currentTarget.style.borderColor = "#059669"}
                  onBlur={e => e.currentTarget.style.borderColor = "#E0E0E0"}
                />
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Mot de passe</div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleTest()}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    style={{ width: "100%", background: "#FFF", border: "1px solid #E0E0E0", borderRadius: "8px", padding: "9px 40px 9px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit" }}
                    onFocus={e => e.currentTarget.style.borderColor = "#059669"}
                    onBlur={e => e.currentTarget.style.borderColor = "#E0E0E0"}
                  />
                  <button onClick={() => setShowPwd(v => !v)} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#AAA", padding: "2px" }}>
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {connError && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#DC2626", marginBottom: "12px" }}>
                ⚠️ {connError}
              </div>
            )}

            <button
              onClick={handleTest}
              disabled={connStatus === "testing" || !username.trim() || !password.trim()}
              style={{
                background: connStatus === "testing" ? "#CCC" : "#059669",
                color: "white", border: "none", borderRadius: "8px",
                padding: "10px 20px", fontSize: "13px", fontWeight: 600,
                cursor: connStatus === "testing" ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: "8px",
              }}
            >
              {connStatus === "testing" ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Test en cours...</> : "Tester la connexion"}
            </button>

            <div style={{ marginTop: "10px", fontSize: "11px", color: "#D97706", display: "flex", alignItems: "flex-start", gap: "5px" }}>
              <span>⚠️</span>
              <span>Les identifiants sont stockés uniquement en mémoire de session (sessionStorage) et ne quittent jamais votre navigateur, sauf pour l'appel API vers votre backend.</span>
            </div>
          </div>
        )}
      </div>

      {/* Section 2 — Comptes cibles résumé */}
      <div style={{ background: "#F9F9F9", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#1A1A1A", marginBottom: "12px" }}>
          🎯 Comptes cibles sélectionnés
        </div>
        {comptes.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#888" }}>Aucun compte — ajoutez-en dans l'onglet "Comptes cibles"</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {comptes.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#444" }}>
                <span style={{ width: "18px", height: "18px", borderRadius: "50%", background: "#D1FAE5", color: "#059669", fontSize: "9px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontWeight: 600 }}>{c.handle}</span>
                <span style={{ color: "#AAA" }}>— {c.categorie}</span>
                {c.priorite === "Haute" && <Star size={10} color="#D97706" fill="#D97706" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3 — Lancer */}
      <div style={{ background: scraping ? "#F0FDF4" : "#FFF", border: `1px solid ${scraping ? "#A7F3D0" : "#F0F0F0"}`, borderRadius: "12px", padding: "20px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#1A1A1A", marginBottom: "6px" }}>
          🚀 Lancer le scraping réel
        </div>
        <div style={{ fontSize: "12px", color: "#888", marginBottom: "16px" }}>
          Durée estimée : <strong>{Math.ceil(comptes.length * 1.5)}-{Math.ceil(comptes.length * 2.5)} minutes</strong> · Pauses anti-détection incluses
        </div>

        {scrapeError && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#DC2626", marginBottom: "14px" }}>
            ⚠️ {scrapeError}
          </div>
        )}

        {scraping && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#444", marginBottom: "6px" }}>
              <span>Analyse de <strong>{scrapeProgress.current}</strong></span>
              <span style={{ color: "#059669", fontWeight: 600 }}>{progressPct}%</span>
            </div>
            <div style={{ height: "6px", background: "#D1FAE5", borderRadius: "3px", overflow: "hidden", marginBottom: "8px" }}>
              <div style={{ height: "100%", width: `${progressPct}%`, background: "#059669", borderRadius: "3px", transition: "width 800ms" }} />
            </div>
            <div style={{ fontSize: "11px", color: "#888" }}>
              Compte {scrapeProgress.done}/{scrapeProgress.total} · Ne fermez pas cet onglet
            </div>
          </div>
        )}

        <button
          onClick={handleScrape}
          disabled={scraping || comptes.length === 0 || (connStatus !== "ok" && connStatus !== "stored")}
          style={{
            background: scraping || comptes.length === 0 || (connStatus !== "ok" && connStatus !== "stored") ? "#CCC" : "#059669",
            color: "white", border: "none", borderRadius: "10px",
            padding: "12px 24px", fontSize: "14px", fontWeight: 700,
            cursor: scraping || comptes.length === 0 || (connStatus !== "ok" && connStatus !== "stored") ? "not-allowed" : "pointer",
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          }}
        >
          {scraping
            ? <><Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> Scraping en cours...</>
            : "📊 Générer mes 100 vrais prospects"}
        </button>

        {connStatus !== "ok" && connStatus !== "stored" && (
          <div style={{ marginTop: "10px", fontSize: "11px", color: "#888", textAlign: "center" }}>
            Connectez votre compte Instagram pour lancer le scraping
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── COMPTES TAB ─────────────────────────────────────────────────────────── */
function ComptesTab({ comptes, setComptes, filters, setFilters, onGenerate }) {
  const [newHandle, setNewHandle] = useState("");
  const [newCat, setNewCat] = useState("Marque DTC");
  const [newPrio, setNewPrio] = useState("Normale");
  const [saved, setSaved] = useState(false);

  const handleAdd = () => {
    const h = newHandle.trim();
    if (!h) return;
    const handle = h.startsWith("@") ? h : `@${h}`;
    if (comptes.find(c => c.handle === handle)) return;
    setComptes(prev => [...prev, { handle, categorie: newCat, priorite: newPrio }]);
    setNewHandle("");
  };

  const handleRemove = (handle) => setComptes(prev => prev.filter(c => c.handle !== handle));

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(comptes));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleGenerate = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(comptes));
    const comptesList = comptes.map((c, i) =>
      `${i + 1}. ${c.handle} (${c.categorie} — Priorité ${c.priorite})`
    ).join("\n");

    const filtersList = [];
    if (filters.boutique) filtersList.push("- Seulement profils avec lien boutique en bio");
    if (filters.fondateur) filtersList.push("- Seulement fondateur/fondatrice/CEO en bio");
    if (filters.exclureFollowed) filtersList.push("- Exclure comptes déjà followés");
    if (filters.exclureVus) filtersList.push("- Exclure comptes vus cette semaine");
    filtersList.push(`- Minimum ${filters.minAbonnes.toLocaleString()} abonnés`);
    filtersList.push(`- Maximum ${filters.maxAbonnes.toLocaleString()} abonnés`);

    const prompt = `rapport du jour

MES COMPTES CIBLES (${comptes.length} comptes) :
${comptesList}

FILTRES ACTIFS :
${filtersList.join("\n")}

Génère le rapport complet avec 100 prospects groupés par compte source, avec scores, actions recommandées, et les unfollows J+7.`;

    onGenerate(prompt);
  };

  const pct = Math.round((comptes.length / 20) * 100);

  return (
    <div>
      {/* Header stats */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#1A1A1A" }}>Mes 20 comptes cibles</h2>
          <p style={{ margin: 0, fontSize: "12px", color: "#888" }}>Nova puise dans leurs abonnés pour trouver vos 100 prospects/jour</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#059669" }}>{comptes.length}<span style={{ fontSize: "14px", color: "#AAA", fontWeight: 400 }}>/20</span></div>
          <div style={{ fontSize: "11px", color: "#888" }}>comptes configurés</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: "4px", background: "#F0F0F0", borderRadius: "2px", marginBottom: "20px", overflow: "hidden" }}>
        <div style={{ height: "100%", background: comptes.length >= 20 ? "#059669" : "#A7F3D0", borderRadius: "2px", width: `${pct}%`, transition: "width 300ms" }} />
      </div>

      {/* Add form */}
      <div style={{ background: "#F9F9F9", borderRadius: "12px", padding: "16px", marginBottom: "16px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 150px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Handle</div>
          <input
            value={newHandle}
            onChange={e => setNewHandle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="@shopify_fr"
            style={{ width: "100%", background: "#FFF", border: "1px solid #E0E0E0", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit" }}
            onFocus={e => e.currentTarget.style.borderColor = "#059669"}
            onBlur={e => e.currentTarget.style.borderColor = "#E0E0E0"}
          />
        </div>
        <div style={{ flex: "1 1 130px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Catégorie</div>
          <select value={newCat} onChange={e => setNewCat(e.target.value)} style={{ width: "100%", background: "#FFF", border: "1px solid #E0E0E0", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit", cursor: "pointer" }}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ flex: "0 0 110px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Priorité</div>
          <select value={newPrio} onChange={e => setNewPrio(e.target.value)} style={{ width: "100%", background: "#FFF", border: "1px solid #E0E0E0", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit", cursor: "pointer" }}>
            <option>Haute</option>
            <option>Normale</option>
          </select>
        </div>
        <button onClick={handleAdd} disabled={!newHandle.trim() || comptes.length >= 20} style={{
          background: comptes.length >= 20 ? "#CCC" : "#000", color: "white", border: "none",
          borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 600,
          cursor: comptes.length >= 20 ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
        }}>
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {/* List */}
      <div style={{ background: "#FFF", border: "1px solid #F0F0F0", borderRadius: "12px", overflow: "hidden", marginBottom: "16px" }}>
        {comptes.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#888", fontSize: "13px" }}>Aucun compte — ajoutez-en jusqu'à 20</div>
        ) : (
          comptes.map((c, i) => (
            <div key={c.handle} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 16px", borderBottom: i < comptes.length - 1 ? "1px solid #F5F5F5" : "none" }}>
              <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#D1FAE5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ fontWeight: 600, fontSize: "13px", color: "#1A1A1A", flex: "0 0 170px" }}>{c.handle}</div>
              <div style={{ flex: 1, display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ background: "#F5F5F5", borderRadius: "99px", padding: "2px 9px", fontSize: "11px", color: "#666" }}>{c.categorie}</span>
                <span style={{ background: c.priorite === "Haute" ? "#FEF3C7" : "#F5F5F5", color: c.priorite === "Haute" ? "#D97706" : "#888", borderRadius: "99px", padding: "2px 9px", fontSize: "11px", display: "flex", alignItems: "center", gap: "3px" }}>
                  {c.priorite === "Haute" && <Star size={9} fill="currentColor" />}{c.priorite}
                </span>
              </div>
              <button onClick={() => handleRemove(c.handle)} style={{ background: "none", border: "none", cursor: "pointer", color: "#CCC", padding: "4px" }}
                onMouseEnter={e => e.currentTarget.style.color = "#EF4444"}
                onMouseLeave={e => e.currentTarget.style.color = "#CCC"}
              ><Trash2 size={14} /></button>
            </div>
          ))
        )}
      </div>

      {/* Save */}
      <button onClick={handleSave} style={{ background: saved ? "#059669" : "#F5F5F5", color: saved ? "white" : "#1A1A1A", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", marginBottom: "24px" }}>
        <Save size={14} />{saved ? "✓ Sauvegardé" : "Sauvegarder mes comptes"}
      </button>

      <div style={{ height: "1px", background: "#F0F0F0", margin: "0 0 24px" }} />

      {/* Filters */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#1A1A1A", marginBottom: "14px" }}>Filtres prospects</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[
            { key: "boutique", label: "Seulement avec lien boutique en bio" },
            { key: "fondateur", label: 'Seulement avec "fondateur / fondatrice / CEO" en bio' },
            { key: "exclureFollowed", label: "Exclure les comptes déjà followés" },
            { key: "exclureVus", label: "Exclure les comptes déjà vus cette semaine" },
          ].map(f => (
            <label key={f.key} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
              <input type="checkbox" checked={filters[f.key]} onChange={e => setFilters(prev => ({ ...prev, [f.key]: e.target.checked }))}
                style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#059669" }}
              />
              <span style={{ fontSize: "13px", color: "#444" }}>{f.label}</span>
            </label>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "4px" }}>
            <div>
              <div style={{ fontSize: "12px", color: "#888", marginBottom: "6px" }}>
                Minimum : <strong style={{ color: "#1A1A1A" }}>{filters.minAbonnes.toLocaleString()}</strong>
              </div>
              <input type="range" min={1000} max={50000} step={1000} value={filters.minAbonnes}
                onChange={e => setFilters(prev => ({ ...prev, minAbonnes: Number(e.target.value) }))}
                style={{ width: "100%", accentColor: "#059669" }}
              />
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#888", marginBottom: "6px" }}>
                Maximum : <strong style={{ color: "#1A1A1A" }}>{filters.maxAbonnes.toLocaleString()}</strong>
              </div>
              <input type="range" min={10000} max={500000} step={5000} value={filters.maxAbonnes}
                onChange={e => setFilters(prev => ({ ...prev, maxAbonnes: Number(e.target.value) }))}
                style={{ width: "100%", accentColor: "#059669" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Crescendo */}
      <div style={{ background: "#F0FDF4", border: "1px solid #A7F3D0", borderRadius: "12px", padding: "16px 18px", marginBottom: "20px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Plan Crescendo — Quotas du jour</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>
          {[{ sem: "S1", f: 20, l: 40, s: 20 }, { sem: "S2", f: 25, l: 50, s: 25 }, { sem: "S3", f: 30, l: 60, s: 30 }, { sem: "S4", f: 35, l: 70, s: 35 }, { sem: "S5+", f: 40, l: 80, s: 40 }].map((q, i) => (
            <div key={i} style={{ background: i === 2 ? "#059669" : "rgba(5,150,105,0.08)", borderRadius: "8px", padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: i === 2 ? "white" : "#059669", marginBottom: "4px" }}>{q.sem}</div>
              <div style={{ fontSize: "10px", color: i === 2 ? "rgba(255,255,255,0.8)" : "#666", lineHeight: "1.6" }}>{q.f}F/{q.l}L<br />{q.s} stories</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "10px", fontSize: "11px", color: "#D97706", display: "flex", alignItems: "center", gap: "5px" }}>
          ⚠️ Exécution manuelle recommandée pour protéger votre compte Instagram
        </div>
      </div>

      {/* Generate via Claude (fallback) */}
      <button onClick={handleGenerate} disabled={comptes.length === 0} style={{
        background: comptes.length === 0 ? "#CCC" : "#1A1A1A",
        color: "white", border: "none", borderRadius: "10px",
        padding: "13px 24px", fontSize: "13px", fontWeight: 700,
        cursor: comptes.length === 0 ? "not-allowed" : "pointer",
        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
      }}>
        ✨ Générer via Claude (sans scraping)
      </button>
    </div>
  );
}

/* ── RAPPORT VIEW ────────────────────────────────────────────────────────── */
function RapportView({ prospects, onClose, onSendToChat }) {
  const chauds = prospects.filter(p => p.score >= 7);
  const tièdes = prospects.filter(p => p.score >= 4 && p.score < 7);
  const froids = prospects.filter(p => p.score < 4);

  const formatRapport = () => {
    const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    let txt = `RAPPORT INSTAGRAM — ${today}\n${"━".repeat(40)}\n${prospects.length} VRAIS PROSPECTS IDENTIFIÉS\n${"━".repeat(40)}\n\n`;

    const sections = [
      { label: "🔥 CHAUDS (priorité 1)", items: chauds },
      { label: "🟡 TIÈDES (priorité 2)", items: tièdes },
      { label: "❄️ FROIDS (priorité 3)", items: froids },
    ];

    sections.forEach(({ label, items }) => {
      if (!items.length) return;
      txt += `${label} — ${items.length} profils\n${"─".repeat(40)}\n`;
      items.forEach((p, i) => {
        txt += `${i + 1}. ${p.handle}\n`;
        if (p.nom) txt += `   ${p.nom}\n`;
        if (p.bio) txt += `   "${p.bio}"\n`;
        txt += `   ${p.abonnes.toLocaleString()} abonnés`;
        if (p.lien_boutique) txt += ` · 🔗 ${p.lien_boutique}`;
        txt += `\n   → ${p.actions.join(" · ")}\n   Source : ${p.source_compte}\n\n`;
      });
    });

    return txt;
  };

  const handleCopy = () => navigator.clipboard.writeText(formatRapport());
  const handleSend = () => onSendToChat(formatRapport());

  const SCORE_COLORS = { Chaud: { bg: "#FEF3C7", color: "#D97706" }, Tiède: { bg: "#F5F5F5", color: "#666" }, Froid: { bg: "#EFF6FF", color: "#2563EB" } };

  return (
    <div style={{ background: "#FFF" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#1A1A1A" }}>
            {prospects.length} prospects identifiés
          </h2>
          <div style={{ fontSize: "12px", color: "#888" }}>
            🔥 {chauds.length} chauds · 🟡 {tièdes.length} tièdes · ❄️ {froids.length} froids
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={handleCopy} style={{ background: "#F5F5F5", border: "none", borderRadius: "7px", padding: "8px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer", color: "#444" }}>
            📋 Copier
          </button>
          <button onClick={handleSend} style={{ background: "#059669", color: "white", border: "none", borderRadius: "7px", padding: "8px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
            💬 Envoyer au chat
          </button>
          <button onClick={onClose} style={{ background: "#F5F5F5", border: "none", borderRadius: "7px", padding: "8px 14px", fontSize: "12px", cursor: "pointer", color: "#888" }}>
            ✕ Fermer
          </button>
        </div>
      </div>

      {[
        { label: "🔥 CHAUDS — Priorité 1", items: chauds, accent: "#D97706" },
        { label: "🟡 TIÈDES — Priorité 2", items: tièdes, accent: "#888" },
        { label: "❄️ FROIDS — Priorité 3", items: froids, accent: "#2563EB" },
      ].map(({ label, items, accent }) => items.length > 0 && (
        <div key={label} style={{ marginBottom: "28px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
            {label} ({items.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {items.map((p, i) => {
              const sc = SCORE_COLORS[p.score_label] || SCORE_COLORS["Tiède"];
              return (
                <div key={i} style={{ background: "#F9F9F9", borderRadius: "10px", padding: "12px 14px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#F0F0F0", color: "#888", fontSize: "10px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: "13px", color: "#059669" }}>{p.handle}</span>
                      {p.nom && <span style={{ fontSize: "12px", color: "#444" }}>{p.nom}</span>}
                      <span style={{ fontSize: "10px", background: sc.bg, color: sc.color, padding: "1px 7px", borderRadius: "99px", fontWeight: 600 }}>{p.score}/10</span>
                      <span style={{ fontSize: "11px", color: "#AAA" }}>via {p.source_compte}</span>
                    </div>
                    {p.bio && <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px", fontStyle: "italic" }}>"{p.bio}"</div>}
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: "#888" }}>{p.abonnes.toLocaleString()} abn</span>
                      {p.lien_boutique && <a href={p.lien_boutique} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "#059669", textDecoration: "none" }}>🔗 boutique</a>}
                      {p.actions.map((a, j) => (
                        <span key={j} style={{ fontSize: "11px", background: "#E5E7EB", color: "#374151", padding: "1px 8px", borderRadius: "99px" }}>{a}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── MAIN EXPORT ─────────────────────────────────────────────────────────── */
export default function NovaComptesClient({ onGenerate }) {
  const [tab, setTab] = useState("comptes");
  const [comptes, setComptes] = useState(() => {
    const stored = getComptesClient();
    return stored.length > 0 ? stored : DEFAULTS;
  });
  const [filters, setFilters] = useState({
    boutique: false,
    fondateur: false,
    minAbonnes: 1000,
    maxAbonnes: 100000,
    exclureFollowed: true,
    exclureVus: false,
  });
  const [prospects, setProspects] = useState(null);

  const handleProspectsDone = (data) => {
    setProspects(data);
    setTab("rapport");
  };

  const handleSendToChat = (text) => {
    onGenerate(text);
    setProspects(null);
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: "800px" }}>
      {prospects ? (
        <RapportView
          prospects={prospects}
          onClose={() => setProspects(null)}
          onSendToChat={handleSendToChat}
        />
      ) : (
        <>
          <TabBar active={tab} onChange={setTab} />
          {tab === "comptes" && (
            <ComptesTab
              comptes={comptes}
              setComptes={setComptes}
              filters={filters}
              setFilters={setFilters}
              onGenerate={onGenerate}
            />
          )}
          {tab === "instagram" && (
            <InstagramTab
              comptes={comptes}
              filters={filters}
              onProspectsDone={handleProspectsDone}
            />
          )}
        </>
      )}
    </div>
  );
}
