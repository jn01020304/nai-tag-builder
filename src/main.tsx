import React from 'react';
import ReactDOM from 'react-dom/client';
import { flushSync } from 'react-dom';
import App from './App.tsx';

const CONTAINER_ID = 'nai-tag-builder-root';

document.getElementById(CONTAINER_ID)?.remove();

const container = document.createElement('div');
container.id = CONTAINER_ID;

container.style.position = 'fixed';
container.style.top = '8px';
container.style.right = '8px';
container.style.zIndex = '999999';

document.body.appendChild(container);

const root = ReactDOM.createRoot(container);
flushSync(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
