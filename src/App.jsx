import { BrowserRouter, Routes, Route } from "react-router-dom";
import TopNav from "./components/TopNav";
import Dashboard from "./pages/Dashboard";
import AgentPage from "./pages/AgentPage";
import ConnectionsPage from "./pages/ConnectionsPage";
import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", background: "#F5F2EE" }}>
        <TopNav />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/agent/:id" element={<AgentPage />} />
          <Route path="/connections" element={<ConnectionsPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
