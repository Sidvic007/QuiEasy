/**
 * Seed Script — creates example user + quiz
 * Run: node config/seed.js
 */
require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Session = require('../models/Session');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mentimeter_clone';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Clear existing seed data
  await User.deleteMany({ email: 'demo@example.com' });
  await Session.deleteMany({}); // Clear sessions too

  const user = await User.create({
    name: 'Demo Presenter',
    email: 'demo@example.com',
    password: 'password123',
  });

  const quiz = await Quiz.create({
    title: 'General Knowledge Quiz',
    description: 'A fun quiz covering history, science, and pop culture.',
    owner: user._id,
    coverColor: '#6366f1',
    questions: [
      {
        type: 'multiple_choice',
        text: 'What is the capital of France?',
        options: [
          { text: 'London', isCorrect: false },
          { text: 'Berlin', isCorrect: false },
          { text: 'Paris', isCorrect: true },
          { text: 'Madrid', isCorrect: false },
        ],
        timeLimit: 20,
        points: 100,
        order: 0,
      },
      {
        type: 'true_false',
        text: 'The Great Wall of China is visible from space with the naked eye.',
        options: [
          { text: 'True', isCorrect: false },
          { text: 'False', isCorrect: true },
        ],
        timeLimit: 15,
        points: 100,
        order: 1,
      },
      {
        type: 'word_cloud',
        text: 'What is your favorite programming language?',
        options: [],
        timeLimit: 30,
        points: 0,
        order: 2,
      },
    ],
  });

  // Create a demo session with join code
  const session = await Session.create({
    quiz: quiz._id,
    host: user._id,
    joinCode: 'DEMO01',
    status: 'waiting',
  });

  console.log('✅ Seed data created');
  console.log('   Email: demo@example.com');
  console.log('   Password: password123');
  console.log('   Demo Session Join Code: DEMO01');
  await mongoose.disconnect();
}

seed().catch((err) => { console.error(err); process.exit(1); });
