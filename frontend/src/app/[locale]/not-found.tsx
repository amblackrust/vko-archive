import { StateHelp } from "@/components/misc/state-help";
import { NotFoundState } from "@/components/ui/state-view";

/** «Страница не существует»: объяснение, поиск по сайту и переходы в основные разделы. */
export default function NotFound() {
  return (
    <>
      <NotFoundState />
      <StateHelp />
    </>
  );
}
