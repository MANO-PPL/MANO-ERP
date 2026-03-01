
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails/index';
import VendorsList from './pages/Vendors';
import CollaborationPage from './pages/Collaboration/index';

import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetails />} />
          <Route path="vendors" element={<VendorsList />} />
          <Route path="collaboration" element={<CollaborationPage />} />
          <Route path="clients" element={
            <div className="p-8 text-gray-500 dark:text-gray-400 text-sm">Clients page coming soon.</div>
          } />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
