import { notFound } from "next/navigation";

// Любой неизвестный путь внутри локали отдаёт локализованный not-found.tsx в общем layout.
export default function CatchAll() {
  notFound();
}
