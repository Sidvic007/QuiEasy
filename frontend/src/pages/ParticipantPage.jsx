import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { connectSocket, disconnectSocket } from '../utils/socket';
import LiveBarChart from '../components/shared/LiveBarChart';

const OPTION_COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444'];

export default function ParticipantPage() {
  const { sessionId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const [status, setStatus] = useState('connecting'); // connecting|lobby|question|answered|results|ended
  const [sessionInfo, setSessionInfo] = useState(null);
  const [question, setQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [wordInput, setWordInput] = useState('');
  const [pointsEarned, setPointsEarned] = useState(null);
  const [totalScore, setTotalScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [timeLimit, setTimeLimit] = useState(null);
  const [questionStartedAt, setQuestionStartedAt] = useState(null);
  const [error, setError] = useState('');
  const [winner, setWinner] = useState(null);
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);
  const timerRef = useRef(null);

  const name = state?.name;
  const joinCode = state?.joinCode;

  useEffect(() => {
    if (!name || !joinCode) { navigate('/join'); return; }

    document.title = 'QuiEasy - Participant';

    const socket = connectSocket();
    socketRef.current = socket;

    socket.emit('participant:join', { joinCode, name });
    console.log('Emitted participant:join with:', { joinCode, name });

    socket.on('session:joined', ({ session }) => {
      console.log('Session joined event received:', session);
      console.log('Session status:', session.status);
      setSessionInfo(session);
      setStatus(session.status === 'active' ? 'question' : 'lobby');
    });

    socket.on('connect', () => {
      console.log('Socket connected successfully');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socket.on('question:started', ({ question, questionIndex, totalQuestions, timeLimit, startedAt }) => {
      console.log('Question started event received:', { question, questionIndex, totalQuestions, timeLimit, startedAt });
      setQuestion(question);
      setQuestionIndex(questionIndex);
      setTotalQuestions(totalQuestions);
      setAnswered(false);
      setSelectedAnswer(null);
      setWordInput('');
      setPointsEarned(null);
      setTimeLimit(timeLimit);
      setQuestionStartedAt(startedAt);
      setStatus('question');
      startTimer(timeLimit, startedAt);
    });

    socket.on('question:timeup', () => {
      clearInterval(timerRef.current);
      setTimeLeft(0);
      if (!answered) setStatus('answered');
    });

    socket.on('results:revealed', ({ leaderboard }) => {
      setStatus('results');
    });

    socket.on('answer:accepted', ({ pointsEarned: pts }) => {
      setPointsEarned(pts);
      setTotalScore(prev => prev + pts);
    });

    socket.on('session:ended', ({ winner, leaderboard, yourScore }) => {
      clearInterval(timerRef.current);
      if (typeof yourScore === 'number') setTotalScore(yourScore);
      setWinner(winner);
      setFinalLeaderboard(Array.isArray(leaderboard) ? leaderboard : []);
      setStatus('ended');
    });

    socket.on('error', ({ message }) => setError(message));

    return () => {
      clearInterval(timerRef.current);
      disconnectSocket();
    };
  }, []);

  const startTimer = (limit, startedAt) => {
    clearInterval(timerRef.current);
    if (!limit || limit <= 0) { setTimeLeft(null); return; }
    const update = () => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, Math.ceil(limit - elapsed));
      setTimeLeft(left);
      if (left <= 0) clearInterval(timerRef.current);
    };
    update();
    timerRef.current = setInterval(update, 500);
  };

  const submitAnswer = (answer) => {
    if (answered) return;
    const responseTime = Date.now() - questionStartedAt;
    socketRef.current.emit('participant:answer', { sessionId, answer, responseTime });
    setSelectedAnswer(answer);
    setAnswered(true);
    setStatus('answered');
    clearInterval(timerRef.current);
  };

  const submitWord = () => {
    if (!wordInput.trim() || answered) return;
    submitAnswer(wordInput.trim());
  };

  // ── Screens ───────────────────────────────────────────────────────────────
  if (status === 'connecting') return <Screen><Spinner /><p className="text-slate-400 mt-4">Connecting…</p></Screen>;

  if (status === 'lobby') return (
    <Screen>
      <div className="text-center animate-slide-up">
        <div className="w-16 h-16 rounded-2xl bg-brand-500/20 flex items-center justify-center mx-auto mb-6 border border-brand-500/30">
          <span className="text-3xl">🎯</span>
        </div>
        <h2 className="text-2xl font-display font-bold text-white mb-2">{sessionInfo?.quiz?.title}</h2>
        <p className="text-slate-400 mb-6">You're in! Waiting for the presenter to start…</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Joined as <strong>{name}</strong>
        </div>
        {error && <p className="text-red-400 mt-4 text-sm">{error}</p>}
      </div>
    </Screen>
  );

  if (status === 'ended') return (
    <Screen>
      <div className="text-center animate-slide-up">
        <div className="text-6xl mb-4">🏁</div>
        <h2 className="text-2xl font-display font-bold text-white mb-2">Quiz Over!</h2>
        <p className="text-slate-400 mb-6">Thanks for playing, <strong className="text-white">{name}</strong>!</p>
        <div className="card inline-block px-8 py-4 mb-6">
          <p className="text-slate-400 text-sm">Your total score</p>
          <p className="text-4xl font-display font-bold gradient-text">{totalScore} pts</p>
        </div>
        {winner && (
          <div className="card inline-block px-8 py-4 mb-6">
            <p className="text-slate-400 text-sm">The winner is</p>
            <p className="text-2xl font-display font-bold text-yellow-400">{winner.name} with {winner.score} points!</p>
          </div>
        )}
        {finalLeaderboard.length > 0 && (
          <div className="max-w-xl mx-auto text-left mb-6">
            <p className="text-slate-400 text-sm mb-3">Final leaderboard</p>
            <LiveBarChart data={finalLeaderboard.map(p => ({ label: p.name, value: p.score }))} isScoreChart />
          </div>
        )}
        <button onClick={() => navigate('/join')} className="btn-primary">Join Another Session</button>
      </div>
    </Screen>
  );

  if (!question) return <Screen><Spinner /></Screen>;

  const progressPct = totalQuestions > 0 ? ((questionIndex + 1) / totalQuestions) * 100 : 0;

  return (
    <div className="min-h-screen bg-mesh flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-border">
        <div className="h-full bg-brand-500 transition-all duration-700" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
        <span className="text-slate-400 text-sm">Q{questionIndex + 1}/{totalQuestions}</span>
        <span className="font-display font-semibold text-white">{name}</span>
        <span className="text-brand-400 text-sm font-medium">{totalScore} pts</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {/* Timer */}
          {timeLeft !== null && (
            <div className={`text-center mb-6 ${timeLeft <= 5 ? 'text-red-400' : 'text-slate-400'}`}>
              <div className={`text-4xl font-display font-bold mb-1 ${timeLeft <= 5 ? 'animate-pulse' : ''}`}>{timeLeft}</div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${timeLeft <= 5 ? 'bg-red-500' : 'bg-brand-500'}`}
                  style={{ width: `${timeLimit > 0 ? (timeLeft / timeLimit) * 100 : 100}%` }} />
              </div>
            </div>
          )}

          {/* Question */}
          <div className="card mb-6 text-center animate-slide-up">
            <p className="text-xl font-display font-semibold text-white leading-relaxed">{question.text}</p>
          </div>

          {/* Answered state */}
          {status === 'answered' && (
            <div className="text-center animate-fade-in">
              <div className="card inline-block px-8 py-4 mb-4">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-white font-medium">Answer submitted!</p>
                {pointsEarned !== null && (
                  <p className="text-brand-400 font-display font-bold text-2xl mt-1">+{pointsEarned} pts</p>
                )}
              </div>
              <p className="text-slate-400 text-sm">Waiting for results…</p>
            </div>
          )}

          {/* Question options */}
          {status === 'question' && (
            <>
              {question.type === 'word_cloud' ? (
                <div className="space-y-3 animate-slide-up">
                  <input className="input text-center text-lg" placeholder="Type your answer…"
                    value={wordInput} onChange={e => setWordInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitWord()} autoFocus />
                  <button onClick={submitWord} disabled={!wordInput.trim()} className="btn-primary w-full py-3">
                    Submit Answer
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {question.options && question.options.length > 0 ? (
                    question.options.map((opt, i) => (
                      <button key={i} onClick={() => submitAnswer(i)}
                        className="w-full px-5 py-4 rounded-2xl text-white font-medium text-left transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] flex items-center gap-3"
                        style={{ background: OPTION_COLORS[i % OPTION_COLORS.length] + '22', border: `2px solid ${OPTION_COLORS[i % OPTION_COLORS.length]}44` }}>
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ background: OPTION_COLORS[i % OPTION_COLORS.length] }}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        {opt.text}
                      </button>
                    ))
                  ) : (
                    <div className="text-center text-red-400">
                      No options available for this question
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {status === 'results' && (
            <div className="text-center animate-fade-in">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-white font-medium">The presenter is showing results…</p>
              <p className="text-slate-400 text-sm mt-1">Next question coming up!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Screen({ children }) {
  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center px-4">
      <div className="text-center">{children}</div>
    </div>
  );
}

function Spinner() {
  return <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />;
}
