import '../config/config.js';
import { db } from '../config/database.js';
import * as resourceService from '../modules/inventory/resourceService.js';
import { resolveComponents } from '../services/compositionResolver.js';
import fs from 'fs';
import path from 'path';

const ORG_ID = 1;

async function main() {
    console.log("=== STARTING DYNAMIC RECIPE BULK IMPORT ===");
    
    // Parse arguments
    const args = process.argv.slice(2);
    const jsonPath = args[0] || 'src/test/lemonade.json';
    const absolutePath = path.resolve(jsonPath);

    if (!fs.existsSync(absolutePath)) {
        console.error(`❌ Error: File not found at ${absolutePath}`);
        process.exit(1);
    }

    try {
        console.log(`Reading recipe JSON from: ${jsonPath}`);
        const rawData = fs.readFileSync(absolutePath, 'utf8');
        const data = JSON.parse(rawData);

        if (!Array.isArray(data.resources)) {
            throw new Error("JSON must contain a root 'resources' array.");
        }

        const resources = data.resources;

        // Clean up workspace before execution to avoid duplicate key violations
        const codesToClean = resources.map(r => r.code).filter(Boolean);
        if (codesToClean.length > 0) {
            console.log("Cleaning up workspace matching codes:", codesToClean.join(', '));
            await db('res_resources')
                .where('org_id', ORG_ID)
                .whereIn('code', codesToClean)
                .del();
        }

        // Separate raw components (materials and labor) from composite items (which require composition mappings)
        const rawPayload = resources.filter(r => r.type === 'material' || r.type === 'labour');
        const itemPayload = resources.filter(r => r.type === 'item');

        console.log(`\nProcessing: ${rawPayload.length} raw components, ${itemPayload.length} composite items.`);

        // Step 1: Bulk upload raw ingredients/labor
        console.log("Step 1: Uploading raw materials and labor resources...");
        const result1 = await resourceService.bulkInsertResources(ORG_ID, rawPayload);
        if (result1.errors.length > 0) {
            throw new Error(`Failed to upload raw resources: ${result1.errors[0].error}`);
        }

        // Build code-to-id map
        const codeToIdMap = {};
        for (let i = 0; i < rawPayload.length; i++) {
            const code = rawPayload[i].code;
            const dbId = result1.insertedIds[i];
            codeToIdMap[code] = dbId;
        }

        console.log("✔ Raw resources uploaded. Code-to-ID mappings established:");
        console.table(codeToIdMap);

        // Step 2: Map composition codes to generated DB IDs, then upload composite items
        if (itemPayload.length > 0) {
            console.log("\nStep 2: Resolving recipe compositions & uploading items...");
            
            const processedItems = itemPayload.map(item => {
                const compositions = Array.isArray(item.compositions) ? item.compositions.map(c => {
                    const componentId = codeToIdMap[c.component_code];
                    if (!componentId) {
                        throw new Error(`Invalid composition: Component code "${c.component_code}" not defined in JSON.`);
                    }
                    return {
                        component_resource_id: componentId,
                        quantity: c.quantity,
                        unit_code: c.unit_code
                    };
                }) : [];

                return {
                    ...item,
                    compositions
                };
            });

            const result2 = await resourceService.bulkInsertResources(ORG_ID, processedItems);
            if (result2.errors.length > 0) {
                throw new Error(`Failed to upload composite items: ${result2.errors[0].error}`);
            }

            console.log("✔ Composite items uploaded successfully.");
            for (let i = 0; i < processedItems.length; i++) {
                const id = result2.insertedIds[i];
                console.log(`  - Composite Item "${processedItems[i].name}" (ID: ${id})`);
                
                // Show dynamic recipe resolution preview
                const resolved = await resolveComponents(id, db);
                console.log(`\nResolved ingredients for "${processedItems[i].name}":`);
                console.table(resolved);
            }
        }

        console.log("\n🎉 DYNAMIC BULK IMPORT COMPLETED SUCCESSFULLY!");
    } catch (error) {
        console.error("\n❌ Import Process Failed:", error.message);
    } finally {
        await db.destroy();
    }
}

main();
