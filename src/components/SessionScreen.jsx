import { useState, useRef, useEffect } from 'react';
import { askRulebook } from '../services/rulesClient';

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
  const retryCountRef = useRef(0); // Track retry attempts for network errors
  const maxRetries = 3; // Maximum retry attempts

  // Keep hushed ref in sync for TTS callbacks
  useEffect(() => {
    isHushedRef.current = isHushed;
  }, [isHushed]);

  // Initialize Web Speech API once
  useEffect(() => {
    // Check HTTPS requirement
    const isSecureContext = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    
    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    // Detect browser
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    
    console.log('[SR] Diagnostics:', {
      isSecureContext,
      protocol: location.protocol,
      hostname: location.hostname,
      isChrome,
      isEdge,
      isSafari,
      isFirefox,
      hasSpeechRecognition: !!window.SpeechRecognition,
      hasWebkitSpeechRecognition: !!window.webkitSpeechRecognition
    });
    
    // Check HTTPS requirement
    if (!isSecureContext) {
      console.error('[SR] Not a secure context - HTTPS required');
      setSpeechSupported(false);
      setError('Speech recognition requires HTTPS. Please use https:// or localhost.');
      return;
    }
    
    // Check browser compatibility
    if (isFirefox) {
      console.error('[SR] Firefox does not support Web Speech API');
      setSpeechSupported(false);
      setError('Firefox does not support voice input. Please use Chrome, Edge, or Safari.');
      return;
    }
    
    // Detect Web Speech API support
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      console.log('[SR] Speech recognition not supported');
      setSpeechSupported(false);
      
      if (isIOS) {
        setError('Voice input is not available on iOS. Use the Rules Help screen to search for rules.');
      } else if (isMobile) {
        setError('Voice input may not work on mobile browsers. Try Rules Help to search for rules.');
      } else {
        setError('Speech recognition is not available in this browser. Try Chrome, Edge, or Safari.');
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
      retryCountRef.current = 0; // Reset retry count on successful start
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
      console.log('[SR] onerror:', event.error, 'retryCount:', retryCountRef.current);
      recognitionActiveRef.current = false;
      setListening(false);
      
      let errorMessage = null;
      let shouldRetry = false;
      
      // Only show errors for critical issues, not transient ones
      if (event.error === 'no-speech') {
        // Don't show error for no-speech - it's normal when user doesn't speak
        errorMessage = null;
      } else if (event.error === 'audio-capture') {
        errorMessage = 'Microphone not found or not accessible. Please check your microphone settings.';
        isHoldingRef.current = false;
      } else if (event.error === 'not-allowed') {
        errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings and refresh the page.';
        isHoldingRef.current = false;
      } else if (event.error === 'network') {
        // Network errors might be transient - try to retry if user is still holding
        if (isHoldingRef.current && retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          console.log('[SR] Network error, retrying...', retryCountRef.current);
          shouldRetry = true;
          errorMessage = `Connection issue (retry ${retryCountRef.current}/${maxRetries})...`;
          
          // Retry after a short delay
          setTimeout(() => {
            if (isHoldingRef.current && recognitionRef.current && !recognitionActiveRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                console.error('[SR] Retry failed:', e);
                if (retryCountRef.current >= maxRetries) {
                  isHoldingRef.current = false;
                  setError('Cannot connect to speech recognition service. Check your internet connection or firewall settings.');
                }
              }
            }
          }, 500);
        } else {
          // Max retries reached or user released button
          isHoldingRef.current = false;
          retryCountRef.current = 0;
          errorMessage = 'Cannot connect to speech recognition service. This may be due to:\n• Firewall blocking Google services\n• VPN or network restrictions\n• Regional service limitations\n\nTry refreshing the page or check your network settings.';
        }
      } else if (event.error === 'aborted') {
        // Don't show error for aborted - it's normal when stopping manually
        errorMessage = null;
        retryCountRef.current = 0;
      } else {
        // For other errors, show a brief message
        errorMessage = 'Speech recognition unavailable. Please try again.';
        isHoldingRef.current = false;
      }
      
      if (errorMessage && !shouldRetry) {
        setError(errorMessage);
      } else if (errorMessage && shouldRetry) {
        setError(errorMessage);
        // Clear retry message after 2 seconds
        setTimeout(() => {
          if (retryCountRef.current < maxRetries) {
            setError(null);
          }
        }, 2000);
      } else {
        setError(null);
      }
    };

    // Handler: recognition result
    // Made async to handle backend API call
    recognitionRef.current.onresult = async (event) => {
      console.log('[SR] onresult');
      const lastResult = event.results[event.results.length - 1];
      const query = lastResult[0].transcript;
      
      // Add user message to transcript
      setTranscript(prev => [...prev, { type: 'user', text: query }]);
      
      try {
        // Call backend RAG endpoint instead of local findRule
        const response = await askRulebook(query, { gameId: 'catan-base' });
        let answer = response.answer || "I couldn't find a matching rule in the rulebook excerpts.";
        
        // Safety net: enforce 3 sentence limit on client side
        const allSentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const limitedSentences = allSentences.slice(0, 3);
        const limitedAnswer = limitedSentences.join('. ') + (limitedSentences.length > 0 ? '.' : '');
        
        // Add assistant message to transcript
        setTranscript(prev => [...prev, { type: 'assistant', text: limitedAnswer }]);
        
        // Speak the answer if not hushed
        if (!isHushedRef.current && 'speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(limitedAnswer);
          utterance.rate = 0.9;
          utterance.pitch = 1;
          window.speechSynthesis.speak(utterance);
        }
      } catch (error) {
        console.error('[SR] Error getting rulebook answer:', error);
        const errorText = "I had trouble getting an answer. Please try again.";
        setTranscript(prev => [...prev, { type: 'assistant', text: errorText }]);
        
        if (!isHushedRef.current && 'speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(errorText);
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
    console.log('[SR] startListening() called', {
      speechSupported,
      recognitionActive: recognitionActiveRef.current,
      hasRecognition: !!recognitionRef.current,
      isSecureContext: window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost'
    });
    
    if (!speechSupported || !recognitionRef.current) {
      const errorMsg = !recognitionRef.current 
        ? 'Speech recognition not initialized. Please refresh the page.'
        : 'Speech recognition is not available in this browser.';
      setError(errorMsg);
      console.error('[SR] Cannot start:', errorMsg);
      return;
    }

    isHoldingRef.current = true;
    setError(null);
    retryCountRef.current = 0; // Reset retry count when starting fresh

    // Only start if not already active
    if (!recognitionActiveRef.current) {
      try {
        console.log('[SR] Calling recognition.start()...');
        recognitionRef.current.start();
        console.log('[SR] recognition.start() called successfully');
      } catch (e) {
        console.error('[SR] start() error:', e, e.message, e.name);
        // Handle "already started" error gracefully
        if (e.message && (e.message.includes('already started') || e.message.includes('started'))) {
          console.log('[SR] Recognition already started, continuing...');
          recognitionActiveRef.current = true;
          setListening(true);
        } else if (e.name === 'InvalidStateError' || e.message.includes('not allowed')) {
          setError('Microphone permission required. Please allow microphone access and refresh.');
          isHoldingRef.current = false;
        } else {
          setError('Could not start listening: ' + (e.message || e.toString()));
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
          <p className="mic-error" style={{ color: '#ff6b6b', fontSize: '0.9rem', marginBottom: '1rem', textAlign: 'center', padding: '0.5rem', backgroundColor: '#1a1a1a', borderRadius: '4px' }}>
            {error}
          </p>
        )}
        {error && speechSupported && (
          <p className="mic-error" style={{ color: '#ff6b6b', fontSize: '0.85rem', marginBottom: '0.5rem', textAlign: 'center', padding: '0.5rem', backgroundColor: '#1a1a1a', borderRadius: '4px' }}>
            {error}
          </p>
        )}
        {process.env.NODE_ENV === 'development' && (
          <div style={{ fontSize: '0.7rem', color: '#555', marginBottom: '0.5rem', textAlign: 'center' }}>
            Protocol: {location.protocol} | Browser: {navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Firefox') ? 'Firefox' : navigator.userAgent.includes('Safari') ? 'Safari' : 'Other'} | Secure: {window.isSecureContext ? 'Yes' : 'No'}
          </div>
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
