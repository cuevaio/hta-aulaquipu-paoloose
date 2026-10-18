import { redirect } from "next/navigation";

// "Mis clases" vive ahora en el tablero; se conserva la ruta para enlaces antiguos
export default function ClassesPage() {
  redirect("/home#clases");
}
