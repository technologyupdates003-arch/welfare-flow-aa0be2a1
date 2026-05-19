import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress React DevTools warning in production
if (process.env.NODE_ENV === 'production') {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('React DevTools')) {
      return;
    }
    originalWarn(...args);
  };
}

// Register service worker for notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
