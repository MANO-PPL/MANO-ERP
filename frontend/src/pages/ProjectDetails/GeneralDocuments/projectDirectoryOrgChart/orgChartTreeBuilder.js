// ─── Seniority Tier Ranking Algorithm ───
export const getDesignationRank = (designation = '', responsibilities = '', isPrimary = false) => {
    const d = (designation || '').toLowerCase().trim();
    const r = (responsibilities || '').toLowerCase().trim();

    // Tier 1: Executive / Top Leadership (Owner, Director, CEO, MD, Partner)
    if (/\b(chairman|ceo|managing director|md\b|president|founder|owner|partner|principal director|executive director|board member)\b/.test(d)) {
        return 1;
    }
    if (/\b(director)\b/.test(d)) {
        return 1.2;
    }

    // Tier 2: Senior Leadership / Directorate (VP, GM, Associate Director, Project Director)
    if (/\b(vice president|vp\b|general manager|gm\b|associate director|country head|regional head|project director|technical director)\b/.test(d)) {
        return 2;
    }

    // Tier 3: Project Leadership / Chief Roles (CPM, Project Head, Lead Architect)
    if (/\b(chief project manager|cpm\b|project head|lead architect|principal consultant|head of|hod\b|construction director|chief engineer)\b/.test(d)) {
        return 3;
    }

    // Tier 4: Project Management & Senior Specialists (PM, Construction Manager, Resident Engineer)
    if (/\b(senior project manager|sr\.?\s*project manager|project manager|pm\b|construction manager|site in-charge|resident engineer|lead engineer|deputy project manager|senior architect)\b/.test(d)) {
        return 4;
    }

    // Tier 5: Senior Engineers & Functional Managers (QA/QC Manager, Safety Manager, Billing Manager)
    if (/\b(senior engineer|sr\.?\s*engineer|qa\/qc manager|safety manager|hse manager|billing manager|contracts manager|commercial manager|lead)\b/.test(d)) {
        return 5;
    }

    // Tier 6: Site Engineers & Specialists (Site Engineer, Civil, MEP, QA/QC Engineer, Safety Officer, QS)
    if (/\b(site engineer|project engineer|civil engineer|structural engineer|mep engineer|electrical engineer|mechanical engineer|qa\/qc engineer|quality engineer|safety officer|hse officer|billing engineer|quantity surveyor|qs\b|architect|designer|planning engineer)\b/.test(d)) {
        return 6;
    }

    // Tier 7: Supervisors, Foremen & Field Leads
    if (/\b(site supervisor|supervisor|foreman|chargehand|field supervisor|surveyor)\b/.test(d)) {
        return 7;
    }

    // Tier 8: Junior / Assistants / Coordinators / Staff
    if (/\b(junior|jr\.?\b|assistant|coordinator|project coordinator|draftsman|cad\b|technician|trainee|intern|executive|officer|clerk)\b/.test(d)) {
        return 8;
    }

    return isPrimary ? 3.5 : 6.5;
};

// ─── Company Internal Personnel Tree Builder ───
export const buildCompanyPersonnelTree = (personnelList, companyName, companyCategory) => {
    if (!personnelList || personnelList.length === 0) return [];

    // Map and score all personnel
    const scoredMembers = personnelList
        .map((p, idx) => {
            const name = (p.contact_person || '').trim();
            const role = (p.designation || '').trim();
            if (!name && !role) return null;

            const isPrimary = idx === 0;
            const rank = getDesignationRank(role, p.responsibilities, isPrimary);

            return {
                id: `person-${p.id || `${companyName.replace(/\s+/g, '-').toLowerCase()}-${idx}`}`,
                name: name || 'Team Member',
                role: role || (isPrimary ? 'Primary Contact / Lead' : 'Team Member'),
                responsibilities: p.responsibilities || '',
                phone: p.telephone_no || '',
                email: p.email || '',
                address: p.address || '',
                party_name: companyName,
                category: companyCategory,
                type: 'person',
                rank,
                children: []
            };
        })
        .filter(Boolean);

    if (scoredMembers.length === 0) return [];
    if (scoredMembers.length === 1) return scoredMembers;

    // Sort by seniority rank (lowest rank number = highest seniority)
    scoredMembers.sort((a, b) => a.rank - b.rank);

    // Build hierarchy tree:
    const minRank = scoredMembers[0].rank;
    const topTierMembers = scoredMembers.filter((m) => m.rank === minRank);
    const subordinateMembers = scoredMembers.filter((m) => m.rank > minRank);

    if (subordinateMembers.length === 0) {
        return topTierMembers;
    }

    const candidateParents = [...topTierMembers];

    // Process subordinates in order of increasing rank
    subordinateMembers.forEach((sub) => {
        const eligibleParents = candidateParents.filter((p) => p.rank < sub.rank);
        if (eligibleParents.length > 0) {
            const maxEligibleRank = Math.max(...eligibleParents.map((p) => p.rank));
            const closestParents = eligibleParents.filter((p) => p.rank === maxEligibleRank);

            // Disciplinary / Trade matching where applicable:
            const subText = `${sub.role} ${sub.responsibilities}`.toLowerCase();
            const matchedParent = closestParents.find((p) => {
                const pText = `${p.role} ${p.responsibilities}`.toLowerCase();
                if (subText.includes('civil') && pText.includes('civil')) return true;
                if (subText.includes('mep') && pText.includes('mep')) return true;
                if (subText.includes('electrical') && pText.includes('electrical')) return true;
                if (subText.includes('qa') && pText.includes('qa')) return true;
                if (subText.includes('safety') && pText.includes('safety')) return true;
                return false;
            });

            const targetParent =
                matchedParent ||
                closestParents.reduce(
                    (min, curr) => (curr.children.length < min.children.length ? curr : min),
                    closestParents[0]
                );

            targetParent.children.push(sub);
        } else {
            candidateParents[0].children.push(sub);
        }

        candidateParents.push(sub);
    });

    return topTierMembers;
};

// ─── Full Project Org Chart Tree Builder ───
export const buildOrgChartTree = (
    gridRowsOrOptions = [],
    projectDetails = {},
    orgChartViewMode = 'full',
    focusedCompany = '',
    getParentCompanyName = () => null
) => {
    let gridRows = [];
    let projDetails = {};
    let viewMode = 'full';
    let focusedComp = '';
    let getParentCompName = () => null;

    if (Array.isArray(gridRowsOrOptions)) {
        gridRows = gridRowsOrOptions;
        projDetails = projectDetails || {};
        viewMode = orgChartViewMode || 'full';
        focusedComp = focusedCompany || '';
        getParentCompName = typeof getParentCompanyName === 'function' ? getParentCompanyName : (() => null);
    } else if (gridRowsOrOptions && typeof gridRowsOrOptions === 'object') {
        gridRows = gridRowsOrOptions.gridRows || [];
        projDetails = gridRowsOrOptions.projectDetails || {};
        viewMode = gridRowsOrOptions.orgChartViewMode || 'full';
        focusedComp = gridRowsOrOptions.focusedCompany || '';
        getParentCompName = typeof gridRowsOrOptions.getParentCompanyName === 'function'
            ? gridRowsOrOptions.getParentCompanyName
            : (() => null);
    }

    // Step 1: Collect and group all parties from gridRows with their full personnel lists
    const partyMap = new Map();

    gridRows.forEach((row, rowIndex) => {
        const rawName = (row.name || row.company_name || '').trim();
        // Forward-fill if company name is blank in spreadsheet
        const companyName = rawName || (typeof getParentCompName === 'function' ? getParentCompName(rowIndex) : null) || '';
        if (!companyName && (!row.personnel || row.personnel.length === 0) && !row.contact_person && !row.designation) {
            return;
        }

        const effectiveName = companyName || 'Unassigned Company';
        const key = effectiveName.toLowerCase();

        // Extract all personnel from this row
        const personnelFromRow = [];
        if (Array.isArray(row.personnel) && row.personnel.length > 0) {
            row.personnel.forEach((p) => {
                if ((p.contact_person || '').trim() || (p.designation || '').trim() || (p.responsibilities || '').trim()) {
                    personnelFromRow.push({
                        id: p.id,
                        contact_person: (p.contact_person || '').trim(),
                        designation: (p.designation || '').trim(),
                        responsibilities: p.responsibilities || '',
                        telephone_no: p.telephone_no || '',
                        email: p.email || '',
                        address: p.address || row.address || ''
                    });
                }
            });
        }

        // Also check main row contact person if not already in personnelFromRow
        const mainPersonName = (row.contact_person || '').trim();
        const mainDesignation = (row.designation || '').trim();
        if (mainPersonName || mainDesignation) {
            const alreadyExists = personnelFromRow.some(
                (p) => p.contact_person?.toLowerCase() === mainPersonName.toLowerCase() &&
                       p.designation?.toLowerCase() === mainDesignation.toLowerCase()
            );
            if (!alreadyExists) {
                personnelFromRow.unshift({
                    id: row.pd_id || row.id,
                    contact_person: mainPersonName,
                    designation: mainDesignation,
                    responsibilities: row.responsibilities || '',
                    telephone_no: row.telephone_no || '',
                    email: row.email || '',
                    address: row.address || ''
                });
            }
        }

        if (!partyMap.has(key)) {
            partyMap.set(key, {
                id: `party-${effectiveName.replace(/\s+/g, '-').toLowerCase()}`,
                rawId: row.id,
                party_id: row.party_id,
                name: effectiveName,
                category: row.category || 'Contractor',
                job_nature: row.job_name || row.job_nature || '',
                address: row.address || '',
                personnelList: personnelFromRow
            });
        } else {
            // Merge personnel avoiding duplicate names
            const existing = partyMap.get(key);
            if (!existing.job_nature && (row.job_name || row.job_nature)) {
                existing.job_nature = row.job_name || row.job_nature;
            }
            if (!existing.address && row.address) existing.address = row.address;
            if (row.category && (existing.category === 'Contractor' || !existing.category) && row.category !== 'Contractor') {
                existing.category = row.category;
            }
            personnelFromRow.forEach((p) => {
                const exists = existing.personnelList.some(
                    (ep) =>
                        ep.contact_person &&
                        ep.contact_person.trim().toLowerCase() === p.contact_person.trim().toLowerCase()
                );
                if (!exists) {
                    existing.personnelList.push(p);
                }
            });
        }
    });

    // Step 2: Handle "Company Focus" mode: focus entirely on one company's internal team tree
    if (viewMode === 'company') {
        const targetKey = focusedComp ? focusedComp.trim().toLowerCase() : (partyMap.keys().next().value || '');
        const targetParty = targetKey ? partyMap.get(targetKey) : null;
        if (targetParty) {
            const teamTree = buildCompanyPersonnelTree(
                targetParty.personnelList,
                targetParty.name,
                targetParty.category
            );
            return {
                id: targetParty.id,
                name: targetParty.name,
                category: targetParty.category,
                role: targetParty.job_nature || targetParty.category,
                party_name: targetParty.name,
                address: targetParty.address,
                type: (targetParty.category || '').toLowerCase() === 'client' ? 'client' : 'party',
                memberCount: targetParty.personnelList.length,
                children: teamTree
            };
        }
    }

    // Step 3: Classify parties into governance tiers
    const clientParties = [];
    const pmcParties = [];
    const consultantParties = [];
    const contractorParties = [];
    const supplierParties = [];

    partyMap.forEach((party) => {
        const cat = (party.category || '').toLowerCase();
        const job = (party.job_nature || '').toLowerCase();
        const isProjectClient = projDetails.client_name && party.name.toLowerCase() === projDetails.client_name.trim().toLowerCase();

        if (cat === 'client' || isProjectClient) {
            clientParties.push(party);
        } else if (cat === 'pmc' || job.includes('pmc') || job.includes('project management')) {
            pmcParties.push(party);
        } else if (
            cat === 'consultant' ||
            job.includes('consultant') ||
            job.includes('architect') ||
            job.includes('design') ||
            job.includes('structural') ||
            job.includes('geotechnical')
        ) {
            consultantParties.push(party);
        } else if (
            cat === 'supplier' ||
            cat === 'vendor' ||
            job.includes('supplier') ||
            job.includes('trading') ||
            job.includes('fabrication')
        ) {
            supplierParties.push(party);
        } else {
            contractorParties.push(party);
        }
    });

    // Helper to create a party node
    const isGovernanceOnly = viewMode === 'governance';

    const createPartyNode = (party, childParties = []) => {
        const isClient = (party.category || '').toLowerCase() === 'client';
        const memberCount = party.personnelList ? party.personnelList.length : 0;

        const personnelTree = isGovernanceOnly
            ? []
            : buildCompanyPersonnelTree(party.personnelList || [], party.name, party.category);

        let children = [];
        if (personnelTree.length > 0 && childParties.length > 0) {
            // Separate internal personnel and child/contracted companies cleanly
            children = [
                {
                    id: `${party.id}-team-branch`,
                    name: `${party.name} Team`,
                    role: `${memberCount} Member${memberCount === 1 ? '' : 's'}`,
                    type: 'team-branch',
                    children: personnelTree
                },
                {
                    id: `${party.id}-parties-branch`,
                    name: 'Appointed Parties & Execution',
                    role: `${childParties.length} Compan${childParties.length === 1 ? 'y' : 'ies'}`,
                    type: 'parties-branch',
                    children: childParties
                }
            ];
        } else if (personnelTree.length > 0) {
            children = personnelTree;
        } else if (childParties.length > 0) {
            children = childParties;
        }

        return {
            id: party.id,
            name: party.name,
            category: party.category || 'Contractor',
            role: (party.job_nature && party.job_nature.toLowerCase() !== (party.category || '').toLowerCase()) ? party.job_nature : '',
            party_name: party.name,
            address: party.address,
            type: isClient ? 'client' : 'party',
            memberCount,
            children
        };
    };

    // Step 4: Build Execution Nodes (All Consultants, All Contractors, All Suppliers)
    const consultantNodes = consultantParties.map((c) => createPartyNode(c));
    const contractorNodes = contractorParties.map((c) => createPartyNode(c));
    const supplierNodes = supplierParties.map((s) => createPartyNode(s));

    // Group execution entities cleanly - all are guaranteed visible!
    const executionPartyNodes = [...consultantNodes, ...contractorNodes, ...supplierNodes];

    // Step 5: Build PMC nodes
    let pmcNodes = [];
    if (pmcParties.length > 0) {
        pmcNodes = pmcParties.map((pmc, idx) => {
            return createPartyNode(pmc, idx === 0 ? executionPartyNodes : []);
        });
    }

    // Child parties under client: PMC nodes if PMC exists, otherwise execution parties directly
    const childPartiesUnderClient = pmcNodes.length > 0 ? pmcNodes : executionPartyNodes;

    // Step 6: Build Client nodes - ALL clients are preserved!
    let topLevelNodes = [];
    if (clientParties.length > 0) {
        topLevelNodes = clientParties.map((client, idx) => {
            return createPartyNode(client, idx === 0 ? childPartiesUnderClient : []);
        });
    } else if (projDetails.client_name && projDetails.client_name.trim()) {
        // Virtual Client fallback only when projectDetails has client_name specified
        const virtualClient = {
            id: 'party-client-virtual',
            name: projDetails.client_name.trim(),
            category: 'Client',
            job_nature: 'Client / Employer',
            address: '',
            personnelList: []
        };
        topLevelNodes = [createPartyNode(virtualClient, childPartiesUnderClient)];
    } else {
        // If no client is specified, attach PMC or execution parties directly to project root!
        topLevelNodes = childPartiesUnderClient;
    }

    // Step 7: Root Project Node - Contains top level governance nodes
    return {
        id: 'project-root',
        name: projDetails.name || 'Project Name',
        role: projDetails.location || '',
        location: projDetails.location || '',
        type: 'project',
        children: topLevelNodes
    };
};
