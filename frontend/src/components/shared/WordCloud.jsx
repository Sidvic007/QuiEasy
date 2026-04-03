/**
 * WordCloud — CSS-based word cloud visualization
 * Sizes words proportionally to their frequency
 */
export default function WordCloud({ words = {} }) {
  const entries = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 40);
  if (entries.length === 0) return (
    <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No responses yet</div>
  );

  const maxCount = entries[0][1];
  const COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#a78bfa','#38bdf8','#34d399'];

  return (
    <div className="flex flex-wrap gap-3 items-center justify-center p-6 min-h-40">
      {entries.map(([word, count], i) => {
        const ratio = count / maxCount;
        const size = 14 + Math.round(ratio * 32); // 14px–46px
        return (
          <span key={word}
            className="transition-all duration-500 font-display font-semibold cursor-default select-none"
            style={{
              fontSize: `${size}px`,
              color: COLORS[i % COLORS.length],
              opacity: 0.7 + ratio * 0.3,
            }}
            title={`${word}: ${count}`}>
            {word}
          </span>
        );
      })}
    </div>
  );
}
