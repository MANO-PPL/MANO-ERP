// Dedicated agent control-plane tables. No ERP schema is altered by this initializer.
export const AGENT_TABLES = Object.freeze(['agent_conversations', 'agent_requests', 'agent_executions', 'agent_events']);
export function validateUniqueIndexes(rows) {
    const required = {
        agent_conversations: [['conversation_id']],
        agent_requests: [['request_id'], ['conversation_id', 'client_request_key']],
        agent_executions: [['execution_id'], ['request_id', 'step_index'], ['confirmation_id']],
        agent_events: [['event_id'], ['request_id', 'sequence']]
    };
    for (const [table, contracts] of Object.entries(required)) {
        const indexes = new Map();
        for (const row of rows.filter(r => r.TABLE_NAME === table && Number(r.NON_UNIQUE) === 0)) {
            if (!indexes.has(row.INDEX_NAME)) indexes.set(row.INDEX_NAME, []);
            indexes.get(row.INDEX_NAME).push(row);
        }
        const identities = [...indexes.values()].filter(columns => columns.every(c => c.SUB_PART == null))
            .map(columns => columns.sort((a, b) => a.SEQ_IN_INDEX - b.SEQ_IN_INDEX).map(c => c.COLUMN_NAME).join('|'));
        if (contracts.some(columns => !identities.includes(columns.join('|')))) throw new Error('Agent unique-index contract missing');
    }
}
export async function initializeAgentSchema(db) {
    if (!(await db.schema.hasTable('agent_conversations'))) await db.schema.createTable('agent_conversations', t => {
        t.engine('InnoDB'); t.string('conversation_id', 80).primary(); t.integer('org_id').unsigned().notNullable(); t.integer('user_id').unsigned().notNullable();
        t.string('status', 30).notNullable(); t.bigInteger('created_ms').notNullable(); t.bigInteger('activity_ms').notNullable(); t.bigInteger('expires_ms').notNullable();
        t.index(['org_id', 'user_id', 'expires_ms']);
    });
    if (!(await db.schema.hasTable('agent_requests'))) await db.schema.createTable('agent_requests', t => {
        t.engine('InnoDB'); t.string('request_id', 80).primary(); t.string('conversation_id', 80).notNullable().references('conversation_id').inTable('agent_conversations');
        t.string('client_request_key', 36).notNullable(); t.string('fingerprint', 64).notNullable(); t.json('context_json').nullable();
        t.string('status', 30).notNullable(); t.string('reasoning_epoch', 80).notNullable(); t.bigInteger('lease_ms').notNullable();
        t.integer('step_index').notNullable().defaultTo(0); t.integer('next_sequence').notNullable().defaultTo(1);
        t.string('generation', 64).notNullable(); t.string('registry_version', 40).notNullable(); t.string('error_category', 100).nullable();
        t.bigInteger('created_ms').notNullable(); t.bigInteger('expires_ms').notNullable();
        t.unique(['conversation_id', 'client_request_key']); t.index(['status', 'lease_ms']);
    });
    if (!(await db.schema.hasTable('agent_executions'))) await db.schema.createTable('agent_executions', t => {
        t.engine('InnoDB'); t.string('execution_id', 80).primary(); t.string('request_id', 80).notNullable().references('request_id').inTable('agent_requests');
        t.integer('step_index').notNullable(); t.string('tool', 80).notNullable(); t.integer('tool_version').notNullable(); t.string('risk', 10).notNullable();
        t.string('authorization_decision', 20).notNullable(); t.json('scope_json').nullable(); t.json('args_json').nullable(); t.json('preconditions_json').nullable();
        t.string('operation_fingerprint', 64).notNullable(); t.string('confirmation_id', 80).nullable().unique(); t.bigInteger('confirmation_expires_ms').nullable();
        t.string('credential_hash', 64).nullable(); t.string('status', 30).notNullable(); t.json('result_json').nullable(); t.string('error_category', 100).nullable();
        t.bigInteger('created_ms').notNullable(); t.bigInteger('completed_ms').nullable(); t.unique(['request_id', 'step_index']); t.index(['status', 'confirmation_expires_ms']);
    });
    if (!(await db.schema.hasTable('agent_events'))) await db.schema.createTable('agent_events', t => {
        t.engine('InnoDB'); t.string('event_id', 80).primary(); t.string('request_id', 80).notNullable().references('request_id').inTable('agent_requests');
        t.string('execution_id', 80).nullable().references('execution_id').inTable('agent_executions'); t.integer('sequence').notNullable();
        t.string('type', 40).notNullable(); t.json('payload_json').nullable(); t.string('audit_category', 100).notNullable(); t.bigInteger('created_ms').notNullable();
        t.unique(['request_id', 'sequence']); t.index(['created_ms']);
    });
    // Do not self-heal an incompatible existing table. Agent stays unavailable on mismatch.
    const required = {
        agent_conversations: ['conversation_id', 'org_id', 'user_id', 'status', 'created_ms', 'activity_ms', 'expires_ms'],
        agent_requests: ['request_id', 'conversation_id', 'client_request_key', 'fingerprint', 'context_json', 'status', 'reasoning_epoch', 'lease_ms', 'step_index', 'next_sequence', 'generation', 'registry_version', 'error_category', 'created_ms', 'expires_ms'],
        agent_executions: ['execution_id', 'request_id', 'step_index', 'tool', 'tool_version', 'risk', 'authorization_decision', 'scope_json', 'args_json', 'preconditions_json', 'operation_fingerprint', 'confirmation_id', 'confirmation_expires_ms', 'credential_hash', 'status', 'result_json', 'error_category', 'created_ms', 'completed_ms'],
        agent_events: ['event_id', 'request_id', 'execution_id', 'sequence', 'type', 'payload_json', 'audit_category', 'created_ms']
    };
    for (const name of AGENT_TABLES) {
        const columns = await db(name).columnInfo();
        if (required[name].some(c => !columns[c])) throw new Error('Agent schema incompatible');
    }
    const engines = await db('information_schema.TABLES').select('TABLE_NAME', 'ENGINE').whereRaw('TABLE_SCHEMA = DATABASE()').whereIn('TABLE_NAME', AGENT_TABLES);
    if (engines.length !== 4 || engines.some(row => String(row.ENGINE).toLowerCase() !== 'innodb')) throw new Error('Agent tables must be transactional');
    validateUniqueIndexes(await db('information_schema.STATISTICS').select('TABLE_NAME', 'INDEX_NAME', 'NON_UNIQUE', 'SEQ_IN_INDEX', 'COLUMN_NAME', 'SUB_PART')
        .whereRaw('TABLE_SCHEMA = DATABASE()').whereIn('TABLE_NAME', AGENT_TABLES));
    const relations = await db('information_schema.KEY_COLUMN_USAGE').select('TABLE_NAME', 'COLUMN_NAME', 'REFERENCED_TABLE_NAME', 'REFERENCED_COLUMN_NAME')
        .whereRaw('TABLE_SCHEMA = DATABASE()').whereIn('TABLE_NAME', AGENT_TABLES).whereNotNull('REFERENCED_TABLE_NAME');
    for (const [table, column, parent, key] of [['agent_requests', 'conversation_id', 'agent_conversations', 'conversation_id'],
        ['agent_executions', 'request_id', 'agent_requests', 'request_id'], ['agent_events', 'request_id', 'agent_requests', 'request_id'],
        ['agent_events', 'execution_id', 'agent_executions', 'execution_id']]) {
        if (!relations.some(r => r.TABLE_NAME === table && r.COLUMN_NAME === column && r.REFERENCED_TABLE_NAME === parent && r.REFERENCED_COLUMN_NAME === key)) throw new Error('Agent foreign-key contract missing');
    }
    const rules = await db('information_schema.REFERENTIAL_CONSTRAINTS').select('DELETE_RULE').whereRaw('CONSTRAINT_SCHEMA = DATABASE()').whereIn('TABLE_NAME', AGENT_TABLES);
    if (rules.some(r => !['RESTRICT', 'NO ACTION'].includes(r.DELETE_RULE))) throw new Error('Agent audit identities must not cascade-delete');
}
