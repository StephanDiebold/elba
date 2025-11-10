// src/pages/RegisterPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {register } from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";

const schema = z.object({
  name: z.string().min(2, "Bitte Namen angeben."),
  email: z.string().email("Bitte gültige E-Mail."),
  password: z.string().min(6, "Mindestens 6 Zeichen."),
  confirm: z.string().min(6),
}).refine((d) => d.password === d.confirm, {
  path: ["confirm"],
  message: "Passwörter stimmen nicht überein.",
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirm: "" },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      await register({ email: values.email, password: values.password, name: values.name });
      toast.success("Konto erstellt. Bitte anmelden.");
      navigate("/login", { replace: true, state: { email: values.email } });
    } catch (e: any) {
      toast.error(e?.data?.detail || "Registrierung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-6">Registrieren</h1>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField name="name" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input placeholder="Max Mustermann" autoComplete="name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField name="email" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>E-Mail</FormLabel>
                <FormControl><Input type="email" placeholder="name@beispiel.de" autoComplete="email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField name="password" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Passwort</FormLabel>
                <FormControl><Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField name="confirm" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Passwort bestätigen</FormLabel>
                <FormControl><Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Erstellen…" : "Konto erstellen"}
            </Button>
          </form>
        </Form>
        <p className="text-xs text-muted-foreground mt-4">
          API: {import.meta.env.VITE_API_BASE_URL || "/api"}
        </p>
      </div>
    </div>
  );
}
