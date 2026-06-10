import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import "./styles.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { path: "overlay", element: <div>Overlay</div> },
      { path: "dashboard", element: <div>Dashboard</div> },
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
        children: [
          { index: true, element: <div>Admin Home</div> },
          { path: "monsters", element: <div>Admin Monsters</div> },
          { path: "hunters", element: <div>Admin Hunters</div> },
          { path: "abilities", element: <div>Admin Abilities</div> },
          { path: "status", element: <div>Admin Status Effects</div> },
          { path: "settings", element: <div>Admin Settings</div> },
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
