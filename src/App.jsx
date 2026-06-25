import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import AgentPage from "./pages/AgentPage";
import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agent/:id" element={<AgentPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
