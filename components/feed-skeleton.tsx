export function FeedSkeleton({ isNight }: { isNight?: boolean }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`rounded-xl overflow-hidden backdrop-blur-xl border ${
            isNight
              ? "bg-indigo-950/40 border-white/10 shadow-lg shadow-indigo-950/20"
              : "bg-white/60 border-white/30 shadow-lg shadow-black/5"
          }`}
        >
          <div className="skeleton h-24 w-full" />
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
