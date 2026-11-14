-- ============================================================================
-- DEV RESET ONLY, destroys all catalog data
-- Date: 2026-11-13
-- Target Engine: MySQL 8.0.16+, InnoDB, utf8mb4
-- Description: Drops all 7 Module 2 Catalog tables in reverse dependency order.
--
-- IMPORTANT: RUN MANUALLY.
-- Under project safety rules (AGENTS.md), this DDL must NEVER be run automatically.
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `cat_activity_norm`;
DROP TABLE IF EXISTS `cat_activity`;
DROP TABLE IF EXISTS `cat_rate`;
DROP TABLE IF EXISTS `cat_resource_conversion`;
DROP TABLE IF EXISTS `cat_resource`;
DROP TABLE IF EXISTS `cat_unit`;
DROP TABLE IF EXISTS `cat_change_log`;

SET FOREIGN_KEY_CHECKS = 1;
