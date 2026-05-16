export function FeedSkeleton() {
  return (
    <div className="space-y-7">
      {Array.from({ length: 3 }).map((_, i) => (
        <article key={i}>
          {/* Hero-style image block for the first card */}
          {i === 0 && (
            <div
              className="skeleton"
              style={{ height: 320, width: "100%", borderRadius: 2 }}
            />
          )}
          <div className="space-y-3" style={{ paddingTop: i === 0 ? 16 : 0 }}>
            <div
              className="skeleton"
              style={{ height: 8, width: 80, borderRadius: 1 }}
            />
            <div
              className="skeleton"
              style={{ height: i === 0 ? 28 : 22, width: "85%", borderRadius: 2 }}
            />
            <div className="space-y-2">
              <div className="skeleton" style={{ height: 10, width: "100%" }} />
              <div className="skeleton" style={{ height: 10, width: "92%" }} />
              <div className="skeleton" style={{ height: 10, width: "70%" }} />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
