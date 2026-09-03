import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createSafeOkfProvider, CANONICAL, VALIDATION_SOURCES, mappedDependencies } from '../../src/modules/agent/safeOkfProvider.js';
import { sha256 } from '../../src/modules/agent/agentValidation.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const inputs = ['backend/scripts/okf-validate-bundle.js', 'backend/knowledge/.okf-system/source-map.json', 'backend/knowledge/.okf-system/okf-metadata.json',
    ...CANONICAL.map(p => `backend/knowledge/${p}`), ...VALIDATION_SOURCES];
async function fixture(t) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mano-agent-fixture-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    for (const relative of inputs) { const target = path.join(directory, relative); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.copyFile(path.join(root, relative), target); }
    return directory;
}
test('S26 unsafe captured OKF fails closed using real unchanged Stage 9', async t => {
    const directory = await fixture(t); const file = path.join(directory, 'backend/knowledge/clients/index.md');
    const content = await fs.readFile(file, 'utf8'); await fs.writeFile(file, content.replace(/## Agent Constraints[\s\S]*?(?=\n## |$)/, '## Agent Constraints\n'));
    await assert.rejects(createSafeOkfProvider({ root: directory }).acquire(), { code: 'backend_unavailable' });
});
test('S27 missing canonical OKF is unavailable, never silently skipped', async t => {
    const directory = await fixture(t); await fs.unlink(path.join(directory, 'backend/knowledge/index.md'));
    await assert.rejects(createSafeOkfProvider({ root: directory }).acquire());
});
test('S50 consume captured bytes, not live bytes changed during validation', async t => {
    const directory = await fixture(t); const target = path.join(directory, 'backend/knowledge/index.md'); const original = await fs.readFile(target, 'utf8');
    const loader = createSafeOkfProvider({ root: directory, run: async (command, args, options) => {
        await fs.writeFile(target, original + '\nLive mutation after capture.\n');
        return { stdout: execFileSync(command, args, { ...options, encoding: 'utf8' }) };
    } });
    const generation = await loader.acquire(); assert.equal(generation.markdown.find(m => m.file === 'index.md').content, original);
    assert.equal(Object.keys(generation.manifest).length, 39); assert.ok(!JSON.stringify(generation.markdown).includes('function readMappedServiceSource'));
});
test('S51 missing, escaping and unreviewed mapped dependencies fail closed', async t => {
    const map = JSON.parse(await fs.readFile(path.join(root, 'backend/knowledge/.okf-system/source-map.json'), 'utf8'));
    assert.equal(mappedDependencies(map).length, 26);
    for (const bad of ['../../outside.js', 'C:/secret', 'backend/src/unknown.js']) { const changed = structuredClone(map); changed[0].primarySources.push(bad); assert.throws(() => mappedDependencies(changed)); }
    const directory = await fixture(t); await fs.unlink(path.join(directory, VALIDATION_SOURCES[0]));
    await assert.rejects(createSafeOkfProvider({ root: directory }).acquire());
});

async function ciHarness(t, changes = {}) {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'mano-ci-fixture-')); t.after(() => fs.rm(temporary, { recursive: true, force: true }));
    const workflow = await fs.readFile(path.join(root, '.github/workflows/okf-validate.yml'), 'utf8');
    const source = workflow.match(/node <<'NODE'\r?\n([\s\S]*?)\r?\n          NODE/)[1].split(/\r?\n/).map(line => line.slice(10)).join('\n');
    const blobs = new Map(); const baseFiles = new Map(); const headFiles = new Map();
    for (const relative of inputs) {
        const bytes = await fs.readFile(path.join(root, relative)); const hash = sha256(bytes); blobs.set(hash, bytes);
        baseFiles.set(relative, { hash, mode: '100644' }); headFiles.set(relative, { hash, mode: '100644' });
    }
    for (const [relative, change] of Object.entries(changes)) {
        if (change === null) { headFiles.delete(relative); continue; }
        const bytes = Buffer.from(change.bytes ?? change); const hash = sha256(bytes); blobs.set(hash, bytes); headFiles.set(relative, { hash, mode: change.mode || '100644' });
    }
    const calls = [];
    const spawnSync = (command, args, options) => {
        calls.push({ command, args }); assert.equal(command, 'git'); const files = options.cwd.endsWith('trusted-base') ? baseFiles : headFiles;
        if (args[0] === 'ls-tree') {
            assert.equal(args[2], options.cwd.endsWith('trusted-base') ? 'BASE_EXACT' : 'HEAD_EXACT');
            const relative = args[4]; const entry = files.get(relative);
            return { status: 0, stdout: Buffer.from(entry ? `${entry.mode} blob ${entry.hash}\t${relative}\0` : '') };
        }
        assert.deepEqual(Array.from(args.slice(0, 2)), ['cat-file', 'blob']); return { status: 0, stdout: blobs.get(args[2]) };
    };
    return { temporary, calls, execute() {
        vm.runInNewContext(source, { require: name => ({ 'node:fs': fsSync, 'node:path': path, 'node:child_process': { spawnSync } })[name],
            process: { cwd: () => temporary, env: { BASE_SHA: 'BASE_EXACT', HEAD_SHA: 'HEAD_EXACT' } }, Buffer });
        return path.join(temporary, 'validation-tree');
    } };
}
test('CI correction: trusted Stage 9 reads exact head mapped source, never PR validator/package/workflow', async t => {
    const relative = 'backend/src/modules/inventory/resourceService.js'; const original = await fs.readFile(path.join(root, relative), 'utf8');
    const head = original + "\nexport async function headOnlyDelete() { await db('res_resources').where({ id: 1 }).delete(); }\n";
    const h = await ciHarness(t, { [relative]: head, 'backend/scripts/okf-validate-bundle.js': 'throw Error("PR VALIDATOR MUST NEVER EXECUTE");',
        'backend/package.json': '{"scripts":{"preinstall":"malicious"}}', 'frontend/ordinary.jsx': 'unrelated' });
    const tree = h.execute();
    assert.equal(await fs.readFile(path.join(tree, relative), 'utf8'), head);
    assert.equal(fsSync.existsSync(path.join(tree, 'backend/package.json')), false);
    const validator = path.join(tree, 'backend/scripts/okf-validate-bundle.mjs');
    assert.equal(sha256(await fs.readFile(validator)), sha256(await fs.readFile(path.join(root, 'backend/scripts/okf-validate-bundle.js'))));
    let stdout; try { stdout = execFileSync(process.execPath, [validator], { cwd: tree, encoding: 'utf8' }); } catch (error) { stdout = error.stdout; }
    const report = JSON.parse(stdout); assert.ok(report.results.some(r => r.check === 'A3' && r.detail.includes('headOnlyDelete')));
});
test('CI mapped source deletions and symlinks never substitute base data', async t => {
    for (const change of [null, { mode: '120000', bytes: '../../secret' }]) {
        const h = await ciHarness(t, { 'backend/src/modules/inventory/resourceService.js': change }); assert.throws(() => h.execute(), /missing\/deleted|Unsafe or symlinked/);
    }
});
