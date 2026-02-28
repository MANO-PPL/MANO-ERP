
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails/index';
import AgendaList from './pages/Agenda/AgendaList';
import AgendaDetail from './pages/Agenda/AgendaDetail';
import MoMList from './pages/MinutesOfMeeting/MoMList';
import MoMDetail from './pages/MinutesOfMeeting/MoMDetail';
import VendorsList from './pages/Vendors';

import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetails />} />
          <Route path="projects/:projectId/agenda" element={<AgendaList />} />
          <Route path="projects/:projectId/agenda/:id" element={<AgendaDetail />} />
          <Route path="projects/:projectId/mom" element={<MoMList />} />
          <Route path="projects/:projectId/mom/:id" element={<MoMDetail />} />
          <Route path="dashboard/agenda" element={<AgendaList />} />
          <Route path="dashboard/agenda/:id" element={<AgendaDetail />} />
          <Route path="dashboard/mom" element={<MoMList />} />
          <Route path="dashboard/mom/:id" element={<MoMDetail />} />
          <Route path="vendors" element={<VendorsList />} />
          {/* Redirect unknown routes to dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
