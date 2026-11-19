-- ============================================================================
-- Migration: 003_party_supplier_override_down.sql
-- Date: 2026-11-18
-- Target Engine: MySQL 8.0.16+, InnoDB, utf8mb4
-- Description: Drops supplier_override column from proj_parties.
--
-- IMPORTANT: RUN MANUALLY.
-- Under project safety rules (AGENTS.md), this DDL must NEVER be run automatically.
-- ============================================================================

ALTER TABLE `proj_parties`
  DROP COLUMN `supplier_override`;
