import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import { HashRouter } from 'react-router-dom';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ReactFlowProvider>
        <App />
      </ReactFlowProvider>
    </HashRouter>
  </StrictMode>,
);
