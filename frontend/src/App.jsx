import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import QuizEditorPage from './pages/QuizEditorPage';
import PresenterPage from './pages/PresenterPage';
import JoinPage from './pages/JoinPage';
import ParticipantPage from './pages/ParticipantPage';
import ResultsPage from './pages/ResultsPage';

// Protected route wrapper
const Protected = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return user ? children : <Navigate to="/login" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/join/:code" element={<JoinPage />} />
      <Route path="/session/:sessionId/participate" element={<ParticipantPage />} />

      {/* Protected presenter routes */}
      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/quiz/:id/edit" element={<Protected><QuizEditorPage /></Protected>} />
      <Route path="/session/:sessionId/present" element={<Protected><PresenterPage /></Protected>} />
      <Route path="/session/:sessionId/results" element={<Protected><ResultsPage /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
