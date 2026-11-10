const KNOWN = [
  "invalid_credentials", "email_taken", "invalid_email", "password_length", "password_too_weak",
  "rate_limited", "limit_reached", "not_found",
];

/** Ключ строки cabinet.* для кода ошибки API; неизвестные коды → общая ошибка. */
export function errorKey(code: string): string {
  return `errors.${KNOWN.includes(code) ? code : "generic"}`;
}
