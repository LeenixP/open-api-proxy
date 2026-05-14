import '@testing-library/jest-dom/vitest';

// Mock matchMedia for components that check dark mode preference
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock scrollTo for jsdom (used by some components)
Element.prototype.scrollTo = () => {};
