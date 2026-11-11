/** Разделы кабинета в порядке вкладок; активный раздел живёт в адресе (?section=…). Модуль общий для сервера и клиента. */
export const SECTIONS = ["favorites", "selections", "searches", "subscriptions", "account"] as const;
export type Section = (typeof SECTIONS)[number];
