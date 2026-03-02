export function FeedSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-[var(--bg-card)] rounded-xl overflow-hidden"
          style={{ boxShadow: "var(--shadow)" }}
        >
          <div className="skeleton h-44 w-full" />
          <div className="p-5 space-y-3">
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-5 w-3/4" />
            <div className="space-y-2">
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-5/6" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
