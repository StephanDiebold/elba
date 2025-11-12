// src/components/auth/RegisterForm.tsx
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  register as registerUser,
  getKammern,
  getBezirkskammern,
  type Kammer,
  type Bezirkskammer,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription,
} from "@/components/ui/form";

/** 0 = nicht gewählt */
const schema = z
  .object({
    vorname: z.string().min(1, "Bitte Vornamen angeben."),
    nachname: z.string().min(1, "Bitte Nachnamen angeben."),
    email: z.string().email("Bitte gültige E-Mail."),
    password: z.string().min(8, "Mindestens 8 Zeichen."),
    confirm: z.string().min(8, "Mindestens 8 Zeichen."),
    mobilnummer: z.string().optional(),
    geburtstag: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD")
      .optional()
      .or(z.literal(""))
      .optional(),
    kammer_id: z.number().int(),
    bezirkskammer_id: z.number().int().optional(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwörter stimmen nicht überein.",
  })
  .refine((d) => d.kammer_id > 0, {
    path: ["kammer_id"],
    message: "Bitte Kammer wählen.",
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterForm({
  onSuccess,
}: {
  onSuccess?: (email: string) => void; // z.B. navigate("/login", {state:{email}})
}) {
  const [loading, setLoading] = useState(false);
  const [kammern, setKammern] = useState<Kammer[]>([]);
  const [bezirkskammern, setBezirkskammern] = useState<Bezirkskammer[]>([]);
  const hasBezirke = bezirkskammern.length > 0;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vorname: "",
      nachname: "",
      email: "",
      password: "",
      confirm: "",
      mobilnummer: "",
      geburtstag: "",
      kammer_id: 0,
      bezirkskammer_id: 0,
    },
    mode: "onChange",
  });

  const { errors } = form.formState;
  const kammerId = form.watch("kammer_id");

  useEffect(() => {
    (async () => {
      try {
        const data = await getKammern();
        setKammern(data ?? []);
      } catch (e: any) {
        toast.error(e?.data?.detail || "Kammern konnten nicht geladen werden.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!kammerId || kammerId <= 0) {
      setBezirkskammern([]);
      form.setValue("bezirkskammer_id", 0);
      return;
    }
    (async () => {
      try {
        const data = await getBezirkskammern(kammerId);
        setBezirkskammern(data ?? []);
        if (!data || data.length === 0) {
          form.setValue("bezirkskammer_id", 0);
        }
      } catch {
        setBezirkskammern([]);
        form.setValue("bezirkskammer_id", 0);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kammerId]);

  async function onSubmit(values: FormValues) {
    if (hasBezirke && (!values.bezirkskammer_id || values.bezirkskammer_id <= 0)) {
      toast.error("Bitte Bezirkskammer wählen.");
      return;
    }
    setLoading(true);
    try {
      await registerUser({
        email: values.email.trim(),
        password: values.password,
        vorname: values.vorname.trim(),
        nachname: values.nachname.trim(),
        mobilnummer: values.mobilnummer?.trim() || null,
        geburtstag: values.geburtstag?.trim() || null,
        kammer_id: values.kammer_id,
        bezirkskammer_id:
          hasBezirke && values.bezirkskammer_id && values.bezirkskammer_id > 0
            ? values.bezirkskammer_id
            : null,
      });
      toast.success("Konto erstellt. Bitte später anmelden (nach Freigabe).");
      onSuccess?.(values.email);
    } catch (e: any) {
      toast.error(e?.data?.detail || "Registrierung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  const ariaErrId = (name: keyof FormValues) => `${String(name)}-error`;
  const hasErr = (name: keyof FormValues) => Boolean(errors[name]);

  return (
    <div className="w-full max-w-md">
      <h1 className="text-xl font-semibold mb-6">Registrieren</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Kammer */}
          <FormField
            control={form.control}
            name="kammer_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kammer*</FormLabel>
                <FormControl>
                  <select
                    className="w-full rounded-md border px-3 py-2 bg-background"
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                    aria-invalid={hasErr("kammer_id")}
                    aria-describedby={hasErr("kammer_id") ? ariaErrId("kammer_id") : undefined}
                    required
                  >
                    <option value={0}>Bitte wählen…</option>
                    {kammern.map((k) => (
                      <option key={k.kammer_id} value={k.kammer_id}>
                        {k.kammer_name}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormDescription>Wähle deine zuständige IHK-Kammer.</FormDescription>
                <FormMessage id={ariaErrId("kammer_id")} />
              </FormItem>
            )}
          />

          {/* Bezirkskammer – nur wenn vorhanden */}
          {hasBezirke && (
            <FormField
              control={form.control}
              name="bezirkskammer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bezirkskammer*</FormLabel>
                  <FormControl>
                    <select
                      className="w-full rounded-md border px-3 py-2 bg-background"
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                      aria-invalid={hasErr("bezirkskammer_id")}
                      aria-describedby={hasErr("bezirkskammer_id") ? ariaErrId("bezirkskammer_id") : undefined}
                      required
                    >
                      <option value={0}>Bitte wählen…</option>
                      {bezirkskammern.map((b) => (
                        <option key={b.bezirkskammer_id} value={b.bezirkskammer_id}>
                          {b.bezirkskammer_name}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormDescription>Falls deine Kammer Bezirkskammern hat, bitte hier auswählen.</FormDescription>
                  <FormMessage id={ariaErrId("bezirkskammer_id")} />
                </FormItem>
              )}
            />
          )}

          {/* Person */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="vorname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vorname*</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Max"
                      autoComplete="given-name"
                      {...field}
                      aria-invalid={hasErr("vorname")}
                      aria-describedby={hasErr("vorname") ? ariaErrId("vorname") : undefined}
                    />
                  </FormControl>
                  <FormDescription>Dein Rufname.</FormDescription>
                  <FormMessage id={ariaErrId("vorname")} />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nachname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nachname*</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Mustermann"
                      autoComplete="family-name"
                      {...field}
                      aria-invalid={hasErr("nachname")}
                      aria-describedby={hasErr("nachname") ? ariaErrId("nachname") : undefined}
                    />
                  </FormControl>
                  <FormDescription>Familienname.</FormDescription>
                  <FormMessage id={ariaErrId("nachname")} />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-Mail*</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="name@beispiel.de"
                    autoComplete="email"
                    {...field}
                    aria-invalid={hasErr("email")}
                    aria-describedby={hasErr("email") ? ariaErrId("email") : undefined}
                  />
                </FormControl>
                <FormDescription>Wir senden dir Infos zur Registrierung an diese Adresse.</FormDescription>
                <FormMessage id={ariaErrId("email")} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Passwort* (min. 8 Zeichen)</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    {...field}
                    aria-invalid={hasErr("password")}
                    aria-describedby={hasErr("password") ? ariaErrId("password") : undefined}
                  />
                </FormControl>
                <FormDescription>Sichere Kombination empfohlen.</FormDescription>
                <FormMessage id={ariaErrId("password")} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Passwort bestätigen*</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    {...field}
                    aria-invalid={hasErr("confirm")}
                    aria-describedby={hasErr("confirm") ? ariaErrId("confirm") : undefined}
                  />
                </FormControl>
                <FormDescription>Wiederhole dein Passwort exakt.</FormDescription>
                <FormMessage id={ariaErrId("confirm")} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mobilnummer"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mobilnummer (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="+49 ..."
                    {...field}
                    aria-invalid={hasErr("mobilnummer")}
                    aria-describedby={hasErr("mobilnummer") ? ariaErrId("mobilnummer") : undefined}
                  />
                </FormControl>
                <FormDescription>Für kurzfristige Rückfragen.</FormDescription>
                <FormMessage id={ariaErrId("mobilnummer")} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="geburtstag"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Geburtstag (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    placeholder="YYYY-MM-DD"
                    {...field}
                    aria-invalid={hasErr("geburtstag")}
                    aria-describedby={hasErr("geburtstag") ? ariaErrId("geburtstag") : undefined}
                  />
                </FormControl>
                <FormDescription>Format: YYYY-MM-DD.</FormDescription>
                <FormMessage id={ariaErrId("geburtstag")} />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={
              loading ||
              !form.formState.isValid ||
              (hasBezirke &&
                (!form.watch("bezirkskammer_id") || form.watch("bezirkskammer_id")! <= 0))
            }
          >
            {loading ? "Erstellen…" : "Konto erstellen"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
