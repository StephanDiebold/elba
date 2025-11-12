// src/pages/RegisterPage.tsx
import { useNavigate } from "react-router-dom";
import { RegisterForm } from "@/components/auth";

export default function RegisterPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <RegisterForm
        onSuccess={(email) =>
          navigate("/login", { replace: true, state: { email } })
        }
      />
      <p className="text-xs text-muted-foreground mt-4">
        API: {import.meta.env.VITE_API_BASE_URL || "/api"}
      </p>
    </div>
  );
}
