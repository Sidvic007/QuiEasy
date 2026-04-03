/**
 * Session Controller
 * Creates sessions, generates join codes, fetches results.
 */
const { v4: uuidv4 } = require('uuid');
const Session = require('../models/Session');
const Quiz = require('../models/Quiz');
const Response = require('../models/Response');

/** Generate a unique 6-char uppercase join code */
const generateCode = () => uuidv4().replace(/-/g, '').toUpperCase().slice(0, 6);

// POST /api/session — create a new session for a quiz
const createSession = async (req, res) => {
  try {
    const { quizId } = req.body;
    const quiz = await Quiz.findOne({ _id: quizId, owner: req.user._id });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    let joinCode, exists;
    do {
      joinCode = generateCode();
      exists = await Session.findOne({ joinCode });
    } while (exists);

    const session = await Session.create({
      quiz: quiz._id,
      host: req.user._id,
      joinCode,
    });

    res.status(201).json({ session, joinCode });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/session/:id — get session (with quiz data)
const getSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id).populate('quiz');
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/session/join/:code — participant join lookup
const findByCode = async (req, res) => {
  try {
    const session = await Session.findOne({
      joinCode: req.params.code.toUpperCase(),
      status: { $in: ['waiting', 'active'] },
    }).populate('quiz', 'title description coverColor');
    if (!session) return res.status(404).json({ message: 'Session not found or has ended' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/session/:id/results — aggregate responses for all questions
const getResults = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id).populate('quiz');
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const responses = await Response.find({ session: session._id });

    // Group responses by questionIndex
    const resultMap = {};
    for (const r of responses) {
      const key = r.questionIndex;
      if (!resultMap[key]) resultMap[key] = [];
      resultMap[key].push(r);
    }

    // Build result summary per question
    const results = session.quiz.questions.map((q, idx) => {
      const qResponses = resultMap[idx] || [];
      let aggregated = {};

      if (q.type === 'multiple_choice' || q.type === 'true_false') {
        q.options.forEach((opt, i) => {
          aggregated[opt.text] = qResponses.filter((r) => r.answer === i).length;
        });
      } else if (q.type === 'word_cloud') {
        const wordCount = {};
        qResponses.forEach((r) => {
          const word = String(r.answer).toLowerCase().trim();
          wordCount[word] = (wordCount[word] || 0) + 1;
        });
        aggregated = wordCount;
      }

      return {
        question: q,
        questionIndex: idx,
        totalResponses: qResponses.length,
        aggregated,
      };
    });

    // Leaderboard — top participants by score (dedupe by name)
    const uniqueParticipants = [];
    const seen = new Set();
    session.participants.forEach((p) => {
      const key = String(p.name || '').trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        uniqueParticipants.push(p);
      }
    });

    const leaderboard = uniqueParticipants
      .map((p) => ({ name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // Return response with deduped participants for accurate count
    res.json({ 
      session: { ...session.toObject(), participants: uniqueParticipants }, 
      results, 
      leaderboard 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/session — host's recent sessions
const getMySessions = async (req, res) => {
  try {
    const sessions = await Session.find({ host: req.user._id })
      .populate('quiz', 'title')
      .sort('-createdAt')
      .limit(20);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createSession, getSession, findByCode, getResults, getMySessions };
