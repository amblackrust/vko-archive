// A template remounts on every navigation, so each screen eases in instead of snapping.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
