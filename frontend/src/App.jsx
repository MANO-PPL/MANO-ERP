
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import PageSkeleton from './components/PageSkeleton';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { customToast } from './utils/toast';
import { toast as reactToastify } from 'react-toastify';

// Intercept react-toastify calls platform-wide to use MANO-ERP custom Toast
if (reactToastify) {
  reactToastify.success = (msg, opts) => customToast.success(msg, typeof opts === 'string' ? opts : 'Success');
  reactToastify.error = (msg, opts) => customToast.error(msg, typeof opts === 'string' ? opts : 'Error');
  reactToastify.warning = (msg, opts) => customToast.warning(msg, typeof opts === 'string' ? opts : 'Warning');
  reactToastify.warn = (msg, opts) => customToast.warn(msg, typeof opts === 'string' ? opts : 'Warning');
  reactToastify.info = (msg, opts) => customToast.info(msg, typeof opts === 'string' ? opts : 'Info');
}

// ─── Lazy-loaded pages ────────────────────────────────────────────────────
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetails = lazy(() => import('./pages/ProjectDetails/ProjectDetails'));
const VendorsList = lazy(() => import('./pages/Vendors/VendorsList'));
const ResourcesList = lazy(() => import('./pages/Resources/ResourceList'));
const ResourceRate = lazy(() => import('./pages/Resources/ResourceRate'));
const UnitsList = lazy(() => import('./pages/Units/UnitsPage'));
const VendorBulkUpload = lazy(() => import('./pages/Vendors/VendorBulkUpload'));
const ClientsList = lazy(() => import('./pages/Clients/ClientsList'));
const ClientBulkUpload = lazy(() => import('./pages/Clients/ClientBulkUpload'));
const CollaborationPage = lazy(() => import('./pages/Collaboration/CollaborationPage'));
const AdminPage = lazy(() => import('./pages/Admin/AdminPage'));
const Login = lazy(() => import('./pages/Auth/Login'));
const DrawingTest = lazy(() => import('./pages/DrawingTest/DrawingTest'));

import './index.css';

// ─── Protected Route Wrapper ────────────────────────────────────────────────
const ProtectedRoute = ({ children, pageId, requiredLevel = 1 }) => {
  const { user, loading, hasPermission } = useAuth();

  if (loading) {
    return <PageSkeleton variant="grid" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (pageId && !hasPermission(pageId, requiredLevel)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  React.useEffect(() => {
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('crm_')) {
        sessionStorage.removeItem(key);
      }
    });
  }, []);

  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
        <Routes>
          <Route path="/login" element={
            <Suspense fallback={<PageSkeleton variant="grid" />}>
              <Login />
            </Suspense>
          } />
          <Route path="/" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={
              <Suspense fallback={<PageSkeleton variant="grid" />}>
                <Dashboard />
              </Suspense>
            } />
            <Route path="projects" element={
              <ProtectedRoute pageId="projects">
                <Suspense fallback={<PageSkeleton variant="grid" />}>
                  <Projects />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="projects/:id" element={
              <ProtectedRoute pageId="projects">
                <Suspense fallback={<PageSkeleton variant="table" />}>
                  <ProjectDetails />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="vendors" element={
              <ProtectedRoute pageId="vendors">
                <Suspense fallback={<PageSkeleton variant="table" />}>
                  <VendorsList />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="vendors/bulk-upload" element={
              <ProtectedRoute pageId="vendors">
                <Suspense fallback={<PageSkeleton variant="table" />}>
                  <VendorBulkUpload />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="resources" element={
              <ProtectedRoute pageId="resources">
                <Suspense fallback={<PageSkeleton variant="table" />}>
                  <ResourcesList />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="resource-rate" element={
              <ProtectedRoute pageId="resources">
                <Suspense fallback={<PageSkeleton variant="table" />}>
                  <ResourceRate/>
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="units" element={<Navigate to="/resources" replace />} />
            <Route path="collaboration" element={
              <ProtectedRoute pageId="collaboration">
                <Suspense fallback={<PageSkeleton variant="table" />}>
                  <CollaborationPage />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="admin" element={
              <ProtectedRoute pageId="admin">
                <Suspense fallback={<PageSkeleton variant="table" />}>
                  <AdminPage />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="clients" element={
              <ProtectedRoute pageId="clients">
                <Suspense fallback={<PageSkeleton variant="table" />}>
                  <ClientsList />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="clients/bulk-upload" element={
              <ProtectedRoute pageId="clients">
                <Suspense fallback={<PageSkeleton variant="table" />}>
                  <ClientBulkUpload />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="drawing-test" element={
              <ProtectedRoute>
                <Suspense fallback={<PageSkeleton variant="table" />}>
                  <DrawingTest />
                </Suspense>
              </ProtectedRoute>
            } />
          </Route>
          <Route path="/drawing-viewer" element={
            <ProtectedRoute>
              <Suspense fallback={<PageSkeleton variant="table" />}>
                <DrawingTest />
              </Suspense>
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
