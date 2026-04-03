import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';

export default function JoinPage() {
  const { code: paramCode } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(paramCode || '');
  const [name, setName] = useState('');
  const [step, setStep] = useState(paramCode ? 'name' : 'code'); // code | name
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // Load session when direct link is used (paramCode in URL)
  useEffect(() => {
    if (paramCode) {
      const loadSession = async () => {
        setLoading(true);
        setError('');
        try {
          const { data } = await api.get(`/session/join/${paramCode.toUpperCase()}`);
          setSession(data);
        } catch (err) {
          setError(err.response?.data?.message || 'Session not found');
          setStep('code');
        } finally {
          setLoading(false);
        }
      };
      loadSession();
    }
  }, [paramCode]);

  const lookupCode = async () => {
    if (!code.trim()) return;
    setLoading(true); setError(''); setInfo('');
    try {
      const { data } = await api.get(`/session/join/${code.trim().toUpperCase()}`);
      setSession(data);
      setStep('name');
    } catch (err) {
      setError(err.response?.data?.message || 'Session not found');
    } finally { setLoading(false); }
  };

  const joinSession = () => {
    if (!name.trim()) return;
    if (session?.participants?.some((p) => p.name?.trim().toLowerCase() === name.trim().toLowerCase())) {
      setInfo('You are already in this session, reconnecting...');
    } else {
      setInfo('Joining session...');
    }
    setError('');
    // Pass name + sessionId via state to the participant page
    navigate(`/session/${session._id}/participate`, { state: { name: name.trim(), joinCode: code.toUpperCase() } });
  };

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">Q</span>
            </div>
            <span className="font-display font-bold text-xl text-white">QuiEasy</span>
          </Link>
          <h1 className="text-3xl font-display font-bold text-white">Join a Session</h1>
          <p className="text-slate-400 mt-2">Enter the code shown by your presenter</p>
        </div>

        <div className="card">
          {step === 'code' ? (
            <div className="space-y-4">
              {error && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
              {!error && info && <div className="px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">{info}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Session Code</label>
                <input className="input text-2xl tracking-[0.5em] text-center font-display uppercase" maxLength={6}
                  placeholder="XXXXXX" value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && lookupCode()} />
              </div>
              <button onClick={lookupCode} disabled={loading || !code.trim()} className="btn-primary w-full py-3">
                {loading ? 'Looking up…' : 'Find Session →'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {session && (
                <div className="px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
                  ✅ Joining: <strong>{session.quiz?.title}</strong>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Your Display Name</label>
                <input className="input text-lg" placeholder="Enter your name…" value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && joinSession()} autoFocus />
              </div>
              <button onClick={joinSession} disabled={!name.trim()} className="btn-primary w-full py-3">
                Join Now 🎉
              </button>
              <button onClick={() => setStep('code')} className="btn-ghost w-full text-sm">← Change Code</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
