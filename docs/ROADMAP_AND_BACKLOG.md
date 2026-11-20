# MANO-ERP Engineering Roadmap & Task Backlog

A centralized board for tracking active initiatives, upcoming unblocked tasks, technical debt, and quick-improvement ideas to eliminate idle developer time and keep architecture clean.

---

## 🚀 Active / In Progress

| ID | Title | Domain | Assignee | Status |
|:---|:---|:---|:---|:---|
| **#CAT-IMG-01** | **Catalog Image Support & WebP Pipeline** | Catalog / Shared | Dev Complete | WebP auto-compression pipeline (Sharp) + multi-tenant storage + large collapsible card UI on Resource & Activity pages complete. Needs manual DB migration (`004_catalog_images.sql`). |

---

## 📋 Next Up (Ready for Dev)
*Self-service queue for developers who finish early:*

- [ ] **[#CAT-BULK-01] Bulk Resource Image Upload Utility**: Add capability to drag & drop a ZIP or multiple files named `{code}.webp` to batch-assign photos to 100 catalog materials.
- [ ] **[#CAT-SYNC-IMG] Sync Diff Detection for Images**: Surface master vs project copy image differences in `SyncReviewModal` alongside rates and descriptions.

---

## 🛠️ Technical Debt & Architectural Refactoring

- [ ] **[#DEBT-MEDIA-01] Unified Media & S3 Upload Migration**:
  - **Objective**: Remove legacy ad-hoc multer configs and direct S3 calls from old feature modules and standardize onto `backend/src/modules/shared/mediaService.js`.
  - **Modules to Refactor**:
    1. `backend/src/modules/projects/core/projectController.js` (`uploadProjectLogo`)
    2. `backend/src/modules/projects/drawings/drawingsRoutes.js` (`uploadDrawing`)
    3. `frontend/src/pages/Projects.jsx` (`getS3SignedUrl` client-side helper)

---

## 💡 Quick Improvement Pool
*Drop zone for spontaneous ideas, UX polishes, and minor feature additions:*

- [ ] Add fullscreen image lightbox modal on clicking catalog thumbnail.
- [ ] Pre-generate small (64x64) and medium (400x400) WebP variants for ultra-fast list previews.

---

## ✅ Completed Log

- [x] **[#CAT-UNITS-01] Metric Dimensions vs Packaging Measures Split**: Units tab separated into Metric Dimensions and Packaging/Containers with category-compatible filtering.
- [x] **[#CAT-UX-01] Relaxed Output Unit & Norm Editing**: Activities and norm lines can now be edited/deleted freely when no downstream project transactions (DPR/WIP) lock them.
- [x] **[#CAT-ACT-PAGE] Dedicated Activity Workspace**: Replaced narrow right-drawer with full-page activity view, synchronized breadcrumbs, and editable recipe formulation.
- [x] **[#CAT-MERGE-01] Unified Cost & BOM Table**: Merged repetitive cost breakdown and BOM consumption tables into a single horizontal split table.
