import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LeadBoard from './pages/LeadBoard';
import InquiryResponder from './pages/InquiryResponder';
import ApprovalQueue from './pages/ApprovalQueue';
import Prospecting from './pages/Prospecting';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import ContentTools from './pages/ContentTools';
import GalleryManager from './pages/GalleryManager';
import GalleryView from './pages/GalleryView';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="leads" element={<LeadBoard />} />
        <Route path="inquiry" element={<InquiryResponder />} />
        <Route path="queue" element={<ApprovalQueue />} />
        <Route path="prospecting" element={<Prospecting />} />
        <Route path="reports" element={<Reports />} />
        <Route path="content" element={<ContentTools />} />
        <Route path="galleries" element={<GalleryManager />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="/gallery/:shareToken" element={<GalleryView />} />
    </Routes>
  );
}
