type LoadingSkeletonProps = { className?: string; label?: string };

export default function LoadingSkeleton({ className = "", label = "Loading" }: LoadingSkeletonProps) {
  return <span role="status" aria-label={label} className={`skeleton block rounded-lg ${className}`} />;
}
