/**
 * Loading indicator component for content loading states
 * Provides visual feedback during content fetching and caching operations
 */

import React from 'react';
import './LoadingIndicator.css';

interface LoadingIndicatorProps {
  isLoading: boolean;
  error?: string | null;
  isOffline?: boolean;
  onRetry?: () => void;
  message?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'spinner' | 'dots' | 'pulse';
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  isLoading,
  error,
  isOffline = false,
  onRetry,
  message,
  size = 'medium',
  variant = 'spinner'
}) => {
  if (!isLoading && !error && !isOffline) {
    return null;
  }

  const getLoadingAnimation = () => {
    switch (variant) {
      case 'dots':
        return (
          <div className={`loading-dots loading-dots--${size}`}>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
          </div>
        );
      case 'pulse':
        return <div className={`loading-pulse loading-pulse--${size}`}></div>;
      default:
        return <div className={`loading-spinner loading-spinner--${size}`}></div>;
    }
  };

  const getStatusMessage = () => {
    if (error) {
      return isOffline 
        ? 'Connection lost. Using cached content.'
        : 'Failed to load content. Please try again.';
    }
    
    if (isOffline) {
      return 'Offline mode. Using cached content.';
    }
    
    return message || 'Loading content...';
  };

  const getStatusIcon = () => {
    if (error && !isOffline) {
      return '⚠️';
    }
    
    if (isOffline) {
      return '📱';
    }
    
    return null;
  };

  return (
    <div className={`loading-indicator loading-indicator--${size}`}>
      {isLoading && (
        <div className="loading-indicator__animation">
          {getLoadingAnimation()}
        </div>
      )}
      
      <div className={`loading-indicator__content ${error ? 'loading-indicator__content--error' : ''} ${isOffline ? 'loading-indicator__content--offline' : ''}`}>
        {getStatusIcon() && (
          <span className="loading-indicator__icon" role="img" aria-label="Status">
            {getStatusIcon()}
          </span>
        )}
        
        <span className="loading-indicator__message">
          {getStatusMessage()}
        </span>
        
        {error && onRetry && !isOffline && (
          <button 
            className="loading-indicator__retry-button"
            onClick={onRetry}
            type="button"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

export default LoadingIndicator;