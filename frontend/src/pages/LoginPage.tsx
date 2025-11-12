// src/pages/LoginPage.tsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LoginForm } from "@/components/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const loc = useLocation() as { state?: { from?: { pathname?: string }; email?: string } };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <LoginForm
          defaultEmail={loc.state?.email ?? ""}
          onSuccess={() => navigate("/dashboard", { replace: true })}
        />
        <p className="text-sm text-muted-foreground mt-4">
          Noch kein Konto?{" "}
          <Link to="/register" className="underline">Registrieren</Link>
        </p>
        <p className="text-xs text-muted-foreground mt-4">
          API: {import.meta.env.VITE_API_BASE_URL || "/api"}
        </p>
      </div>
    </div>
  );
}
