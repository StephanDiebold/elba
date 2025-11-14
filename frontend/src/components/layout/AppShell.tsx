import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader";
import Footer from "./Footer";

export default function AppShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <div className="flex-1">
        <Outlet /> {/* WICHTIG: ohne das siehst du nix */}
      </div>
      <Footer />
    </div>
  );
}
