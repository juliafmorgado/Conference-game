/**
 * ContentManager custom hook for fetching and caching game content
 * Implements history tracking for repeat prevention and category filtering
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Sentence, Acronym, SentencesResponse, AcronymsResponse } from '../types/game';

interface ContentManagerState {
  sentences: Sentence[];
  acronyms: Acronym[];
  categories: string[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
}

interface ContentHistory {
  sentences: string[];
  acronyms: string[];
  maxHistorySize: number;
}

interface UseContentManagerOptions {
  maxHistorySize?: number;
  cacheExpiry?: number; // in milliseconds
  enableOfflineMode?: boolean;
}

interface UseContentManagerReturn {
  // Content data
  sentences: Sentence[];
  acronyms: Acronym[];
  categories: string[];
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  isOffline: boolean;
  
  // Content operations
  getRandomSentence: (category?: string) => Sentence | null;
  getRandomAcronym: () => Acronym | null;
  getPreviousSentence: () => Sentence | null;
  getPreviousAcronym: () => Acronym | null;
  
  // Cache operations
  refreshContent: () => Promise<void>;
  clearCache: () => void;
  clearHistory: () => void;
  
  // Category operations
  getAvailableCategories: () => string[];
  getSentencesByCategory: (category: string) => Sentence[];
}

const CACHE_KEYS = {
  SENTENCES: 'conference-games-sentences',
  ACRONYMS: 'conference-games-acronyms',
  CATEGORIES: 'conference-games-categories',
  HISTORY: 'conference-games-history',
  LAST_FETCH: 'conference-games-last-fetch'
};

const DEFAULT_OPTIONS: Required<UseContentManagerOptions> = {
  maxHistorySize: 20,
  cacheExpiry: 5 * 60 * 1000, // 5 minutes
  enableOfflineMode: true
};

export const useContentManager = (options: UseContentManagerOptions = {}): UseContentManagerReturn => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [state, setState] = useState<ContentManagerState>({
    sentences: [],
    acronyms: [],
    categories: [],
    isLoading: false,
    error: null,
    lastFetch: null
  });
  
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const historyRef = useRef<ContentHistory>({
    sentences: [],
    acronyms: [],
    maxHistorySize: opts.maxHistorySize
  });
  
  // Load cached data on mount
  useEffect(() => {
    loadFromCache();
    loadHistoryFromStorage();
    
    // Set up online/offline listeners
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Auto-refresh content if cache is expired and online
  useEffect(() => {
    const shouldRefresh = state.lastFetch === null || 
      (Date.now() - state.lastFetch > opts.cacheExpiry);
    
    if (shouldRefresh && !isOffline && !state.isLoading) {
      refreshContent();
    }
  }, [isOffline, state.lastFetch, state.isLoading]);
  
  const loadFromCache = useCallback(() => {
    try {
      const cachedSentences = localStorage.getItem(CACHE_KEYS.SENTENCES);
      const cachedAcronyms = localStorage.getItem(CACHE_KEYS.ACRONYMS);
      const cachedCategories = localStorage.getItem(CACHE_KEYS.CATEGORIES);
      const cachedLastFetch = localStorage.getItem(CACHE_KEYS.LAST_FETCH);
      
      setState(prev => ({
        ...prev,
        sentences: cachedSentences ? JSON.parse(cachedSentences) : [],
        acronyms: cachedAcronyms ? JSON.parse(cachedAcronyms) : [],
        categories: cachedCategories ? JSON.parse(cachedCategories) : [],
        lastFetch: cachedLastFetch ? parseInt(cachedLastFetch) : null
      }));
    } catch (error) {
      console.warn('Failed to load cached content:', error);
    }
  }, []);
  
  const loadHistoryFromStorage = useCallback(() => {
    try {
      const cachedHistory = localStorage.getItem(CACHE_KEYS.HISTORY);
      if (cachedHistory) {
        historyRef.current = { ...historyRef.current, ...JSON.parse(cachedHistory) };
      }
    } catch (error) {
      console.warn('Failed to load history from storage:', error);
    }
  }, []);
  
  const saveToCache = useCallback((sentences: Sentence[], acronyms: Acronym[]) => {
    try {
      const categories = [...new Set(sentences.map(s => s.category))].sort();
      const timestamp = Date.now();
      
      localStorage.setItem(CACHE_KEYS.SENTENCES, JSON.stringify(sentences));
      localStorage.setItem(CACHE_KEYS.ACRONYMS, JSON.stringify(acronyms));
      localStorage.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(categories));
      localStorage.setItem(CACHE_KEYS.LAST_FETCH, timestamp.toString());
      
      setState(prev => ({
        ...prev,
        sentences,
        acronyms,
        categories,
        lastFetch: timestamp
      }));
    } catch (error) {
      console.warn('Failed to save content to cache:', error);
    }
  }, []);
  
  const saveHistoryToStorage = useCallback(() => {
    try {
      localStorage.setItem(CACHE_KEYS.HISTORY, JSON.stringify(historyRef.current));
    } catch (error) {
      console.warn('Failed to save history to storage:', error);
    }
  }, []);
  
  const addToHistory = useCallback((type: 'sentences' | 'acronyms', id: string) => {
    const history = historyRef.current[type];
    
    // Remove if already exists to avoid duplicates
    const filteredHistory = history.filter(item => item !== id);
    
    // Add to beginning and limit size
    historyRef.current[type] = [id, ...filteredHistory].slice(0, opts.maxHistorySize);
    
    saveHistoryToStorage();
  }, [opts.maxHistorySize, saveHistoryToStorage]);
  
  const fetchContent = useCallback(async (): Promise<{ sentences: Sentence[], acronyms: Acronym[] }> => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    
    const [sentencesResponse, acronymsResponse] = await Promise.all([
      fetch(`${baseUrl}/sentences`),
      fetch(`${baseUrl}/acronyms`)
    ]);
    
    if (!sentencesResponse.ok || !acronymsResponse.ok) {
      throw new Error('Failed to fetch content from API');
    }
    
    const sentencesData: SentencesResponse = await sentencesResponse.json();
    const acronymsData: AcronymsResponse = await acronymsResponse.json();
    
    return {
      sentences: sentencesData.sentences,
      acronyms: acronymsData.acronyms
    };
  }, []);
  
  const refreshContent = useCallback(async () => {
    if (state.isLoading) return;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const { sentences, acronyms } = await fetchContent();
      saveToCache(sentences, acronyms);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch content';
      setState(prev => ({ ...prev, error: errorMessage }));
      
      // If we have cached content and this is a network error, continue with cached data
      if (opts.enableOfflineMode && (state.sentences.length > 0 || state.acronyms.length > 0)) {
        console.warn('Using cached content due to network error:', errorMessage);
      }
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.isLoading, state.sentences.length, state.acronyms.length, fetchContent, saveToCache, opts.enableOfflineMode]);
  
  const getFilteredSentences = useCallback((category?: string): Sentence[] => {
    if (!category) return state.sentences;
    return state.sentences.filter(sentence => sentence.category === category);
  }, [state.sentences]);
  
  const getRandomSentence = useCallback((category?: string): Sentence | null => {
    const availableSentences = getFilteredSentences(category);
    
    if (availableSentences.length === 0) return null;
    
    // Filter out recently shown sentences to prevent immediate repeats
    const history = historyRef.current.sentences;
    const unshownSentences = availableSentences.filter(s => !history.includes(s.id));
    
    // If all sentences have been shown recently, use all available sentences
    const candidateSentences = unshownSentences.length > 0 ? unshownSentences : availableSentences;
    
    const randomIndex = Math.floor(Math.random() * candidateSentences.length);
    const selectedSentence = candidateSentences[randomIndex];
    
    addToHistory('sentences', selectedSentence.id);
    
    return selectedSentence;
  }, [getFilteredSentences, addToHistory]);
  
  const getRandomAcronym = useCallback((): Acronym | null => {
    if (state.acronyms.length === 0) return null;
    
    // Filter out recently shown acronyms to prevent immediate repeats
    const history = historyRef.current.acronyms;
    const unshownAcronyms = state.acronyms.filter(a => !history.includes(a.id));
    
    // If all acronyms have been shown recently, use all available acronyms
    const candidateAcronyms = unshownAcronyms.length > 0 ? unshownAcronyms : state.acronyms;
    
    const randomIndex = Math.floor(Math.random() * candidateAcronyms.length);
    const selectedAcronym = candidateAcronyms[randomIndex];
    
    addToHistory('acronyms', selectedAcronym.id);
    
    return selectedAcronym;
  }, [state.acronyms, addToHistory]);
  
  const getPreviousSentence = useCallback((): Sentence | null => {
    const history = historyRef.current.sentences;
    if (history.length < 2) return null;
    
    // Get the second-to-last item (previous item)
    const previousId = history[1];
    return state.sentences.find(s => s.id === previousId) || null;
  }, [state.sentences]);
  
  const getPreviousAcronym = useCallback((): Acronym | null => {
    const history = historyRef.current.acronyms;
    if (history.length < 2) return null;
    
    // Get the second-to-last item (previous item)
    const previousId = history[1];
    return state.acronyms.find(a => a.id === previousId) || null;
  }, [state.acronyms]);
  
  const clearCache = useCallback(() => {
    try {
      Object.values(CACHE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      
      setState({
        sentences: [],
        acronyms: [],
        categories: [],
        isLoading: false,
        error: null,
        lastFetch: null
      });
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }, []);
  
  const clearHistory = useCallback(() => {
    historyRef.current = {
      sentences: [],
      acronyms: [],
      maxHistorySize: opts.maxHistorySize
    };
    saveHistoryToStorage();
  }, [opts.maxHistorySize, saveHistoryToStorage]);
  
  const getAvailableCategories = useCallback((): string[] => {
    return state.categories;
  }, [state.categories]);
  
  const getSentencesByCategory = useCallback((category: string): Sentence[] => {
    return state.sentences.filter(sentence => sentence.category === category);
  }, [state.sentences]);
  
  return {
    // Content data
    sentences: state.sentences,
    acronyms: state.acronyms,
    categories: state.categories,
    
    // Loading states
    isLoading: state.isLoading,
    error: state.error,
    isOffline,
    
    // Content operations
    getRandomSentence,
    getRandomAcronym,
    getPreviousSentence,
    getPreviousAcronym,
    
    // Cache operations
    refreshContent,
    clearCache,
    clearHistory,
    
    // Category operations
    getAvailableCategories,
    getSentencesByCategory
  };
};