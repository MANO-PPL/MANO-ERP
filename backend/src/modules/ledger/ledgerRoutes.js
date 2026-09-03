import express from 'express';
import * as controller from './ledgerController.js';

const router = express.Router();

// ─── Transactions CRUD & Lifecycle ────────────────────────────────────────────
router.post('/transactions', controller.createTransaction);
router.get('/transactions', controller.listTransactions);
router.get('/transactions/:id', controller.getTransaction);
router.post('/transactions/:id/confirm', controller.confirmTransaction);
router.post('/transactions/:id/cancel', controller.cancelTransaction);

// ─── Inventory & Ledger Queries ───────────────────────────────────────────────
router.get('/party-position', controller.getPartyResourcePosition);
router.get('/party-ledger/:party_id', controller.getPartyLedger);

// ─── Project Party Directory (proj_parties JOIN crm_contacts) ────────────────
// Returns the valid party list for a given project — pv_id is used as party_id
router.get('/project-parties/:projectId', controller.getProjectParties);

// ─── Action Integration Endpoints ────────────────────────────────────────────
router.post('/assign-supply', controller.assignSupply);
router.post('/transfer-party', controller.transferContractor);

// NOTE: /consume-activity and /adjustment are disabled pending activity module integration

export default router;
