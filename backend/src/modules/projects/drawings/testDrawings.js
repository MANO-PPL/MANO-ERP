import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

const router = express.Router();

// Configure disk storage for test drawings
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(process.cwd(), 'uploads', 'test');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.dwg' || ext === '.dxf' || ext === '.pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only .dwg, .dxf, and .pdf files are supported.'));
        }
    }
});

// A valid minimal SVG displaying a fallback warning message
const createFallbackSvg = (filename, hasTool = false) => {
    const title = hasTool ? "Conversion Failed" : "LibreDWG Tool Missing";
    const subtitle = hasTool 
        ? "An error occurred during dwg2SVG execution." 
        : "Install LibreDWG locally via: brew install libredwg";
    
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <text x="50" y="80" font-family="Helvetica, Arial, sans-serif" font-size="24" font-weight="bold" fill="#0f172a">${title}</text>
  <text x="50" y="120" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#475569">This is a fallback SVG preview for: ${filename}</text>
  <text x="50" y="150" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#475569">${subtitle}</text>
  <text x="50" y="190" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#475569">The original file is stored and served untouched.</text>
  <text x="50" y="210" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#475569">Once LibreDWG is installed in the system PATH, the conversion will run automatically.</text>
</svg>`;
};

router.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const ext = path.extname(req.file.originalname).toLowerCase();
        const filename = req.file.filename;
        const inputPath = req.file.path;
        const isPdf = ext === '.pdf';
        const previewFilename = `preview-${filename.replace(ext, '')}.${isPdf ? 'pdf' : 'svg'}`;
        const previewPath = path.join(process.cwd(), 'uploads', 'test', previewFilename);

        const responseData = {
            originalName: req.file.originalname,
            originalUrl: `/uploads/test/${filename}`,
            previewUrl: `/uploads/test/${previewFilename}`,
            fileType: ext,
            convertedStatus: 'skipped'
        };

        if (isPdf) {
            // Already PDF, copy to preview directly
            fs.copyFileSync(inputPath, previewPath);
            responseData.convertedStatus = 'direct_pdf';
            return res.status(200).json(responseData);
        }

        // DWG or DXF: Attempt Conversion using CLI tool (dwg2SVG)
        const command = `dwg2SVG "${inputPath}" > "${previewPath}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.warn(`[DWG Conversion] CLI tool execution failed: ${error.message}`);
                console.warn(`[DWG Conversion] Generating fallback SVG warning...`);
                // Write fallback SVG warning
                const fallbackContent = createFallbackSvg(req.file.originalname, false);
                fs.writeFileSync(previewPath, fallbackContent);
                responseData.convertedStatus = 'failed_fallback';
                return res.status(200).json(responseData);
            }
            
            console.log(`[DWG Conversion] Successfully converted ${filename} to SVG`);
            responseData.convertedStatus = 'converted_svg';
            return res.status(200).json(responseData);
        });

    } catch (err) {
        console.error('Error during drawing test upload:', err);
        return res.status(500).json({ error: err.message });
    }
});

export default router;
