/**
 * App - the auth gate and the route table.
 *
 * HashRouter rather than BrowserRouter: this site is meant to be built once and
 * opened from disk or served as static files, where a deep link like
 * /finance has no server to rewrite it to index.html and would 404 on refresh.
 * A hash route needs nothing from the server.
 */
import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import { Spinner } from './components/ui';
import { AuthProvider, useAuth } from './lib/auth';
import { SignIn } from './pages/SignIn';
import './styles/components.css';

// Split per route. The charts and the whole Supabase client are large, and the
// login screen has no business waiting on code it will never run.
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const TodoPage = lazy(() => import('./pages/TodoPage').then((m) => ({ default: m.TodoPage })));
const NotesPage = lazy(() => import('./pages/NotesPage').then((m) => ({ default: m.NotesPage })));
const FinancePage = lazy(() =>
  import('./pages/FinancePage').then((m) => ({ default: m.FinancePage })),
);
const SubscriptionsPage = lazy(() =>
  import('./pages/SubscriptionsPage').then((m) => ({ default: m.SubscriptionsPage })),
);
const FitnessPage = lazy(() =>
  import('./pages/FitnessPage').then((m) => ({ default: m.FitnessPage })),
);
const CustomModulePage = lazy(() =>
  import('./pages/CustomModulePage').then((m) => ({ default: m.CustomModulePage })),
);
const ModuleBuilderPage = lazy(() =>
  import('./pages/ModuleBuilderPage').then((m) => ({ default: m.ModuleBuilderPage })),
);

function Routed() {
  const { session, loading } = useAuth();

  // Nothing is rendered until the stored session has been read back. Showing
  // the login screen first would flash it at somebody already signed in on
  // every page load.
  if (loading) return <Spinner center />;
  if (!session) return <SignIn />;

  return (
    <Suspense fallback={<Spinner center />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/todo" element={<TodoPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/fitness" element={<FitnessPage />} />
        <Route path="/m/:moduleId" element={<CustomModulePage />} />
        <Route path="/builder" element={<ModuleBuilderPage />} />
        <Route path="/builder/:moduleId" element={<ModuleBuilderPage />} />
        {/* An unknown hash goes home rather than showing a blank page. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routed />
      </HashRouter>
    </AuthProvider>
  );
}
