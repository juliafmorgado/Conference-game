import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Suspense } from 'react'
import { LoadingIndicator } from './components'
import { createLazyComponent } from './utils/lazyLoad'
import './App.css'

// Enhanced lazy loading with error boundaries and preloading
const { Component: GameSelector } = createLazyComponent(
  () => import('./components/GameSelector').then(module => ({ default: module.GameSelector })),
  { preload: true } // Preload the landing page component
);

const { Component: FinishSentenceGame, preload: preloadFinishSentence } = createLazyComponent(
  () => import('./components/FinishSentenceGame').then(module => ({ default: module.FinishSentenceGame }))
);

const { Component: GuessAcronymGame, preload: preloadGuessAcronym } = createLazyComponent(
  () => import('./components/GuessAcronymGame').then(module => ({ default: module.GuessAcronymGame }))
);

const { Component: TimerDemo } = createLazyComponent(
  () => import('./components/TimerDemo').then(module => ({ default: module.default }))
);

function App() {
  return (
    <Router>
      <div className="App">
        <Suspense fallback={
          <LoadingIndicator 
            isLoading={true} 
            message="Loading application..." 
            size="large" 
            variant="spinner" 
          />
        }>
          <Routes>
            <Route 
              path="/" 
              element={
                <div onMouseEnter={() => {
                  // Preload game components when hovering over landing page
                  preloadFinishSentence().catch(console.error);
                  preloadGuessAcronym().catch(console.error);
                }}>
                  <GameSelector />
                </div>
              } 
            />
            <Route path="/finish-sentence" element={<FinishSentenceGame />} />
            <Route path="/guess-acronym" element={<GuessAcronymGame />} />
            <Route path="/timer-demo" element={<TimerDemo />} />
          </Routes>
        </Suspense>
      </div>
    </Router>
  )
}

export default App