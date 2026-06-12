import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminMonsters from "./pages/admin/AdminMonsters";
import AdminHunters from "./pages/admin/AdminHunters";
import AdminAbilities from "./pages/admin/AdminAbilities";
import AdminStatus from "./pages/admin/AdminStatus";
import AdminSettings from "./pages/admin/AdminSettings";
import DashboardLayout from "./pages/dashboard/DashboardLayout";
import LineupBuilder from "./pages/dashboard/LineupBuilder";
import DraftPhase from "./pages/dashboard/DraftPhase";
import BattlePage from "./pages/dashboard/BattlePage";
import WikiLayout from "./pages/wiki/WikiLayout";
import WikiMonsters from "./pages/wiki/WikiMonsters";
import WikiMonsterDetail from "./pages/wiki/WikiMonsterDetail";
import WikiHunters from "./pages/wiki/WikiHunters";
import WikiHunterDetail from "./pages/wiki/WikiHunterDetail";
import WikiStatusEffects from "./pages/wiki/WikiStatusEffects";
import WikiTypeChart from "./pages/wiki/WikiTypeChart";
import History from "./pages/history/History";
import HistoryDetail from "./pages/history/HistoryDetail";
import Stats from "./pages/stats/Stats";
import Overlay from "./pages/overlay/Overlay";
import "./styles.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { path: "overlay", element: <Overlay /> },
      {
        path: "dashboard",
        element: <DashboardLayout />,
        children: [
          { index: true, element: <div className="text-zinc-500 p-8">Select Lineup or Draft from the sidebar.</div> },
          { path: "lineup", element: <LineupBuilder /> },
          { path: "draft", element: <DraftPhase /> },
          { path: "battle", element: <BattlePage /> },
        ],
      },
      {
        path: "wiki",
        element: <WikiLayout />,
        children: [
          { index: true, element: <WikiMonsters /> },
          { path: "monsters", element: <WikiMonsters /> },
          { path: "monsters/:id", element: <WikiMonsterDetail /> },
          { path: "hunters", element: <WikiHunters /> },
          { path: "hunters/:id", element: <WikiHunterDetail /> },
          { path: "status-effects", element: <WikiStatusEffects /> },
          { path: "types", element: <WikiTypeChart /> },
        ],
      },
      {
        path: "admin",
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminMonsters /> },
          { path: "monsters", element: <AdminMonsters /> },
          { path: "hunters", element: <AdminHunters /> },
          { path: "abilities", element: <AdminAbilities /> },
          { path: "status", element: <AdminStatus /> },
          { path: "settings", element: <AdminSettings /> },
        ],
      },
      { path: "history", element: <History /> },
      { path: "history/:id", element: <HistoryDetail /> },
      { path: "stats", element: <Stats /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
