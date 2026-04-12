/**
 * Quiz Controller
 * CRUD operations for quizzes and their questions.
 */
const Quiz = require('../models/Quiz');
const { generateQuizDraft } = require('../services/quizAiService');

const ALLOWED_TYPES = new Set(['multiple_choice', 'true_false', 'word_cloud']);

const toNumberInRange = (value, fallback, min, max) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

const normalizeQuestion = (question, index) => {
  const type = ALLOWED_TYPES.has(question?.type) ? question.type : 'multiple_choice';
  const text = String(question?.text || '').trim() || `Question ${index + 1}`;
  const timeLimit = toNumberInRange(question?.timeLimit, 30, 10, 120);

  if (type === 'word_cloud') {
    return {
      type,
      text,
      timeLimit,
      points: 0,
      options: [],
      order: index,
    };
  }

  if (type === 'true_false') {
    const sourceOptions = Array.isArray(question?.options) ? question.options : [];
    const trueCorrect = sourceOptions.find((o) => String(o?.text || '').toLowerCase() === 'true')?.isCorrect;
    const falseCorrect = sourceOptions.find((o) => String(o?.text || '').toLowerCase() === 'false')?.isCorrect;
    const trueIsCorrect = Boolean(trueCorrect) || (!trueCorrect && !falseCorrect);

    return {
      type,
      text,
      timeLimit,
      points: toNumberInRange(question?.points, 100, 50, 300),
      options: [
        { text: 'True', isCorrect: trueIsCorrect },
        { text: 'False', isCorrect: !trueIsCorrect },
      ],
      order: index,
    };
  }

  const rawOptions = Array.isArray(question?.options) ? question.options : [];
  let options = rawOptions
    .map((opt) => ({ text: String(opt?.text || '').trim(), isCorrect: Boolean(opt?.isCorrect) }))
    .filter((opt) => opt.text)
    .slice(0, 6);

  if (options.length < 2) {
    options = [
      { text: 'Option 1', isCorrect: true },
      { text: 'Option 2', isCorrect: false },
    ];
  }

  if (!options.some((opt) => opt.isCorrect)) {
    options = options.map((opt, idx) => ({ ...opt, isCorrect: idx === 0 }));
  } else {
    let found = false;
    options = options.map((opt) => {
      if (!opt.isCorrect) return opt;
      if (!found) {
        found = true;
        return opt;
      }
      return { ...opt, isCorrect: false };
    });
  }

  return {
    type,
    text,
    timeLimit,
    points: toNumberInRange(question?.points, 100, 50, 300),
    options,
    order: index,
  };
};

// GET /api/quiz — list presenter's quizzes
const getQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ owner: req.user._id }).sort('-createdAt');
    res.json(quizzes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/quiz/:id — single quiz (owner only)
const getQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, owner: req.user._id });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/quiz — create new quiz
const createQuiz = async (req, res) => {
  try {
    const { title, description, coverColor } = req.body;
    const quiz = await Quiz.create({ title, description, coverColor, owner: req.user._id });
    res.status(201).json(quiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/quiz/:id — update quiz metadata
const updateQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/quiz/:id
const deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    res.json({ message: 'Quiz deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/quiz/:id/questions — add question
const addQuestion = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, owner: req.user._id });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    quiz.questions.push({ ...req.body, order: quiz.questions.length });
    await quiz.save();
    res.status(201).json(quiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/quiz/:id/questions/:qid — update question
const updateQuestion = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, owner: req.user._id });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    const q = quiz.questions.id(req.params.qid);
    if (!q) return res.status(404).json({ message: 'Question not found' });
    Object.assign(q, req.body);
    await quiz.save();
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/quiz/:id/questions/:qid
const deleteQuestion = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, owner: req.user._id });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    quiz.questions.pull(req.params.qid);
    await quiz.save();
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/quiz/:id/ai-generate
const generateQuestionsWithAI = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, owner: req.user._id });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    const { prompt, context = '', mode = 'append' } = req.body;
    const questionCount = toNumberInRange(req.body.questionCount, 5, 1, 10);

    if (!prompt || String(prompt).trim().length < 8) {
      return res.status(400).json({ message: 'Prompt must be at least 8 characters' });
    }

    const { provider, model, draft } = await generateQuizDraft({
      title: quiz.title,
      prompt: String(prompt).trim(),
      context: String(context || '').trim(),
      questionCount,
    });

    const rawQuestions = Array.isArray(draft?.questions) ? draft.questions : [];
    const generatedQuestions = rawQuestions.slice(0, questionCount).map((q, idx) => normalizeQuestion(q, idx));

    if (!generatedQuestions.length) {
      return res.status(502).json({ message: 'AI did not return valid questions. Try a more specific prompt.' });
    }

    if (mode === 'replace') {
      quiz.questions = generatedQuestions.map((q, idx) => ({ ...q, order: idx }));
    } else {
      const startOrder = quiz.questions.length;
      generatedQuestions.forEach((q, idx) => {
        quiz.questions.push({ ...q, order: startOrder + idx });
      });
    }

    if (!quiz.description && draft?.description) {
      quiz.description = String(draft.description).trim();
    }

    await quiz.save();

    res.json({
      quiz,
      generatedCount: generatedQuestions.length,
      provider,
      model,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  generateQuestionsWithAI,
};
