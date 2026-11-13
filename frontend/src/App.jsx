import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import RfqList from "./pages/RfqList";
import CreateRfq from "./pages/CreateRfq";
import RfqDetails from "./pages/RfqDetails";

export default function App() {
  return (
    <BrowserRouter>
      <header className="topbar">
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            RFQs
          </NavLink>
          <NavLink to="/create" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Create RFQ
          </NavLink>
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<RfqList />} />
          <Route path="/create" element={<CreateRfq />} />
          <Route path="/rfqs/:id" element={<RfqDetails />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
