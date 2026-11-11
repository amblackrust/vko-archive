import { useTranslations } from "next-intl";

/**
 * Человеческое название действия из журнала: «auth.login» → «Вход в систему», «news.update» → «Новость: изменение».
 * Незнакомый код возвращается как есть — журнал остаётся точным.
 */
export function useActionLabel() {
  const t = useTranslations("admin");
  return (code: string): string => {
    if (t.has(`actions.full.${code}`)) return t(`actions.full.${code}`);
    const [object, verb] = code.split(".");
    const name = t.has(`actions.objects.${object}`) ? t(`actions.objects.${object}`) : t.has(`objectTypes.${object}`) ? t(`objectTypes.${object}`) : null;
    return name && verb && t.has(`actions.verbs.${verb}`) ? `${name}: ${t(`actions.verbs.${verb}`)}` : code;
  };
}
