import React, { useEffect } from 'react';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MeetingProvider, useMeeting } from './context/MeetingContext';
import Navbar from './components/Landing/Navbar';
import Hero from './components/Landing/Hero';
import LobbyView from './components/Lobby/LobbyView';
import MeetingView from './components/Meeting/MeetingView';
import { Shield } from 'lucide-react';

// ── Auth gate: wait for anonymous session before rendering ────────────────────
function AuthGate({ children }) {
  const { loading, error } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4 lobby-bg">
        <div className="w-14 h-14 rounded-2xl bg-live-saffron flex items-center justify-center shadow-lg">
          <Shield className="w-7 h-7 text-white" />
        </div>
        <div className="w-8 h-8 rounded-full border-4 border-live-saffron border-t-transparent animate-spin" />
        <p className="text-meet-textSoft text-sm">Securing your session…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4 lobby-bg px-4 text-center">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-meet-text text-lg font-medium">Authentication Error</h2>
        <p className="text-meet-textSoft text-sm max-w-sm">{error}</p>
        <p className="text-meet-textSoft text-xs">
          Enable <strong>Anonymous Sign-In</strong> in your Supabase dashboard:<br />
          Authentication → Providers → Anonymous Sign-In → Enable
        </p>
      </div>
    );
  }

  return children;
}

// ── Views ─────────────────────────────────────────────────────────────────────

function LandingPage() {
  return (
    <div className="flex flex-col h-full">
      <Navbar />
      <Hero />
    </div>
  );
}

function JoinRedirect() {
  const { code } = useParams();
  const navigate  = useNavigate();
  const { setRoomId, setView } = useMeeting();

  useEffect(() => {
    if (code) {
      setRoomId(code.toLowerCase().trim());
      setView('lobby');
      navigate('/', { replace: true });
    }
  }, [code]);

  return null;
}

function ErrorView() {
  const { errorMsg, setView } = useMeeting();
  return (
    <div className="flex h-full items-center justify-center flex-col gap-5 lobby-bg px-4 text-center">
      <div className="text-5xl">🔐</div>
      <h2 className="text-meet-text text-xl font-medium">Unable to join</h2>
      <p className="text-meet-textSoft text-sm max-w-sm">{errorMsg || 'An unexpected error occurred.'}</p>
      <button onClick={() => setView('landing')} className="meet-btn-primary">
        Back to Home
      </button>
    </div>
  );
}

function AppContent() {
  const { view } = useMeeting();

  if (view === 'meeting') return <MeetingView />;
  if (view === 'error')   return <ErrorView />;
  if (view === 'lobby') {
    return (
      <div className="flex flex-col h-full">
        <Navbar />
        <LobbyView />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/"          element={<LandingPage />} />
      <Route path="/join/:code" element={<JoinRedirect />} />
      <Route path="*"          element={<LandingPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <MeetingProvider>
          <AppContent />
        </MeetingProvider>
      </AuthGate>
    </AuthProvider>
  );
}
