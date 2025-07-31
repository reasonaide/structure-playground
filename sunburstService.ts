// sunburstService.ts
import * as d3 from 'd3';
import { NodeSingular } from 'cytoscape';
import { sunburstContainer, manualTooltipDiv } from './dom.js';
import { getCyInstance } from './cytoscapeService.js';
import { CyNodeData, CyEdgeData, DPType } from './types.js';
import { predicateColors, symmetricPredicatesSet } from './config.js';
import { formatTextWithReferences } from './utils.js';
import { createPopper, Instance as PopperInstance, VirtualElement } from '@popperjs/core';

export type SunburstConnectionMode = 'incoming-symmetric' | 'incoming-only' | 'outgoing-only' | 'outgoing-symmetric' | 'all';
type RelationshipType = 'root' | 'incoming' | 'outgoing' | 'symmetric';

interface SunburstNode {
    id: string;
    name: string; // Just the ID, not DP{id}
    type: DPType;
    text: string; // Full text for tooltip
    contextualText?: string;
    predicate: string;
    color: string;
    relationshipType: RelationshipType;
    branchType: RelationshipType; // To propagate 'outgoing' state down a branch
    children?: SunburstNode[];
    value?: number; // Used by d3.hierarchy to size segments
}

type SunburstHierarchyNode = d3.HierarchyRectangularNode<SunburstNode>;

let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
let popperInstance: PopperInstance | null = null;

function buildHierarchy(
    rootId: string,
    maxDepth: number,
    connectionMode: SunburstConnectionMode,
    filterState: { [key: string]: boolean }
): SunburstNode | null {
    const cy = getCyInstance();
    if (!cy) return null;

    const rootNode = cy.getElementById(rootId) as NodeSingular;
    if (rootNode.empty()) return null;

    const rootData = rootNode.data() as CyNodeData;
    const hierarchy: SunburstNode = {
        id: rootData.id,
        name: rootData.id,
        type: rootData.type,
        text: rootData.rawText,
        predicate: 'root',
        color: '', // Color is handled by CSS for the root
        relationshipType: 'root',
        branchType: 'root',
    };

    const visited = new Set<string>();

    function findChildren(parent: SunburstNode, currentDepth: number) {
        if (currentDepth >= maxDepth) return;
        visited.add(parent.id);

        const parentNode = cy!.getElementById(parent.id) as NodeSingular;
        if (parentNode.empty()) return;
        
        const connectedEdges = parentNode.connectedEdges();
        parent.children = [];

        connectedEdges.forEach(edge => {
            const edgeData = edge.data() as CyEdgeData;
            const predicate = edgeData.label;
            
            const isSymmetric = symmetricPredicatesSet.has(edgeData.label);
            const isIncomingToParent = edge.target().id() === parent.id;
            const isOutgoingFromParent = edge.source().id() === parent.id;

            let relationshipType: RelationshipType = 'incoming';
            if (isSymmetric) {
                relationshipType = 'symmetric';
            } else if (isOutgoingFromParent) {
                relationshipType = 'outgoing';
            }
            
            // Apply predicate filter first
            const filterKey = `${predicate}:${relationshipType}`;
            if (filterState && filterState[filterKey] === false) {
                return; // Skip this edge if filtered out
            }

            let shouldInclude = false;
            switch (connectionMode) {
                case 'incoming-symmetric':
                    shouldInclude = isIncomingToParent || isSymmetric;
                    break;
                case 'incoming-only':
                    shouldInclude = isIncomingToParent && !isSymmetric;
                    break;
                case 'outgoing-only':
                    shouldInclude = isOutgoingFromParent && !isSymmetric;
                    break;
                case 'outgoing-symmetric':
                    shouldInclude = isOutgoingFromParent || isSymmetric;
                    break;
                case 'all':
                    shouldInclude = true;
                    break;
            }

            if (shouldInclude) {
                const otherNode = isOutgoingFromParent ? edge.target() : edge.source();
                
                if (!visited.has(otherNode.id())) {
                    const sourceData = otherNode.data() as CyNodeData;

                    // Determine contextual text
                    let contextualTextForChild: string | undefined;
                    if (isOutgoingFromParent) { // otherNode is target/object
                        contextualTextForChild = edgeData.objectContextualText;
                    } else { // otherNode is source/subject (for both incoming and symmetric cases where this branch is taken)
                        contextualTextForChild = edgeData.subjectContextualText;
                    }

                    // The relationshipType was already determined above for filtering
                    const branchType = parent.branchType === 'outgoing' ? 'outgoing' : relationshipType;

                    const childNode: SunburstNode = {
                        id: sourceData.id,
                        name: sourceData.id,
                        type: sourceData.type,
                        text: sourceData.rawText,
                        contextualText: contextualTextForChild,
                        predicate: edgeData.label,
                        color: predicateColors[edgeData.label] || predicateColors.default,
                        relationshipType: relationshipType,
                        branchType: branchType
                    };
                    parent.children!.push(childNode);
                    findChildren(childNode, currentDepth + 1);
                }
            }
        });

        // For 'all' mode, sort children to group outgoing ones
        if (connectionMode === 'all' && parent.children.length > 0) {
            parent.children.sort((a, b) => {
                const aIsOutgoing = a.relationshipType === 'outgoing';
                const bIsOutgoing = b.relationshipType === 'outgoing';
                if (aIsOutgoing && !bIsOutgoing) return 1; // b (non-outgoing) comes first
                if (!aIsOutgoing && bIsOutgoing) return -1; // a (non-outgoing) comes first
                return 0; // maintain order among same-type groups
            });
        }

        if (parent.children.length === 0) {
            delete parent.children;
        }

        visited.delete(parent.id);
    }

    findChildren(hierarchy, 0);
    return hierarchy;
}

export function highlightSunburstNode(nodeId: string | null) {
    if (!svg) return;
    svg.selectAll('.sunburst-segment').classed('selected', false);
    if (nodeId) {
        svg.selectAll('.sunburst-segment')
            .filter(d => (d as SunburstHierarchyNode).data.id === nodeId)
            .classed('selected', true);
    }
}

function hideSunburstTooltip() {
    if (manualTooltipDiv) {
        manualTooltipDiv.style.display = 'none';
    }
    if (popperInstance) {
        popperInstance.destroy();
        popperInstance = null;
    }
}

export function renderSunburst(
    rootNodeId: string,
    maxDepth: number,
    fitMode: 'fit' | 'fill',
    connectionMode: SunburstConnectionMode,
    filterState: { [key: string]: boolean },
    showLabels: boolean,
    selectedNodeId: string | null,
    onClick: (nodeId: string) => void,
    onDblClick: (nodeId: string) => void,
    onBackgroundClick: () => void
) {
    destroySunburst();
    if (!sunburstContainer) return;

    const data = buildHierarchy(rootNodeId, maxDepth, connectionMode, filterState);
    if (!data) {
        sunburstContainer.innerHTML = '<p style="text-align: center; margin-top: 20px;">Could not build hierarchy. Check filters or root node validity.</p>';
        return;
    }
    
    const width = sunburstContainer.clientWidth;
    const height = sunburstContainer.clientHeight;
    
    let radius;
    if (fitMode === 'fill') {
        radius = Math.max(width, height) / 2;
    } else { // 'fit' is the default
        radius = Math.min(width, height) / 2;
    }

    const root = d3.hierarchy(data)
        .sum(d => (d.children ? 0 : 1)) // Each leaf node has a value of 1
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const partition = d3.partition<SunburstNode>()
        .size([2 * Math.PI, radius]);

    const partitionRoot = partition(root);

    const arc = d3.arc<d3.HierarchyRectangularNode<SunburstNode>>()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
        .padRadius(radius / 2)
        .innerRadius(d => d.y0)
        .outerRadius(d => d.y1 - 1);

    svg = d3.select(sunburstContainer).append("svg")
        .attr("viewBox", [-width / 2, -height / 2, width, height])
        .on("click", (event) => {
            if (event.target === event.currentTarget) {
                onBackgroundClick();
            }
        });

    const g = svg.append("g");
    
    function getLabelText(d: SunburstHierarchyNode): string {
        const nodeData = d.data;
        let prefix = '';
        switch (nodeData.type) {
            case 'question':
                prefix = '❓';
                break;
            case 'argument':
                prefix = '⚖️';
                break;
            case 'reference':
                prefix = '📖';
                break;
        }
        return `${prefix} ${nodeData.name}`.trim();
    }

    const tooltipMouseoverHandler = (event: MouseEvent, content: string) => {
        if (!manualTooltipDiv) return;
        manualTooltipDiv.innerHTML = content;
        manualTooltipDiv.style.display = 'block';

        if (popperInstance) popperInstance.destroy();

        const virtualElement: VirtualElement = {
            getBoundingClientRect: () => ({
                width: 0,
                height: 0,
                top: event.clientY,
                right: event.clientX,
                bottom: event.clientY,
                left: event.clientX,
                x: event.clientX,
                y: event.clientY,
                toJSON: () => JSON.stringify(this),
            }),
        };

        popperInstance = createPopper(virtualElement, manualTooltipDiv, {
            placement: 'auto',
            modifiers: [
                { name: 'offset', options: { offset: [0, 10] } },
                { name: 'preventOverflow', options: { padding: 8 } }
            ],
        });
    };

    const path = g.append("g")
        .selectAll("path")
        .data(partitionRoot.descendants().slice(1))
        .join("path")
        .attr("class", d => `sunburst-segment ${d.data.branchType === 'outgoing' ? 'outgoing-connection' : ''}`)
        .classed("selected", d => d.data.id === selectedNodeId)
        .attr("fill", d => d.data.color)
        .attr("d", arc);

    path.on("mouseover", (event: MouseEvent, d) => {
        d3.select(event.currentTarget as Element).style("opacity", d.data.branchType === 'outgoing' ? 0.7 : 0.8);
        const textToShow = d.data.contextualText ? d.data.contextualText : d.data.text;
        tooltipMouseoverHandler(event, `<b>DP${d.data.name}</b><br>${formatTextWithReferences(textToShow)}`);
    })
    .on("mouseleave", (event) => {
        d3.select(event.currentTarget as Element).style("opacity", null); // Reverts to CSS-defined opacity
        hideSunburstTooltip();
    })
    .on("click", (event, d) => {
        event.stopPropagation();
        onClick(d.data.id);
    })
    .on("dblclick", (event, d) => {
        event.stopPropagation();
        onDblClick(d.data.id);
    });
        
    if (showLabels) {
        // Add labels for segments
        g.append("g")
            .attr("pointer-events", "none")
            .attr("text-anchor", "middle")
            .style("user-select", "none")
            .selectAll("text")
            .data(partitionRoot.descendants().filter(d => d.depth > 0))
            .join("text")
            .attr("class", "sunburst-label")
            .attr("transform", d => {
                const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
                const y = (d.y0 + d.y1) / 2;
                const angle = x - 90;
                const rotate = angle + (x >= 90 && x < 270 ? 180 : 0);
                return `rotate(${angle}) translate(${y},0) rotate(${x >= 90 && x < 270 ? 180 : 0})`;
            })
            .attr("dy", "0.35em")
            .attr("display", d => ((d.x1 - d.x0) * 180 / Math.PI) > 2.5 ? null : "none") // Hide if angle is too small
            .text(d => getLabelText(d as SunburstHierarchyNode));
    }


    // Center circle for the root node
    const centerGroup = g.append("g")
        .on("click", (event) => {
            event.stopPropagation();
            onClick(partitionRoot.data.id);
        })
        .on("mouseover", (event: MouseEvent) => {
             d3.select(event.currentTarget as Element).select('circle').style("opacity", 0.8);
             tooltipMouseoverHandler(event, `<b>DP${partitionRoot.data.name}</b> (Root)<br>${formatTextWithReferences(partitionRoot.data.text)}`);
        })
        .on("mouseleave", (event) => {
            d3.select(event.currentTarget as Element).select('circle').style("opacity", 1);
            hideSunburstTooltip();
        });

    centerGroup.append("circle")
        .datum(partitionRoot) // Bind the root node's data object
        .attr("r", partitionRoot.y1)
        .attr("class", "sunburst-segment sunburst-root") // So it can be highlighted and styled
        .classed("selected", partitionRoot.data.id === selectedNodeId)
        .style("cursor", "pointer");

    centerGroup.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", "var(--text-color)")
        .attr("class", "sunburst-label")
        .style("display", showLabels ? null : "none")
        .text(getLabelText(partitionRoot));
}

export function destroySunburst() {
    hideSunburstTooltip();
    if (svg) {
        svg.remove();
        svg = null;
    }
    if (sunburstContainer) {
        sunburstContainer.innerHTML = '';
    }
}