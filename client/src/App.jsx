import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { ClassDetail } from './pages/ClassDetail';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'login', 'signup', 'class-detail'
  const [selectedClassId, setSelectedClassId] = useState(null);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-dark)',
        color: 'var(--text-muted)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>EduCast</h2>
          <p>Loading application...</p>
        </div>
      </div>
    );
  }

  const handleSelectClass = (classId) => {
    setSelectedClassId(classId);
    setCurrentView('class-detail');
  };

  const renderMainContent = () => {
    if (!user) {
      if (currentView === 'signup') {
        return <Signup onSwitchToLogin={() => setCurrentView('login')} onSuccess={() => setCurrentView('dashboard')} />;
      }
      return <Login onSwitchToSignup={() => setCurrentView('signup')} onSuccess={() => setCurrentView('dashboard')} />;
    }

    if (currentView === 'class-detail' && selectedClassId) {
      return <ClassDetail classId={selectedClassId} onBack={() => setCurrentView('dashboard')} />;
    }

    return <Dashboard onSelectClass={handleSelectClass} />;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar onNavigate={(view) => setCurrentView(view)} currentView={currentView} />
      <main style={{ flex: 1 }}>
        {renderMainContent()}
      </main>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
