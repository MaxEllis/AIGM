import { useState } from 'react';
import HomeScreen from './components/HomeScreen';
import SessionScreen from './components/SessionScreen';
import RulesSearchScreen from './components/RulesSearchScreen';

function App() {
  const [currentScreen, setCurrentScreen] = useState('home');

  return (
    <div className="app">
      {currentScreen === 'home' && (
        <HomeScreen
          onStartSession={() => setCurrentScreen('session')}
          onRulesHelp={() => setCurrentScreen('rules')}
        />
      )}
      {currentScreen === 'session' && (
        <SessionScreen onBack={() => setCurrentScreen('home')} />
      )}
      {currentScreen === 'rules' && (
        <RulesSearchScreen onBack={() => setCurrentScreen('home')} />
      )}
    </div>
  );
}

export default App;
