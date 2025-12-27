// frontend/src/pages/admin/TimeSchemesPage.tsx
import TimeSchemesTab from "@/components/admin/time-schemes/TimeSchemesTab";

export default function TimeSchemesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Zeitschema</h1>
        <p className="text-sm text-muted-foreground">
          Definition der Zeitschemata und Default-Zuordnung pro Organisationseinheit &amp; Fach.
        </p>
      </div>

      <TimeSchemesTab />
    </div>
  );
}
