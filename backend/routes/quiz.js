const express = require('express');
const router = express.Router();
const {
  getQuizzes, getQuiz, createQuiz, updateQuiz, deleteQuiz,
  addQuestion, updateQuestion, deleteQuestion, generateQuestionsWithAI,
} = require('../controllers/quizController');
const { protect } = require('../middleware/auth');

router.use(protect); // All quiz routes require auth

router.route('/').get(getQuizzes).post(createQuiz);
router.route('/:id').get(getQuiz).put(updateQuiz).delete(deleteQuiz);
router.route('/:id/ai-generate').post(generateQuestionsWithAI);
router.route('/:id/questions').post(addQuestion);
router.route('/:id/questions/:qid').put(updateQuestion).delete(deleteQuestion);

module.exports = router;
