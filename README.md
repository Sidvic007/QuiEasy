# QuiEasy

A full-stack real-time interactive quiz and polling platform built with React, Node.js, MongoDB, and Socket.io.

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                              │
│  ┌──────────────────────┐   ┌──────────────────────────┐   │
│  │   Presenter (React)  │   │  Participants (React)    │   │
│  │  JWT authenticated   │   │  No login required       │   │
│  └────────┬─────────────┘   └──────────┬───────────────┘   │
│           │  REST + WebSocket          │  WebSocket         │
└───────────┼────────────────────────────┼───────────────────-┘
            │                            │
┌───────────▼────────────────────────────▼───────────────────┐
│                  Node.js / Express Server                   │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │   REST API      │    │      Socket.io               │   │
│  │  /api/auth      │    │  host:join / host:start      │   │
│  │  /api/quiz      │    │  host:next / host:reveal     │   │
│  │  /api/session   │    │  participant:join / :answer  │   │
│  └────────┬────────┘    └──────────────┬───────────────┘   │
└───────────┼─────────────────────────────┼──────────────────┘
            │                             │
┌───────────▼─────────────────────────────▼──────────────────┐
│                        MongoDB                              │
│   Users │ Quizzes │ Sessions │ Responses                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Database Schema

### Users
```js
{ name, email, password (bcrypt), avatar, timestamps }
```

### Quizzes
```js
{
  title, description, owner (→ User), coverColor,
  questions: [{
    type: 'multiple_choice' | 'true_false' | 'word_cloud',
    text, timeLimit, points,
    options: [{ text, isCorrect }]
  }]
}
```

### Sessions
```js
{
  quiz (→ Quiz), host (→ User), joinCode (6-char unique),
  status: 'waiting' | 'active' | 'paused' | 'ended',
  currentQuestionIndex, resultsRevealed,
  participants: [{ socketId, name, score, joinedAt }],
  startedAt, endedAt
}
```

### Responses
```js
{
  session (→ Session), questionId, questionIndex,
  participantName, participantSocketId,
  answer (Mixed: option index | string),
  responseTime (ms), pointsEarned
}
// Unique index: (session, questionId, participantName)
```

---

## 🔌 REST API Endpoints

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | ❌ | Register a presenter account |
| POST | `/api/auth/login` | ❌ | Login → returns JWT |
| GET | `/api/auth/me` | ✅ | Get current user |

### Quizzes
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/quiz` | ✅ | List my quizzes |
| POST | `/api/quiz` | ✅ | Create quiz |
| GET | `/api/quiz/:id` | ✅ | Get quiz details |
| PUT | `/api/quiz/:id` | ✅ | Update quiz |
| DELETE | `/api/quiz/:id` | ✅ | Delete quiz |
| POST | `/api/quiz/:id/questions` | ✅ | Add question |
| PUT | `/api/quiz/:id/questions/:qid` | ✅ | Update question |
| DELETE | `/api/quiz/:id/questions/:qid` | ✅ | Delete question |
| POST | `/api/quiz/:id/ai-generate` | ✅ | Generate questions from prompt/context with AI |

### Sessions
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/session` | ✅ | Create session (generates join code) |
| GET | `/api/session` | ✅ | My recent sessions |
| GET | `/api/session/:id` | ✅ | Session details |
| GET | `/api/session/:id/results` | ✅ | Aggregated results + leaderboard |
| GET | `/api/session/join/:code` | ❌ | Participant code lookup |

---

## ⚡ Socket.io Events

### Presenter → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `host:join` | `{ sessionId, token }` | Authenticate and join session room |
| `host:start` | `{ sessionId }` | Launch quiz from lobby |
| `host:next` | `{ sessionId }` | Advance to next question (ends if last) |
| `host:reveal` | `{ sessionId }` | Reveal correct answer + leaderboard |
| `host:end` | `{ sessionId }` | Force-end session immediately |

### Participant → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `participant:join` | `{ joinCode, name }` | Join session room |
| `participant:answer` | `{ sessionId, answer, responseTime }` | Submit answer |

### Server → All Clients
| Event | Payload | Description |
|-------|---------|-------------|
| `question:started` | `{ question, questionIndex, totalQuestions, timeLimit, startedAt }` | New question live |
| `results:live` | `{ aggregated, responseCount, participantCount }` | After every answer |
| `results:revealed` | `{ aggregated, leaderboard }` | Host revealed results |
| `question:timeup` | `{ questionIndex }` | Timer expired |
| `session:ended` | `{ sessionId }` | Quiz over |
| `participant:joined` | `{ name, participantCount }` | New joiner (to host) |
| `answer:accepted` | `{ pointsEarned }` | Confirmation (to answering participant) |
| `session:joined` | `{ session, participantCount }` | Lobby state (to new participant) |

---

## 🚀 Setup & Running

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- npm

### 1. Clone & Install

```bash
git clone <repo>
cd mentimeter-clone

# Install backend
cd backend
npm install
cp .env.example .env
# Edit .env with your MONGO_URI and JWT_SECRET

# Install frontend
cd ../frontend
npm install
```

### 2. Configure Environment

**backend/.env**
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/mentimeter_clone
JWT_SECRET=your_super_secret_key_here
CLIENT_URL=http://localhost:3000

# Configure one provider for AI generation
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemma-4-31b-it:free

HUGGINGFACE_API_KEY=
HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.2
```

**frontend/.env** (already set)
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

### 3. Seed Demo Data (Optional)

```bash
cd backend
node config/seed.js
# Creates: demo@example.com / password123
# With a sample 3-question quiz
```

### 4. Run the App

```bash
# Terminal 1 — Backend
cd backend
npm run dev    # nodemon, auto-restarts on changes

# Terminal 2 — Frontend
cd frontend
npm start      # React dev server on :3000
```

Open **http://localhost:3000**

---

## 🎮 Usage Flow

### As a Presenter
1. Sign up / log in at `/signup`
2. Create a quiz from the Dashboard
3. Add questions (Multiple Choice, True/False, or Word Cloud)
4. Click **▶ Start** on a quiz to create a live session
5. Share the 6-character join code (or QR code) with participants
6. Click **▶ Start Quiz** once participants have joined
7. Watch live results update in real-time as participants answer
8. Click **Show Results** to reveal the correct answer and leaderboard
9. Click **Next →** to advance, or **End Session** to finish
10. View full results with charts at `/session/:id/results`
11. Export results as CSV
12. In quiz editor, use **AI Generator** with prompt/context to append or replace questions automatically

### As a Participant
1. Go to `/join` (or scan QR code)
2. Enter the 6-character session code
3. Enter your display name
4. Wait in the lobby for the presenter to start
5. Answer each question before the timer runs out
6. See your points after each answer
7. View the final leaderboard when the quiz ends

---

## 🏆 Scoring System

Points per question are awarded based on speed:

```
points = question.points × (0.5 + 0.5 × (1 - responseTime / timeLimitMs))
```

- Correct answer at 0s remaining → 50% of points
- Correct answer instantly → 100% of points  
- Wrong answer → 0 points
- Word Cloud questions → no points (open-ended)

---

## 📁 Full Project Structure

```
mentimeter-clone/
├── README.md
├── backend/
│   ├── package.json
│   ├── server.js                    # Entry: Express + Socket.io + MongoDB
│   ├── .env.example
│   ├── config/
│   │   └── seed.js                  # Demo data seeder
│   ├── middleware/
│   │   └── auth.js                  # JWT protect middleware
│   ├── models/
│   │   ├── User.js
│   │   ├── Quiz.js
│   │   ├── Session.js
│   │   └── Response.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── quizController.js
│   │   ├── sessionController.js
│   │   └── socketController.js      # All Socket.io event handlers
│   └── routes/
│       ├── auth.js
│       ├── quiz.js
│       └── session.js
│
└── frontend/
    ├── package.json
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── .env
    └── src/
        ├── index.js
        ├── index.css                # Global styles + Tailwind
        ├── App.jsx                  # Router + protected routes
        ├── context/
        │   └── AuthContext.jsx      # Global auth state
        ├── utils/
        │   ├── api.js               # Axios with JWT interceptor
        │   └── socket.js            # Socket.io singleton
        ├── components/
        │   └── shared/
        │       ├── LiveBarChart.jsx  # Chart.js bar chart
        │       └── WordCloud.jsx     # CSS word cloud
        └── pages/
            ├── LandingPage.jsx
            ├── LoginPage.jsx
            ├── SignupPage.jsx
            ├── DashboardPage.jsx
            ├── QuizEditorPage.jsx
            ├── PresenterPage.jsx
            ├── JoinPage.jsx
            ├── ParticipantPage.jsx
            └── ResultsPage.jsx
```

---

## 🔧 Production Deployment

### Backend (e.g. Railway, Render, Fly.io)
```bash
cd backend
npm start
# Set env vars: MONGO_URI, JWT_SECRET, CLIENT_URL, PORT
```

### Frontend (e.g. Vercel, Netlify)
```bash
cd frontend
npm run build
# Set env vars: REACT_APP_API_URL, REACT_APP_SOCKET_URL
# Upload the build/ folder
```

### MongoDB Atlas
Replace `MONGO_URI` with your Atlas connection string:
```
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/mentis
```
