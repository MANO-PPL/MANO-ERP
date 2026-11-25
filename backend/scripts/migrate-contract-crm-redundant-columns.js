/**
 * CONTRACT-PHASE MIGRATION (RUN MANUALLY ONLY AFTER CLOUD + ALL CLIENTS ARE DEPLOYED)
 *
 * Removes redundant legacy CRM columns once all running code no longer depends on them:
 *   1. crm_contacts.responsibility   (replaced by crm_contacts.created_by -> iam_users.id)
 *   2. crm_interactions.org_id       (redundant; org-scoped via contact_id -> crm_contacts.org_id)
 *   3. crm_contacts.archived_at      (redundant; status + updated_at track archiving)
 *   4. crm_contacts index fk_desg_id (stale index on plain varchar designation column)
 *
 * Usage:
 *   node backend/scripts/migrate-contract-crm-redundant-columns.js            # Dry-run (default, read-only)
 *   node backend/scripts/migrate-contract-crm-redundant-columns.js --execute  # Apply changes
 */

import { db } from '../src/config/database.js';

const EXECUTE = process.argv.includes('--execute');

async function run() {
    console.log(EXECUTE
        ? '⚠️  RUNNING CONTRACT MIGRATION (--execute)'
        : '🔍 DRY-RUN MODE (pass --execute to apply changes)');

    // 1. crm_contacts.responsibility -> backfill created_by, then drop
    if (await db.schema.hasColumn('crm_contacts', 'responsibility')) {
        console.log('• [crm_contacts.responsibility] Present -> will backfill created_by and DROP COLUMN responsibility');
        if (EXECUTE) {
            await db.raw(`
                UPDATE crm_contacts c
                JOIN iam_users u
                  ON u.org_id = c.org_id
                 AND LOWER(TRIM(u.user_name)) = LOWER(TRIM(c.responsibility))
                SET c.created_by = u.id
                WHERE c.created_by IS NULL
                  AND c.responsibility IS NOT NULL
                  AND TRIM(c.responsibility) != ''
            `);
            await db.raw(`
                UPDATE crm_contacts c
                JOIN iam_users u
                  ON u.org_id = c.org_id
                 AND LOWER(TRIM(u.user_name)) LIKE CONCAT(LOWER(TRIM(c.responsibility)), ' %')
                SET c.created_by = u.id
                WHERE c.created_by IS NULL
                  AND c.responsibility IS NOT NULL
                  AND CHAR_LENGTH(TRIM(c.responsibility)) >= 3
            `);
            await db.schema.alterTable('crm_contacts', (t) => t.dropColumn('responsibility'));
            console.log('  ✅ Dropped crm_contacts.responsibility');
        }
    } else {
        console.log('• [crm_contacts.responsibility] Already absent');
    }

    // 2. crm_interactions.org_id
    if (await db.schema.hasColumn('crm_interactions', 'org_id')) {
        console.log('• [crm_interactions.org_id] Present -> will DROP COLUMN org_id');
        if (EXECUTE) {
            const [fks] = await db.raw(`
                SELECT CONSTRAINT_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'crm_interactions'
                  AND COLUMN_NAME = 'org_id'
                  AND REFERENCED_TABLE_NAME IS NOT NULL
            `);
            for (const fk of fks) {
                await db.raw(`ALTER TABLE crm_interactions DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
            }
            await db.schema.alterTable('crm_interactions', (t) => t.dropColumn('org_id'));
            console.log('  ✅ Dropped crm_interactions.org_id');
        }
    } else {
        console.log('• [crm_interactions.org_id] Already absent');
    }

    // 3. crm_contacts.archived_at
    if (await db.schema.hasColumn('crm_contacts', 'archived_at')) {
        console.log('• [crm_contacts.archived_at] Present -> will DROP COLUMN archived_at');
        if (EXECUTE) {
            await db.schema.alterTable('crm_contacts', (t) => t.dropColumn('archived_at'));
            console.log('  ✅ Dropped crm_contacts.archived_at');
        }
    } else {
        console.log('• [crm_contacts.archived_at] Already absent');
    }

    // 4. Stale index fk_desg_id on crm_contacts.designation
    const [desgIdx] = await db.raw("SHOW INDEXES FROM crm_contacts WHERE Key_name = 'fk_desg_id'");
    if (desgIdx && desgIdx.length > 0) {
        console.log('• [crm_contacts index fk_desg_id] Present -> will DROP INDEX fk_desg_id');
        if (EXECUTE) {
            await db.raw('ALTER TABLE crm_contacts DROP INDEX `fk_desg_id`');
            console.log('  ✅ Dropped index fk_desg_id');
        }
    } else {
        console.log('• [crm_contacts index fk_desg_id] Already absent');
    }

    process.exit(0);
}

run().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
