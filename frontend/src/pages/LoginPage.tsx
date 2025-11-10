// src/pages/LoginPage.tsx
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/auth/AuthContext";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

const schema = z.object({
  email: z.string().email("Bitte gültige E-Mail eingeben."),
  password: z.string().min(6, "Mindestens 6 Zeichen."),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { login /*, logout*/ } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation() as { state?: { from?: { pathname?: string }; email?: string } };
  const [loading, setLoading] = useState(false);

  // 🔒 WICHTIG: Beim Betreten der Login-Seite evtl. vorhandenes Token entfernen,
  // damit kein Authorization-Header gesendet wird (verhindert Preflight/CORS auf /auth/me in globalen Hooks)
  useEffect(() => {
    // Falls dein AuthContext ein logout() hat, ist das noch sauberer:
    // logout?.();
    localStorage.removeItem("token");
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: loc.state?.email ?? "",
      password: "",
    },
    mode: "onSubmit",
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      await login(values.email, values.password);
      toast.success("Erfolgreich angemeldet");
      // const target = loc.state?.from?.pathname || "/schlagworte";
      navigate("/dashboard", { replace: true });
      // navigate(target, { replace: true });
    } catch (e: any) {
      const detail = e?.data?.detail || "Login fehlgeschlagen";
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-6">Login</h1>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="name@beispiel.de"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passwort</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Anmelden…" : "Anmelden"}
            </Button>
          </form>
        </Form>

        <p className="text-sm text-muted-foreground mt-4">
          Noch kein Konto?{" "}
          <Link to="/register" className="underline">
            Registrieren
          </Link>
        </p>

        <p className="text-xs text-muted-foreground mt-4">
          API: {import.meta.env.VITE_API_BASE_URL || "/api"}
        </p>
      </div>
    </div>
  );
}
