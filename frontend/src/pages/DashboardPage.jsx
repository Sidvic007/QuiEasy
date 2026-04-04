import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    api.get('/quiz').then(({ data }) => setQuizzes(data)).finally(() => setLoading(false));
    document.title = 'QuiEasy - Dashboard';
  }, []);

  const createQuiz = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/quiz', { title: newTitle });
      navigate(`/quiz/${data._id}/edit`);
    } catch { setCreating(false); }
  };

  const deleteQuiz = async (id) => {
    if (!window.confirm('Delete this quiz?')) return;
    await api.delete(`/quiz/${id}`);
    setQuizzes(quizzes.filter(q => q._id !== id));
  };

  const startSession = async (quizId) => {
    try {
      const { data } = await api.post('/session', { quizId });
      navigate(`/session/${data.session._id}/present`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start session');
    }
  };

  const COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444'];

  return (
    <div className="min-h-screen bg-mesh">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-border/50 sticky top-0 bg-surface/80 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">Q</span>
          </div>
          <span className="font-display font-bold text-xl text-white">QuiEasy</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/" className="text-slate-400 hover:text-white transition-colors">Welcome, {user.name}</Link>
          <button onClick={logout} className="btn-ghost text-sm">Logout</button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-white">My Quizzes</h1>
            <p className="text-slate-400 mt-1">{quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''} created</p>
          </div>
          <button onClick={() => setShowNew(true)} className="btn-primary">
            + New Quiz
          </button>
        </div>

        {/* New quiz modal */}
        {showNew && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-md animate-slide-up">
              <h2 className="text-xl font-display font-bold text-white mb-4">Create New Quiz</h2>
              <input className="input mb-4" placeholder="Quiz title…" value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createQuiz()} autoFocus />
              <div className="flex gap-3">
                <button className="btn-ghost flex-1" onClick={() => setShowNew(false)}>Cancel</button>
                <button className="btn-primary flex-1" onClick={createQuiz} disabled={creating || !newTitle.trim()}>
                  {creating ? 'Creating…' : 'Create & Edit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quiz grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-xl font-display font-semibold text-white mb-2">No quizzes yet</h3>
            <p className="text-slate-400 mb-6">Create your first quiz to get started</p>
            <button onClick={() => setShowNew(true)} className="btn-primary">Create Quiz</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {quizzes.map((quiz, i) => (
              <div key={quiz._id} className="card hover:border-brand-500/50 transition-all group">
                {/* Color bar */}
                <div className="h-2 rounded-full mb-4" style={{ background: quiz.coverColor || COLORS[i % COLORS.length] }} />
                <h3 className="font-display font-semibold text-white text-lg mb-1 truncate">{quiz.title}</h3>
                <p className="text-slate-400 text-sm mb-4">
                  {quiz.questions?.length || 0} question{quiz.questions?.length !== 1 ? 's' : ''}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Link to={`/quiz/${quiz._id}/edit`} className="btn-ghost text-xs px-3 py-1.5">✏️ Edit</Link>
                  <button onClick={() => startSession(quiz._id)} className="btn-primary text-xs px-3 py-1.5">▶ Start</button>
                  <button onClick={() => deleteQuiz(quiz._id)} className="btn-danger text-xs px-3 py-1.5">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
