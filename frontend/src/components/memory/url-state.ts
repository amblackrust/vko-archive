/**
 * Состояние фильтров хранится в адресе: ссылкой на выбранный период или место можно поделиться.
 * replaceState не добавляет записей в историю, поэтому «Назад» уводит со страницы, а не перебирает фильтры.
 */
export function replaceQuery(params: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") query.set(key, String(value));
  }
  const search = query.toString();
  window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
}
