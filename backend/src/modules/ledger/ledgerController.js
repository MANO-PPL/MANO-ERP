import * as ledgerService from './ledgerService.js';
import AppError from '../../utils/AppError.js';

export async function createTransaction(req, res, next) {
    try {
        const { lines, ...txnData } = req.body;
        if (!lines || !Array.isArray(lines)) {
            throw new AppError('Request body must contain lines array', 400);
        }
        const createdBy = req.user?.id || req.body.created_by || req.body.createdBy;
        const orgId     = req.user?.orgId || req.body.org_id || req.body.orgId;
        const result    = await ledgerService.createTransaction({ ...txnData, created_by: createdBy, org_id: orgId }, lines);
        res.status(201).json({ status: 'success', data: result });
    } catch (err) {
        next(err);
    }
}

export async function confirmTransaction(req, res, next) {
    try {
        const { id } = req.params;
        const result  = await ledgerService.confirmTransaction(id);
        res.status(200).json({ status: 'success', data: result });
    } catch (err) {
        next(err);
    }
}

export async function cancelTransaction(req, res, next) {
    try {
        const { id } = req.params;
        const result  = await ledgerService.cancelTransaction(id);
        res.status(200).json({ status: 'success', data: result });
    } catch (err) {
        next(err);
    }
}

export async function getTransaction(req, res, next) {
    try {
        const { id } = req.params;
        const result  = await ledgerService.getTransactionById(id);
        if (!result) throw new AppError(`Transaction '${id}' not found`, 404);
        res.status(200).json({ status: 'success', data: result });
    } catch (err) {
        next(err);
    }
}

export async function listTransactions(req, res, next) {
    try {
        const filters = {
            org_id:     req.query.org_id     || req.query.orgId || req.user?.orgId,
            project_id: req.query.project_id || req.query.projectId,
            txn_type:   req.query.txn_type,
            status:     req.query.status,
            party_id:   req.query.party_id   || req.query.partyId,
        };
        const result = await ledgerService.getTransactions(filters);
        res.status(200).json({ status: 'success', results: result.length, data: result });
    } catch (err) {
        next(err);
    }
}

export async function getPartyResourcePosition(req, res, next) {
    try {
        const partyId    = req.query.party_id   || req.query.partyId;
        const projectResourceId = req.query.project_resource_id || req.query.projectResourceId || null;
        const projectId  = req.query.project_id  || req.query.projectId  || null;
        const orgId      = req.query.org_id      || req.query.orgId      || req.user?.orgId || null;

        if (!partyId) throw new AppError('Query parameter party_id is required', 400);

        const result = await ledgerService.getPartyResourcePosition(partyId, projectResourceId, projectId, orgId);
        res.status(200).json({ status: 'success', data: result });
    } catch (err) {
        next(err);
    }
}

export async function getPartyLedger(req, res, next) {
    try {
        const partyId   = req.params.party_id || req.query.party_id || req.query.partyId;
        const projectId = req.query.project_id || req.query.projectId || null;
        const orgId     = req.query.org_id     || req.query.orgId    || req.user?.orgId || null;
        const result    = await ledgerService.getPartyLedger(partyId, projectId, orgId);
        res.status(200).json({ status: 'success', results: result.length, data: result });
    } catch (err) {
        next(err);
    }
}

export async function getProjectParties(req, res, next) {
    try {
        const projectId = req.params.projectId || req.query.project_id || req.query.projectId;
        if (!projectId) throw new AppError('project_id is required', 400);
        const result = await ledgerService.getProjectParties(projectId);
        res.status(200).json({ status: 'success', results: result.length, data: result });
    } catch (err) {
        next(err);
    }
}

export async function assignSupply(req, res, next) {
    try {
        const orgId  = req.body.orgId || req.body.org_id || req.user?.orgId;
        const projectResourceId = req.body.project_resource_id || req.body.projectResourceId;
        const result = await ledgerService.assignSupplyToContractor({ ...req.body, projectResourceId, orgId });
        res.status(201).json({ status: 'success', data: result });
    } catch (err) {
        next(err);
    }
}

export async function transferContractor(req, res, next) {
    try {
        const orgId  = req.body.orgId || req.body.org_id || req.user?.orgId;
        const projectResourceId = req.body.project_resource_id || req.body.projectResourceId;
        const result = await ledgerService.transferBetweenContractors({ ...req.body, projectResourceId, orgId });
        res.status(201).json({ status: 'success', data: result });
    } catch (err) {
        next(err);
    }
}
