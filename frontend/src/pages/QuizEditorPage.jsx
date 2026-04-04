import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';

const TYPE_LABELS = {
  multiple_choice: { label: 'Multiple Choice', icon: '☑️' },
  true_false: { label: 'True / False', icon: '✓✗' },
  word_cloud: { label: 'Word Cloud', icon: '☁️' },
};

const defaultOptions = (type) => {
  if (type === 'true_false') return [{ text: 'True', isCorrect: false }, { text: 'False', isCorrect: false }];
  if (type === 'multiple_choice') return [{ text: '', isCorrect: false }, { text: '', isCorrect: false }];
  return [];
};

const blankQuestion = (type = 'multiple_choice') => ({
  type, text: '', timeLimit: 30, points: 100, options: defaultOptions(type),
});

const isFormValid = (form) => {
  if (!form || !form.text?.trim()) return false;
  if (form.type === 'multiple_choice') {
    const filledOptions = form.options.filter(opt => opt.text?.trim());
    const hasCorrect = form.options.some(opt => opt.isCorrect);
    return filledOptions.length >= 2 && hasCorrect;
  }
  if (form.type === 'true_false') {
    return form.options.some(opt => opt.isCorrect);
  }
  if (form.type === 'word_cloud') {
    return true;
  }
  return false;
};

export default function QuizEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeQ, setActiveQ] = useState(null); // index of question being edited
  const [form, setForm] = useState(null);        // working copy of question
  const [title, setTitle] = useState('');
  const [showAddNextModal, setShowAddNextModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    api.get(`/quiz/${id}`).then(({ data }) => {
      setQuiz(data); setTitle(data.title);
      if (data.questions.length > 0) { setActiveQ(0); setForm(data.questions[0]); }
    }).finally(() => setLoading(false));
    document.title = 'QuiEasy - Quiz Editor';
  }, [id]);

  const saveTitle = () => api.put(`/quiz/${id}`, { title });

  const addQuestion = async (type) => {
    const q = blankQuestion(type);
    const { data } = await api.post(`/quiz/${id}/questions`, q);
    setQuiz(data);
    const idx = data.questions.length - 1;
    setActiveQ(idx); setForm(data.questions[idx]);
  };

  const saveQuestion = async () => {
    if (!isFormValid(form)) return;
    setSaving(true);
    try {
      const qId = quiz.questions[activeQ]._id;
      const { data } = await api.put(`/quiz/${id}/questions/${qId}`, form);
      setQuiz(data);
      setShowAddNextModal(true);
    } finally { setSaving(false); }
  };

  const deleteQuestion = async (idx) => {
    const qId = quiz.questions[idx]._id;
    const { data } = await api.delete(`/quiz/${id}/questions/${qId}`);
    setQuiz(data);
    if (data.questions.length === 0) { setActiveQ(null); setForm(null); }
    else { const next = Math.min(idx, data.questions.length - 1); setActiveQ(next); setForm(data.questions[next]); }
  };

  const updateOption = (i, key, val) => {
    const opts = [...form.options];
    opts[i] = { ...opts[i], [key]: val };
    setForm({ ...form, options: opts });
  };

  const setCorrect = (i) => {
    const opts = form.options.map((o, idx) => ({ ...o, isCorrect: idx === i }));
    setForm({ ...form, options: opts });
  };

  const addOption = () => setForm({ ...form, options: [...form.options, { text: '', isCorrect: false }] });

  const startSession = async () => {
    try {
      const { data } = await api.post('/session', { quizId: quiz._id });
      navigate(`/session/${data.session._id}/present`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start session');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-mesh flex flex-col">
      {/* Top bar */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-border/50 bg-surface/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="btn-ghost px-3 py-2 text-sm">← Dashboard</Link>
          <input className="bg-transparent text-white font-display font-semibold text-lg focus:outline-none border-b border-transparent focus:border-brand-500 px-1 transition-colors"
            value={title} onChange={e => setTitle(e.target.value)} onBlur={saveTitle} />
        </div>
        <div className="flex gap-2">
          <button onClick={saveQuestion} disabled={!form || saving || !isFormValid(form)} className="btn-primary text-sm">
            {saving ? 'Saving…' : '💾 Save Question'}
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — question list */}
        <aside className="w-64 border-r border-border flex flex-col bg-card/50 shrink-0">
          <div className="p-4 border-b border-border">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-3">Add Question</p>
            <div className="space-y-1.5">
              {Object.entries(TYPE_LABELS).map(([type, { label, icon }]) => (
                <button key={type} onClick={() => addQuestion(type)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-brand-500/10 text-slate-300 hover:text-white text-sm flex items-center gap-2 transition-colors">
                  <span>{icon}</span>{label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {quiz?.questions.map((q, i) => (
              <div key={q._id} className={`relative group ${activeQ === i ? 'bg-brand-500/20 text-white border border-brand-500/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'} w-full px-3 py-2.5 rounded-xl text-sm transition-colors`}>
                <button onClick={() => { setActiveQ(i); setForm(q); }} className="w-full text-left">
                  <span className="text-xs text-slate-500 block mb-0.5">Q{i + 1} · {TYPE_LABELS[q.type]?.label}</span>
                  <span className="truncate block">{q.text || 'Untitled question'}</span>
                </button>
                <button onClick={() => deleteQuestion(i)}
                  className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity text-xs">✕</button>
              </div>
            ))}
          </div>
        </aside>

        {/* Main editor */}
        <main className="flex-1 overflow-y-auto p-8">
          {!form ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-5xl mb-4">➕</div>
              <h3 className="text-xl font-display font-semibold text-white mb-2">No questions yet</h3>
              <p className="text-slate-400">Add your first question from the left panel</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
              {/* Type badge */}
              <div className="flex items-center gap-2">
                <span className="badge bg-brand-500/20 text-brand-400 border border-brand-500/30">
                  {TYPE_LABELS[form.type]?.icon} {TYPE_LABELS[form.type]?.label}
                </span>
              </div>

              {/* Question text */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Question</label>
                <textarea className="input resize-none" rows={3} placeholder="Type your question here…"
                  value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} />
              </div>

              {/* Options (MC / TF) */}
              {form.type !== 'word_cloud' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Answer Options <span className="text-slate-500 font-normal">(click radio to mark correct)</span>
                  </label>
                  <div className="space-y-2">
                    {form.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <button onClick={() => setCorrect(i)}
                          className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${opt.isCorrect ? 'bg-green-500 border-green-500' : 'border-slate-500 hover:border-green-400'}`} />
                        <input className="input flex-1" placeholder={`Option ${i + 1}`}
                          value={opt.text} onChange={e => updateOption(i, 'text', e.target.value)}
                          disabled={form.type === 'true_false'} />
                        {form.type === 'multiple_choice' && form.options.length > 2 && (
                          <button onClick={() => removeOption(i)} className="text-slate-500 hover:text-red-400 text-sm transition-colors">✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                  {form.type === 'multiple_choice' && form.options.length < 6 && (
                    <button onClick={addOption} className="btn-ghost text-sm mt-3">+ Add Option</button>
                  )}
                </div>
              )}

              {form.type === 'word_cloud' && (
                <div className="px-4 py-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 text-sm">
                  ☁️ Participants will type a free-form word or phrase. All answers display as a word cloud.
                </div>
              )}

              {/* Settings row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">⏱ Time Limit (seconds)</label>
                  <input className="input" type="number" min={0} max={300}
                    value={form.timeLimit} onChange={e => setForm({ ...form, timeLimit: +e.target.value })} />
                  <p className="text-xs text-slate-500 mt-1">0 = no limit</p>
                </div>
                {form.type !== 'word_cloud' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">🏆 Points</label>
                    <input className="input" type="number" min={0} max={1000} step={50}
                      value={form.points} onChange={e => setForm({ ...form, points: +e.target.value })} />
                  </div>
                )}
              </div>

              <button onClick={saveQuestion} disabled={saving || !isFormValid(form)} className="btn-primary w-full py-3">
                {saving ? 'Saving…' : '💾 Save Question'}
              </button>
            </div>
          )}
        </main>
      </div>

      {showAddNextModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-display font-semibold text-white mb-4">Add Next Question</h3>
            <p className="text-slate-400 mb-6">Choose the type of question you'd like to add next:</p>
            <div className="space-y-3">
              {Object.entries(TYPE_LABELS).map(([type, { label, icon }]) => (
                <button key={type} onClick={() => { addQuestion(type); setShowAddNextModal(false); }}
                  className="w-full text-left px-4 py-3 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-white border border-brand-500/30 hover:border-brand-500/50 transition-colors flex items-center gap-3">
                  <span className="text-lg">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowAddNextModal(false); setShowSuccessModal(true); }} className="btn-ghost flex-1">Done Adding</button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">✅</div>
              <h3 className="text-lg font-display font-semibold text-white">Questions Added!</h3>
              <p className="text-slate-400 text-sm mt-1">Your quiz is ready.</p>
            </div>
            <div className="space-y-3">
              <button onClick={() => { setShowSuccessModal(false); setShowAddNextModal(true); }}
                className="w-full text-left px-4 py-3 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-white border border-brand-500/30 hover:border-brand-500/50 transition-colors flex items-center gap-3">
                <span className="text-lg">➕</span>
                <span>Add More Questions</span>
              </button>
              <button onClick={() => navigate('/dashboard')}
                className="w-full text-left px-4 py-3 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 text-white border border-slate-500/30 hover:border-slate-500/50 transition-colors flex items-center gap-3">
                <span className="text-lg">🏠</span>
                <span>Go to Dashboard</span>
              </button>
              <button onClick={startSession}
                className="w-full text-left px-4 py-3 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-white border border-green-500/30 hover:border-green-500/50 transition-colors flex items-center gap-3">
                <span className="text-lg">▶️</span>
                <span>Start the Quiz</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
