import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import LiveBarChart from '../components/shared/LiveBarChart';
import WordCloud from '../components/shared/WordCloud';

export default function ResultsPage() {
  const { sessionId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/session/${sessionId}/results`).then(({ data }) => setData(data)).finally(() => setLoading(false));
    document.title = 'QuiEasy - Results';
  }, [sessionId]);

  const exportCSV = () => {
    if (!data) return;
    const rows = [['Question', 'Type', 'Option/Word', 'Count']];
    data.results.forEach(r => {
      Object.entries(r.aggregated).forEach(([key, count]) => {
        rows.push([r.question.text, r.question.type, key, count]);
      });
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'results.csv'; a.click();
  };

  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data) return <div className="min-h-screen bg-surface flex items-center justify-center text-slate-400">Results not found</div>;

  const { session, results, leaderboard } = data;

  return (
    <div className="min-h-screen bg-mesh">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-surface/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="btn-ghost text-sm px-3 py-2">← Dashboard</Link>
          <h1 className="font-display font-bold text-white">{session?.quiz?.title} — Results</h1>
        </div>
        <button onClick={exportCSV} className="btn-ghost text-sm">📥 Export CSV</button>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Participants', value: session.participants?.length || 0, icon: '👥' },
            { label: 'Questions', value: results.length, icon: '❓' },
            { label: 'Total Responses', value: results.reduce((a, r) => a + r.totalResponses, 0), icon: '✅' },
          ].map(s => (
            <div key={s.label} className="card text-center">
              <div className="text-3xl mb-2">{s.icon}</div>
              <div className="text-3xl font-display font-bold text-white">{s.value}</div>
              <div className="text-slate-400 text-sm">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="card">
            <h2 className="text-xl font-display font-bold text-white mb-4">🏆 Final Leaderboard</h2>
            <div className="space-y-2">
              {leaderboard.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: i === 0 ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)', border: i === 0 ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent' }}>
                  <span className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#c2772a' : '#2a2a45', color: i < 3 ? '#0f0f1a' : '#94a3b8' }}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-white font-medium">{p.name}</span>
                  <span className="text-brand-400 font-mono font-bold">{p.score} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-question results */}
        {results.map((r, i) => (
          <div key={i} className="card animate-fade-in">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="badge bg-brand-500/20 text-brand-400 border border-brand-500/20 text-xs mb-2 inline-block">
                  Q{i + 1} · {r.question.type.replace('_', ' ')}
                </span>
                <h3 className="font-display font-semibold text-white text-lg">{r.question.text}</h3>
              </div>
              <span className="text-slate-400 text-sm ml-4 flex-shrink-0">{r.totalResponses} response{r.totalResponses !== 1 ? 's' : ''}</span>
            </div>
            {r.question.type === 'word_cloud' ? (
              <WordCloud words={r.aggregated} />
            ) : (
              <div className="h-48">
                <LiveBarChart
                  aggregated={r.aggregated}
                  correctOption={r.question.options?.find(o => o.isCorrect)?.text}
                />
              </div>
            )}
          </div>
        ))}

        {results.length === 0 && (
          <div className="text-center py-16 text-slate-500">No responses were recorded for this session.</div>
        )}
      </div>
    </div>
  );
}
