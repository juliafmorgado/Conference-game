import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Timer from './Timer';
import { useContentManager } from '../hooks/useContentManager';
import { useKeyboardShortcuts, useKeyboardFeedback } from '../hooks/useKeyboardShortcuts';
import { Sentence } from '../types/game';
import './FinishSentenceGame.css';
import './KeyboardFeedback.css';

export const FinishSentenceGame: React.FC = () => {
  const navigate = useNavigate();
  const {
    getRandomSentence,
    getPreviousSentence,
    getAvailableCategories,
    isLoading,
    error,
    isOffline
  } = useContentManager();

  const [currentSentence, setCurrentSentence] = useState<Sentence | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [timerKey, setTimerKey] = useState<number>(0);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  // Refs for visual feedback
  const shuffleButtonRef = useRef<HTMLButtonElement>(null);
  const previousButtonRef = useRef<HTMLButtonElement>(null);
  const restartButtonRef = useRef<HTMLButtonElement>(null);

  const categories = getAvailableCategories();
  const TIMER_DURATION = 30; // 30 seconds for Finish the Sentence
  
  const { showKeyboardFeedback } = useKeyboardFeedback();

  // Load initial sentence
  useEffect(() => {
    if (!isLoading && !error) {
      loadNewSentence();
    }
  }, [isLoading, error, selectedCategory]);

  const loadNewSentence = useCallback(() => {
    const sentence = getRandomSentence(selectedCategory || undefined);
    setCurrentSentence(sentence);
  }, [getRandomSentence, selectedCategory]);

  const handleShuffle = useCallback(() => {
    loadNewSentence();
    setTimerKey(prev => prev + 1); // Reset timer
    showKeyboardFeedback('→ Shuffle');
    
    // Visual feedback
    if (shuffleButtonRef.current) {
      shuffleButtonRef.current.classList.add('keyboard-pressed');
      setTimeout(() => {
        shuffleButtonRef.current?.classList.remove('keyboard-pressed');
      }, 150);
    }
  }, [loadNewSentence, showKeyboardFeedback]);

  const handlePrevious = useCallback(() => {
    const previousSentence = getPreviousSentence();
    if (previousSentence) {
      setCurrentSentence(previousSentence);
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
  }, [getPreviousSentence, showKeyboardFeedback]);

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

  const handleTimerComplete = useCallback(() => {
    // Timer completed - could add additional logic here if needed
    console.log('Timer completed for sentence:', currentSentence?.text);
  }, [currentSentence]);

  const handleCategoryChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(event.target.value);
  }, []);

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
      onEscape: handleBackToHome,
    },
    enabled: true,
    preventDefault: true,
    excludeInputs: true,
  });

  if (isLoading) {
    return (
      <div className="finish-sentence-game">
        <div className="finish-sentence-game__loading">
          <div className="loading-spinner"></div>
          <p>Loading sentences...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="finish-sentence-game">
        <div className="finish-sentence-game__error">
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
    <div className="finish-sentence-game">
      <header className="finish-sentence-game__header">
        <button 
          className="btn btn-back"
          onClick={handleBackToHome}
          title="Back to game selection (Esc)"
        >
          ← Back
        </button>
        
        <h1 className="finish-sentence-game__title">
          Finish the Sentence
        </h1>

        {isOffline && (
          <div className="offline-indicator">
            📡 Offline Mode
          </div>
        )}
      </header>

      <main className="finish-sentence-game__main">
        <div className="finish-sentence-game__controls">
          <div className="category-selector">
            <label htmlFor="category-select" className="category-label">
              Category:
            </label>
            <select
              id="category-select"
              className="category-dropdown"
              value={selectedCategory}
              onChange={handleCategoryChange}
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="finish-sentence-game__content">
          <div className="sentence-display">
            {currentSentence ? (
              <p className="sentence-text">
                {currentSentence.text}
              </p>
            ) : (
              <p className="sentence-text sentence-text--placeholder">
                No sentences available for the selected category
              </p>
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

        <div className="finish-sentence-game__actions">
          <button
            ref={previousButtonRef}
            className="btn btn-secondary"
            onClick={handlePrevious}
            disabled={!getPreviousSentence()}
            title="Previous sentence (←)"
          >
            Previous
          </button>

          <button
            ref={shuffleButtonRef}
            className="btn btn-primary"
            onClick={handleShuffle}
            disabled={!currentSentence}
            title="Next sentence (→)"
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

        <div className="finish-sentence-game__shortcuts">
          <p className="shortcuts-text">
            <strong>Shortcuts:</strong> 
            <span className="shortcut-key">Space</span> = Restart Timer, 
            <span className="shortcut-key">←</span> = Previous, 
            <span className="shortcut-key">→</span> = Shuffle, 
            <span className="shortcut-key">Esc</span> = Home
          </p>
        </div>
      </main>
    </div>
  );
};