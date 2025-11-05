/**
 * Lazy loading utility with preloading functionality
 */

import React, { ComponentType, LazyExoticComponent } from 'react';

/**
 * Enhanced lazy loading function
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return React.lazy(importFunc);
}

/**
 * Preload a lazy component for better UX
 */
export function preloadComponent<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
): Promise<{ default: T }> {
  return importFunc();
}

/**
 * Create a lazy component with preloading capability
 */
export function createLazyComponent<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options?: {
    preload?: boolean;
  }
) {
  const LazyComponent = React.lazy(importFunc);

  // Preload if requested
  if (options?.preload) {
    // Preload after a short delay to not block initial render
    setTimeout(() => {
      preloadComponent(importFunc).catch(console.error);
    }, 100);
  }

  return {
    Component: LazyComponent,
    preload: () => preloadComponent(importFunc)
  };
}

export default lazyLoad;