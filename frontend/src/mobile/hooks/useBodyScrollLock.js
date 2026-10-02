import { useEffect } from 'react';

let activeLocks = 0;
let previousBodyStyles = null;

const lockBody = () => {
    if (typeof document === 'undefined') return () => {};

    if (activeLocks === 0) {
        previousBodyStyles = {
            overflow: document.body.style.overflow,
            overscrollBehavior: document.body.style.overscrollBehavior,
            paddingRight: document.body.style.paddingRight,
        };

        const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
        const scrollbarWidth = Math.max(0, viewportWidth - document.documentElement.clientWidth);
        document.body.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'none';
        if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    activeLocks += 1;
    let released = false;

    return () => {
        if (released) return;
        released = true;
        activeLocks = Math.max(0, activeLocks - 1);
        if (activeLocks !== 0 || !previousBodyStyles) return;

        document.body.style.overflow = previousBodyStyles.overflow;
        document.body.style.overscrollBehavior = previousBodyStyles.overscrollBehavior;
        document.body.style.paddingRight = previousBodyStyles.paddingRight;
        previousBodyStyles = null;
    };
};

export default function useBodyScrollLock(locked) {
    useEffect(() => {
        if (!locked) return undefined;
        return lockBody();
    }, [locked]);
}
