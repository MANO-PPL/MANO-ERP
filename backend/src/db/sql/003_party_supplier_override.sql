-- ============================================================================
-- Migration: 003_party_supplier_override.sql
-- Date: 2026-11-18
-- Target Engine: MySQL 8.0.16+, InnoDB, utf8mb4
-- Description: Add supplier_override column to proj_parties.
--              NULL = follow contact category; 1 = supplier on this project; 0 = not a supplier on this project.
--
-- IMPORTANT: RUN MANUALLY.
-- Under project safety rules (AGENTS.md), this DDL must NEVER be run automatically.
-- ============================================================================

ALTER TABLE `proj_parties`
  ADD COLUMN `supplier_override` TINYINT(1) NULL DEFAULT NULL AFTER `contact_id`;
