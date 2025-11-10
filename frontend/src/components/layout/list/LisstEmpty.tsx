export default function ListEmpty({ message = "Keine Einträge gefunden." }: { message?: string }) {
  return <div className="text-sm text-muted-foreground px-4 py-8">{message}</div>;
}
