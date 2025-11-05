import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcuts {
  onSpacePress?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onEscape?: () => void;
  onEnter?: () => void;
  onKeyR?: () => void;
  // Add more shortcuts as needed
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcuts;
  enabled?: boolean;
  preventDefault?: boolean;
  excludeInputs?: boolean;
}

/**
 * Custom hook for handling keyboard shortcuts with optimized performance
 * Ensures 100ms response time for inputs as per requirements
 */
export const useKeyboardShortcuts = ({
  shortcuts,
  enabled = true,
  preventDefault = true,
  excludeInputs = true
}: UseKeyboardShortcutsOptions) => {
  const shortcutsRef = useRef(shortcuts);
  const lastExecutionRef = useRef<{ [key: string]: number }>({});

  // Update shortcuts ref when shortcuts change
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Exclude input elements if specified
    if (excludeInputs && event.target instanceof HTMLElement) {
      const tagName = event.target.tagName.toLowerCase();
      const inputTypes = ['input', 'textarea', 'select', 'button'];
      
      // Allow shortcuts on buttons but exclude other input types
      if (inputTypes.includes(tagName) && tagName !== 'button') {
        return;
      }
      
      // Also check for contenteditable
      if (event.target.contentEditable === 'true') {
        return;
      }
    }

    // Throttle rapid key presses to ensure 100ms response time
    const now = Date.now();
    const keyCode = event.code;
    const lastExecution = lastExecutionRef.current[keyCode] || 0;
    
    if (now - lastExecution < 100) {
      return; // Throttle to prevent rapid firing
    }
    
    lastExecutionRef.current[keyCode] = now;

    // Handle different key combinations
    let handled = false;

    switch (event.code) {
      case 'Space':
        if (shortcutsRef.current.onSpacePress) {
          shortcutsRef.current.onSpacePress();
          handled = true;
        }
        break;
      
      case 'ArrowLeft':
        if (shortcutsRef.current.onArrowLeft) {
          shortcutsRef.current.onArrowLeft();
          handled = true;
        }
        break;
      
      case 'ArrowRight':
        if (shortcutsRef.current.onArrowRight) {
          shortcutsRef.current.onArrowRight();
          handled = true;
        }
        break;
      
      case 'Escape':
        if (shortcutsRef.current.onEscape) {
          shortcutsRef.current.onEscape();
          handled = true;
        }
        break;
      
      case 'Enter':
        if (shortcutsRef.current.onEnter) {
          shortcutsRef.current.onEnter();
          handled = true;
        }
        break;
      
      case 'KeyR':
        if (shortcutsRef.current.onKeyR) {
          shortcutsRef.current.onKeyR();
          handled = true;
        }
        break;
    }

    // Prevent default behavior if handler was found and preventDefault is enabled
    if (handled && preventDefault) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, [enabled, preventDefault, excludeInputs]);

  useEffect(() => {
    if (!enabled) return;

    // Use capture phase for better performance and to ensure we catch events first
    document.addEventListener('keydown', handleKeyDown, { capture: true, passive: false });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [handleKeyDown, enabled]);

  // Return utility functions for manual control
  return {
    isEnabled: enabled,
    // Could add methods to temporarily disable/enable shortcuts
  };
};

/**
 * Hook for visual feedback on keyboard interactions
 */
export const useKeyboardFeedback = () => {
  const feedbackRef = useRef<HTMLElement | null>(null);

  const showKeyboardFeedback = useCallback((key: string, _element?: HTMLElement) => {
    
    // Create or update feedback element
    if (!feedbackRef.current) {
      feedbackRef.current = document.createElement('div');
      feedbackRef.current.className = 'keyboard-feedback';
      feedbackRef.current.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: bold;
        z-index: 9999;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
      `;
      document.body.appendChild(feedbackRef.current);
    }

    // Update content and show
    feedbackRef.current.textContent = `Key: ${key}`;
    feedbackRef.current.style.opacity = '1';

    // Hide after short delay
    setTimeout(() => {
      if (feedbackRef.current) {
        feedbackRef.current.style.opacity = '0';
      }
    }, 800);
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup feedback element on unmount
      if (feedbackRef.current && feedbackRef.current.parentNode) {
        feedbackRef.current.parentNode.removeChild(feedbackRef.current);
      }
    };
  }, []);

  return { showKeyboardFeedback };
};