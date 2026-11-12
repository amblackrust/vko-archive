// Placeholder mark: an archive box. Replace with the archive's official emblem.
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--action)" />
      <rect x="6.5" y="8" width="19" height="5.5" rx="2.2" fill="var(--action-ink)" />
      <path d="M8.5 15.5h15v6.2a2.8 2.8 0 0 1-2.8 2.8H11.3a2.8 2.8 0 0 1-2.8-2.8v-6.2Z" fill="var(--action-ink)" />
      <rect x="13" y="18" width="6" height="2.2" rx="1.1" fill="var(--action)" />
    </svg>
  );
}
