/**
 * Quiz Model
 * Contains embedded questions array.
 * Question types: multiple_choice | true_false | word_cloud
 */
const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  text: { type: String, default: '' },
  isCorrect: { type: Boolean, default: false },
});

const questionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['multiple_choice', 'true_false', 'word_cloud'],
    required: true,
  },
  text: { type: String, default: '' },
  options: [optionSchema],        // for multiple_choice & true_false
  timeLimit: { type: Number, default: 30 }, // seconds (0 = no limit)
  points: { type: Number, default: 100 },
  order: { type: Number, default: 0 },
});

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    questions: [questionSchema],
    isPublished: { type: Boolean, default: false },
    coverColor: { type: String, default: '#6366f1' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Quiz', quizSchema);
