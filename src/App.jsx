import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Home from "./pages/Home";
import AssistantsPage from "./pages/AssistantsPage";
import ConversationPage from "./pages/ConversationPage";
import SuperPouvoirs from "./pages/SuperPouvoirs";
import Integrations from "./pages/Integrations";
import Documents from "./pages/Documents";
import Parametres from "./pages/Parametres";
import OAuthCallback from "./pages/OAuthCallback";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* OAuth callback — full-page, no sidebar */}
        <Route path="/oauth/callback" element={<OAuthCallback />} />

        {/* Main app with sidebar */}
        <Route path="/*" element={
          <div style={{ display: "flex", minHeight: "100vh", background: "#FFFFFF" }}>
            <Sidebar />
            <main style={{ flex: 1, marginLeft: "280px", minHeight: "100vh", overflowY: "auto" }}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/assistants" element={<AssistantsPage tab="assistants" />} />
                <Route path="/assistants/historique" element={<AssistantsPage tab="historique" />} />
                <Route path="/conversation/:agentId" element={<ConversationPage />} />
                <Route path="/super-pouvoirs" element={<SuperPouvoirs />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/parametres" element={<Parametres />} />
              </Routes>
            </main>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}
