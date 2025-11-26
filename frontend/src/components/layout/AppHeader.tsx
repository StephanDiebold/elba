// src/components/layout/AppHeader.tsx

import { Settings } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { AdminBadge } from "@/components/ui/AdminBadge";

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "px-3 py-1.5 rounded-md text-sm",
          isActive
            ? "bg-muted font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}

export default function AppHeader() {
  const { user, logout } = useAuth();

  const roles = (user as any)?.roles as string[] | undefined;
  const primaryRole = (user as any)?.role as string | undefined;

  // Admin-Logik: Admin ODER Koordinator
  const isAdmin =
    (Array.isArray(roles) &&
      (roles.includes("admin") || roles.includes("koordinator"))) ||
    primaryRole === "admin" ||
    primaryRole === "koordinator";

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-3">
        {/* Logo / Brand */}
        <Link to="/dashboard" className="font-semibold">
          ELBA
        </Link>

        {/* Hauptnavigation */}
        <nav className="ml-2 flex items-center gap-1">
          <NavItem to="/dashboard">Dashboard</NavItem>
          <NavItem to="/planner">Planer</NavItem>
          <NavItem to="/candidates">Kandidaten</NavItem>
          <NavItem to="/committees">Ausschüsse</NavItem>
          <NavItem to="/exams">Prüfungen</NavItem>

          {/* ADMINISTRATION nur für Admin / Koordinator */}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2 flex items-center gap-1 group"
                >
                  <Settings className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
                  Administration
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Verwaltung</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                  <NavLink to="/admin/org-units" className="w-full">
                    Organisationseinheiten
                  </NavLink>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <NavLink to="/admin/committees" className="w-full">
                    Ausschüsse (Admin)
                  </NavLink>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <NavLink to="/admin/users" className="w-full">
                    Benutzer
                  </NavLink>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <NavLink to="/admin/roles" className="w-full">
                    Rollen
                  </NavLink>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>

        {/* Account-Menü */}
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <div className="flex flex-col items-start leading-tight">
                  <span>
                    {user?.display_name ?? user?.email ?? "Konto"}
                  </span>

                  {/* Rollen-Anzeige direkt unter dem Namen */}
                  {(() => {
                    const rolesArr = (user as any)?.roles as string[] | undefined;
                    const primaryRole = (user as any)?.role as string | undefined;

                    let allRoles: string[] = [];
                    if (Array.isArray(rolesArr)) {
                      allRoles = [...rolesArr];
                    }
                    if (primaryRole && !allRoles.includes(primaryRole)) {
                      allRoles.push(primaryRole);
                    }

                    if (!allRoles.length) return null;

                    return (
                      <span className="text-[10px] text-muted-foreground">
                        {allRoles.join(", ")}
                      </span>
                    );
                  })()}
                </div>

                {isAdmin && <AdminBadge />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/account">Profil</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout}>Abmelden</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
// Ende der Datei src/components/layout/AppHeader.tsx