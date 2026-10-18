import { UpcomingClasses } from "@/components/upcoming-classes";

export default function ClassesPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-primary">🏫 Aulas</p>
        <h1 className="font-heading text-3xl font-semibold">Tus clases</h1>
        <p className="mt-1 text-muted-foreground">Entra al aula de tus clases agendadas o vuelve a una que sigue en vivo.</p>
      </div>
      <UpcomingClasses />
    </div>
  );
}
