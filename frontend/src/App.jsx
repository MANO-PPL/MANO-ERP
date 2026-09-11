
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import PageSkeleton from './components/PageSkeleton';
import LoadingScreen from './components/LoadingScreen';
import ErrorBoundary from './components/ErrorBoundary';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { customToast } from './utils/toast';
import { toast as reactToastify, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Intercept react-toastify calls platform-wide to use MANO-ERP custom Toast
if (reactToastify) {
  reactToastify.success = (msg, opts) => customToast.success(msg, typeof opts === 'string' ? opts : 'Success');
  reactToastify.error = (msg, opts) => customToast.error(msg, typeof opts === 'string' ? opts : 'Error');
  reactToastify.warning = (msg, opts) => customToast.warning(msg, typeof opts === 'string' ? opts : 'Warning');
  reactToastify.warn = (msg, opts) => customToast.warn(msg, typeof opts === 'string' ? opts : 'Warning');
  reactToastify.info = (msg, opts) => customToast.info(msg, typeof opts === 'string' ? opts : 'Info');
}

// ─── Lazy-loaded pages with resilient chunk retries ─────────────────────────
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'), 'dashboard');
const Projects = lazyWithRetry(() => import('./pages/Projects'), 'projects');
const CreateProject = lazyWithRetry(() => import('./pages/Projects/CreateProject'), 'create_project');
const ProjectDetails = lazyWithRetry(() => import('./pages/ProjectDetails/ProjectDetails'), 'project_details');
const VendorsList = lazyWithRetry(() => import('./pages/Vendors/VendorsList'), 'vendors');
const ResourcesList = lazyWithRetry(() => import('./pages/Resources/ResourceList'), 'resources');
const ResourceRate = lazyWithRetry(() => import('./pages/Resources/ResourceRate'), 'resource_rate');
const UnitsList = lazyWithRetry(() => import('./pages/Units/UnitsPage'), 'units');
const VendorBulkUpload = lazyWithRetry(() => import('./pages/Vendors/VendorBulkUpload'), 'vendor_upload');
const ResourceBulkUpload = lazyWithRetry(() => import('./pages/Resources/ResourceBulkUpload'), 'resource_upload');
const ClientsList = lazyWithRetry(() => import('./pages/Clients/ClientsList'), 'clients');
const ClientBulkUpload = lazyWithRetry(() => import('./pages/Clients/ClientBulkUpload'), 'client_upload');
const CollaborationPage = lazyWithRetry(() => import('./pages/Collaboration/CollaborationPage'), 'collaboration');
const AdminPage = lazyWithRetry(() => import('./pages/Admin/AdminPage'), 'admin');
const Login = lazyWithRetry(() => import('./pages/Auth/Login'), 'login');
const DrawingTest = lazyWithRetry(() => import('./pages/DrawingTest/DrawingTest'), 'drawing_test');
const SpreadsheetPage = lazyWithRetry(() => import('./pages/Spreadsheets/SpreadsheetPage'), 'spreadsheets');

import './index.css';

// ─── Protected Route Wrapper ────────────────────────────────────────────────
const ProtectedRoute = ({ children, pageId, requiredLevel = 1 }) => {
  const { user, loading, hasPermission } = useAuth();

  if (loading) {
    return <LoadingScreen message="Securing connection..." />;
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
    <ErrorBoundary>
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
            <Route path="projects/create" element={
              <ProtectedRoute pageId="projects" requiredLevel={2}>
                <Suspense fallback={<PageSkeleton variant="form" />}>
                  <CreateProject />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="projects/new" element={
              <ProtectedRoute pageId="projects" requiredLevel={2}>
                <Suspense fallback={<PageSkeleton variant="form" />}>
                  <CreateProject />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="projects/:id" element={
              <ProtectedRoute>
                <Suspense fallback={<PageSkeleton variant="grid" />}>
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
            <Route path="resources/bulk-upload" element={
              <ProtectedRoute pageId="resources">
                <Suspense fallback={<PageSkeleton variant="table" />}>
                  <ResourceBulkUpload />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="resource-rate" element={<Navigate to="/resources?tab=rates" replace />} />
            <Route path="units" element={<Navigate to="/resources" replace />} />
            <Route path="spreadsheets" element={
              <ProtectedRoute pageId="spreadsheets">
                <Suspense fallback={<PageSkeleton variant="table" />}>
                  <SpreadsheetPage />
                </Suspense>
              </ProtectedRoute>
            } />
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
      <ToastContainer position="bottom-center" autoClose={3000} limit={2} hideProgressBar={true} newestOnTop={true} closeOnClick={true} />
      </ToastProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
