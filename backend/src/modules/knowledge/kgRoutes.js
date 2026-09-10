/**
 * kgRoutes.js
 * REST and Server-Sent Events (SSE) endpoints for the ERP Knowledge Graph.
 */

import express from 'express';
import knowledgeGraphService from './knowledgeGraphService.js';
import { registerSseClient, notifyMutation } from './kgDatabaseListener.js';

const router = express.Router();

/**
 * GET /api/agent/knowledge-graph
 * Fetches nodes, edges, and statistics for the Knowledge Graph visualizer.
 * Supports page-scoped sub-graph filtering via ?page=
 */
router.get('/', (req, res) => {
  try {
    const { page, module, category, search, limit } = req.query;
    const graph = knowledgeGraphService.getGraph({
      page,
      module,
      category,
      search,
      limit: limit ? Number(limit) : 150
    });
    res.json({ success: true, ...graph });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/agent/knowledge-graph/pages
 * Returns list of all registered platform pages and project sub-tabs with node metrics.
 */
router.get('/pages', (req, res) => {
  try {
    const pages = knowledgeGraphService.getPages();
    res.json({ success: true, pages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/agent/knowledge-graph/node/:id
 * Fetches deep inspection data for an individual node including neighbors.
 */
router.get('/node/:id', (req, res) => {
  try {
    const details = knowledgeGraphService.getNodeDetails(req.params.id);
    if (!details) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }
    res.json({ success: true, node: details });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/agent/knowledge-graph/trace
 * Traces query through the Knowledge Graph and returns path + evidence facts.
 */
router.post('/trace', (req, res) => {
  try {
    const { query, context } = req.body || {};
    const trace = knowledgeGraphService.traceQuery(query, context);
    res.json({ success: true, trace });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/agent/knowledge-graph/events
 * Real-time Server-Sent Events (SSE) stream for instant graph updates on database changes.
 */
router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering
  res.flushHeaders?.();

  // Send initial handshake
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', timestamp: Date.now() })}\n\n`);

  registerSseClient(res);

  // Keep-alive heartbeat every 20 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartheart);
    }
  }, 20000);

  res.on('close', () => {
    clearInterval(heartbeat);
  });
});

/**
 * POST /api/agent/knowledge-graph/simulate-change
 * Test/simulation endpoint to trigger a minute database change and observe real-time sync.
 */
router.post('/simulate-change', async (req, res) => {
  try {
    const { table = 'proj_projects', id = 4, operation = 'UPDATE', data = {} } = req.body || {};
    const event = await notifyMutation(table, id, operation, {
      ...data,
      name: data.name || `Simulated ${table} Mutation`,
      updatedAt: new Date().toISOString()
    });
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
