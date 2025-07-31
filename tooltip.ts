// tooltip.ts
import { createPopper, Instance as PopperInstance, VirtualElement } from '@popperjs/core';
import { NodeSingular, EdgeSingular } from 'cytoscape';
import { manualTooltipDiv } from './dom.js';

let currentPopperInstance: PopperInstance | null = null;

export function showManualTooltip(target: NodeSingular | EdgeSingular, text: string): void {
    if (!manualTooltipDiv) return;
    manualTooltipDiv.innerHTML = text;
    manualTooltipDiv.style.display = 'block';

    if (currentPopperInstance) currentPopperInstance.destroy();

    const bb = target.renderedBoundingBox ? target.renderedBoundingBox() : (target as any).popperRef().renderedBoundingBox(); // Handle nodes and edges

    const virtualElement: VirtualElement = {
        getBoundingClientRect: () => ({
            width: bb.w,
            height: bb.h,
            top: bb.y1,
            right: bb.x2,
            bottom: bb.y2,
            left: bb.x1,
            x: bb.x1,
            y: bb.y1,
            toJSON: () => JSON.stringify(this)
        }),
    };

    currentPopperInstance = createPopper(virtualElement, manualTooltipDiv, {
        placement: 'auto',
        modifiers: [{ name: 'offset', options: { offset: [0, 10] } }]
    });
}

export function hideManualTooltip(): void {
    if (!manualTooltipDiv) return;
    manualTooltipDiv.style.display = 'none';
    if (currentPopperInstance) {
        currentPopperInstance.destroy();
        currentPopperInstance = null;
    }
}
