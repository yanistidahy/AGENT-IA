import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import AgentPage from "./pages/AgentPage";
import ConnectionsPage from "./pages/ConnectionsPage";
import "./index.css";

function Layout() {
  const location = useLocation();
  const isAgentPage = location.pathname.startsWith("/agent/");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F4F3FF" }}>
      <Sidebar />
      <main style={{
        flex: 1,
        marginLeft: "220px",
        minHeight: "100vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}>
        <div style={{
          flex: 1,
          padding: isAgentPage ? "0" : "32px",
          maxWidth: isAgentPage ? "none" : "1200px",
          width: "100%",
          margin: isAgentPage ? "0" : "0 auto",
        }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agent/:id" element={<AgentPage />} />
            <Route path="/connections" element={<ConnectionsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}

export default App;
