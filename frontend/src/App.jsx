
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import PageSkeleton from './components/PageSkeleton';
import { AuthProvider, useAuth } from './context/AuthContext';

// ─── Lazy-loaded pages ────────────────────────────────────────────────────
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetails = lazy(() => import('./pages/ProjectDetails/index'));
const VendorsList = lazy(() => import('./pages/Vendors'));
const ResourcesList = lazy(() => import('./pages/Resources/index'));
const UnitsList = lazy(() => import('./pages/Units/index'));
const VendorBulkUpload = lazy(() => import('./pages/Vendors/VendorBulkUpload'));
const ClientsList = lazy(() => import('./pages/Clients'));
const ClientBulkUpload = lazy(() => import('./pages/Clients/ClientBulkUpload'));
const CollaborationPage = lazy(() => import('./pages/Collaboration/index'));
const AdminPage = lazy(() => import('./pages/Admin/index'));
const Login = lazy(() => import('./pages/Auth/Login'));

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
  return (
    <AuthProvider>
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
            <Route path="units" element={
              <ProtectedRoute pageId="units">
                <Suspense fallback={<PageSkeleton variant="table" />}>
                  <UnitsList />
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
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
