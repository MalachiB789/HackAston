
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Auth0Provider
      domain={"dev-82qbe21jf3s4u5j1.us.auth0.com"}
      clientId={"WR4r2lb7H3dFzeZWAGGnYrXWm6RhvXmI"}
      authorizationParams={{ redirect_uri: window.location.origin }}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>
);
