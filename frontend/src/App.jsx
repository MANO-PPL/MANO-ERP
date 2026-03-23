
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import PageSkeleton from './components/PageSkeleton';

// ─── Lazy-loaded pages ────────────────────────────────────────────────────
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetails = lazy(() => import('./pages/ProjectDetails/index'));
const VendorsList = lazy(() => import('./pages/Vendors'));
const ResourcesList = lazy(() => import('./pages/Resources/index'));
const VendorBulkUpload = lazy(() => import('./pages/Vendors/VendorBulkUpload'));
const ClientsList = lazy(() => import('./pages/Clients'));
const ClientBulkUpload = lazy(() => import('./pages/Clients/ClientBulkUpload'));
const CollaborationPage = lazy(() => import('./pages/Collaboration/index'));
const AdminPage = lazy(() => import('./pages/Admin/index'));
const Login = lazy(() => import('./pages/Auth/Login'));

import './index.css';

// ─── Pick the right skeleton variant per route ────────────────────────────
const RouteSkeletonFallback = () => {
  const path = window.location.pathname;
  const variant =
    path.startsWith('/admin') || path.startsWith('/collaboration')
      ? 'table'
      : 'grid';
  return <PageSkeleton variant={variant} />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={
          <Suspense fallback={<PageSkeleton variant="grid" />}>
            <Login />
          </Suspense>
        } />
        <Route path="/" element={<MainLayout />}>
          <Route index element={
            <Suspense fallback={<PageSkeleton variant="grid" />}>
              <Dashboard />
            </Suspense>
          } />
          <Route path="projects" element={
            <Suspense fallback={<PageSkeleton variant="grid" />}>
              <Projects />
            </Suspense>
          } />
          <Route path="projects/:id" element={
            <Suspense fallback={<PageSkeleton variant="table" />}>
              <ProjectDetails />
            </Suspense>
          } />
          <Route path="vendors" element={
            <Suspense fallback={<PageSkeleton variant="table" />}>
              <VendorsList />
            </Suspense>
          } />
          <Route path="vendors/bulk-upload" element={
            <Suspense fallback={<PageSkeleton variant="table" />}>
              <VendorBulkUpload />
            </Suspense>
          } />
          <Route path="resources" element={
            <Suspense fallback={<PageSkeleton variant="table" />}>
              <ResourcesList />
            </Suspense>
          } />
          <Route path="collaboration" element={
            <Suspense fallback={<PageSkeleton variant="table" />}>
              <CollaborationPage />
            </Suspense>
          } />
          <Route path="admin" element={
            <Suspense fallback={<PageSkeleton variant="table" />}>
              <AdminPage />
            </Suspense>
          } />
          <Route path="clients" element={
            <Suspense fallback={<PageSkeleton variant="table" />}>
              <ClientsList />
            </Suspense>
          } />
          <Route path="clients/bulk-upload" element={
            <Suspense fallback={<PageSkeleton variant="table" />}>
              <ClientBulkUpload />
            </Suspense>
          } />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
