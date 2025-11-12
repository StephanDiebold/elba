// src/components/auth/LoginForm.tsx
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";

const schema = z.object({
  email: z.string().email("Bitte gültige E-Mail eingeben."),
  password: z.string().min(6, "Mindestens 6 Zeichen."),
});
type FormValues = z.infer<typeof schema>;

export default function LoginForm({
  defaultEmail = "",
  onSuccess,
}: {
  defaultEmail?: string;
  onSuccess?: () => void; // z.B. navigate("/dashboard")
}) {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: defaultEmail, password: "" },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      await login(values.email, values.password);
      toast.success("Erfolgreich angemeldet");
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.data?.detail || "Login fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  return (
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
                  <Input type="email" placeholder="name@beispiel.de" autoComplete="email" {...field} />
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
                  <Input type="password" placeholder="••••••••" autoComplete="current-password" {...field} />
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
    </div>
  );
}
