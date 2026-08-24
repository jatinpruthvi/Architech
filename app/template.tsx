/* Re-mounts per navigation → editorial page-in transition. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-transition">{children}</div>;
}
