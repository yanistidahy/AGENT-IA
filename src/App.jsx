import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import AgentPage from "./pages/AgentPage";
import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <div style={{ display: "flex", minHeight: "100vh", background: "#F8F7FF" }}>
        <Sidebar />
        <main style={{ flex: 1, marginLeft: "260px", minHeight: "100vh", overflowY: "auto" }}>
          <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "32px" }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/agent/:id" element={<AgentPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
