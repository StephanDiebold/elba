// src/components/layout/AppHeader.tsx
import { Link, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "px-3 py-1.5 rounded-md text-sm",
          isActive ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}

export default function AppHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-3">
        {/* Logo / Brand */}
        <Link to="/dashboard" className="font-semibold">ELBA</Link>

        {/* Navigation */}
        <nav className="ml-2 flex items-center gap-1">
          <NavItem to="/dashboard">Dashboard</NavItem>
          <NavItem to="/planner">Planer</NavItem>
          <NavItem to="/candidates">Kandidaten</NavItem>
          <NavItem to="/committees">Ausschüsse</NavItem>
          <NavItem to="/exams">Prüfungen</NavItem>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">{user?.display_name ?? user?.email ?? "Konto"}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={logout}>Abmelden</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
