import React from 'react';
import { useNavigate } from 'react-router-dom';
import './GameSelector.css';

export const GameSelector: React.FC = React.memo(() => {
  const navigate = useNavigate();

  const handleGameSelection = (gameMode: 'finish-sentence' | 'guess-acronym') => {
    navigate(`/${gameMode}`);
  };

  return (
    <div className="game-selector">
      <div className="game-selector__container">
        <header className="game-selector__header">
          <h1 className="game-selector__title">Conference Games</h1>
          <p className="game-selector__subtitle">
            Choose your interactive game mode
          </p>
        </header>

        <div className="game-selector__buttons">
          <button
            className="game-selector__button game-selector__button--finish-sentence"
            onClick={() => handleGameSelection('finish-sentence')}
            type="button"
          >
            <div className="game-selector__button-content">
              <span className="game-selector__button-title">
                Finish the Sentence
              </span>
              <span className="game-selector__button-description">
                30-second interactive discussions
              </span>
            </div>
          </button>

          <button
            className="game-selector__button game-selector__button--guess-acronym"
            onClick={() => handleGameSelection('guess-acronym')}
            type="button"
          >
            <div className="game-selector__button-content">
              <span className="game-selector__button-title">
                Guess the Acronym
              </span>
              <span className="game-selector__button-description">
                10-second technical challenges
              </span>
            </div>
          </button>
        </div>

        <footer className="game-selector__footer">
          <p className="game-selector__footer-text">
            Optimized for tablets, laptops, and mobile devices
          </p>
        </footer>
      </div>
    </div>
  );
});