/**
 * Complete Application Flow Integration Tests
 * Tests all game modes end-to-end, keyboard shortcuts, timer functionality, and offline behavior
 * Requirements: 1.1, 2.1, 3.1, 4.1, 7.1
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameSelector } from '../../components/GameSelector';
import { FinishSentenceGame } from '../../components/FinishSentenceGame';
import { GuessAcronymGame } from '../../components/GuessAcronymGame';

// Mock the content API
const mockSentences = [
  { id: '1', text: 'Kubernetes is...', category: 'Kubernetes' },
  { id: '2', text: 'DevOps means...', category: 'DevOps' },
  { id: '3', text: 'Observability helps...', category: 'Observability' }
];

const mockAcronyms = [
  { id: '1', term: 'API', meaning: 'Application Programming Interface' },
  { id: '2', term: 'CI/CD', meaning: 'Continuous Integration/Continuous Deployment' },
  { id: '3', term: 'SRE', meaning: 'Site Reliability Engineering' }
];

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock audio context for timer sounds
global.AudioContext = vi.fn().mockImplementation(() => ({
  createOscillator: vi.fn().mockReturnValue({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { setValueAtTime: vi.fn() }
  }),
  createGain: vi.fn().mockReturnValue({
    connect: vi.fn(),
    gain: { setValueAtTime: vi.fn() }
  }),
  destination: {}
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

const renderWithRouter = (component: React.ReactElement, initialEntries = ['/']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      {component}
    </MemoryRouter>
  );
};

describe('Complete Application Flow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    // Mock successful API responses
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/sentences')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ sentences: mockSentences })
        });
      }
      if (url.includes('/acronyms')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ acronyms: mockAcronyms })
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Landing Page and Navigation', () => {
    it('should display game selector with both game mode buttons', async () => {
      renderWithRouter(<GameSelector />);
      
      expect(screen.getByText('Conference Games')).toBeInTheDocument();
      expect(screen.getByText('Finish the Sentence')).toBeInTheDocument();
      expect(screen.getByText('Guess the Acronym')).toBeInTheDocument();
    });

    it('should have working navigation buttons', async () => {
      const mockNavigate = vi.fn();
      vi.mock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom');
        return {
          ...actual,
          useNavigate: () => mockNavigate,
        };
      });

      renderWithRouter(<GameSelector />);
      
      const finishSentenceButton = screen.getByText('Finish the Sentence');
      const guessAcronymButton = screen.getByText('Guess the Acronym');
      
      expect(finishSentenceButton).toBeInTheDocument();
      expect(guessAcronymButton).toBeInTheDocument();
    });
  });

  describe('Finish the Sentence Game Flow', () => {
    it('should load and display sentence content', async () => {
      renderWithRouter(<FinishSentenceGame />);
      
      await waitFor(() => {
        expect(screen.getByText('Finish the Sentence')).toBeInTheDocument();
      });

      // Wait for content to load
      await waitFor(() => {
        const sentenceText = mockSentences.find(s => 
          screen.queryByText(s.text)
        );
        expect(sentenceText).toBeTruthy();
      });
    });

    it('should display 30-second timer with controls', async () => {
      renderWithRouter(<FinishSentenceGame />);
      
      await waitFor(() => {
        expect(screen.getByText('00:30')).toBeInTheDocument();
        expect(screen.getByText('Start')).toBeInTheDocument();
        expect(screen.getByText('Reset')).toBeInTheDocument();
        expect(screen.getByText('Restart')).toBeInTheDocument();
      });
    });

    it('should provide shuffle, previous, and restart timer buttons', async () => {
      renderWithRouter(<FinishSentenceGame />);
      
      await waitFor(() => {
        expect(screen.getByText('Shuffle')).toBeInTheDocument();
        expect(screen.getByText('Previous')).toBeInTheDocument();
        expect(screen.getByText('Restart Timer')).toBeInTheDocument();
      });
    });

    it('should display category filter dropdown', async () => {
      renderWithRouter(<FinishSentenceGame />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('Category:')).toBeInTheDocument();
        expect(screen.getByDisplayValue('All Categories')).toBeInTheDocument();
      });
    });
  });

  describe('Guess the Acronym Game Flow', () => {
    it('should load and display acronym content', async () => {
      renderWithRouter(<GuessAcronymGame />);
      
      await waitFor(() => {
        expect(screen.getByText('Guess the Acronym')).toBeInTheDocument();
      });

      // Wait for content to load
      await waitFor(() => {
        const acronymTerm = mockAcronyms.find(a => 
          screen.queryByText(a.term)
        );
        expect(acronymTerm).toBeTruthy();
      });
    });

    it('should display 10-second timer with controls', async () => {
      renderWithRouter(<GuessAcronymGame />);
      
      await waitFor(() => {
        expect(screen.getByText('00:10')).toBeInTheDocument();
        expect(screen.getByText('Start')).toBeInTheDocument();
      });
    });

    it('should provide reveal meaning functionality', async () => {
      renderWithRouter(<GuessAcronymGame />);
      
      await waitFor(() => {
        expect(screen.getByText('Reveal Meaning')).toBeInTheDocument();
        expect(screen.getByText('???')).toBeInTheDocument();
      });

      // Click reveal button
      fireEvent.click(screen.getByText('Reveal Meaning'));
      
      await waitFor(() => {
        expect(screen.getByText('Hide Meaning')).toBeInTheDocument();
        // Should show actual meaning instead of ???
        const meaningText = mockAcronyms.find(a => 
          screen.queryByText(a.meaning)
        );
        expect(meaningText).toBeTruthy();
      });
    });
  });

  describe('Timer Functionality', () => {
    it('should start timer when start button is clicked', async () => {
      renderWithRouter(<FinishSentenceGame />);
      
      await waitFor(() => {
        expect(screen.getByText('Start')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Start'));
      
      await waitFor(() => {
        expect(screen.getByText('Pause')).toBeInTheDocument();
      });
    });

    it('should pause and resume timer', async () => {
      renderWithRouter(<FinishSentenceGame />);
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Start'));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText('Pause'));
      });

      await waitFor(() => {
        expect(screen.getByText('Resume')).toBeInTheDocument();
        expect(screen.getByText('Paused')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Resume'));
      
      await waitFor(() => {
        expect(screen.getByText('Pause')).toBeInTheDocument();
      });
    });

    it('should reset timer to initial duration', async () => {
      renderWithRouter(<FinishSentenceGame />);
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Start'));
      });

      // Wait a moment for timer to tick
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1100));
      });

      fireEvent.click(screen.getByText('Reset'));
      
      await waitFor(() => {
        expect(screen.getByText('00:30')).toBeInTheDocument();
        expect(screen.getByText('Start')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should handle spacebar for timer restart in Finish the Sentence', async () => {
      renderWithRouter(<FinishSentenceGame />);
      
      await waitFor(() => {
        expect(screen.getByText('00:30')).toBeInTheDocument();
      });

      // Press spacebar
      fireEvent.keyDown(document, { code: 'Space' });
      
      await waitFor(() => {
        expect(screen.getByText('Pause')).toBeInTheDocument();
      });
    });

    it('should handle R key for reveal in Guess the Acronym', async () => {
      renderWithRouter(<GuessAcronymGame />);
      
      await waitFor(() => {
        expect(screen.getByText('???')).toBeInTheDocument();
      });

      // Press R key
      fireEvent.keyDown(document, { code: 'KeyR' });
      
      await waitFor(() => {
        const meaningText = mockAcronyms.find(a => 
          screen.queryByText(a.meaning)
        );
        expect(meaningText).toBeTruthy();
      });
    });
  });

  describe('Offline Behavior and Content Caching', () => {
    it('should display offline indicator when offline', async () => {
      // Set navigator to offline
      Object.defineProperty(navigator, 'onLine', { value: false });
      
      renderWithRouter(<FinishSentenceGame />);
      
      await waitFor(() => {
        expect(screen.getByText('📡 Offline Mode')).toBeInTheDocument();
      });
    });

    it('should handle content loading errors gracefully', async () => {
      // Mock API failure with no cached content
      (global.fetch as any).mockRejectedValue(new Error('Network error'));
      
      renderWithRouter(<FinishSentenceGame />);
      
      await waitFor(() => {
        expect(screen.getByText('Unable to Load Content')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Audio Functionality', () => {
    it('should provide audio toggle controls', async () => {
      renderWithRouter(<FinishSentenceGame />);
      
      await waitFor(() => {
        expect(screen.getByTitle('Disable audio alerts')).toBeInTheDocument();
      });

      // Click audio toggle
      fireEvent.click(screen.getByTitle('Disable audio alerts'));
      
      await waitFor(() => {
        expect(screen.getByTitle('Enable audio alerts')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design and Accessibility', () => {
    it('should display keyboard shortcuts help text', async () => {
      renderWithRouter(<FinishSentenceGame />);
      
      await waitFor(() => {
        expect(screen.getByText(/Shortcuts:/)).toBeInTheDocument();
        expect(screen.getByText(/Space/)).toBeInTheDocument();
        expect(screen.getByText(/Restart Timer/)).toBeInTheDocument();
      });
    });

    it('should provide proper button titles for accessibility', async () => {
      renderWithRouter(<FinishSentenceGame />);
      
      await waitFor(() => {
        expect(screen.getByTitle('Next sentence (→)')).toBeInTheDocument();
        expect(screen.getByTitle('Previous sentence (←)')).toBeInTheDocument();
        expect(screen.getByTitle('Restart timer (Space)')).toBeInTheDocument();
        expect(screen.getByTitle('Back to game selection (Esc)')).toBeInTheDocument();
      });
    });
  });
});