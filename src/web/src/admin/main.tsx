// Admin dashboard entry (/admin.html): a read-only look at the API's database. Separate from the game page.

import '../shared/styles/base.css';
import './admin.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminApp } from './AdminApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
