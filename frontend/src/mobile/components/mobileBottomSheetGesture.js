export const BOTTOM_SHEET_DEFAULT = 'default';
export const BOTTOM_SHEET_EXPANDED = 'expanded';

export const BOTTOM_SHEET_DRAG_DISTANCE = 72;
export const BOTTOM_SHEET_DRAG_VELOCITY = 0.55;

export function isHorizontalDrag(deltaX = 0, deltaY = 0, slop = 8) {
    return Math.abs(deltaX) > slop && Math.abs(deltaX) > Math.abs(deltaY);
}

export function resolveBottomSheetGesture({
    origin = BOTTOM_SHEET_DEFAULT,
    deltaX = 0,
    deltaY = 0,
    velocityY = 0,
    canClose = false,
    cancelled = false,
} = {}) {
    if (cancelled || isHorizontalDrag(deltaX, deltaY)) return { action: 'snap', state: origin };

    const upward = deltaY < 0;
    const passedDistance = Math.abs(deltaY) >= BOTTOM_SHEET_DRAG_DISTANCE;
    const passedVelocity = upward
        ? velocityY <= -BOTTOM_SHEET_DRAG_VELOCITY
        : velocityY >= BOTTOM_SHEET_DRAG_VELOCITY;
    const committed = passedDistance || passedVelocity;

    if (origin === BOTTOM_SHEET_DEFAULT) {
        if (upward && committed) return { action: 'expand', state: BOTTOM_SHEET_EXPANDED };
        if (!upward && committed && canClose) return { action: 'dismiss', state: BOTTOM_SHEET_DEFAULT };
        return { action: 'snap', state: BOTTOM_SHEET_DEFAULT };
    }

    if (!upward && committed) return { action: 'collapse', state: BOTTOM_SHEET_DEFAULT };
    return { action: 'snap', state: BOTTOM_SHEET_EXPANDED };
}

export function bottomSheetDragOffset({ origin = BOTTOM_SHEET_DEFAULT, deltaX = 0, deltaY = 0 } = {}) {
    if (isHorizontalDrag(deltaX, deltaY)) return 0;
    const limit = origin === BOTTOM_SHEET_EXPANDED ? 260 : 220;
    return Math.max(-limit, Math.min(limit, deltaY));
}
