import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TimerProps, TimerState } from '../types';
import { useTimerAudio } from '../hooks';
import './Timer.css';

const Timer: React.FC<TimerProps> = React.memo(({
  duration,
  onComplete,
  autoStart = false,
  onTick,
  audioEnabled = true,
  onAudioToggle
}) => {
  const [timerState, setTimerState] = useState<TimerState>({
    duration,
    remaining: duration,
    isRunning: false,
    isPaused: false
  });

  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(audioEnabled);
  const [showTimeNotification, setShowTimeNotification] = useState<boolean>(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef<boolean>(true);
  const { playCompletionSound, playTickSound } = useTimerAudio({ enabled: isAudioEnabled });

  // Handle tab visibility changes for pause/resume functionality
  const handleVisibilityChange = useCallback(() => {
    const isVisible = !document.hidden;
    isVisibleRef.current = isVisible;

    if (timerState.isRunning) {
      if (isVisible && timerState.isPaused) {
        // Resume timer when tab becomes visible
        setTimerState(prev => ({ ...prev, isPaused: false }));
      } else if (!isVisible && !timerState.isPaused) {
        // Pause timer when tab becomes hidden
        setTimerState(prev => ({ ...prev, isPaused: true }));
      }
    }
  }, [timerState.isRunning, timerState.isPaused]);

  // Set up visibility change listener
  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  // Timer countdown logic
  useEffect(() => {
    if (timerState.isRunning && !timerState.isPaused && timerState.remaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimerState(prev => {
          const newRemaining = prev.remaining - 1;
          
          // Call onTick callback if provided
          if (onTick) {
            onTick(newRemaining);
          }

          if (newRemaining <= 0) {
            // Timer completed
            playCompletionSound();
            setShowTimeNotification(true);
            onComplete();
            
            // Hide notification after 3 seconds
            setTimeout(() => {
              setShowTimeNotification(false);
            }, 3000);
            
            return {
              ...prev,
              remaining: 0,
              isRunning: false,
              isPaused: false
            };
          }

          // Play tick sound for last 5 seconds
          if (newRemaining <= 5 && newRemaining > 0) {
            playTickSound();
          }

          return {
            ...prev,
            remaining: newRemaining
          };
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timerState.isRunning, timerState.isPaused, timerState.remaining, onComplete, onTick]);

  // Auto-start functionality
  useEffect(() => {
    if (autoStart) {
      setTimerState(prev => ({ ...prev, isRunning: true }));
    }
  }, [autoStart]);

  // Update timer when duration prop changes
  useEffect(() => {
    setTimerState(prev => ({
      ...prev,
      duration,
      remaining: duration,
      isRunning: false,
      isPaused: false
    }));
  }, [duration]);

  const startTimer = useCallback(() => {
    setTimerState(prev => ({ ...prev, isRunning: true, isPaused: false }));
  }, []);

  const pauseTimer = useCallback(() => {
    setTimerState(prev => ({ ...prev, isPaused: true }));
  }, []);

  const resumeTimer = useCallback(() => {
    setTimerState(prev => ({ ...prev, isPaused: false }));
  }, []);

  const resetTimer = useCallback(() => {
    setTimerState(prev => ({
      ...prev,
      remaining: prev.duration,
      isRunning: false,
      isPaused: false
    }));
  }, []);

  const restartTimer = useCallback(() => {
    setShowTimeNotification(false);
    setTimerState(prev => ({
      ...prev,
      remaining: prev.duration,
      isRunning: true,
      isPaused: false
    }));
  }, []);

  const toggleAudio = useCallback(() => {
    const newAudioState = !isAudioEnabled;
    setIsAudioEnabled(newAudioState);
    if (onAudioToggle) {
      onAudioToggle(newAudioState);
    }
  }, [isAudioEnabled, onAudioToggle]);

  // Calculate progress percentage for progress bar
  const progressPercentage = ((timerState.duration - timerState.remaining) / timerState.duration) * 100;

  // Format time display (MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="timer-container">
      <div className="timer-display">
        <div className={`timer-text ${timerState.remaining === 0 ? 'timer-expired' : ''}`}>
          {formatTime(timerState.remaining)}
        </div>
        
        <div className="timer-progress-container">
          <div 
            className="timer-progress-bar"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        <div className="timer-status">
          {timerState.isPaused && (
            <span className="timer-paused">Paused</span>
          )}
          {(timerState.remaining === 0 || showTimeNotification) && (
            <span className="timer-completed">Time!</span>
          )}
        </div>
      </div>

      <div className="timer-controls">
        <div className="timer-main-controls">
          {!timerState.isRunning ? (
            <button 
              className="timer-btn timer-btn-start" 
              onClick={startTimer}
              disabled={timerState.remaining === 0}
            >
              Start
            </button>
          ) : (
            <>
              {timerState.isPaused ? (
                <button 
                  className="timer-btn timer-btn-resume" 
                  onClick={resumeTimer}
                >
                  Resume
                </button>
              ) : (
                <button 
                  className="timer-btn timer-btn-pause" 
                  onClick={pauseTimer}
                >
                  Pause
                </button>
              )}
            </>
          )}
          
          <button 
            className="timer-btn timer-btn-reset" 
            onClick={resetTimer}
          >
            Reset
          </button>
          
          <button 
            className="timer-btn timer-btn-restart" 
            onClick={restartTimer}
          >
            Restart
          </button>
        </div>

        <div className="timer-audio-controls">
          <button 
            className={`timer-btn timer-btn-audio ${isAudioEnabled ? 'audio-enabled' : 'audio-disabled'}`}
            onClick={toggleAudio}
            title={isAudioEnabled ? 'Disable audio alerts' : 'Enable audio alerts'}
          >
            {isAudioEnabled ? '🔊' : '🔇'}
          </button>
        </div>
      </div>
    </div>
  );
});

export default Timer;