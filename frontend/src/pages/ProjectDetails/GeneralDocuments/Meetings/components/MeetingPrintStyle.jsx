// ─────────────────────────────────────────────────────────────────────────────
// Meetings / components / MeetingPrintStyle.jsx
// Renders the @media print <style> block so it stays out of MeetingDetail.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { PRINT_STYLE_CSS } from '../constants';

const MeetingPrintStyle = () => <style>{PRINT_STYLE_CSS}</style>;

export default MeetingPrintStyle;
