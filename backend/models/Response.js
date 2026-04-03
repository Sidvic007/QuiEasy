/**
 * Response Model
 * Stores individual participant answers per session question.
 */
const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    questionIndex: { type: Number, required: true },
    participantName: { type: String, required: true },
    participantSocketId: { type: String },
    answer: mongoose.Schema.Types.Mixed, // string | string[] | number (option index)
    responseTime: { type: Number }, // ms taken to answer
    pointsEarned: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound index so one participant can't answer the same question twice
responseSchema.index(
  { session: 1, questionId: 1, participantName: 1 },
  { unique: true }
);

module.exports = mongoose.model('Response', responseSchema);
