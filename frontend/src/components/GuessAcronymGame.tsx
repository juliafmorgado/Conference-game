import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Timer from './Timer';
import { useContentManager } from '../hooks/useContentManager';
import { useKeyboardShortcuts, useKeyboardFeedback } from '../hooks/useKeyboardShortcuts';
import { Acronym } from '../types/game';
import './GuessAcronymGame.css';
import './KeyboardFeedback.css';

export const GuessAcronymGame: React.FC = () => {
  const navigate = useNavigate();
  const {
    getRandomAcronym,
    getPreviousAcronym,
    isLoading,
    error,
    isOffline
  } = useContentManager();

  const [currentAcronym, setCurrentAcronym] = useState<Acronym | null>(null);
  const [showMeaning, setShowMeaning] = useState<boolean>(false);
  const [timerKey, setTimerKey] = useState<number>(0);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  // Refs for visual feedback
  const shuffleButtonRef = useRef<HTMLButtonElement>(null);
  const previousButtonRef = useRef<HTMLButtonElement>(null);
  const restartButtonRef = useRef<HTMLButtonElement>(null);
  const revealButtonRef = useRef<HTMLButtonElement>(null);

  const TIMER_DURATION = 10; // 10 seconds for Guess the Acronym
  
  const { showKeyboardFeedback } = useKeyboardFeedback();

  // Load initial acronym
  useEffect(() => {
    if (!isLoading && !error) {
      loadNewAcronym();
    }
  }, [isLoading, error]);

  const loadNewAcronym = useCallback(() => {
    const acronym = getRandomAcronym();
    setCurrentAcronym(acronym);
    setShowMeaning(false); // Hide meaning when loading new acronym
  }, [getRandomAcronym]);

  const handleShuffle = useCallback(() => {
    loadNewAcronym();
    setTimerKey(prev => prev + 1); // Reset timer
    showKeyboardFeedback('→ Shuffle');
    
    // Visual feedback
    if (shuffleButtonRef.current) {
      shuffleButtonRef.current.classList.add('keyboard-pressed');
      setTimeout(() => {
        shuffleButtonRef.current?.classList.remove('keyboard-pressed');
      }, 150);
    }
  }, [loadNewAcronym, showKeyboardFeedback]);

  const handlePrevious = useCallback(() => {
    const previousAcronym = getPreviousAcronym();
    if (previousAcronym) {
      setCurrentAcronym(previousAcronym);
      setShowMeaning(false); // Hide meaning when going to previous
      setTimerKey(prev => prev + 1); // Reset timer
      showKeyboardFeedback('← Previous');
      
      // Visual feedback
      if (previousButtonRef.current) {
        previousButtonRef.current.classList.add('keyboard-pressed');
        setTimeout(() => {
          previousButtonRef.current?.classList.remove('keyboard-pressed');
        }, 150);
      }
    }
  }, [getPreviousAcronym, showKeyboardFeedback]);

  const handleRestartTimer = useCallback(() => {
    setTimerKey(prev => prev + 1);
    showKeyboardFeedback('Space - Restart Timer');
    
    // Visual feedback
    if (restartButtonRef.current) {
      restartButtonRef.current.classList.add('keyboard-pressed');
      setTimeout(() => {
        restartButtonRef.current?.classList.remove('keyboard-pressed');
      }, 150);
    }
  }, [showKeyboardFeedback]);

  const handleRevealMeaning = useCallback(() => {
    setShowMeaning(prev => !prev);
    showKeyboardFeedback('R/Enter - Reveal');
    
    // Visual feedback
    if (revealButtonRef.current) {
      revealButtonRef.current.classList.add('keyboard-pressed');
      setTimeout(() => {
        revealButtonRef.current?.classList.remove('keyboard-pressed');
      }, 150);
    }
  }, [showKeyboardFeedback]);

  const handleTimerComplete = useCallback(() => {
    // Timer completed - could add additional logic here if needed
    console.log('Timer completed for acronym:', currentAcronym?.term);
  }, [currentAcronym]);

  const handleBackToHome = useCallback(() => {
    navigate('/');
    showKeyboardFeedback('Esc - Back to Home');
  }, [navigate, showKeyboardFeedback]);

  const handleAudioToggle = useCallback((enabled: boolean) => {
    setAudioEnabled(enabled);
  }, []);

  // Use the new keyboard shortcuts hook
  useKeyboardShortcuts({
    shortcuts: {
      onSpacePress: handleRestartTimer,
      onArrowRight: handleShuffle,
      onArrowLeft: handlePrevious,
      onKeyR: handleRevealMeaning,
      onEnter: handleRevealMeaning,
      onEscape: handleBackToHome,
    },
    enabled: true,
    preventDefault: true,
    excludeInputs: true,
  });

  if (isLoading) {
    return (
      <div className="guess-acronym-game">
        <div className="guess-acronym-game__loading">
          <div className="loading-spinner"></div>
          <p>Loading acronyms...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="guess-acronym-game">
        <div className="guess-acronym-game__error">
          <h2>Unable to Load Content</h2>
          <p>{error}</p>
          {isOffline && (
            <p className="offline-notice">
              You appear to be offline. Please check your connection and try again.
            </p>
          )}
          <button 
            className="btn btn-primary"
            onClick={handleBackToHome}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="guess-acronym-game">
      <header className="guess-acronym-game__header">
        <button 
          className="btn btn-back"
          onClick={handleBackToHome}
          title="Back to game selection (Esc)"
        >
          ← Back
        </button>
        
        <h1 className="guess-acronym-game__title">
          Guess the Acronym
        </h1>

        {isOffline && (
          <div className="offline-indicator">
            📡 Offline Mode
          </div>
        )}
      </header>

      <main className="guess-acronym-game__main">
        <div className="guess-acronym-game__content">
          <div className="acronym-display">
            {currentAcronym ? (
              <>
                <div className="acronym-term">
                  {currentAcronym.term}
                </div>
                
                <div className={`acronym-meaning ${showMeaning ? 'acronym-meaning--visible' : 'acronym-meaning--hidden'}`}>
                  {showMeaning ? currentAcronym.meaning : '???'}
                </div>
              </>
            ) : (
              <div className="acronym-term acronym-term--placeholder">
                No acronyms available
              </div>
            )}
          </div>

          <div className="timer-section">
            <Timer
              key={timerKey}
              duration={TIMER_DURATION}
              onComplete={handleTimerComplete}
              autoStart={false}
              audioEnabled={audioEnabled}
              onAudioToggle={handleAudioToggle}
            />
          </div>
        </div>

        <div className="guess-acronym-game__actions">
          <button
            ref={previousButtonRef}
            className="btn btn-secondary"
            onClick={handlePrevious}
            disabled={!getPreviousAcronym()}
            title="Previous acronym (←)"
          >
            Previous
          </button>

          <button
            ref={revealButtonRef}
            className="btn btn-reveal"
            onClick={handleRevealMeaning}
            disabled={!currentAcronym}
            title="Reveal/Hide meaning (R or Enter)"
          >
            {showMeaning ? 'Hide Meaning' : 'Reveal Meaning'}
          </button>

          <button
            ref={shuffleButtonRef}
            className="btn btn-primary"
            onClick={handleShuffle}
            disabled={!currentAcronym}
            title="Next acronym (→)"
          >
            Shuffle
          </button>

          <button
            ref={restartButtonRef}
            className="btn btn-accent"
            onClick={handleRestartTimer}
            title="Restart timer (Space)"
          >
            Restart Timer
          </button>
        </div>

        <div className="guess-acronym-game__shortcuts">
          <p className="shortcuts-text">
            <strong>Shortcuts:</strong> 
            <span className="shortcut-key">Space</span> = Restart Timer, 
            <span className="shortcut-key">←</span> = Previous, 
            <span className="shortcut-key">→</span> = Shuffle, 
            <span className="shortcut-key">R</span>/<span className="shortcut-key">Enter</span> = Reveal, 
            <span className="shortcut-key">Esc</span> = Home
          </p>
        </div>
      </main>
    </div>
  );
};