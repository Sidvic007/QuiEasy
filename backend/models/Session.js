/**
 * Session Model
 * Represents a live quiz session with join code and state tracking.
 */
const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  socketId: String,
  name: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now },
  score: { type: Number, default: 0 },
});

const sessionSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    joinCode: { type: String, required: true, unique: true, uppercase: true },
    status: {
      type: String,
      enum: ['waiting', 'active', 'paused', 'ended'],
      default: 'waiting',
    },
    currentQuestionIndex: { type: Number, default: -1 }, // -1 = lobby
    resultsRevealed: { type: Boolean, default: false },
    participants: [participantSchema],
    startedAt: Date,
    endedAt: Date,
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Session', sessionSchema);
