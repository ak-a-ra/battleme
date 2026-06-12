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
        children: [
          { index: true, element: <div>Wiki Home</div> },
          { path: "monsters", element: <div>Wiki Monsters</div> },
          { path: "monsters/:id", element: <div>Wiki Monster Detail</div> },
          { path: "hunters", element: <div>Wiki Hunters</div> },
          { path: "hunters/:id", element: <div>Wiki Hunter Detail</div> },
          { path: "status-effects", element: <div>Wiki Status Effects</div> },
          { path: "types", element: <div>Wiki Type Chart</div> },
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
      { path: "history", element: <div>History</div> },
      { path: "history/:id", element: <div>History Detail</div> },
      { path: "stats", element: <div>Stats</div> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
