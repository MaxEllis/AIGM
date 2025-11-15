import { useState, useRef, useEffect } from 'react';
import { findRule } from '../rules/catanRules';

export default function SessionScreen({ onBack }) {
  // State and refs
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [error, setError] = useState(null);
  const [isHushed, setIsHushed] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  const isHushedRef = useRef(false);
  const isHoldingRef = useRef(false); // Track if user is holding the button
  const recognitionActiveRef = useRef(false); // Track if recognition is currently active

  // Keep hushed ref in sync for TTS callbacks
  useEffect(() => {
    isHushedRef.current = isHushed;
  }, [isHushed]);

  // Initialize Web Speech API once
  useEffect(() => {
    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    // Detect Web Speech API support
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      console.log('[SR] Speech recognition not supported');
      setSpeechSupported(false);
      
      if (isIOS) {
        setError('Voice input is not available on iOS. Use the Rules Help screen to search for rules.');
      } else if (isMobile) {
        setError('Voice input may not work on mobile browsers. Try Rules Help to search for rules.');
      } else {
        setError('Speech recognition is not available in this browser.');
      }
      return;
    }
    
    // Initialize recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    // iOS devices don't support Web Speech API even if the API exists
    if (isMobile && isIOS) {
      setSpeechSupported(false);
      setError('Voice input is not available on iOS. Use the Rules Help screen to search for rules.');
      return;
    }
    
    // Initialize recognition
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'en-US';
    recognitionRef.current.interimResults = false;
    recognitionRef.current.maxAlternatives = 1;
    recognitionRef.current.continuous = false; // Set to false for push-to-talk

    // Handler: recognition started
    recognitionRef.current.onstart = () => {
      console.log('[SR] onstart');
      recognitionActiveRef.current = true;
      setListening(true);
      setError(null);
    };

    // Handler: recognition ended
    recognitionRef.current.onend = () => {
      console.log('[SR] onend, isHolding:', isHoldingRef.current);
      recognitionActiveRef.current = false;
      setListening(false);
      
      // If user is still holding the button, restart recognition
      if (isHoldingRef.current && recognitionRef.current) {
        console.log('[SR] Restarting recognition because user is still holding');
        try {
          // Small delay to avoid immediate restart issues
          setTimeout(() => {
            if (isHoldingRef.current && recognitionRef.current) {
              recognitionRef.current.start();
            }
          }, 100);
        } catch (e) {
          console.error('[SR] Error restarting recognition:', e);
          // If restart fails, user can release and press again
        }
      }
    };

    // Handler: recognition error
    recognitionRef.current.onerror = (event) => {
      console.log('[SR] onerror:', event.error);
      recognitionActiveRef.current = false;
      setListening(false);
      
      // If user is still holding, stop holding state on critical errors
      if (event.error === 'not-allowed' || event.error === 'audio-capture' || event.error === 'network') {
        isHoldingRef.current = false;
      }
      
      let errorMessage = null;
      // Only show errors for critical issues, not transient ones
      if (event.error === 'no-speech') {
        // Don't show error for no-speech - it's normal when user doesn't speak
        errorMessage = null;
      } else if (event.error === 'audio-capture') {
        errorMessage = 'Microphone not found or not accessible. Please check your microphone settings.';
      } else if (event.error === 'not-allowed') {
        errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings and refresh the page.';
      } else if (event.error === 'network') {
        errorMessage = 'Internet connection required. Speech recognition needs network access.';
      } else if (event.error === 'aborted') {
        // Don't show error for aborted - it's normal when stopping manually
        errorMessage = null;
      } else {
        // For other errors, show a brief message
        errorMessage = 'Speech recognition unavailable. Please try again.';
      }
      
      if (errorMessage) {
        setError(errorMessage);
        // Auto-clear error after 5 seconds for network errors
        if (event.error === 'network') {
          setTimeout(() => {
            setError(null);
          }, 5000);
        }
      } else {
        setError(null);
      }
    };

    // Handler: recognition result
    recognitionRef.current.onresult = (event) => {
      console.log('[SR] onresult');
      const lastResult = event.results[event.results.length - 1];
      const query = lastResult[0].transcript;
      
      // Add user message to transcript
      setTranscript(prev => [...prev, { type: 'user', text: query }]);
      
      // Find matching rule
      const match = findRule(query);
      
      if (match && match.rule) {
        const answer = match.rule.answer;
        // Limit to 3 sentences
        const allSentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const limitedSentences = allSentences.slice(0, 3);
        const limitedAnswer = limitedSentences.join('. ') + '.';
        
        // Add assistant message to transcript
        setTranscript(prev => [...prev, { type: 'assistant', text: limitedAnswer }]);
        
        // Speak the answer if not hushed
        if (!isHushedRef.current && 'speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(limitedAnswer);
          utterance.rate = 0.9;
          utterance.pitch = 1;
          window.speechSynthesis.speak(utterance);
        }
      } else {
        const noMatchText = "I couldn't find a matching rule. Try asking about settlements, resources, trading, or building.";
        setTranscript(prev => [...prev, { type: 'assistant', text: noMatchText }]);
        
        if (!isHushedRef.current && 'speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(noMatchText);
          utterance.rate = 0.9;
          window.speechSynthesis.speak(utterance);
        }
      }
    };

    // Initialize speech synthesis
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }

    // Cleanup
    return () => {
      console.log('[SR] cleanup');
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore cleanup errors
        }
        recognitionRef.current = null;
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []); // Initialize only once

  // Start listening function
  const startListening = () => {
    console.log('[SR] startListening() called, recognitionActive:', recognitionActiveRef.current);
    
    if (!speechSupported || !recognitionRef.current) {
      setError('Speech recognition is not available in this browser.');
      return;
    }

    isHoldingRef.current = true;
    setError(null);

    // Only start if not already active
    if (!recognitionActiveRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error('[SR] start() error:', e);
        // Handle "already started" error gracefully
        if (e.message && e.message.includes('already started')) {
          console.log('[SR] Recognition already started, continuing...');
          recognitionActiveRef.current = true;
          setListening(true);
        } else {
          setError('Could not start listening: ' + e.message);
          isHoldingRef.current = false;
        }
      }
    } else {
      console.log('[SR] Recognition already active, skipping start');
    }
  };

  // Stop listening function
  const stopListening = () => {
    console.log('[SR] stopListening() called, recognitionActive:', recognitionActiveRef.current);
    
    isHoldingRef.current = false;
    
    if (!recognitionRef.current) return;

    if (recognitionActiveRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionActiveRef.current = false;
      } catch (e) {
        console.error('[SR] stop() error:', e);
        // Swallow errors during stop
        recognitionActiveRef.current = false;
      }
    }
  };

  // Hush toggle handler
  const handleHushToggle = () => {
    setIsHushed(!isHushed);
    if (synthRef.current) {
      synthRef.current.cancel();
    }
  };

  return (
    <div className="session-screen">
      <div className="session-header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <button 
          className={`hush-toggle ${isHushed ? 'active' : ''}`}
          onClick={handleHushToggle}
          title={isHushed ? 'Unmute voice' : 'Mute voice'}
        >
          {isHushed ? '🔇 Hushed' : '🔊 Sound On'}
        </button>
      </div>

      <div className="transcript-container">
        {transcript.length === 0 ? (
          <p className="transcript-placeholder">Press and hold the mic button to ask a question</p>
        ) : (
          <div className="transcript">
            {transcript.map((item, index) => (
              <div key={index} className={`transcript-message ${item.type}`}>
                <span className="message-text">{item.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mic-container">
        {error && !speechSupported && (
          <p className="mic-error" style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1rem', textAlign: 'center' }}>
            {error}
          </p>
        )}
        {error && speechSupported && (
          <p className="mic-error" style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem', textAlign: 'center' }}>
            {error}
          </p>
        )}
        <button
          type="button"
          className={`mic-button ${listening ? 'listening' : ''}`}
          onMouseDown={startListening}
          onMouseUp={stopListening}
          onMouseLeave={stopListening}
          onTouchStart={(e) => {
            e.preventDefault();
            startListening();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            stopListening();
          }}
          disabled={!speechSupported}
        >
          {listening ? 'Listening… Release to stop' : '🎤 Hold to Talk'}
        </button>
        <p className="mic-hint">Press and hold to speak</p>
        {!error && (
          <p className="mic-hint" style={{ fontSize: '0.75rem', color: '#555', marginTop: '0.25rem' }}>
            Internet connection required
          </p>
        )}
      </div>
    </div>
  );
}
