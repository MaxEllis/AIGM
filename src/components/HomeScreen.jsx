export default function HomeScreen({ onStartSession, onRulesHelp }) {
  return (
    <div className="home-screen">
      <h1>AI Game Master</h1>
      <p className="subtitle">Calm rules assistance for game night</p>
      <div className="button-group">
        <button className="primary-button" onClick={onStartSession}>
          Start Session
        </button>
        <button className="secondary-button" onClick={onRulesHelp}>
          Rules Help
        </button>
      </div>
    </div>
  );
}
