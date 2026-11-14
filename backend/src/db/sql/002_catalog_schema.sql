-- ============================================================================
-- Module 2: Catalog Module Canonical DDL Schema
-- Date: 2026-11-13
-- Target Engine: MySQL 8.0.16+, InnoDB, utf8mb4
-- Description: Creates the 7 canonical Catalog tables in strict dependency order:
--              1. cat_unit
--              2. cat_resource
--              3. cat_resource_conversion
--              4. cat_rate
--              5. cat_activity
--              6. cat_activity_norm
--              7. cat_change_log
--
-- IMPORTANT: RUN MANUALLY.
-- Under project safety rules (AGENTS.md), this DDL must NEVER be run automatically
-- by server startup code, background agents, or unreviewed processes.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ----------------------------------------------------------------------------
-- 1. Units of Measure: Global Standard Units & Tenant Custom Units
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cat_unit` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `org_id` BIGINT UNSIGNED NULL COMMENT 'NULL indicates global standard unit - non-null indicates tenant custom unit',
  `scope_org_id` BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(`org_id`, 0)) STORED NOT NULL COMMENT '0 for global units, org_id for tenant units',
  `code` VARCHAR(20) NOT NULL COMMENT 'Canonical unit code e.g. kg, m, m3, hr, nos',
  `name` VARCHAR(60) NOT NULL COMMENT 'Human-readable unit name',
  `category` ENUM('weight', 'volume', 'area', 'length', 'count', 'time') NOT NULL,
  `to_base_factor` DECIMAL(24, 10) NOT NULL DEFAULT '1.0000000000' COMMENT 'Conversion multiplier to category canonical base unit',
  `is_base` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if canonical base unit of category, 0 otherwise',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cat_unit_scope_code` (`scope_org_id`, `code`),
  KEY `idx_cat_unit_category` (`category`),
  KEY `idx_cat_unit_org` (`org_id`),
  CONSTRAINT `chk_cat_unit_factor` CHECK (`to_base_factor` > 0),
  CONSTRAINT `chk_cat_unit_is_base` CHECK (`is_base` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 2. Resources: Master Catalog & Project Scoped Copies (material, labour, equipment)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cat_resource` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `org_id` BIGINT UNSIGNED NOT NULL,
  `project_id` BIGINT UNSIGNED NULL COMMENT 'NULL for master catalog - non-null for project copy',
  `parent_id` BIGINT UNSIGNED NULL COMMENT 'Self-reference to master row - NULL for master',
  `kind` ENUM('material', 'labour', 'equipment') NOT NULL COMMENT 'Immutable resource kind',
  `code` VARCHAR(40) NOT NULL COMMENT 'Unique code per org & scope',
  `name` VARCHAR(160) NOT NULL,
  `base_unit_id` BIGINT UNSIGNED NOT NULL COMMENT 'Reference to cat_unit',
  `description` VARCHAR(500) NULL,
  `remarks` VARCHAR(500) NULL,
  `status` ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  `version` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Incremented on each mutation',
  `synced_version` INT UNSIGNED NULL COMMENT 'Master version last synchronized into project copy',
  `scope_key` BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(`project_id`, 0)) STORED NOT NULL COMMENT '0 for master catalog, project_id for project copy',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cat_resource_scope_code` (`org_id`, `scope_key`, `code`),
  KEY `idx_cat_resource_parent` (`parent_id`),
  KEY `idx_cat_resource_base_unit` (`base_unit_id`),
  KEY `idx_cat_resource_org_project` (`org_id`, `project_id`),
  KEY `idx_cat_resource_kind` (`kind`),
  KEY `idx_cat_resource_status` (`status`),
  CONSTRAINT `fk_cat_resource_parent` FOREIGN KEY (`parent_id`) REFERENCES `cat_resource` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cat_resource_base_unit` FOREIGN KEY (`base_unit_id`) REFERENCES `cat_unit` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_cat_resource_version` CHECK (`version` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 3. Resource Conversions: Resource-Specific Packaging & Scaling Factors
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cat_resource_conversion` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `resource_id` BIGINT UNSIGNED NOT NULL,
  `from_unit_id` BIGINT UNSIGNED NOT NULL,
  `to_unit_id` BIGINT UNSIGNED NOT NULL,
  `factor` DECIMAL(24, 10) NOT NULL COMMENT 'Multiplier: 1 from_unit = factor to_unit',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cat_res_conv_pair` (`resource_id`, `from_unit_id`, `to_unit_id`),
  KEY `idx_cat_res_conv_to_unit` (`to_unit_id`),
  CONSTRAINT `fk_cat_conv_resource` FOREIGN KEY (`resource_id`) REFERENCES `cat_resource` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cat_conv_from_unit` FOREIGN KEY (`from_unit_id`) REFERENCES `cat_unit` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cat_conv_to_unit` FOREIGN KEY (`to_unit_id`) REFERENCES `cat_unit` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_cat_conv_factor` CHECK (`factor` > 0),
  CONSTRAINT `chk_cat_conv_distinct_units` CHECK (`from_unit_id` <> `to_unit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 4. Resource Rates: Effective-Dated Price History for Resources Only
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cat_rate` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `resource_id` BIGINT UNSIGNED NOT NULL,
  `rate` DECIMAL(18, 4) NOT NULL COMMENT 'Unit price in currency units',
  `unit_id` BIGINT UNSIGNED NOT NULL COMMENT 'Quoted unit - must match or convert to resource base unit',
  `effective_from` DATE NOT NULL COMMENT 'Inclusive start date of rate period',
  `effective_to` DATE NULL COMMENT 'Inclusive end date - NULL indicates currently open rate',
  `note` VARCHAR(255) NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cat_rate_effective` (`resource_id`, `effective_from`),
  KEY `idx_cat_rate_lookup` (`resource_id`, `effective_from`, `effective_to`),
  KEY `idx_cat_rate_unit` (`unit_id`),
  CONSTRAINT `fk_cat_rate_resource` FOREIGN KEY (`resource_id`) REFERENCES `cat_resource` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cat_rate_unit` FOREIGN KEY (`unit_id`) REFERENCES `cat_unit` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_cat_rate_positive` CHECK (`rate` >= 0),
  CONSTRAINT `chk_cat_rate_dates` CHECK (`effective_to` IS NULL OR `effective_to` >= `effective_from`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 5. Activities: Master Catalog & Project Scoped Construction Works / Items
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cat_activity` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `org_id` BIGINT UNSIGNED NOT NULL,
  `project_id` BIGINT UNSIGNED NULL COMMENT 'NULL for master catalog - non-null for project copy',
  `parent_id` BIGINT UNSIGNED NULL COMMENT 'Self-reference to master row - NULL for master',
  `code` VARCHAR(40) NOT NULL COMMENT 'Unique code per org & scope',
  `name` VARCHAR(160) NOT NULL,
  `output_unit_id` BIGINT UNSIGNED NOT NULL COMMENT 'Reference to cat_unit for activity output work unit',
  `description` VARCHAR(500) NULL,
  `remarks` VARCHAR(500) NULL,
  `status` ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  `version` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Incremented on each mutation',
  `synced_version` INT UNSIGNED NULL COMMENT 'Master version last synchronized into project copy',
  `scope_key` BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(`project_id`, 0)) STORED NOT NULL COMMENT '0 for master catalog, project_id for project copy',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cat_activity_scope_code` (`org_id`, `scope_key`, `code`),
  KEY `idx_cat_activity_parent` (`parent_id`),
  KEY `idx_cat_activity_output_unit` (`output_unit_id`),
  KEY `idx_cat_activity_org_project` (`org_id`, `project_id`),
  KEY `idx_cat_activity_status` (`status`),
  CONSTRAINT `fk_cat_activity_parent` FOREIGN KEY (`parent_id`) REFERENCES `cat_activity` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cat_activity_output_unit` FOREIGN KEY (`output_unit_id`) REFERENCES `cat_unit` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_cat_activity_version` CHECK (`version` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 6. Activity Norms: Flat Resource Consumption Rules (Zero Activity Nesting)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cat_activity_norm` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `activity_id` BIGINT UNSIGNED NOT NULL,
  `resource_id` BIGINT UNSIGNED NOT NULL COMMENT 'FK points exclusively to cat_resource - no activity nesting permitted',
  `qty_per_unit` DECIMAL(18, 6) NOT NULL COMMENT 'Net quantity of resource required per 1 unit of activity output',
  `unit_id` BIGINT UNSIGNED NOT NULL COMMENT 'Unit in which resource is consumed - must match or convert to resource base unit',
  `wastage_pct` DECIMAL(6, 3) NOT NULL DEFAULT '0.000' COMMENT 'Estimation allowance/wastage percentage between 0 and 100',
  `effective_from` DATE NOT NULL COMMENT 'Inclusive start date of norm version',
  `effective_to` DATE NULL COMMENT 'Inclusive end date - NULL indicates currently active norm',
  `note` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cat_act_norm_effective` (`activity_id`, `resource_id`, `effective_from`),
  KEY `idx_cat_act_norm_lookup` (`activity_id`, `effective_from`, `effective_to`),
  KEY `idx_cat_act_norm_resource` (`resource_id`),
  KEY `idx_cat_act_norm_unit` (`unit_id`),
  CONSTRAINT `fk_cat_norm_activity` FOREIGN KEY (`activity_id`) REFERENCES `cat_activity` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cat_norm_resource` FOREIGN KEY (`resource_id`) REFERENCES `cat_resource` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cat_norm_unit` FOREIGN KEY (`unit_id`) REFERENCES `cat_unit` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_cat_norm_qty` CHECK (`qty_per_unit` > 0),
  CONSTRAINT `chk_cat_norm_wastage` CHECK (`wastage_pct` >= 0 AND `wastage_pct` <= 100),
  CONSTRAINT `chk_cat_norm_dates` CHECK (`effective_to` IS NULL OR `effective_to` >= `effective_from`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 7. Change Log: Transactional Audit Trail for Catalog Mutations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cat_change_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `org_id` BIGINT UNSIGNED NOT NULL,
  `entity` ENUM('resource', 'activity', 'rate', 'norm', 'conversion') NOT NULL,
  `entity_id` BIGINT UNSIGNED NOT NULL,
  `action` VARCHAR(30) NOT NULL COMMENT 'create, update, delete, sync_accept, correct, restore',
  `before_data` JSON NULL,
  `after_data` JSON NULL,
  `reason` VARCHAR(255) NULL,
  `user_id` BIGINT UNSIGNED NULL,
  `at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cat_change_log_entity` (`entity`, `entity_id`, `at`),
  KEY `idx_cat_change_log_org` (`org_id`, `at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
