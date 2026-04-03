/**
 * Quiz Controller
 * CRUD operations for quizzes and their questions.
 */
const Quiz = require('../models/Quiz');

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

module.exports = { getQuizzes, getQuiz, createQuiz, updateQuiz, deleteQuiz, addQuestion, updateQuestion, deleteQuestion };
