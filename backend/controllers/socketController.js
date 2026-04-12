/**
 * Socket Controller
 * All real-time events for presenter and participant interactions.
 *
 * Events (presenter → server):
 *   host:join         — presenter joins session room
 *   host:start        — start quiz from lobby
 *   host:next         — advance to next question
 *   host:reveal       — reveal results for current question
 *   host:end          — end the session
 *
 * Events (participant → server):
 *   participant:join   — join session with name
 *   participant:answer — submit answer for current question
 *
 * Events (server → clients):
 *   session:updated    — session state changed
 *   question:started   — new question is live
 *   results:live       — live result update (every answer)
 *   results:revealed   — host revealed results
 *   session:ended      — quiz is over
 *   participant:joined — broadcast new participant to host
 */

const Session = require('../models/Session');
const Quiz = require('../models/Quiz');
const Response = require('../models/Response');
const jwt = require('jsonwebtoken');

// In-memory: roomCode → { questionStartedAt, timerHandles }
const roomMeta = {};

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

const registerSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ─── HOST JOINS SESSION ROOM ──────────────────────────────────────────
    socket.on('host:join', async ({ sessionId, token }) => {
      try {
        // Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'changeme_secret');
        const session = await Session.findById(sessionId).populate('quiz');
        if (!session || String(session.host) !== String(decoded.id)) {
          return socket.emit('error', { message: 'Unauthorized' });
        }

        socket.join(session.joinCode);
        socket.data.role = 'host';
        socket.data.sessionId = sessionId;
        socket.data.joinCode = session.joinCode;
        if (!roomMeta[session.joinCode]) roomMeta[session.joinCode] = {};
        roomMeta[session.joinCode].hostSocketId = socket.id;
        socket.emit('session:updated', { session });
        console.log(`👑 Host joined room ${session.joinCode}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ─── PARTICIPANT JOINS SESSION ────────────────────────────────────────
    socket.on('participant:join', async ({ joinCode, name }) => {
      try {
        const session = await Session.findOne({
          joinCode: joinCode.toUpperCase(),
          status: { $in: ['waiting', 'active'] },
        }).populate('quiz', 'title description coverColor questions');

        if (!session) {
          return socket.emit('error', { message: 'Session not found or ended' });
        }

        // Normalize name to avoid duplicates by case/whitespace
        const cleanName = name?.trim();
        if (!cleanName) {
          return socket.emit('error', { message: 'Name is required' });
        }

        const normalized = normalizeName(cleanName);
        const exists = session.participants.find((p) => normalizeName(p.name) === normalized);

        if (!exists) {
          session.participants.push({ socketId: socket.id, name: cleanName, score: 0 });
        } else {
          // Update socket id on reconnect and keep canonical name
          exists.socketId = socket.id;
          exists.name = cleanName;
        }

        // Ensure session participants are unique after any update ignoring case/spacing
        session.participants = dedupeParticipants(session.participants);

        await session.save();

        socket.join(joinCode.toUpperCase());
        socket.data.role = 'participant';
        socket.data.name = name;
        socket.data.joinCode = joinCode.toUpperCase();
        socket.data.sessionId = String(session._id);

        // Tell participant current state
        socket.emit('session:joined', {
          session: {
            _id: session._id,
            status: session.status,
            currentQuestionIndex: session.currentQuestionIndex,
            resultsRevealed: session.resultsRevealed,
            quiz: {
              title: session.quiz.title,
              description: session.quiz.description,
              coverColor: session.quiz.coverColor,
              questionCount: session.quiz.questions.length,
            },
          },
          participantCount: session.participants.length,
        });

        // Notify host
        io.to(joinCode.toUpperCase()).emit('participant:joined', {
          name,
          participantCount: session.participants.length,
        });

        // If session is already active, send current question
        if (session.status === 'active' && session.currentQuestionIndex >= 0) {
          const q = session.quiz.questions[session.currentQuestionIndex];
          socket.emit('question:started', {
            question: sanitizeQuestion(q),
            questionIndex: session.currentQuestionIndex,
            totalQuestions: session.quiz.questions.length,
            timeLimit: q.timeLimit,
            startedAt: roomMeta[session.joinCode]?.questionStartedAt || Date.now(),
          });
        }

        console.log(`👤 ${name} joined room ${joinCode}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ─── HOST STARTS QUIZ ────────────────────────────────────────────────
    socket.on('host:start', async ({ sessionId }) => {
      try {
        const session = await Session.findById(sessionId).populate('quiz');
        if (!session) return socket.emit('error', { message: 'Session not found' });

        session.status = 'active';
        session.currentQuestionIndex = 0;
        session.resultsRevealed = false;
        session.startedAt = new Date();
        await session.save();

        const q = session.quiz.questions[0];
        const startedAt = Date.now();
        if (!roomMeta[session.joinCode]) roomMeta[session.joinCode] = {};
        roomMeta[session.joinCode].questionStartedAt = startedAt;

        io.to(session.joinCode).emit('question:started', {
          question: sanitizeQuestion(q),
          questionIndex: 0,
          totalQuestions: session.quiz.questions.length,
          timeLimit: q.timeLimit,
          startedAt,
        });

        // Start timer if applicable
        startTimer(io, session, 0, q.timeLimit);
        console.log(`▶️  Session ${session.joinCode} started`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ─── HOST ADVANCES TO NEXT QUESTION ─────────────────────────────────
    socket.on('host:next', async ({ sessionId }) => {
      try {
        const session = await Session.findById(sessionId).populate('quiz');
        if (!session) return socket.emit('error', { message: 'Session not found' });

        clearTimer(session.joinCode);

        const nextIndex = session.currentQuestionIndex + 1;
        if (nextIndex >= session.quiz.questions.length) {
          // No more questions — end session
          session.status = 'ended';
          session.endedAt = new Date();
          await session.save();

          const leaderboard = await buildLeaderboard(session);
          const winner = leaderboard.length > 0 ? leaderboard[0] : null;
          const scoreMap = Object.fromEntries(leaderboard.map((item) => [item.name.trim(), item.score]));

          session.participants.forEach((participant) => {
            if (participant.socketId) {
              io.to(participant.socketId).emit('session:ended', {
                sessionId,
                winner,
                leaderboard,
                yourScore: scoreMap[participant.name.trim()] || 0,
              });
            }
          });
          socket.emit('session:ended', { sessionId, winner, leaderboard });
          return;
        }

        session.currentQuestionIndex = nextIndex;
        session.resultsRevealed = false;
        await session.save();

        const q = session.quiz.questions[nextIndex];
        const startedAt = Date.now();
        roomMeta[session.joinCode].questionStartedAt = startedAt;

        io.to(session.joinCode).emit('question:started', {
          question: sanitizeQuestion(q),
          questionIndex: nextIndex,
          totalQuestions: session.quiz.questions.length,
          timeLimit: q.timeLimit,
          startedAt,
        });

        startTimer(io, session, nextIndex, q.timeLimit);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ─── HOST REVEALS RESULTS ────────────────────────────────────────────
    socket.on('host:reveal', async ({ sessionId }) => {
      try {
        const session = await Session.findById(sessionId).populate('quiz');
        if (!session) return;

        session.resultsRevealed = true;
        await session.save();

        const aggregated = await aggregateCurrentQuestion(session);
        socket.emit('results:revealed', {
          questionIndex: session.currentQuestionIndex,
          aggregated,
          leaderboard: await buildLeaderboard(session),
        });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ─── HOST ENDS SESSION ───────────────────────────────────────────────
    socket.on('host:end', async ({ sessionId }) => {
      try {
        const session = await Session.findById(sessionId).populate('quiz');
        if (!session) return;
        clearTimer(session.joinCode);
        session.status = 'ended';
        session.endedAt = new Date();
        await session.save();

        const leaderboard = await buildLeaderboard(session);
        const winner = leaderboard.length > 0 ? leaderboard[0] : null;
        const scoreMap = Object.fromEntries(leaderboard.map((item) => [item.name.trim(), item.score]));

        session.participants.forEach((participant) => {
          if (participant.socketId) {
            io.to(participant.socketId).emit('session:ended', {
              sessionId,
              winner,
              leaderboard,
              yourScore: scoreMap[participant.name.trim()] || 0,
            });
          }
        });
        socket.emit('session:ended', { sessionId, winner, leaderboard });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ─── PARTICIPANT SUBMITS ANSWER ──────────────────────────────────────
    socket.on('participant:answer', async ({ sessionId, answer, responseTime }) => {
      try {
        const session = await Session.findById(sessionId).populate('quiz');
        if (!session || session.status !== 'active') return;

        const name = socket.data.name;
        const qIdx = session.currentQuestionIndex;
        const question = session.quiz.questions[qIdx];

        // Prevent duplicate answers
        const existing = await Response.findOne({
          session: session._id,
          questionId: question._id,
          participantName: name,
        });
        if (existing) return socket.emit('error', { message: 'Already answered' });

        // Calculate points (faster = more points)
        let pointsEarned = 0;
        if (question.type !== 'word_cloud') {
          const correctIndex = question.options.findIndex((o) => o.isCorrect);
          if (correctIndex >= 0 && answer === correctIndex) {
            const timeFactor = Math.max(0, 1 - responseTime / (question.timeLimit * 1000));
            pointsEarned = Math.round(question.points * (0.5 + 0.5 * timeFactor));
          }
        }

        await Response.create({
          session: session._id,
          questionId: question._id,
          questionIndex: qIdx,
          participantName: name,
          participantSocketId: socket.id,
          answer,
          responseTime,
          pointsEarned,
        });

        // Update participant score using normalized lookup to prevent duplicates
        const participant = session.participants.find((p) => normalizeName(p.name) === normalizeName(name));
        if (participant) {
          participant.score += pointsEarned;
          await session.save();
        }

        // Acknowledge to participant
        socket.emit('answer:accepted', { pointsEarned });

        // Send live aggregated results to host
        const aggregated = await aggregateCurrentQuestion(session);
        const responseCount = await Response.countDocuments({
          session: session._id,
          questionIndex: qIdx,
        });

        io.to(session.joinCode).emit('results:live', {
          questionIndex: qIdx,
          aggregated,
          responseCount,
          participantCount: session.participants.length,
        });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ─── DISCONNECT ───────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip isCorrect from options before sending to participants */
function sanitizeQuestion(q) {
  return {
    _id: q._id,
    type: q.type,
    text: q.text,
    timeLimit: q.timeLimit,
    options: q.options.map((o) => ({ _id: o._id, text: o.text })),
  };
}

/** Aggregate responses for the current question */
async function aggregateCurrentQuestion(session) {
  const qIdx = session.currentQuestionIndex;
  const question = session.quiz.questions[qIdx];
  const responses = await Response.find({
    session: session._id,
    questionIndex: qIdx,
  });

  if (question.type === 'word_cloud') {
    const wordCount = {};
    responses.forEach((r) => {
      const word = String(r.answer).toLowerCase().trim();
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    return wordCount;
  }

  // Multiple choice / True-False
  const counts = {};
  question.options.forEach((opt) => { counts[opt.text] = 0; });
  responses.forEach((r) => {
    const opt = question.options[r.answer];
    if (opt) counts[opt.text] = (counts[opt.text] || 0) + 1;
  });
  return counts;
}

async function buildLeaderboard(session) {
  const responseTotals = {};
  const responses = await Response.find({ session: session._id });

  responses.forEach((r) => {
    const name = String(r.participantName || '').trim();
    responseTotals[name] = (responseTotals[name] || 0) + (r.pointsEarned || 0);
  });

  const unique = dedupeParticipants(session.participants || []);
  const leaderboard = unique
    .map((p) => ({ name: p.name, score: responseTotals[p.name.trim()] || 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return leaderboard;
}

// Auto-advance when timer expires
const questionTimers = {};

async function handleQuestionTimeout(io, code, expectedIndex) {
  const session = await Session.findOne({ joinCode: code }).populate('quiz');
  if (!session || session.status !== 'active' || session.currentQuestionIndex !== expectedIndex) return;

  io.to(code).emit('question:timeup', { questionIndex: expectedIndex });

  const nextIndex = session.currentQuestionIndex + 1;
  if (nextIndex >= session.quiz.questions.length) {
    session.status = 'ended';
    session.endedAt = new Date();
    await session.save();

    const leaderboard = await buildLeaderboard(session);
    const winner = leaderboard.length > 0 ? leaderboard[0] : null;
    const scoreMap = Object.fromEntries(leaderboard.map((item) => [item.name.trim(), item.score]));

    session.participants.forEach((participant) => {
      if (participant.socketId) {
        io.to(participant.socketId).emit('session:ended', {
          sessionId: session._id,
          winner,
          leaderboard,
          yourScore: scoreMap[participant.name.trim()] || 0,
        });
      }
    });
    // Emit to host as well (timeout path does not have direct socket reference)
    const hostSocketId = roomMeta[code]?.hostSocketId;
    if (hostSocketId) {
      io.to(hostSocketId).emit('session:ended', { sessionId: session._id, winner, leaderboard });
    } else {
      io.to(code).emit('session:ended', { sessionId: session._id, winner, leaderboard });
    }
    return;
  }

  session.currentQuestionIndex = nextIndex;
  session.resultsRevealed = false;
  await session.save();

  const q = session.quiz.questions[nextIndex];
  const startedAt = Date.now();
  if (!roomMeta[code]) roomMeta[code] = {};
  roomMeta[code].questionStartedAt = startedAt;

  io.to(code).emit('question:started', {
    question: sanitizeQuestion(q),
    questionIndex: nextIndex,
    totalQuestions: session.quiz.questions.length,
    timeLimit: q.timeLimit,
    startedAt,
  });

  startTimer(io, session, nextIndex, q.timeLimit);
}

function startTimer(io, session, questionIndex, timeLimit) {
  if (!timeLimit || timeLimit <= 0) return;
  const code = session.joinCode;
  if (questionTimers[code]) clearTimeout(questionTimers[code]);
  questionTimers[code] = setTimeout(async () => {
    await handleQuestionTimeout(io, code, questionIndex);
  }, timeLimit * 1000);
}

function clearTimer(joinCode) {
  if (questionTimers[joinCode]) {
    clearTimeout(questionTimers[joinCode]);
    delete questionTimers[joinCode];
  }
  if (advanceTimers[joinCode]) {
    clearTimeout(advanceTimers[joinCode]);
    delete advanceTimers[joinCode];
  }
}

module.exports = registerSocketHandlers;
