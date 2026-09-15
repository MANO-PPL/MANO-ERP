export const CAD_MODES = Object.freeze({ pan: 1, select: 0 });

export function readCadSearch(search) {
    const params = new URLSearchParams(search || '');
    return { url: params.get('url') || '', name: params.get('name') || 'Drawing.dwg' };
}

export function cadExtension(url) {
    const pathname = String(url || '').split('?')[0];
    const match = pathname.match(/\.(dwg|dxf)$/i);
    return match ? `.${match[1].toLowerCase()}` : '';
}

export function cadFilename(name, url) {
    const extension = cadExtension(url);
    if (!extension) return String(name || 'Drawing.dwg');
    const base = String(name || 'Drawing');
    return base.toLowerCase().endsWith(extension) ? base : `${base}${extension}`;
}

export function runCadCommand(viewer, command) {
    if (!viewer) return false;
    if (command === 'pan' || command === 'select') {
        if (!viewer.curView) return false;
        viewer.curView.mode = CAD_MODES[command];
        return true;
    }
    const commands = { measure: 'dist', clear: 'regen', fit: 'zoom e' };
    if (!commands[command] || typeof viewer.sendStringToExecute !== 'function') return false;
    viewer.sendStringToExecute(commands[command]);
    return true;
}

export function createCadLifecycleGuard() {
    let generation = 0;
    let activeUrl = '';
    return {
        begin(url) {
            generation += 1;
            activeUrl = String(url || '');
            return { generation, url: activeUrl };
        },
        invalidate() { generation += 1; activeUrl = ''; },
        isCurrent(token, url) {
            return Boolean(token) && token.generation === generation && token.url === activeUrl && activeUrl === String(url || '');
        },
    };
}
