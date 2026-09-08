import React from 'react';
import ReactDOM from 'react-dom/client';
import { flushSync } from 'react-dom';
import App from './App.tsx';

const CONTAINER_ID = 'nai-tag-builder-root';

interface TagBuilderInstance {
  unmount: () => void;
}

type RuntimeGlobal = typeof globalThis & {
  __NAI_TAG_BUILDER_INSTANCE__?: TagBuilderInstance;
};

const runtime = globalThis as RuntimeGlobal;
runtime.__NAI_TAG_BUILDER_INSTANCE__?.unmount();
document.getElementById(CONTAINER_ID)?.remove();

const container = document.createElement('div');
container.id = CONTAINER_ID;

container.style.position = 'fixed';
container.style.top = '8px';
container.style.right = '8px';
container.style.zIndex = '999999';

document.body.appendChild(container);

const root = ReactDOM.createRoot(container);
let isUnmounted = false;
const unmount = () => {
  if (isUnmounted) return;
  isUnmounted = true;
  root.unmount();
  container.remove();
  if (runtime.__NAI_TAG_BUILDER_INSTANCE__?.unmount === unmount) {
    delete runtime.__NAI_TAG_BUILDER_INSTANCE__;
  }
};

runtime.__NAI_TAG_BUILDER_INSTANCE__ = { unmount };

flushSync(() => {
  root.render(
    <React.StrictMode>
      <App onRequestClose={unmount} />
    </React.StrictMode>
  );
});
