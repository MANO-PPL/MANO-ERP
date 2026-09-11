/**
 * KnowledgeGraphNodeDrawer.jsx
 * Slide-over inspector displaying node metadata, database columns, connected relationships,
 * and quick-action prompts for the assistant.
 */

import React, { useEffect, useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { CATEGORY_STYLES } from './knowledgeGraphStyles.js';

export default function KnowledgeGraphNodeDrawer({ nodeId, onClose, onSelectNode, onAskAgent }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!nodeId) {
      setDetails(null);
      return;
    }

    let active = true;
    setLoading(true);

    fetch(`/api/agent/knowledge-graph/node/${encodeURIComponent(nodeId)}`)
      .then(res => res.json())
      .then(data => {
        if (active && data.success) {
          setDetails(data.node);
        }
      })
      .catch(err => console.warn('Node details fetch error:', err))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [nodeId]);

  if (!nodeId) return null;

  const style = details ? (CATEGORY_STYLES[details.category] || CATEGORY_STYLES.module) : CATEGORY_STYLES.module;

  return (
    <div className="absolute inset-y-0 right-0 w-80 sm:w-96 border-l border-gray-200 bg-white/95 backdrop-blur-md p-4 shadow-2xl z-30 flex flex-col dark:border-gh-border dark:bg-gh-bg/95 transition-all">
      {/* Drawer Header */}
      <div className="flex items-start justify-between pb-3 border-b border-gray-100 dark:border-gh-border">
        <div className="min-w-0 flex-1 pr-2">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${style.badge}`}>
              {style.label}
            </span>
            {details?.module && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 dark:bg-gh-subtle dark:text-gh-muted uppercase tracking-wider">
                {details.module}
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
            {details?.label || 'Loading...'}
          </h3>
          {details?.table && (
            <p className="text-[11px] font-mono text-gray-500 dark:text-gh-muted">
              Table: {details.table} {details.recordId ? `#${details.recordId}` : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gh-hover dark:hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4 custom-scrollbar text-xs">
        {loading && (
          <div className="py-8 text-center text-gray-400">
            Loading node details...
          </div>
        )}

        {!loading && details && (
          <>
            {/* Description / Summary */}
            {(details.description || details.summary) && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gh-muted mb-1">
                  Description
                </h4>
                <p className="leading-relaxed text-gray-700 dark:text-gh-text bg-gray-50 dark:bg-gh-subtle/50 p-2.5 rounded-lg border border-gray-100 dark:border-gh-border/60">
                  {details.description || details.summary}
                </p>
              </div>
            )}

            {/* Rule Enforcement if category === 'rule' */}
            {details.category === 'rule' && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                  Enforcement & Guard
                </h4>
                <p className="leading-relaxed text-gray-700 dark:text-gh-text bg-amber-50/60 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-200/50 dark:border-amber-900/30">
                  {details.enforcement}
                </p>
              </div>
            )}

            {/* Properties & Database Fields */}
            {details.properties && Object.keys(details.properties).length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gh-muted mb-1">
                  Live Properties
                </h4>
                <div className="rounded-lg border border-gray-100 dark:border-gh-border divide-y divide-gray-100 dark:divide-gh-border overflow-hidden">
                  {Object.entries(details.properties)
                    .filter(([k, v]) => v !== null && typeof v !== 'object')
                    .map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-2 bg-white dark:bg-gh-bg">
                        <span className="text-[11px] font-mono text-gray-500 dark:text-gh-muted">{key}</span>
                        <span className="font-medium text-gray-800 dark:text-gh-text truncate max-w-[170px]">
                          {String(value)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Schema Key Columns if category === 'schema' */}
            {details.keyColumns && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gh-muted mb-1">
                  Key Columns
                </h4>
                <div className="flex flex-wrap gap-1">
                  {details.keyColumns.map(col => (
                    <span key={col} className="px-2 py-0.5 font-mono text-[10px] bg-sky-50 text-sky-700 border border-sky-200/60 rounded dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-900/40">
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Connected Relationships */}
            {details.neighbors && details.neighbors.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gh-muted mb-1">
                  Relationships ({details.neighbors.length})
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {details.neighbors.map((rel, idx) => (
                    <button
                      key={`${rel.edgeId}-${idx}`}
                      type="button"
                      onClick={() => onSelectNode(rel.neighbor.id)}
                      className="w-full text-left flex items-center justify-between p-2 rounded-md border border-gray-100 dark:border-gh-border hover:border-blue-300 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 transition-all group"
                    >
                      <div className="min-w-0 flex-1 pr-1">
                        <span className="block text-[10px] font-mono text-gray-400 dark:text-gh-muted">
                          {rel.direction === 'outgoing' ? 'to' : 'from'}: {rel.label}
                        </span>
                        <span className="font-semibold text-gray-800 dark:text-white truncate block text-[11px]">
                          {rel.neighbor.label}
                        </span>
                      </div>
                      <ArrowRight size={12} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Action: Ask Assistant */}
      <div className="pt-3 border-t border-gray-100 dark:border-gh-border">
        <button
          type="button"
          onClick={() => {
            if (details) {
              const query = details.category === 'entity'
                ? `Tell me about ${details.label}`
                : details.category === 'schema'
                ? `Overview of the ${details.label} table and its relationships`
                : `Explain the ${details.label} and how it applies to MANO-ERP`;
              onAskAgent(query);
            }
          }}
          className="w-full flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-all cursor-pointer"
        >
          <span>Ask Assistant about this</span>
        </button>
      </div>
    </div>
  );
}
