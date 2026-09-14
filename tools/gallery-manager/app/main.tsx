/**
 * ============================================================================
 * ENTRY POINT  (tools/gallery-manager/app/main.tsx)
 * ============================================================================
 *
 * Starts the React app: finds <div id="root"> in index.html and renders <App>
 * into it. <StrictMode> runs extra checks during development (it renders some
 * components twice to reveal mistakes; that's normal).
 * ============================================================================
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
