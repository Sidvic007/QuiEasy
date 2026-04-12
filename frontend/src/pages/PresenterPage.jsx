import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../utils/api';
import { connectSocket, disconnectSocket } from '../utils/socket';
import LiveBarChart from '../components/shared/LiveBarChart';
import WordCloud from '../components/shared/WordCloud';

export default function PresenterPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const token = sessionStorage.getItem('token');

  const [session, setSession] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [status, setStatus] = useState('loading'); // loading|waiting|active|ended
  const [currentQ, setCurrentQ] = useState(null);

  const normalizeName = (name) => String(name || '').trim().toLowerCase();
  const dedupeParticipants = (participants = []) => {
    const seen = new Set();
    return participants.filter((p) => {
      const key = normalizeName(p.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const [questionIndex, setQuestionIndex] = useState(-1);
  const [participants, setParticipants] = useState([]);
  const [aggregated, setAggregated] = useState({});
  const [responseCount, setResponseCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [showQR, setShowQR] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // Load session
    api.get(`/session/${sessionId}`).then(({ data }) => {
      setSession(data);
      setQuiz(data.quiz);
      setParticipants(dedupeParticipants(data.participants || []));
      setStatus(data.status);
    });

    document.title = 'QuiEasy - Presenter';

    const socket = connectSocket();
    socketRef.current = socket;
    socket.emit('host:join', { sessionId, token });

    socket.on('session:updated', ({ session }) => {
      setSession(session);
      setStatus(session.status);

      const uniqueParticipants = (session.participants || []).reduce((acc, p) => {
        const normalized = p.name?.trim().toLowerCase();
        if (!normalized) return acc;
        if (!acc.some((x) => x.name.trim().toLowerCase() === normalized)) {
          acc.push({ ...p, name: p.name.trim() });
        }
        return acc;
      }, []);
      setParticipants(uniqueParticipants);
    });

    socket.on('participant:joined', ({ name, participantCount }) => {
      const cleanName = name?.trim();
      if (!cleanName) return;
      setParticipants(prev => {
        if (prev.some(p => p.name.trim().toLowerCase() === cleanName.toLowerCase())) return prev;
        return [...prev, { name: cleanName, score: 0 }];
      });
    });

    socket.on('question:started', ({ question, questionIndex, timeLimit, startedAt }) => {
      setCurrentQ(question);
      setQuestionIndex(questionIndex);
      setAggregated({});
      setResponseCount(0);
      setRevealed(false);
      setStatus('active');
      startTimer(timeLimit, startedAt);
    });

    socket.on('results:live', ({ aggregated, responseCount }) => {
      setAggregated(aggregated);
      setResponseCount(responseCount);
    });

    socket.on('results:revealed', ({ aggregated, leaderboard }) => {
      setAggregated(aggregated);
      setLeaderboard(leaderboard || []);
      setRevealed(true);
      clearInterval(timerRef.current);
    });

    socket.on('question:timeup', () => {
      clearInterval(timerRef.current);
      setTimeLeft(0);
    });

    socket.on('session:ended', () => {
      clearInterval(timerRef.current);
      setStatus('ended');
      navigate(`/session/${sessionId}/results`);
    });

    return () => { clearInterval(timerRef.current); disconnectSocket(); };
  }, [sessionId]);

  const startTimer = (limit, startedAt) => {
    clearInterval(timerRef.current);
    if (!limit || limit <= 0) { setTimeLeft(null); return; }
    const update = () => {
      const left = Math.max(0, Math.ceil(limit - (Date.now() - startedAt) / 1000));
      setTimeLeft(left);
      if (left <= 0) clearInterval(timerRef.current);
    };
    update();
    timerRef.current = setInterval(update, 500);
  };

  const startQuiz = () => socketRef.current?.emit('host:start', { sessionId });
  const nextQuestion = () => socketRef.current?.emit('host:next', { sessionId });
  const revealResults = () => socketRef.current?.emit('host:reveal', { sessionId });
  const endSession = () => { socketRef.current?.emit('host:end', { sessionId }); };

  const joinUrl = `${window.location.origin}/join/${session?.joinCode}`;
  const correctOption = currentQ?.type !== 'word_cloud'
    ? quiz?.questions[questionIndex]?.options?.find(o => o.isCorrect)?.text
    : null;

  const chartData = revealed
    ? leaderboard.map((p) => ({ label: p.name, value: p.score }))
    : Object.entries(aggregated).map(([label, value]) => ({ label, value }));

  if (status === 'loading') return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-mesh flex flex-col">
      {/* Top bar */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-border/50 bg-surface/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="btn-ghost text-sm px-3 py-2">← Dashboard</Link>
          <div>
            <span className="font-display font-semibold text-white">{quiz?.title}</span>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {participants.length} participant{participants.length !== 1 ? 's' : ''}
              </span>
              {session?.joinCode && (
                <span className="text-xs text-brand-400 font-mono font-bold tracking-widest">{session.joinCode}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowQR(!showQR)} className="btn-ghost text-sm">QR Code</button>
          {status === 'waiting' && (
            <button onClick={startQuiz} disabled={participants.length === 0} className="btn-primary">
              ▶ Start Quiz
            </button>
          )}
          {status === 'active' && (
            <>
              {!revealed ? (
                <button onClick={revealResults} className="btn-ghost text-sm">Show Results</button>
              ) : (
                <button onClick={nextQuestion} className="btn-primary">
                  {questionIndex + 1 >= (quiz?.questions?.length || 0) - 1 ? '🏁 End Quiz' : 'Next →'}
                </button>
              )}
            </>
          )}
          <button onClick={endSession} className="btn-danger text-sm">End Session</button>
        </div>
      </nav>

      {/* QR Modal */}
      {showQR && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowQR(false)}>
          <div className="card p-8 text-center animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-bold text-white text-xl mb-4">Scan to Join</h3>
            <div className="bg-white p-4 rounded-2xl inline-block mb-4">
              <QRCodeSVG value={joinUrl} size={200} />
            </div>
            <p className="text-slate-400 text-sm">or go to <strong className="text-white">mentis.app/join</strong></p>
            <p className="text-3xl font-display font-bold gradient-text mt-2 tracking-widest">{session?.joinCode}</p>
            <button className="btn-ghost mt-4 text-sm" onClick={() => setShowQR(false)}>Close</button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-8">
          {/* Waiting lobby */}
          {status === 'waiting' && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-slide-up">
              <div className="text-6xl mb-6">🎯</div>
              <h2 className="text-3xl font-display font-bold text-white mb-2">Waiting for participants</h2>
              <p className="text-slate-400 mb-8">Share the code below or scan the QR code</p>
              <div className="card px-12 py-6 mb-6">
                <p className="text-slate-400 text-sm mb-2">Join code</p>
                <p className="text-6xl font-display font-bold gradient-text tracking-[0.3em]">{session?.joinCode}</p>
                <p className="text-slate-500 text-sm mt-2">{joinUrl}</p>
              </div>
              <p className="text-slate-400">
                {participants.length === 0
                  ? 'No participants yet — waiting…'
                  : `${participants.length} participant${participants.length !== 1 ? 's' : ''} ready!`}
              </p>
            </div>
          )}

          {/* Active question */}
          {status === 'active' && currentQ && (
            <div className="max-w-3xl mx-auto animate-fade-in">
              {/* Progress + timer */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400 text-sm">Question {questionIndex + 1} of {quiz?.questions?.length}</span>
                {timeLeft !== null && (
                  <span className={`text-2xl font-display font-bold ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                    ⏱ {timeLeft}s
                  </span>
                )}
                <span className="text-slate-400 text-sm">{responseCount}/{participants.length} answered</span>
              </div>

              {/* Progress bar */}
              <div className="h-1 bg-border rounded-full mb-6 overflow-hidden">
                <div className="h-full bg-brand-500 transition-all duration-300"
                  style={{ width: `${participants.length > 0 ? (responseCount / participants.length) * 100 : 0}%` }} />
              </div>

              {/* Question card */}
              <div className="card mb-6">
                <span className="badge bg-brand-500/20 text-brand-400 border border-brand-500/20 mb-3 text-xs">
                  {currentQ.type === 'word_cloud' ? '☁️ Word Cloud' : currentQ.type === 'true_false' ? '✓✗ True/False' : '☑️ Multiple Choice'}
                </span>
                <h2 className="text-2xl font-display font-semibold text-white">{currentQ.text}</h2>
              </div>

              {/* Live chart */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-white">
                    {revealed ? 'Scores' : 'Live Results'}
                  </h3>
                  {revealed && correctOption && (
                    <span className="badge bg-green-500/20 text-green-400 border border-green-500/20">
                      ✅ Correct: {correctOption}
                    </span>
                  )}
                </div>
                {currentQ.type === 'word_cloud' ? (
                  <WordCloud words={aggregated} />
                ) : (
                  <LiveBarChart data={chartData} isScoreChart={revealed} correctOption={!revealed ? correctOption : null} />
                )}
                {chartData.length === 0 && (
                  <p className="text-slate-500 text-center py-8 text-sm">Waiting for responses…</p>
                )}
              </div>

              {/* Leaderboard after reveal */}
              {revealed && leaderboard.length > 0 && (
                <div className="card mt-6">
                  <h3 className="font-display font-semibold text-white mb-4">🏆 Leaderboard</h3>
                  <div className="space-y-2">
                    {leaderboard.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#c2772a' : '#2a2a45', color: i < 3 ? '#0f0f1a' : '#94a3b8' }}>
                          {i + 1}
                        </span>
                        <span className="flex-1 text-white text-sm">{p.name}</span>
                        <span className="text-brand-400 font-mono text-sm font-semibold">{p.score} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {status === 'ended' && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-6xl mb-4">🏁</div>
              <h2 className="text-3xl font-display font-bold text-white mb-2">Session Ended</h2>
              <p className="text-slate-400 mb-6">Great session! Check out the full results.</p>
              <Link to={`/session/${sessionId}/results`} className="btn-primary text-base px-8 py-3">
                View Full Results →
              </Link>
            </div>
          )}
        </main>

        {/* Participants sidebar */}
        <aside className="w-56 border-l border-border bg-card/50 flex flex-col">
          <div className="p-4 border-b border-border">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Participants ({participants.length})</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {participants.map((p, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-brand-500/30 flex items-center justify-center text-xs text-brand-400 font-bold flex-shrink-0">
                  {p.name[0]?.toUpperCase()}
                </div>
                <span className="text-slate-300 text-sm truncate">{p.name}</span>
              </div>
            ))}
            {participants.length === 0 && (
              <p className="text-slate-500 text-xs text-center py-4">Waiting for participants…</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
