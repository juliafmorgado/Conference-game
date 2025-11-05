import React, { useState } from 'react';
import { Timer } from './';

const TimerDemo: React.FC = () => {
  const [timerDuration, setTimerDuration] = useState(10);
  const [completionCount, setCompletionCount] = useState(0);

  const handleTimerComplete = () => {
    setCompletionCount(prev => prev + 1);
    console.log('Timer completed!');
  };

  const handleAudioToggle = (enabled: boolean) => {
    console.log('Audio toggled:', enabled);
  };

  const handleTick = (remaining: number) => {
    console.log('Timer tick:', remaining);
  };

  return (
    <div style={{ 
      padding: '2rem', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      gap: '2rem',
      backgroundColor: '#0a0a0a',
      minHeight: '100vh'
    }}>
      <h1 style={{ color: 'white', marginBottom: '2rem' }}>Timer Component Demo</h1>
      
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ color: 'white', marginRight: '1rem' }}>
          Duration (seconds):
          <input 
            type="number" 
            value={timerDuration} 
            onChange={(e) => setTimerDuration(Number(e.target.value))}
            min="1"
            max="300"
            style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
          />
        </label>
      </div>

      <Timer
        duration={timerDuration}
        onComplete={handleTimerComplete}
        onTick={handleTick}
        audioEnabled={true}
        onAudioToggle={handleAudioToggle}
        autoStart={false}
      />

      <div style={{ color: 'white', textAlign: 'center' }}>
        <p>Completions: {completionCount}</p>
        <p>Features tested:</p>
        <ul style={{ textAlign: 'left' }}>
          <li>✅ Countdown timer with progress bar</li>
          <li>✅ Numeric display and completion callback</li>
          <li>✅ Pause/resume functionality for tab visibility</li>
          <li>✅ Timer completion sound</li>
          <li>✅ Audio toggle functionality</li>
          <li>✅ Visual "Time!" notification</li>
        </ul>
      </div>
    </div>
  );
};

export default TimerDemo;