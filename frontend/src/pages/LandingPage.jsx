import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

export default function LandingPage() {
  const { user, logout } = useAuth();

  useEffect(() => {
    document.title = 'QuiEasy — Live Interactive Quizzes';
  }, []);

  return (
    <div className="min-h-screen bg-mesh flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">Q</span>
          </div>
          <span className="font-display font-bold text-xl text-white">QuiEasy</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-slate-400">Welcome, {user.name}</span>
              <Link to="/dashboard" className="btn-ghost text-sm">Dashboard</Link>
              <button onClick={logout} className="btn-ghost text-sm">Logout</button>
            </>
          ) : (
            <>
              <Link to="/join" className="btn-ghost text-sm">Join Session</Link>
              <Link to="/login" className="btn-ghost text-sm">Login</Link>
              <Link to="/signup" className="btn-primary text-sm">Get Started</Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center py-24">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-500 text-sm font-medium mb-8 animate-fade-in">
          <span className="w-2 h-2 bg-brand-500 rounded-full animate-pulse"></span>
          Real-time interactive presentations
        </div>

        <h1 className="text-6xl md:text-7xl font-display font-bold text-white leading-tight mb-6 animate-slide-up">
          Engage your<br />
          <span className="gradient-text">audience live</span>
        </h1>

        <p className="text-xl text-slate-400 max-w-2xl mb-12 leading-relaxed animate-slide-up" style={{animationDelay:'0.1s'}}>
          Create interactive quizzes, polls, and word clouds. Participants join with a code — no login required.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 animate-slide-up" style={{animationDelay:'0.2s'}}>
          <Link to="/signup" className="btn-primary text-base px-8 py-3.5">
            Create a Quiz — Free
          </Link>
          <Link to="/join" className="btn-ghost text-base px-8 py-3.5">
            Join with Code
          </Link>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-4xl w-full animate-fade-in" style={{animationDelay:'0.3s'}}>
          {[
            { icon: '⚡', title: 'Instant responses', desc: 'Results update in real-time as participants answer.' },
            { icon: '📊', title: 'Live charts', desc: 'Beautiful bar charts and word clouds auto-refresh.' },
            { icon: '🏆', title: 'Leaderboard', desc: 'Speed-based scoring keeps participants engaged.' },
          ].map(f => (
            <div key={f.title} className="card text-left">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-display font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-slate-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
