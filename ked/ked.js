const canvas = document.getElementById('cadCanvas');
const ctx = canvas.getContext('2d');
const infoPanel = document.getElementById('info-panel');
const dynContainer = document.getElementById('dynamic-input-container');
const dynInput = document.getElementById('dynamic-input');
const propsMenu = document.getElementById('line-props-menu');

const PAPERS = {
    "A4_P": { w: 210, h: 297, css: "A4 portrait" },
    "A4_L": { w: 297, h: 210, css: "A4 landscape" },
    "A3_P": { w: 297, h: 420, css: "A3 portrait" },
    "A3_L": { w: 420, h: 297, css: "A3 landscape" },
    "A2_L": { w: 594, h: 420, css: "A2 landscape" },
    "A1_L": { w: 841, h: 594, css: "A1 landscape" },
    "A0_L": { w: 1189, h: 841, css: "A0 landscape" }
};

let scale = 1.0;
let panX = 150, panY = window.innerHeight - 150;
let isPanning = false;
let startPanX = 0, startPanY = 0;
let startPanMouseX = 0, startPanMouseY = 0;

let mode = 'select'; 
let elements = []; 
let isDrawing = false;
let snapEnabled = false;   
let osnapEnabled = true;   
let orthoEnabled = true;   
let isPrinting = false; 
let isPrintingBestFit = false;

// MOD KOTIRANJA: 0 = Dijagonalno (Aligned), 1 = Ortogonalno (H/V), 2 = Radijalno (R)
let dimMode = 0; 

let startPoint = { x: 0, y: 0 }; 
let currentPoint = { x: 0, y: 0 }; 
let orthoCorrectedWorldPos = { x: 0, y: 0 }; 
let bezierDragStartPos = null; 

let dimStep = 0, dimP1 = null, dimP2 = null, dimRadius = 0;

let selectedElements = []; 
let selectedBezierNodeIndex = null; 
let activeGrip = null; 
let gripRadius = 6;
let originalGripState = null; 
let isBoxSelecting = false;
let boxStartWorld = { x: 0, y: 0 };

let mouseWorldPos = { x: 0, y: 0 }; 
let mouseScreenPos = { x: 0, y: 0 }; 
let rawMouseWorldPos = { x: 0, y: 0 }; 
let osnapTarget = null; 
let gridSize = 20; 

const styleTag = document.createElement('style');
document.head.appendChild(styleTag);

const mobileDimBtn = document.createElement('button');
mobileDimBtn.id = 'btn-dim-ortho';
mobileDimBtn.innerText = 'Kotiranje: Dijagonalno';
mobileDimBtn.style.cssText = 'position: absolute; bottom: 20px; right: 20px; z-index: 1000; padding: 10px 15px; background: #333; color: white; border: 1px solid #555; cursor: pointer; border-radius: 5px; display: none; box-shadow: 0 4px 6px rgba(0,0,0,0.3);';
document.body.appendChild(mobileDimBtn);

mobileDimBtn.onclick = () => {
    dimMode = (dimMode + 1) % 3;
    updateDimBtnUI();
    drawEverything();
};

function updateDimBtnUI() {
    const labels = ['Kotiranje: Dijagonalno', 'Kotiranje: Ortogonalno', 'Kotiranje: Radijalno'];
    mobileDimBtn.style.background = dimMode !== 0 ? '#00e5ff' : '#333';
    mobileDimBtn.style.color = dimMode !== 0 ? '#000' : '#fff';
    mobileDimBtn.innerText = labels[dimMode];
}

function ensureTextSidebarButton() {
    let dimBtn = document.getElementById('btn-dimension');
    if (dimBtn && !document.getElementById('btn-text')) {
        let textBtn = document.createElement('button');
        textBtn.id = 'btn-text';
        textBtn.className = 'sidebar-btn';
        textBtn.innerText = 'Tekst';
        textBtn.onclick = () => setMode('text');
        dimBtn.parentNode.insertBefore(textBtn, dimBtn.nextSibling);
    }
}

window.addEventListener('contextmenu', e => e.preventDefault());

function updatePaperStyle() {
    let paperKey = document.getElementById('paper-select').value;
    if (PAPERS[paperKey]) {
        styleTag.innerHTML = `@media print { 
            @page { size: ${PAPERS[paperKey].css}; margin: 0mm; } 
            html, body { margin: 0 !important; padding: 0 !important; overflow: hidden !important; width: 100% !important; height: 100% !important; }
            #cadCanvas { width: 100vw !important; height: 100vh !important; display: block !important; object-fit: fill !important; }
            #toolbar, #sidebar, #info-panel, #dynamic-input-container, #line-props-menu, #btn-dim-ortho, #btn-bezier-type { display: none !important; }
        }`;
        zoomToPaper();
    }
    drawEverything();
}

function updateGridSnap() {
    gridSize = parseFloat(document.getElementById('grid-snap-select').value);
    drawEverything();
}

function resizeCanvas() { if (!isPrinting) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; drawEverything(); } }
window.addEventListener('resize', resizeCanvas);
canvas.width = window.innerWidth; canvas.height = window.innerHeight;

function setMode(newMode) {
    mode = newMode; resetDrawingState();
    if (typeof resetToolState === 'function') resetToolState();
    
    if (!['select', 'move', 'rotate', 'scale'].includes(newMode)) selectedElements = [];
    hidePropsMenu();

    ensureTextSidebarButton();

    document.querySelectorAll('.sidebar-btn').forEach(btn => btn.classList.remove('active'));
    let activeBtn = document.getElementById(`btn-${newMode}`);
    if (activeBtn) activeBtn.classList.add('active');

    mobileDimBtn.style.display = (mode === 'dimension') ? 'block' : 'none';
    let bezBtn = document.getElementById('btn-bezier-type');
    if (bezBtn) bezBtn.style.display = (mode === 'bezier') ? 'block' : 'none';

    if (['move', 'rotate', 'scale'].includes(newMode)) {
        let label = newMode === 'rotate' ? "Stožer / Bazna tačka" : (newMode === 'scale' ? "Pivot / Bazna tačka" : "Bazna tačka");
        if (selectedElements.length > 0) {
            ToolState.step = 1;
            showDynamicInput(mouseScreenPos.x, mouseScreenPos.y, label);
            setTimeout(() => dynInput.focus(), 10);
        } else {
            ToolState.step = 0;
            showDynamicInput(mouseScreenPos.x, mouseScreenPos.y, `Klikni objekte za ${newMode}`);
            setTimeout(() => dynInput.focus(), 10);
        }
    }

    drawEverything();
}

function toggleSnap() { snapEnabled = !snapEnabled; document.getElementById('btn-snap').classList.toggle('active', snapEnabled); drawEverything(); }
function toggleOsnap() { osnapEnabled = !osnapEnabled; document.getElementById('btn-osnap').classList.toggle('active', osnapEnabled); drawEverything(); }
function toggleOrtho() { orthoEnabled = !orthoEnabled; document.getElementById('btn-ortho').classList.toggle('active', orthoEnabled); drawEverything(); }

function undo() {
    if (elements.length > 0) {
        elements.pop(); selectedElements = []; resetDrawingState(); hidePropsMenu(); drawEverything();
    }
}

function clearAll() { if(confirm("Obrisati kompletan crtež?")) { elements = []; selectedElements = []; resetDrawingState(); hidePropsMenu(); drawEverything(); } }
function resetDrawingState() { isDrawing = false; dimStep = 0; dimP1 = null; dimP2 = null; dimRadius = 0; selectedBezierNodeIndex = null; bezierDragStartPos = null; isBoxSelecting = false; if(activeGrip) cancelGripMove(); hideDynamicInput(); hidePropsMenu(); if (typeof resetToolState === 'function') resetToolState(); }

function screenToWorld(screenX, screenY) { return { x: (screenX - panX) / scale, y: -(screenY - panY) / scale }; }
function worldToScreen(worldX, worldY) { return { x: worldX * scale + panX, y: -(worldY * scale) + panY }; }

function distToSegment(p, v, w) {
    let l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2); if (l2 == 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = Math.max(0, Math.min(1, ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

function getClosestPointOnSegment(p, v, w) {
    let l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
    if (l2 === 0) return { pt: { ...v }, dist: Math.hypot(p.x - v.x, p.y - v.y) };
    let t = Math.max(0, Math.min(1, ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2));
    let proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    return { pt: proj, dist: Math.hypot(p.x - proj.x, p.y - proj.y) };
}

function distToBezierSegment(pos, p0, p1, p2, p3, samples = 20) {
    let minDist = Infinity;
    let prevPt = p0;
    for (let step = 1; step <= samples; step++) {
        let t = step / samples;
        let invT = 1 - t;
        let x = invT*invT*invT * p0.x + 3*invT*invT*t * p1.x + 3*invT*t*t * p2.x + t*t*t * p3.x;
        let y = invT*invT*invT * p0.y + 3*invT*invT*t * p1.y + 3*invT*t*t * p2.y + t*t*t * p3.y;
        let currPt = { x, y };
        minDist = Math.min(minDist, distToSegment(pos, prevPt, currPt));
        prevPt = currPt;
    }
    return minDist;
}

function drawSnapDot(pt, options = {}) {
    if (isPrinting || !pt) return;
    let r = (options.radius || 2.5) / scale;
    ctx.save();
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fillStyle = options.fillColor || '#ffffff';
    ctx.strokeStyle = options.strokeColor || '#000000';
    ctx.lineWidth = 0.8 / scale;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function getDimEndpoints(el) {
    let p1 = el.p1, p2 = el.p2, offset = el.offset || 0, dimType = el.dimType || 'aligned';
    if (!p1 || !p2) return null;
    if (dimType === 'horizontal') {
        let dimLineY = p1.y + offset;
        return { p1: { x: p1.x, y: dimLineY }, p2: { x: p2.x, y: dimLineY } };
    } else if (dimType === 'vertical') {
        let dimLineX = p1.x + offset;
        return { p1: { x: dimLineX, y: p1.y }, p2: { x: dimLineX, y: p2.y } };
    } else if (dimType === 'radial') {
        let r = el.radius || Math.hypot(p2.x - p1.x, p2.y - p1.y);
        let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        let startOff = (el.startOffset !== undefined) ? el.startOffset : Math.min(r * 0.2, 15 / scale);
        let startPt = { x: p1.x + Math.cos(angle) * startOff, y: p1.y + Math.sin(angle) * startOff };
        let endPt = { x: p1.x + Math.cos(angle) * r, y: p1.y + Math.sin(angle) * r };
        return { p1: startPt, p2: endPt };
    } else {
        let dx = p2.x - p1.x, dy = p2.y - p1.y;
        let len = Math.hypot(dx, dy);
        if (len === 0) return { p1: { ...p1 }, p2: { ...p2 } };
        let nx = -dy / len, ny = dx / len;
        return {
            p1: { x: p1.x + nx * offset, y: p1.y + ny * offset },
            p2: { x: p2.x + nx * offset, y: p2.y + ny * offset }
        };
    }
}

function renderExtendedElement(ctx, el, isSel, isPrinting, currentScale) {
    ctx.save();
    let color = isPrinting ? '#000000' : (isSel ? '#ff3333' : (el.color || '#ffffff'));
    let baseThick = (el.thickness !== undefined) ? el.thickness * 10 : 2;
    let thickness = isPrinting ? (baseThick * 1.25 / currentScale) : ((isSel ? baseThick * 1.5 : baseThick) / currentScale);

    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;

    let dashLen = el.dashLength || 10;
    let dashGap = el.dashGap || 5;
    if (el.lineType === 'dashed') {
        ctx.setLineDash([dashLen / currentScale, dashGap / currentScale]);
    } else if (el.lineType === 'dashdot') {
        ctx.setLineDash([dashLen / currentScale, dashGap / currentScale, (dashLen / 4) / currentScale, dashGap / currentScale]);
    } else {
        ctx.setLineDash([]);
    }

    if (el.type === 'rect' && el.pts && el.pts.length === 4) {
        ctx.beginPath();
        ctx.moveTo(el.pts[0].x, el.pts[0].y);
        ctx.lineTo(el.pts[1].x, el.pts[1].y);
        ctx.lineTo(el.pts[2].x, el.pts[2].y);
        ctx.lineTo(el.pts[3].x, el.pts[3].y);
        ctx.closePath();
        ctx.stroke();
    } else if (el.type === 'circle' && el.p1) {
        let r = (el.radius !== undefined) ? el.radius : Math.hypot(el.p2.x - el.p1.x, el.p2.y - el.p1.y);
        ctx.beginPath();
        ctx.arc(el.p1.x, el.p1.y, r, 0, Math.PI * 2);
        ctx.stroke();
    } else if (el.type === 'bezier' && el.nodes && el.nodes.length > 1) {
        ctx.beginPath();
        ctx.moveTo(el.nodes[0].anchor.x, el.nodes[0].anchor.y);
        for (let i = 0; i < el.nodes.length - 1; i++) {
            let n1 = el.nodes[i], n2 = el.nodes[i + 1];
            ctx.bezierCurveTo(n1.handleOut.x, n1.handleOut.y, n2.handleIn.x, n2.handleIn.y, n2.anchor.x, n2.anchor.y);
        }
        ctx.stroke();
    } else if (el.type === 'polygon' && el.pts && el.pts.length > 0) {
        ctx.beginPath();
        ctx.moveTo(el.pts[0].x, el.pts[0].y);
        for (let i = 1; i < el.pts.length; i++) ctx.lineTo(el.pts[i].x, el.pts[i].y);
        ctx.closePath();
        ctx.stroke();
    } else if (el.type === 'polyline' && el.pts && el.pts.length > 0) {
        ctx.beginPath();
        ctx.moveTo(el.pts[0].x, el.pts[0].y);
        for (let i = 1; i < el.pts.length; i++) ctx.lineTo(el.pts[i].x, el.pts[i].y);
        ctx.stroke();
    }
    ctx.restore();
}

function getElementDistance(pos, el) {
    if (el.type === 'line') {
        return distToSegment(pos, el.p1, el.p2);
    }
    if (el.type === 'rect' && el.pts && el.pts.length === 4) {
        let minDist = Infinity;
        for (let j = 0; j < 4; j++) {
            minDist = Math.min(minDist, distToSegment(pos, el.pts[j], el.pts[(j + 1) % 4]));
        }
        return minDist;
    }
    if (el.type === 'polygon' && el.pts && el.pts.length > 0) {
        let minDist = Infinity;
        let n = el.pts.length;
        for (let j = 0; j < n; j++) {
            minDist = Math.min(minDist, distToSegment(pos, el.pts[j], el.pts[(j + 1) % n]));
        }
        return minDist;
    }
    if (el.type === 'polyline' && el.pts && el.pts.length > 0) {
        let minDist = Infinity;
        for (let j = 0; j < el.pts.length - 1; j++) {
            minDist = Math.min(minDist, distToSegment(pos, el.pts[j], el.pts[j + 1]));
        }
        return minDist;
    }
    if (el.type === 'circle' && el.p1 && (el.p2 || el.radius !== undefined)) {
        let r = (el.radius !== undefined) ? el.radius : Math.hypot(el.p2.x - el.p1.x, el.p2.y - el.p1.y);
        let distFromCenter = Math.hypot(pos.x - el.p1.x, pos.y - el.p1.y);
        return Math.abs(distFromCenter - r);
    }
    if (el.type === 'bezier') {
        if (el.nodes && el.nodes.length > 0) {
            let minDist = Infinity;
            for (let i = 0; i < el.nodes.length - 1; i++) {
                let n1 = el.nodes[i], n2 = el.nodes[i + 1];
                let d = distToBezierSegment(pos, n1.anchor, n1.handleOut, n2.handleIn, n2.anchor, 20);
                minDist = Math.min(minDist, d);
            }
            return minDist;
        }
    }
    if (el.type === 'dimension') {
        let pts = getDimEndpoints(el);
        if (!pts) return Infinity;
        let dMain = distToSegment(pos, pts.p1, pts.p2);
        let dExt1 = distToSegment(pos, el.p1, pts.p1);
        let dExt2 = distToSegment(pos, el.p2, pts.p2);
        return Math.min(dMain, dExt1, dExt2);
    }
    if (el.type === 'text') {
        let len = (el.text || '').length * (el.fontSize || 16) * 0.6;
        let p2 = { x: el.p1.x + len, y: el.p1.y };
        return distToSegment(pos, el.p1, p2);
    }
    return Infinity;
}

function findBestHitElement(pos, elementsList, currentScale) {
    let threshold = 3 / currentScale; 
    let bestEl = null;
    let bestDist = threshold;

    for (let i = elementsList.length - 1; i >= 0; i--) {
        let el = elementsList[i];
        let d = getElementDistance(pos, el);
        if (d < bestDist) {
            bestDist = d;
            bestEl = el;
        }
    }
    return bestEl;
}

function isElementInBox(el, xMin, xMax, yMin, yMax) {
    if (el.type === 'line') {
        return (el.p1.x >= xMin && el.p1.x <= xMax && el.p1.y >= yMin && el.p1.y <= yMax) ||
               (el.p2.x >= xMin && el.p2.x <= xMax && el.p2.y >= yMin && el.p2.y <= yMax);
    }
    if (el.type === 'rect' && el.pts) {
        let rxMin = Math.min(...el.pts.map(p => p.x)), rxMax = Math.max(...el.pts.map(p => p.x));
        let ryMin = Math.min(...el.pts.map(p => p.y)), ryMax = Math.max(...el.pts.map(p => p.y));
        return (rxMin <= xMax && rxMax >= xMin && ryMin <= yMax && ryMax >= yMin);
    }
    if (el.type === 'bezier' && el.nodes) {
        let bxMin = Math.min(...el.nodes.map(n => n.anchor.x)), bxMax = Math.max(...el.nodes.map(n => n.anchor.x));
        let byMin = Math.min(...el.nodes.map(n => n.anchor.y)), byMax = Math.max(...el.nodes.map(n => n.anchor.y));
        return (bxMin <= xMax && bxMax >= xMin && byMin <= yMax && byMax >= yMin);
    }
    if (el.type === 'circle' && el.p1 && (el.p2 || el.radius !== undefined)) {
        let r = (el.radius !== undefined) ? el.radius : Math.hypot(el.p2.x - el.p1.x, el.p2.y - el.p1.y);
        let cxMin = el.p1.x - r, cxMax = el.p1.x + r;
        let cyMin = el.p1.y - r, cyMax = el.p1.y + r;
        return (cxMin <= xMax && cxMax >= xMin && cyMin <= yMax && cyMax >= yMin);
    }
    if (el.type === 'dimension') {
        let pts = getDimEndpoints(el);
        if (!pts) return false;
        let dxMin = Math.min(el.p1.x, el.p2.x, pts.p1.x, pts.p2.x);
        let dxMax = Math.max(el.p1.x, el.p2.x, pts.p1.x, pts.p2.x);
        let dyMin = Math.min(el.p1.y, el.p2.y, pts.p1.y, pts.p2.y);
        let dyMax = Math.max(el.p1.y, el.p2.y, pts.p1.y, pts.p2.y);
        return (dxMin <= xMax && dxMax >= xMin && dyMin <= yMax && dyMax >= yMin);
    }
    if (el.type === 'text') {
        return (el.p1.x >= xMin && el.p1.x <= xMax && el.p1.y >= yMin && el.p1.y <= yMax);
    }
    return false;
}

function findLineIntersection(l1p1, l1p2, l2p1, l2p2) {
    let det = (l1p2.x - l1p1.x) * (l2p2.y - l2p1.y) - (l2p2.x - l2p1.x) * (l1p2.y - l1p1.y);
    if (det === 0) return null; 
    let t = ((l2p1.x - l1p1.x) * (l2p2.y - l2p1.y) - (l2p1.y - l1p1.y) * (l2p2.x - l2p1.x)) / det;
    let u = ((l2p1.x - l1p1.x) * (l1p2.y - l1p1.y) - (l2p1.y - l1p1.y) * (l1p2.x - l1p1.x)) / det;
    if (t >= -0.001 && t <= 1.001 && u >= -0.001 && u <= 1.001) {
        return { x: l1p1.x + t * (l1p2.x - l1p1.x), y: l1p1.y + t * (l1p2.y - l1p1.y) };
    }
    return null;
}

function getPaperWorldDimensions() {
    let paperSelect = document.getElementById('paper-select');
    if (!paperSelect) return null;
    let paperKey = paperSelect.value;
    if (paperKey === "NONE" || !PAPERS[paperKey]) return null;
    let rawPaper = PAPERS[paperKey];
    let unit = document.getElementById('unit-select').value;
    let currentScale = parseFloat(document.getElementById('scale-select').value);
    let unitFactor = 1.0; if (unit === 'cm') unitFactor = 0.1; if (unit === 'm') unitFactor = 0.001;
    return { w: rawPaper.w * unitFactor * currentScale, h: rawPaper.h * unitFactor * currentScale, margin: 5 * unitFactor * currentScale, leftMargin: 20 * unitFactor * currentScale };
}

function getAllElementSnapPoints(el) {
    let pts = [];
    if (el.type === 'line') {
        pts.push(el.p1, el.p2, { x: (el.p1.x + el.p2.x) / 2, y: (el.p1.y + el.p2.y) / 2 });
    } else if (el.type === 'rect' && el.pts && el.pts.length === 4) {
        pts.push(...el.pts);
        for (let k = 0; k < 4; k++) {
            let pA = el.pts[k], pB = el.pts[(k + 1) % 4];
            pts.push({ x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 });
        }
        pts.push({ x: (el.pts[0].x + el.pts[2].x) / 2, y: (el.pts[0].y + el.pts[2].y) / 2 });
    } else if (el.type === 'circle' && el.p1 && (el.p2 || el.radius !== undefined)) {
        let r = (el.radius !== undefined) ? el.radius : Math.hypot(el.p2.x - el.p1.x, el.p2.y - el.p1.y);
        pts.push(
            el.p1,
            { x: el.p1.x + r, y: el.p1.y },
            { x: el.p1.x - r, y: el.p1.y },
            { x: el.p1.x, y: el.p1.y + r },
            { x: el.p1.x, y: el.p1.y - r }
        );
    } else if (el.type === 'bezier' && el.nodes) {
        el.nodes.forEach(n => pts.push(n.anchor));
    } else if (el.type === 'dimension') {
        let dimPts = getDimEndpoints(el);
        if (dimPts) {
            pts.push(el.p1, el.p2, dimPts.p1, dimPts.p2, { x: (dimPts.p1.x + dimPts.p2.x) / 2, y: (dimPts.p1.y + dimPts.p2.y) / 2 });
        }
    } else if (el.type === 'text') {
        pts.push(el.p1);
    }
    return pts;
}

function drawAllCandidateSnapPoints() {
    if (isPrinting || !osnapEnabled) return;
    elements.forEach(el => {
        let pts = getAllElementSnapPoints(el);
        pts.forEach(pt => {
            drawSnapDot(pt, { fillColor: 'rgba(0, 229, 255, 0.45)', strokeColor: 'rgba(0, 0, 0, 0.6)', radius: 2 });
        });
    });
}

function getWorldMousePos(e) {
    let scrX = e.clientX, scrY = e.clientY;
    mouseScreenPos = { x: scrX, y: scrY };
    let world = screenToWorld(scrX, scrY);
    rawMouseWorldPos = { ...world };
    osnapTarget = null;

    if (osnapEnabled && !isPanning) {
        let strongDist = 18 / scale;
        
        for (let i = 0; i < elements.length; i++) {
            for (let j = i + 1; j < elements.length; j++) {
                if (elements[i].type === 'line' && elements[j].type === 'line') {
                    let intersect = findLineIntersection(elements[i].p1, elements[i].p2, elements[j].p1, elements[j].p2);
                    if (intersect) {
                        let d = Math.hypot(world.x - intersect.x, world.y - intersect.y);
                        if (d < strongDist) { strongDist = d; osnapTarget = { ...intersect }; }
                    }
                }
            }
        }

        if (!osnapTarget) {
            elements.forEach(el => {
                let pointsToCheck = getAllElementSnapPoints(el);
                pointsToCheck.forEach(pt => {
                    let d = Math.hypot(world.x - pt.x, world.y - pt.y);
                    if (d < strongDist) { strongDist = d; osnapTarget = { ...pt }; }
                });
            });
        }

        if (!osnapTarget) {
            let nearestDist = 10 / scale;
            elements.forEach(el => {
                if (el.type === 'line') {
                    let res = getClosestPointOnSegment(world, el.p1, el.p2);
                    if (res.dist < nearestDist) { nearestDist = res.dist; osnapTarget = res.pt; }
                } else if (el.type === 'rect' && el.pts && el.pts.length === 4) {
                    for (let j = 0; j < 4; j++) {
                        let res = getClosestPointOnSegment(world, el.pts[j], el.pts[(j + 1) % 4]);
                        if (res.dist < nearestDist) { nearestDist = res.dist; osnapTarget = res.pt; }
                    }
                } else if (el.type === 'circle' && el.p1 && (el.p2 || el.radius !== undefined)) {
                    let r = (el.radius !== undefined) ? el.radius : Math.hypot(el.p2.x - el.p1.x, el.p2.y - el.p1.y);
                    let angle = Math.atan2(world.y - el.p1.y, world.x - el.p1.x);
                    let circleEdgePt = { x: el.p1.x + Math.cos(angle) * r, y: el.p1.y + Math.sin(angle) * r };
                    let d = Math.hypot(world.x - circleEdgePt.x, world.y - circleEdgePt.y);
                    if (d < nearestDist) { nearestDist = d; osnapTarget = circleEdgePt; }
                } else if (el.type === 'bezier' && el.nodes && el.nodes.length > 1) {
                    let samples = 25;
                    for (let i = 0; i < el.nodes.length - 1; i++) {
                        let n1 = el.nodes[i], n2 = el.nodes[i + 1];
                        let prevPt = n1.anchor;
                        for (let step = 1; step <= samples; step++) {
                            let t = step / samples;
                            let invT = 1 - t;
                            let x = invT*invT*invT * n1.anchor.x + 3*invT*invT*t * n1.handleOut.x + 3*invT*t*t * n2.handleIn.x + t*t*t * n2.anchor.x;
                            let y = invT*invT*invT * n1.anchor.y + 3*invT*invT*t * n1.handleOut.y + 3*invT*t*t * n2.handleIn.y + t*t*t * n2.anchor.y;
                            let currPt = { x, y };
                            let res = getClosestPointOnSegment(world, prevPt, currPt);
                            if (res.dist < nearestDist) { nearestDist = res.dist; osnapTarget = res.pt; }
                            prevPt = currPt;
                        }
                    }
                } else if (el.type === 'dimension') {
                    let pts = getDimEndpoints(el);
                    if (pts) {
                        let res = getClosestPointOnSegment(world, pts.p1, pts.p2);
                        if (res.dist < nearestDist) { nearestDist = res.dist; osnapTarget = res.pt; }
                    }
                }
            });
        }

        if (osnapTarget) { 
            orthoCorrectedWorldPos = { ...osnapTarget }; 
            return { ...osnapTarget }; 
        }
    }

    let finalPos = snapEnabled ? { x: Math.round(world.x / gridSize) * gridSize, y: Math.round(world.y / gridSize) * gridSize } : world;

    if (orthoEnabled && (isDrawing || activeGrip)) {
        let base = startPoint;
        if (mode === 'select' && activeGrip && selectedElements[0]) {
            if (activeGrip === 'p1') base = selectedElements[0].p2;
            else if (activeGrip === 'p2') base = selectedElements[0].p1;
            else if (activeGrip === 'center') base = originalGripState ? originalGripState.center : startPoint;
        }
        let dx = finalPos.x - base.x; 
        let dy = finalPos.y - base.y;
        if (Math.abs(dx) > Math.abs(dy)) { 
            orthoCorrectedWorldPos = { x: finalPos.x, y: base.y }; 
        } else { 
            orthoCorrectedWorldPos = { x: base.x, y: finalPos.y }; 
        }
    } else {
        orthoCorrectedWorldPos = { ...finalPos };
    }

    return finalPos;
}

function drawEverything() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(scale, -scale);

    if (!isPrinting) { drawGrid(); drawUCS(); }

    let paperDim = getPaperWorldDimensions();
    if (paperDim && !isPrintingBestFit) {
        // VANJSKI DIO OKVIRA SE NE CRTA KADA SE PRINTA
        if (!isPrinting) {
            ctx.strokeStyle = 'rgba(255, 80, 80, 0.5)';
            ctx.lineWidth = 1.5 / scale; 
            ctx.strokeRect(0, 0, paperDim.w, paperDim.h);
        }

        ctx.strokeStyle = isPrinting ? '#000000' : 'rgba(255, 80, 80, 0.3)';
        ctx.lineWidth = isPrinting ? 1.5 / scale : 1 / scale;
        ctx.strokeRect(paperDim.leftMargin, paperDim.margin, paperDim.w - paperDim.leftMargin - paperDim.margin, paperDim.h - paperDim.margin * 2);

        if (isPrinting) {
            ctx.save();
            let posX = paperDim.leftMargin - 0.1;
            let posY = paperDim.margin + 0.1;
            ctx.translate(posX, posY);
            ctx.scale(1, -1);
            ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = '#000000';
            ctx.font = `${32 / scale}px Arial`;
            ctx.textAlign = 'left';
            ctx.fillText("almedin.vercel.app    husalmedin@gmail.com", 0, 0);
            ctx.restore();
        }
    }

    if (!isPrinting && (isDrawing || activeGrip || mode !== 'select')) {
        drawAllCandidateSnapPoints();
    }

    elements.forEach(el => {
        let isSel = selectedElements.includes(el);
        let color = isPrinting ? '#000000' : (isSel ? '#ff3333' : (el.color || '#ffffff'));
        
        if (el.type === 'line') {
            let baseThick = (el.thickness !== undefined) ? el.thickness * 10 : 2;
            let thickness = isPrinting ? (baseThick * 1.25 / scale) : ((isSel ? baseThick * 1.5 : baseThick) / scale);
            drawLine(el.p1, el.p2, color, thickness, el.lineType || 'solid', el.dashLength || 10, el.dashGap || 5);
        } else if (el.type === 'dimension') {
            let thickness = isPrinting ? (2.5 / scale) : ((isSel ? 3 : 2) / scale);
            drawAutoCADDimension(el.p1, el.p2, el.offset, false, isSel, el.dimType || 'aligned', el.radius, el.startOffset);
        } else if (el.type === 'text') {
            ctx.save();
            ctx.fillStyle = isPrinting ? '#000000' : (isSel ? '#ff3333' : (el.color || '#ffffff'));
            let baseSize = el.fontSize || 16;
            let fSize = (isPrinting ? baseSize * 4 : baseSize) / scale;
            ctx.font = `${fSize}px ${el.font || 'Arial'}`;
            ctx.translate(el.p1.x, el.p1.y);
            ctx.scale(1, -1);
            ctx.fillText(el.text || '', 0, 0);
            ctx.restore();
        } else {
            renderExtendedElement(ctx, el, isSel, isPrinting, scale);
        }
    });

    if (!isPrinting) {
        if (mode === 'line' && isDrawing) drawLine(startPoint, currentPoint, '#007acc', 2 / scale);
        else if (mode === 'dimension') {
            if (dimMode === 2 && dimStep === 1) {
                let angle = Math.atan2(mouseWorldPos.y - dimP1.y, mouseWorldPos.x - dimP1.x);
                let p2Radial = { x: dimP1.x + Math.cos(angle) * dimRadius, y: dimP1.y + Math.sin(angle) * dimRadius };
                drawAutoCADDimension(dimP1, p2Radial, 0, true, false, 'radial', dimRadius);
            } else if (dimStep === 1) {
                drawLine(dimP1, mouseWorldPos, 'rgba(0, 229, 255, 0.4)', 1 / scale);
            } else if (dimStep === 2) {
                let params = getDimParams(dimP1, dimP2, mouseWorldPos);
                drawAutoCADDimension(dimP1, dimP2, params.offset, true, false, params.type);
            }
        } else if (typeof drawToolPreview === 'function') {
            drawToolPreview(ctx, mode, mouseWorldPos, scale);
        }

        if (mode === 'select' && selectedElements.length === 1) drawGrips(selectedElements[0]);
        if (osnapTarget) {
            drawSnapDot(osnapTarget, { fillColor: '#00ff00', strokeColor: '#000000', radius: 3 });
        }
    }

    ctx.restore();

    if (!isPrinting) {
        if (mode === 'select' && isBoxSelecting) {
            let p1Scr = worldToScreen(boxStartWorld.x, boxStartWorld.y);
            ctx.fillStyle = 'rgba(0, 122, 204, 0.15)'; ctx.strokeStyle = '#007acc'; ctx.lineWidth = 1;
            ctx.fillRect(p1Scr.x, p1Scr.y, mouseScreenPos.x - p1Scr.x, mouseScreenPos.y - p1Scr.y);
            ctx.strokeRect(p1Scr.x, p1Scr.y, mouseScreenPos.x - p1Scr.x, mouseScreenPos.y - p1Scr.y);
        }
        let snappedScreenPos = worldToScreen(mouseWorldPos.x, mouseWorldPos.y);
        drawCadCursor(snappedScreenPos.x, snappedScreenPos.y);
        infoPanel.innerText = `X: ${mouseWorldPos.x.toFixed(2)}, Y: ${mouseWorldPos.y.toFixed(2)} | Snap-Rez: ${gridSize}`;
    }
}

function drawGrid() {
    let start = screenToWorld(0, canvas.height); let end = screenToWorld(canvas.width, 0);
    ctx.strokeStyle = '#252525'; ctx.lineWidth = 0.5 / scale;
    let startX = Math.floor(start.x / gridSize) * gridSize; let endX = Math.ceil(end.x / gridSize) * gridSize;
    let startY = Math.floor(start.y / gridSize) * gridSize; let endY = Math.ceil(end.y / gridSize) * gridSize;
    for (let x = startX; x <= endX; x += gridSize) strokeGridLine(x, start.y, x, end.y);
    for (let y = startY; y <= endY; y += gridSize) strokeGridLine(start.x, y, end.x, y);
}
function strokeGridLine(x1,y1,x2,y2) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }

let toolbarEl = document.getElementById('toolbar');
if(toolbarEl) {
    toolbarEl.addEventListener('mousedown', (e) => {
        if (isDrawing || activeGrip) {
            e.preventDefault(); 
            setTimeout(() => dynInput.focus(), 5); 
        }
    });
}

function drawUCS() {
    ctx.lineWidth = 2 / scale;
    ctx.strokeStyle = '#ff3333'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(40 / scale, 0); ctx.stroke();
    ctx.strokeStyle = '#33ff33'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 40 / scale); ctx.stroke();
}

function drawLine(p1, p2, color, width, lineType = 'solid', dashLen = 10, dashGap = 5) { 
    ctx.save();
    ctx.strokeStyle = color; 
    ctx.lineWidth = width; 
    
    if (lineType === 'dashed') {
        ctx.setLineDash([dashLen / scale, dashGap / scale]);
    } else if (lineType === 'dashdot') {
        ctx.setLineDash([dashLen / scale, dashGap / scale, (dashLen / 4) / scale, dashGap / scale]);
    } else {
        ctx.setLineDash([]);
    }

    ctx.beginPath(); 
    ctx.moveTo(p1.x, p1.y); 
    ctx.lineTo(p2.x, p2.y); 
    ctx.stroke(); 
    ctx.restore();
}

function drawGrips(el) {
    if (!el || isPrinting) return;
    
    if (el.type === 'rect' && el.pts && el.pts.length === 4) {
        el.pts.forEach(pt => drawSnapDot(pt, { fillColor: '#0055ff', radius: 3 }));
        for (let k = 0; k < 4; k++) {
            let pA = el.pts[k], pB = el.pts[(k + 1) % 4];
            drawSnapDot({ x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 }, { fillColor: '#00e5ff', radius: 2.5 });
        }
        drawSnapDot({ x: (el.pts[0].x + el.pts[2].x) / 2, y: (el.pts[0].y + el.pts[2].y) / 2 }, { fillColor: '#ffaa00', radius: 3 });
    } else if (el.type === 'bezier') {
        if (el.nodes) {
            el.nodes.forEach((n, i) => {
                let isNodeSel = (selectedBezierNodeIndex === i);
                ctx.save();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.setLineDash([3 / scale, 3 / scale]);
                ctx.lineWidth = 1 / scale;
                if (Math.hypot(n.handleIn.x - n.anchor.x, n.handleIn.y - n.anchor.y) > 0.001) {
                    ctx.beginPath(); ctx.moveTo(n.anchor.x, n.anchor.y); ctx.lineTo(n.handleIn.x, n.handleIn.y); ctx.stroke();
                }
                if (Math.hypot(n.handleOut.x - n.anchor.x, n.handleOut.y - n.anchor.y) > 0.001) {
                    ctx.beginPath(); ctx.moveTo(n.anchor.x, n.anchor.y); ctx.lineTo(n.handleOut.x, n.handleOut.y); ctx.stroke();
                }
                ctx.restore();

                drawSnapDot(n.anchor, { fillColor: isNodeSel ? '#ffaa00' : '#00e5ff', radius: 3 });
                if (Math.hypot(n.handleIn.x - n.anchor.x, n.handleIn.y - n.anchor.y) > 0.001) {
                    drawSnapDot(n.handleIn, { fillColor: '#ffffff', strokeColor: '#000000', radius: 2 });
                }
                if (Math.hypot(n.handleOut.x - n.anchor.x, n.handleOut.y - n.anchor.y) > 0.001) {
                    drawSnapDot(n.handleOut, { fillColor: '#ffffff', strokeColor: '#000000', radius: 2 });
                }
            });
        }
    } else if (el.type === 'dimension') {
        let pts = getDimEndpoints(el);
        if (pts) {
            drawSnapDot(el.p1, { fillColor: '#0055ff', radius: 2.5 });
            drawSnapDot(el.p2, { fillColor: '#0055ff', radius: 2.5 });
            drawSnapDot(pts.p1, { fillColor: '#00e5ff', radius: 3 });
            drawSnapDot(pts.p2, { fillColor: '#00e5ff', radius: 3 });
            if (el.dimType !== 'radial') {
                drawSnapDot({ x: (pts.p1.x + pts.p2.x) / 2, y: (pts.p1.y + pts.p2.y) / 2 }, { fillColor: '#ffaa00', radius: 3 });
            }
        }
    } else if (el.type === 'text') {
        drawSnapDot(el.p1, { fillColor: '#0055ff', radius: 3 });
    } else if (el.p1 && el.p2) {
        drawSnapDot(el.p1, { fillColor: '#0055ff', radius: 3 });
        drawSnapDot(el.p2, { fillColor: '#0055ff', radius: 3 });
        if(el.type === 'line') {
            drawSnapDot({ x: (el.p1.x + el.p2.x) / 2, y: (el.p1.y + el.p2.y) / 2 }, { fillColor: '#00e5ff', radius: 2.5 });
        }
    }
}

function drawCadCursor(x, y) {
    const size = 8; const crossSize = 20;
    ctx.strokeStyle = isPanning ? '#ff00ff' : (osnapTarget ? '#00ff00' : (snapEnabled ? '#00ff00' : '#ffea00')); ctx.lineWidth = 1;
    ctx.strokeRect(x - size/2, y - size/2, size, size);
    ctx.beginPath(); ctx.moveTo(x - crossSize, y); ctx.lineTo(x + crossSize, y); ctx.moveTo(x, y - crossSize); ctx.lineTo(x, y + crossSize); ctx.stroke();
}

function showDynamicInput(x, y, placeholder = "Vrednost ili X,Y") { 
    dynContainer.style.display = 'block'; 
    dynContainer.style.left = (x + 15) + 'px'; 
    dynContainer.style.top = (y + 15) + 'px'; 
    dynInput.placeholder = placeholder;
}
function hideDynamicInput() { dynContainer.style.display = 'none'; dynInput.value = ''; canvas.focus(); }

function openPropsMenu(x, y) {
    if (selectedElements.length !== 1) return;
    let el = selectedElements[0];
    
    document.getElementById('prop-thickness').value = el.thickness || 0.2;
    document.getElementById('thick-val').innerText = (el.thickness || 0.2).toFixed(2);
    document.getElementById('prop-dash-len').value = el.dashLength || 10;
    document.getElementById('prop-dash-gap').value = el.dashGap || 5;
    document.getElementById('prop-hex-color').value = el.color || '#ffffff';

    let textContainer = document.getElementById('text-props-container');
    if (!textContainer) {
        textContainer = document.createElement('div');
        textContainer.id = 'text-props-container';
        textContainer.style.cssText = 'margin-top: 10px; border-top: 1px solid #444; padding-top: 10px; display: none;';
        textContainer.innerHTML = `
            <label style="color:#ccc; font-size:12px; display:block; margin-bottom:3px;">Tekst Sadržaj:</label>
            <input type="text" id="prop-text-val" style="width:100%; background:#222; color:#fff; border:1px solid #555; padding:5px; margin-bottom:8px; border-radius:3px; box-sizing:border-box;">
            <label style="color:#ccc; font-size:12px; display:block; margin-bottom:3px;">Font Familija:</label>
            <select id="prop-text-font" style="width:100%; background:#222; color:#fff; border:1px solid #555; padding:5px; margin-bottom:8px; border-radius:3px; box-sizing:border-box;">
                <option value="Arial">Arial</option>
                <option value="Segoe UI">Segoe UI</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Verdana">Verdana</option>
            </select>
            <label style="color:#ccc; font-size:12px; display:block; margin-bottom:3px;">Veličina (px):</label>
            <input type="number" id="prop-text-size" min="6" max="200" value="16" style="width:100%; background:#222; color:#fff; border:1px solid #555; padding:5px; margin-bottom:8px; border-radius:3px; box-sizing:border-box;">
        `;
        propsMenu.appendChild(textContainer);

        document.getElementById('prop-text-val').addEventListener('input', (e) => {
            if (selectedElements.length === 1 && selectedElements[0].type === 'text') {
                selectedElements[0].text = e.target.value;
                drawEverything();
            }
        });
        document.getElementById('prop-text-font').addEventListener('change', (e) => {
            if (selectedElements.length === 1 && selectedElements[0].type === 'text') {
                selectedElements[0].font = e.target.value;
                drawEverything();
            }
        });
        document.getElementById('prop-text-size').addEventListener('input', (e) => {
            if (selectedElements.length === 1 && selectedElements[0].type === 'text') {
                selectedElements[0].fontSize = parseFloat(e.target.value) || 16;
                drawEverything();
            }
        });
    }

    if (el.type === 'text') {
        textContainer.style.display = 'block';
        document.getElementById('prop-text-val').value = el.text || '';
        document.getElementById('prop-text-font').value = el.font || 'Arial';
        document.getElementById('prop-text-size').value = el.fontSize || 16;
    } else {
        textContainer.style.display = 'none';
    }
    
    let bezProp = document.getElementById('bezier-handle-props');
    if (bezProp) {
        bezProp.style.display = (el.type === 'bezier') ? 'block' : 'none';
        if (el.type === 'bezier' && el.nodes && el.nodes.length > 0) {
            let activeIdx = (selectedBezierNodeIndex !== null) ? selectedBezierNodeIndex : 0;
            let activeNode = el.nodes[activeIdx] || el.nodes[0];
            let currentType = activeNode.type || 'symmetric';
            let activeMap = { 'corner': 'btn-hz-sharp', 'symmetric': 'btn-hz-sym', 'smooth': 'btn-hz-indep' };
            ['sharp', 'sym', 'indep'].forEach(tId => {
                let btn = document.getElementById(`btn-hz-${tId}`);
                if (btn) btn.classList.remove('active');
            });
            let activeBtn = document.getElementById(activeMap[currentType]);
            if (activeBtn) activeBtn.classList.add('active');
        }
    }

    updateLineTypeButtons(el.lineType || 'solid');
    
    let menuW = 250, menuH = 380;
    let posX = Math.min(x, window.innerWidth - menuW - 10);
    let posY = Math.min(y, window.innerHeight - menuH - 10);
    
    propsMenu.style.left = posX + 'px';
    propsMenu.style.top = posY + 'px';
    propsMenu.style.display = 'block';
}

function hidePropsMenu() {
    if(propsMenu) propsMenu.style.display = 'none';
}

function updateLineFromMenu() {
    if (selectedElements.length !== 1) return;
    let el = selectedElements[0];
    
    let thick = parseFloat(document.getElementById('prop-thickness').value);
    el.thickness = thick;
    document.getElementById('thick-val').innerText = thick.toFixed(2);
    
    el.dashLength = parseFloat(document.getElementById('prop-dash-len').value) || 10;
    el.dashGap = parseFloat(document.getElementById('prop-dash-gap').value) || 5;
    
    drawEverything();
}

function setBezierHandleType(type) {
    if (selectedElements.length !== 1 || selectedElements[0].type !== 'bezier') return;
    let el = selectedElements[0];
    if (!el.nodes || el.nodes.length === 0) return;

    let targetIdx = (selectedBezierNodeIndex !== null && selectedBezierNodeIndex >= 0 && selectedBezierNodeIndex < el.nodes.length)
        ? selectedBezierNodeIndex
        : 0;

    let node = el.nodes[targetIdx];
    node.type = type;

    if (type !== 'corner') {
        let inDist = Math.hypot(node.handleIn.x - node.anchor.x, node.handleIn.y - node.anchor.y);
        let outDist = Math.hypot(node.handleOut.x - node.anchor.x, node.handleOut.y - node.anchor.y);

        if (inDist === 0 && outDist === 0) {
            let defLen = 25 / scale;
            node.handleIn = { x: node.anchor.x - defLen, y: node.anchor.y };
            node.handleOut = { x: node.anchor.x + defLen, y: node.anchor.y };
        } else if (outDist === 0 && inDist > 0) {
            node.handleOut = { x: node.anchor.x - (node.handleIn.x - node.anchor.x), y: node.anchor.y - (node.handleIn.y - node.anchor.y) };
        } else if (inDist === 0 && outDist > 0) {
            node.handleIn = { x: node.anchor.x - (node.handleOut.x - node.anchor.x), y: node.anchor.y - (node.handleOut.y - node.anchor.y) };
        }

        if (typeof updateNodeHandles === 'function') {
            updateNodeHandles(node, 'handleOut', node.handleOut);
        }
    } else {
        node.handleIn = { ...node.anchor };
        node.handleOut = { ...node.anchor };
    }

    ['sharp', 'sym', 'indep'].forEach(tId => {
        let btn = document.getElementById(`btn-hz-${tId}`);
        if (btn) btn.classList.remove('active');
    });

    let activeMap = { 'corner': 'btn-hz-sharp', 'symmetric': 'btn-hz-sym', 'smooth': 'btn-hz-indep' };
    let activeBtn = document.getElementById(activeMap[type]);
    if (activeBtn) activeBtn.classList.add('active');

    drawEverything();
}

function setLineThickness(val) {
    document.getElementById('prop-thickness').value = val;
    updateLineFromMenu();
}

function setLineType(type) {
    if (selectedElements.length !== 1) return;
    selectedElements[0].lineType = type;
    updateLineTypeButtons(type);
    drawEverything();
}

function updateLineTypeButtons(type) {
    ['solid', 'dashed', 'dashdot'].forEach(t => {
        let btn = document.getElementById(`btn-lt-${t}`);
        if(btn) btn.classList.toggle('active', t === type);
    });
}

function setLineColor(hex) {
    if (selectedElements.length !== 1) return;
    selectedElements[0].color = hex;
    document.getElementById('prop-hex-color').value = hex;
    drawEverything();
}

function calculateLiveOffset(p1, p2, mousePos) { 
    let dx = p2.x - p1.x; let dy = p2.y - p1.y; let len = Math.sqrt(dx * dx + dy * dy); 
    if (len < 1) return 0; 
    return (mousePos.x - p1.x) * (-dy / len) + (mousePos.y - p1.y) * (dx / len); 
}

function getDimParams(p1, p2, mousePos) {
    if (dimMode === 2) {
        return { type: 'radial', offset: 0 };
    }
    if (dimMode === 0) return { type: 'aligned', offset: calculateLiveOffset(p1, p2, mousePos) };
    
    let midX = (p1.x + p2.x) / 2; let midY = (p1.y + p2.y) / 2;
    if (Math.abs(mousePos.y - midY) > Math.abs(mousePos.x - midX)) {
        return { type: 'horizontal', offset: mousePos.y - p1.y };
    } else {
        return { type: 'vertical', offset: mousePos.x - p1.x };
    }
}

function drawAutoCADDimension(p1, p2, offset, isPreview = false, isSelected = false, dimType = 'aligned', storedRadius = 0, startOffCustom = undefined) {
    let distance, dimLineP1, dimLineP2;
    let mainColor = isPrinting ? '#000000' : (isSelected ? '#ff3333' : (isPreview ? '#ffaa00' : '#00e5ff'));
    let thickness = 1.5 / scale;

    ctx.strokeStyle = isPrinting ? 'rgba(0,0,0,0.3)' : 'rgba(255, 255, 255, 0.3)'; 
    ctx.lineWidth = 0.5 / scale;

    let txtPrefix = "";

    if (dimType === 'radial') {
        distance = storedRadius || Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (distance < 0.1) return;
        txtPrefix = "R ";
        
        let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        let startOffset = (startOffCustom !== undefined) ? startOffCustom : Math.min(distance * 0.2, 15 / scale);
        
        dimLineP1 = { x: p1.x + Math.cos(angle) * startOffset, y: p1.y + Math.sin(angle) * startOffset };
        dimLineP2 = { x: p1.x + Math.cos(angle) * distance, y: p1.y + Math.sin(angle) * distance };

        drawLine(dimLineP1, dimLineP2, mainColor, thickness);
        drawCadTick(dimLineP2, angle, mainColor);
    } 
    else if (dimType === 'horizontal') {
        distance = Math.abs(p2.x - p1.x); if (distance < 0.1) return;
        let dimLineY = p1.y + offset;
        dimLineP1 = { x: p1.x, y: dimLineY };
        dimLineP2 = { x: p2.x, y: dimLineY };
        
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(dimLineP1.x, dimLineP1.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p2.x, p2.y); ctx.lineTo(dimLineP2.x, dimLineP2.y); ctx.stroke();
        drawLine(dimLineP1, dimLineP2, mainColor, thickness);
        drawCadTick(dimLineP1, 0, mainColor);
        drawCadTick(dimLineP2, 0, mainColor);
    } 
    else if (dimType === 'vertical') {
        distance = Math.abs(p2.y - p1.y); if (distance < 0.1) return;
        let dimLineX = p1.x + offset;
        dimLineP1 = { x: dimLineX, y: Math.min(p1.y, p2.y) };
        dimLineP2 = { x: dimLineX, y: Math.max(p1.y, p2.y) };
        
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(dimLineX, p1.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p2.x, p2.y); ctx.lineTo(dimLineX, p2.y); ctx.stroke();
        drawLine(dimLineP1, dimLineP2, mainColor, thickness);
        drawCadTick(dimLineP1, Math.PI / 2, mainColor);
        drawCadTick(dimLineP2, Math.PI / 2, mainColor);
    } 
    else {
        let dx = p2.x - p1.x; let dy = p2.y - p1.y;
        distance = Math.sqrt(dx * dx + dy * dy); if (distance < 0.1) return;
        let nx = -dy / distance; let ny = dx / distance;
        dimLineP1 = { x: p1.x + nx * offset, y: p1.y + ny * offset };
        dimLineP2 = { x: p2.x + nx * offset, y: p2.y + ny * offset };
        
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(dimLineP1.x, dimLineP1.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p2.x, p2.y); ctx.lineTo(dimLineP2.x, dimLineP2.y); ctx.stroke();
        let angle = Math.atan2(dy, dx);
        drawLine(dimLineP1, dimLineP2, mainColor, thickness);
        drawCadTick(dimLineP1, angle, mainColor);
        drawCadTick(dimLineP2, angle, mainColor);
    }

    let dx = dimLineP2.x - dimLineP1.x;
    let dy = dimLineP2.y - dimLineP1.y;
    let angle = Math.atan2(dy, dx);

    let mx = (dimLineP1.x + dimLineP2.x) / 2; 
    let my = (dimLineP1.y + dimLineP2.y) / 2;
    let fontSize = isPrinting ? (48 / scale) : (12 / scale);
    
    ctx.fillStyle = mainColor; 
    ctx.font = `bold ${fontSize}px Arial`; 
    ctx.textAlign = 'center';
    
    ctx.save(); 
    ctx.translate(mx, my); 
    ctx.scale(1, -1); 
    
    let txtAngle = -angle; 
    if (txtAngle > Math.PI / 2 || txtAngle <= -Math.PI / 2) {
        txtAngle += Math.PI;
    }
    
    ctx.rotate(txtAngle);
    
    let scaleSelect = document.getElementById('scale-select');
    let unitSelect = document.getElementById('unit-select');
    let selectedScale = scaleSelect ? parseFloat(scaleSelect.value) : 1;
    let unit = unitSelect ? unitSelect.value : 'cm';
    let txt = txtPrefix + (distance / selectedScale).toFixed(1) + " " + unit;
    
    let cleanPadding = 8 / scale;
    ctx.fillText(txt, 0, -cleanPadding);
    ctx.restore();
}

function drawCadTick(pt, lineAngle, color) {
    let tickLength = 5 / scale; let tickAngle = lineAngle + Math.PI / 4;
    ctx.strokeStyle = color; ctx.lineWidth = isPrinting ? (2.0 / scale) : (2 / scale);
    ctx.beginPath(); ctx.moveTo(pt.x - Math.cos(tickAngle) * tickLength, pt.y - Math.sin(tickAngle) * tickLength); ctx.lineTo(pt.x + Math.cos(tickAngle) * tickLength, pt.y + Math.sin(tickAngle) * tickLength); ctx.stroke();
}

function checkGripClick(scrX, scrY) {
    if (selectedElements.length !== 1) return null;
    let el = selectedElements[0];

    if (el.type === 'text') {
        let p1Scr = worldToScreen(el.p1.x, el.p1.y);
        if (Math.hypot(scrX - p1Scr.x, scrY - p1Scr.y) < gripRadius + 6) return 'p1';
    }

    if (el.type === 'dimension') {
        let pts = getDimEndpoints(el);
        if (pts) {
            let p1Scr = worldToScreen(el.p1.x, el.p1.y);
            let p2Scr = worldToScreen(el.p2.x, el.p2.y);
            let dimP1Scr = worldToScreen(pts.p1.x, pts.p1.y);
            let dimP2Scr = worldToScreen(pts.p2.x, pts.p2.y);
            let dimMidScr = worldToScreen((pts.p1.x + pts.p2.x) / 2, (pts.p1.y + pts.p2.y) / 2);

            if (Math.hypot(scrX - p1Scr.x, scrY - p1Scr.y) < gripRadius + 6) return 'p1';
            if (Math.hypot(scrX - p2Scr.x, scrY - p2Scr.y) < gripRadius + 6) return 'p2';

            if (el.dimType === 'radial') {
                if (Math.hypot(scrX - dimP1Scr.x, scrY - dimP1Scr.y) < gripRadius + 6) return 'dim_rad_inner';
                if (Math.hypot(scrX - dimP2Scr.x, scrY - dimP2Scr.y) < gripRadius + 6) return 'dim_rad_outer';
            } else {
                if (Math.hypot(scrX - dimP1Scr.x, scrY - dimP1Scr.y) < gripRadius + 6) return 'dim_line_move';
                if (Math.hypot(scrX - dimP2Scr.x, scrY - dimP2Scr.y) < gripRadius + 6) return 'dim_line_move';
                if (Math.hypot(scrX - dimMidScr.x, scrY - dimMidScr.y) < gripRadius + 6) return 'dim_line_move';
            }
        }
    }

    if (el.type === 'bezier') {
        if (el.nodes) {
            for (let i = 0; i < el.nodes.length; i++) {
                let n = el.nodes[i];
                let aScr = worldToScreen(n.anchor.x, n.anchor.y);
                let inScr = worldToScreen(n.handleIn.x, n.handleIn.y);
                let outScr = worldToScreen(n.handleOut.x, n.handleOut.y);

                if (Math.hypot(scrX - aScr.x, scrY - aScr.y) < gripRadius + 6) return { type: 'bz_node', nodeIndex: i, part: 'anchor' };
                if (Math.hypot(scrX - inScr.x, scrY - inScr.y) < gripRadius + 6) return { type: 'bz_node', nodeIndex: i, part: 'handleIn' };
                if (Math.hypot(scrX - outScr.x, scrY - outScr.y) < gripRadius + 6) return { type: 'bz_node', nodeIndex: i, part: 'handleOut' };
            }
        }
    }

    if (el.type === 'rect' && el.pts) {
        for (let i = 0; i < el.pts.length; i++) {
            let ptScr = worldToScreen(el.pts[i].x, el.pts[i].y);
            if (Math.hypot(scrX - ptScr.x, scrY - ptScr.y) < gripRadius + 6) return { type: 'rect_pt', index: i };
        }
    }

    if (el.p1 && el.p2) {
        let p1Scr = worldToScreen(el.p1.x, el.p1.y);
        let p2Scr = worldToScreen(el.p2.x, el.p2.y);
        if (Math.hypot(scrX - p1Scr.x, scrY - p1Scr.y) < gripRadius + 6) return 'p1';
        if (Math.hypot(scrX - p2Scr.x, scrY - p2Scr.y) < gripRadius + 6) return 'p2';
        if (el.type === 'line') {
            let midScr = worldToScreen((el.p1.x + el.p2.x) / 2, (el.p1.y + el.p2.y) / 2);
            if (Math.hypot(scrX - midScr.x, scrY - midScr.y) < gripRadius + 6) return 'center';
        }
    }
    return null;
}

function cancelGripMove() { if (selectedElements[0] && originalGripState) { selectedElements[0].p1 = { ...originalGripState.p1 }; selectedElements[0].p2 = { ...originalGripState.p2 }; } activeGrip = null; originalGripState = null; hideDynamicInput(); }

canvas.addEventListener('mousedown', (e) => {

    if (mode === 'bezier' && typeof ToolState !== 'undefined' && ToolState.bezierType === 'cubic' && e.button === 0) {
        let pos = getWorldMousePos(e);
        bezierDragStartPos = { ...pos };
        if (typeof handleToolMouseDown === 'function') handleToolMouseDown('bezier', pos);
        showDynamicInput(e.clientX, e.clientY, "Povuci za zakrivljenost ili Enter za kraj");
        setTimeout(() => dynInput.focus(), 10);
        drawEverything();
        return;
    }

    if (e.button === 1) { 
        e.preventDefault(); 
        isPanning = true; 
        startPanX = e.clientX - panX; 
        startPanY = e.clientY - panY; 
        startPanMouseX = e.clientX;
        startPanMouseY = e.clientY;
        return; 
    }
    
    if (e.button === 2) { 
        e.preventDefault(); 
        if (activeGrip) {
            cancelGripMove();
        } else if (mode === 'bezier') {
            if (typeof ToolState !== 'undefined' && ToolState.points && ToolState.points.length > 1) {
                elements.push({
                    type: 'bezier',
                    bezierKind: 'cubic',
                    nodes: JSON.parse(JSON.stringify(ToolState.points)),
                    thickness: 0.2,
                    color: '#ffffff'
                });
            }
            if (typeof resetToolState === 'function') resetToolState();
            hideDynamicInput();
        } else if (['move', 'rotate', 'scale'].includes(mode) && typeof ToolState !== 'undefined' && ToolState.step === 0 && selectedElements.length > 0) {
            ToolState.step = 1;
            let label = mode === 'rotate' ? "Stožer / Bazna tačka" : (mode === 'scale' ? "Pivot / Bazna tačka" : "Bazna tačka");
            showDynamicInput(e.clientX, e.clientY, label);
            drawEverything();
            return;
        } else if (mode === 'select' && selectedElements.length === 1) {
            let el = selectedElements[0];
            let posClick = getWorldMousePos(e);
            if (el.type === 'bezier' && el.nodes) {
                let bestD = 25 / scale;
                for (let i = 0; i < el.nodes.length; i++) {
                    let d = Math.hypot(posClick.x - el.nodes[i].anchor.x, posClick.y - el.nodes[i].anchor.y);
                    if (d < bestD) {
                        bestD = d;
                        selectedBezierNodeIndex = i;
                    }
                }
            }
            openPropsMenu(e.clientX, e.clientY);
            return;
        } else {
            resetDrawingState(); 
        }
        drawEverything(); 
        return; 
    }

    hidePropsMenu();

    let pos = getWorldMousePos(e);

    if (mode !== 'select' && typeof handleToolClick === 'function') {
        let res = handleToolClick(mode, pos, elements);
        if (res) {
            if (res.inputPrompt) {
                showDynamicInput(e.clientX, e.clientY, res.placeholder);
                setTimeout(() => dynInput.focus(), 10);
            } else {
                hideDynamicInput();
            }
            drawEverything();
            return;
        }
    }

    if (mode === 'select') {
        if (activeGrip) { activeGrip = null; originalGripState = null; hideDynamicInput(); } 
        else {
            let grip = checkGripClick(e.clientX, e.clientY);
            if (grip) {
                activeGrip = grip;
                if (grip.type === 'bz_node') {
                    selectedBezierNodeIndex = grip.nodeIndex;
                }
                let p1 = selectedElements[0].p1 || (selectedElements[0].pts ? selectedElements[0].pts[0] : { x: 0, y: 0 });
                let p2 = selectedElements[0].p2 || (selectedElements[0].pts ? selectedElements[0].pts[2] : { x: 0, y: 0 });
                originalGripState = { p1: { ...p1 }, p2: { ...p2 }, center: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 } };
                startPoint = { ...pos }; 
                showDynamicInput(e.clientX, e.clientY); 
                setTimeout(() => dynInput.focus(), 10);
            } else {
                let clickedEl = findBestHitElement(pos, elements, scale);
                if (clickedEl) { 
                    selectedElements = [clickedEl]; 
                    selectedBezierNodeIndex = 0;
                } else { 
                    isBoxSelecting = true; 
                    boxStartWorld = { ...rawMouseWorldPos }; 
                }
            }
        }
    }
    else if (mode === 'text') {
        startPoint = { ...pos };
        showDynamicInput(e.clientX, e.clientY, "Unesite tekst i pritisnite Enter");
        setTimeout(() => dynInput.focus(), 10);
    }
    else if (mode === 'line') {
        let clickPos = (orthoEnabled && isDrawing) ? orthoCorrectedWorldPos : pos;
        if (!isDrawing) { 
            isDrawing = true; startPoint = { ...pos }; currentPoint = { ...startPoint }; 
            showDynamicInput(e.clientX, e.clientY); 
            setTimeout(() => dynInput.focus(), 10); 
        } 
        else {
            if (startPoint.x !== clickPos.x || startPoint.y !== clickPos.y) { 
                elements.push({ 
                    type: 'line', p1: { ...startPoint }, p2: { ...clickPos },
                    thickness: 0.2, lineType: 'solid', dashLength: 10, dashGap: 5, color: '#ffffff'
                }); 
            }
            startPoint = { ...clickPos }; 
            currentPoint = { ...clickPos };
            dynInput.value = '';
            setTimeout(() => dynInput.focus(), 10);
        }
    } 
    else if (mode === 'dimension') {
        if (dimMode === 2) {
            if (dimStep === 0) {
                let hitEl = findBestHitElement(pos, elements, scale);
                if (hitEl && hitEl.type === 'circle') {
                    dimP1 = { ...hitEl.p1 };
                    dimRadius = (hitEl.radius !== undefined) ? hitEl.radius : Math.hypot(hitEl.p2.x - hitEl.p1.x, hitEl.p2.y - hitEl.p1.y);
                    dimStep = 1;
                } else {
                    dimP1 = { ...pos };
                    dimStep = 1;
                }
            } else if (dimStep === 1) {
                let angle = Math.atan2(pos.y - dimP1.y, pos.x - dimP1.x);
                let p2Radial = { x: dimP1.x + Math.cos(angle) * dimRadius, y: dimP1.y + Math.sin(angle) * dimRadius };
                elements.push({ type: 'dimension', p1: { ...dimP1 }, p2: p2Radial, offset: 0, dimType: 'radial', radius: dimRadius });
                dimStep = 0; dimP1 = null; dimP2 = null; dimRadius = 0;
            }
        } else {
            if (dimStep === 0) { dimP1 = { ...pos }; dimStep = 1; }
            else if (dimStep === 1) { dimP2 = { ...pos }; if (dimP1.x !== dimP2.x || dimP1.y !== dimP2.y) { dimStep = 2; showDynamicInput(e.clientX, e.clientY); setTimeout(() => dynInput.focus(), 10); } }
            else if (dimStep === 2) {
                let params = getDimParams(dimP1, dimP2, pos);
                elements.push({ type: 'dimension', p1: { ...dimP1 }, p2: { ...dimP2 }, offset: params.offset, dimType: params.type });
                dimStep = 0; dimP1 = null; dimP2 = null; hideDynamicInput();
            }
        }
    }
    drawEverything();
});

canvas.addEventListener('mousemove', (e) => {
    if (isPanning) { panX = e.clientX - startPanX; panY = e.clientY - startPanY; mouseScreenPos = { x: e.clientX, y: e.clientY }; drawEverything(); return; }
    if (isPrinting) return; 

    mouseWorldPos = getWorldMousePos(e);

    if (mode === 'line' && isDrawing) {
        currentPoint = orthoEnabled ? orthoCorrectedWorldPos : mouseWorldPos;
    }

    if (mode === 'select' && activeGrip && selectedElements[0]) {
        let el = selectedElements[0];
        let targetPos = orthoEnabled ? orthoCorrectedWorldPos : mouseWorldPos;
        if (typeof activeGrip === 'object') {
            if (activeGrip.type === 'bz_quad') {
                el[activeGrip.target] = { ...targetPos };
            } else if (activeGrip.type === 'bz_node') {
                let node = el.nodes[activeGrip.nodeIndex];
                if (activeGrip.part === 'anchor') {
                    let dx = targetPos.x - node.anchor.x;
                    let dy = targetPos.y - node.anchor.y;
                    node.anchor.x += dx; node.anchor.y += dy;
                    node.handleIn.x += dx; node.handleIn.y += dy;
                    node.handleOut.x += dx; node.handleOut.y += dy;
                } else {
                    if (typeof updateNodeHandles === 'function') updateNodeHandles(node, activeGrip.part, targetPos);
                }
            } else if (activeGrip.type === 'rect_pt') {
                el.pts[activeGrip.index] = { ...targetPos };
            }
        } else {
            if (activeGrip === 'p1') el.p1 = { ...targetPos };
            if (activeGrip === 'p2') el.p2 = { ...targetPos };
            if (activeGrip === 'center' && el.type === 'line') {
                let dx = targetPos.x - startPoint.x; let dy = targetPos.y - startPoint.y;
                el.p1.x += dx; el.p1.y += dy; el.p2.x += dx; el.p2.y += dy; startPoint = { ...targetPos };
            }
            if (activeGrip === 'dim_line_move' && el.type === 'dimension') {
                if (el.dimType === 'horizontal') {
                    el.offset = targetPos.y - el.p1.y;
                } else if (el.dimType === 'vertical') {
                    el.offset = targetPos.x - el.p1.x;
                } else {
                    el.offset = calculateLiveOffset(el.p1, el.p2, targetPos);
                }
            }
            if (activeGrip === 'dim_rad_inner' && el.type === 'dimension') {
                let r = (el.radius !== undefined) ? el.radius : Math.hypot(el.p2.x - el.p1.x, el.p2.y - el.p1.y);
                let dist = Math.hypot(targetPos.x - el.p1.x, targetPos.y - el.p1.y);
                el.startOffset = Math.min(Math.max(0, dist), r * 0.95);
            }
            if (activeGrip === 'dim_rad_outer' && el.type === 'dimension') {
                let r = (el.radius !== undefined) ? el.radius : Math.hypot(el.p2.x - el.p1.x, el.p2.y - el.p1.y);
                let angle = Math.atan2(targetPos.y - el.p1.y, targetPos.x - el.p1.x);
                el.p2 = { x: el.p1.x + Math.cos(angle) * r, y: el.p1.y + Math.sin(angle) * r };
            }
        }
        showDynamicInput(e.clientX, e.clientY);
    }

    if (mode === 'bezier' && typeof ToolState !== 'undefined' && ToolState.bezierType === 'cubic' && typeof isDraggingHandle !== 'undefined' && isDraggingHandle) {
        if (typeof handleToolMouseMove === 'function') handleToolMouseMove('bezier', mouseWorldPos);
        drawEverything();
        return;
    }

    drawEverything();
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 1) {
        isPanning = false;
        let distMoved = Math.hypot(e.clientX - startPanMouseX, e.clientY - startPanMouseY);
        if (distMoved < 5) {
            dimMode = (dimMode + 1) % 3;
            updateDimBtnUI();
            if(mode === 'dimension') drawEverything();
        }
    }
    
    if (mode === 'select' && isBoxSelecting) {
        isBoxSelecting = false;
        let xMin = Math.min(boxStartWorld.x, rawMouseWorldPos.x), xMax = Math.max(boxStartWorld.x, rawMouseWorldPos.x);
        let yMin = Math.min(boxStartWorld.y, rawMouseWorldPos.y), yMax = Math.max(boxStartWorld.y, rawMouseWorldPos.y);
        selectedElements = [];
        elements.forEach(el => { 
            if (isElementInBox(el, xMin, xMax, yMin, yMax)) {
                selectedElements.push(el);
            }
        });
        drawEverything();
    }

    if (mode === 'bezier' && typeof ToolState !== 'undefined' && ToolState.bezierType === 'cubic') {
        if (typeof handleToolMouseUp === 'function') handleToolMouseUp('bezier');

        if (bezierDragStartPos && ToolState.points && ToolState.points.length > 0) {
            let lastNode = ToolState.points[ToolState.points.length - 1];
            let dragDist = Math.hypot(mouseWorldPos.x - bezierDragStartPos.x, mouseWorldPos.y - bezierDragStartPos.y);
            let handleLen = Math.hypot(lastNode.handleOut.x - lastNode.anchor.x, lastNode.handleOut.y - lastNode.anchor.y);

            if (dragDist < 5 / scale || handleLen < 2 / scale) {
                lastNode.type = 'corner';
                lastNode.handleIn = { ...lastNode.anchor };
                lastNode.handleOut = { ...lastNode.anchor };
            }
            bezierDragStartPos = null;
        }

        drawEverything();
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
        dimMode = (dimMode + 1) % 3;
        updateDimBtnUI();
        if (mode === 'dimension') drawEverything();
    }
});

dynInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        let val = dynInput.value.trim();

        if (mode === 'text') {
            if (val) {
                elements.push({
                    type: 'text',
                    p1: { ...startPoint },
                    text: val,
                    font: 'Arial',
                    fontSize: 16,
                    color: '#ffffff'
                });
            }
            hideDynamicInput();
            drawEverything();
            return;
        }

        if (['move', 'rotate', 'scale'].includes(mode) && typeof ToolState !== 'undefined' && ToolState.step === 0) {
            if (selectedElements.length > 0) {
                ToolState.step = 1;
                let label = mode === 'rotate' ? "Stožer / Bazna tačka" : (mode === 'scale' ? "Pivot / Bazna tačka" : "Bazna tačka");
                showDynamicInput(mouseScreenPos.x, mouseScreenPos.y, label);
                dynInput.value = '';
                drawEverything();
                setTimeout(() => dynInput.focus(), 10);
                return;
            }
        }

        if (mode === 'bezier' && typeof ToolState !== 'undefined' && ToolState.bezierType === 'cubic') {
            if (ToolState.points.length > 1) {
                elements.push({
                    type: 'bezier',
                    bezierKind: 'cubic',
                    nodes: JSON.parse(JSON.stringify(ToolState.points)),
                    thickness: 0.2,
                    color: '#ffffff'
                });
            }
            if (typeof resetToolState === 'function') resetToolState();
            hideDynamicInput();
            drawEverything();
            return;
        }

        if (!val) return;

        if (['move', 'rotate', 'scale'].includes(mode) && typeof ToolState !== 'undefined' && ToolState.step === 2) {
            let center = ToolState.points[0];

            if (mode === 'move') {
                let dx = 0, dy = 0;
                if (val.includes(',')) {
                    let parts = val.replace('@', '').split(',');
                    dx = parseFloat(parts[0]);
                    dy = parseFloat(parts[1]);
                } else {
                    let dist = parseFloat(val);
                    if (!isNaN(dist)) {
                        let angle = Math.atan2(orthoCorrectedWorldPos.y - center.y, orthoCorrectedWorldPos.x - center.x);
                        dx = Math.cos(angle) * dist;
                        dy = Math.sin(angle) * dist;
                    }
                }
                if (!isNaN(dx) && !isNaN(dy)) {
                    if (typeof moveElement === 'function') selectedElements.forEach(el => moveElement(el, dx, dy));
                    if (typeof resetToolState === 'function') resetToolState();
                    hideDynamicInput();
                    drawEverything();
                    return;
                }
            } else if (mode === 'rotate') {
                let deg = parseFloat(val);
                if (!isNaN(deg)) {
                    let rad = deg * Math.PI / 180;
                    if (typeof rotateElement === 'function') selectedElements.forEach(el => rotateElement(el, center, rad));
                    if (typeof resetToolState === 'function') resetToolState();
                    hideDynamicInput();
                    drawEverything();
                    return;
                }
            } else if (mode === 'scale') {
                let factor = parseFloat(val);
                if (!isNaN(factor) && factor > 0) {
                    if (typeof scaleElement === 'function') selectedElements.forEach(el => scaleElement(el, center, factor));
                    if (typeof resetToolState === 'function') resetToolState();
                    hideDynamicInput();
                    drawEverything();
                    return;
                }
            }
        }

        if (mode === 'rect' && typeof ToolState !== 'undefined' && ToolState.step === 1) {
            let p1 = ToolState.points[0];
            let w = 0, h = 0;
            if (val.includes(',')) {
                let parts = val.split(',');
                w = parseFloat(parts[0]);
                h = parseFloat(parts[1]);
            } else {
                w = parseFloat(val);
                h = w;
            }
            if (!isNaN(w) && !isNaN(h)) {
                let p2 = { x: p1.x + w, y: p1.y + h };
                elements.push({
                    type: 'rect',
                    pts: [
                        { x: p1.x, y: p1.y },
                        { x: p2.x, y: p1.y },
                        { x: p2.x, y: p2.y },
                        { x: p1.x, y: p2.y }
                    ],
                    thickness: 0.2,
                    color: '#ffffff'
                });
                if (typeof resetToolState === 'function') resetToolState();
                hideDynamicInput();
                drawEverything();
                return;
            }
        }

        if (mode === 'circle' && typeof ToolState !== 'undefined' && ToolState.step === 1) {
            let r = parseFloat(val);
            if (!isNaN(r) && r > 0) {
                let p1 = ToolState.points[0];
                elements.push({
                    type: 'circle',
                    p1: { ...p1 },
                    p2: { x: p1.x + r, y: p1.y },
                    thickness: 0.2,
                    color: '#ffffff'
                });
                if (typeof resetToolState === 'function') resetToolState();
                hideDynamicInput();
                drawEverything();
                return;
            }
        }

        if (val.includes(',')) {
            let isRelative = val.startsWith('@');
            let cleanVal = isRelative ? val.substring(1) : val;
            let parts = cleanVal.split(',');
            let targetX = parseFloat(parts[0]), targetY = parseFloat(parts[1]);

            if (!isNaN(targetX) && !isNaN(targetY)) {
                let finalWorldX = targetX, finalWorldY = targetY;
                if (isRelative) {
                    let basePoint = (mode === 'line') ? startPoint : (activeGrip ? startPoint : { x: 0, y: 0 });
                    finalWorldX = basePoint.x + targetX;
                    finalWorldY = basePoint.y + targetY;
                }

                if (mode === 'line' && isDrawing) { 
                    elements.push({ 
                        type: 'line', p1: { ...startPoint }, p2: { x: finalWorldX, y: finalWorldY },
                        thickness: 0.2, lineType: 'solid', dashLength: 10, dashGap: 5, color: '#ffffff'
                    }); 
                    startPoint = { x: finalWorldX, y: finalWorldY };
                    currentPoint = { ...startPoint }; 
                } 
                else if (mode === 'select' && activeGrip && selectedElements[0]) {
                    let el = selectedElements[0];
                    if (activeGrip === 'p1') el.p1 = { x: finalWorldX, y: finalWorldY };
                    if (activeGrip === 'p2') el.p2 = { x: finalWorldX, y: finalWorldY };
                    activeGrip = null;
                    originalGripState = null;
                    hideDynamicInput();
                }
            }
        } else {
            let length = parseFloat(val);
            if (!isNaN(length) && length > 0) {
                if (mode === 'line' && isDrawing) {
                    let angle = Math.atan2(orthoCorrectedWorldPos.y - startPoint.y, orthoCorrectedWorldPos.x - startPoint.x);
                    let finalPoint = { x: startPoint.x + Math.cos(angle) * length, y: startPoint.y + Math.sin(angle) * length };
                    elements.push({ 
                        type: 'line', p1: { ...startPoint }, p2: finalPoint,
                        thickness: 0.2, lineType: 'solid', dashLength: 10, dashGap: 5, color: '#ffffff'
                    }); 
                    startPoint = finalPoint;
                    currentPoint = finalPoint;
                } else if (mode === 'dimension' && dimStep === 2) {
                    let params = getDimParams(dimP1, dimP2, mouseWorldPos);
                    elements.push({ 
                        type: 'dimension', p1: { ...dimP1 }, p2: { ...dimP2 }, 
                        offset: length * (params.offset >= 0 ? 1 : -1), dimType: params.type 
                    });
                    dimStep = 0; dimP1 = null; dimP2 = null;
                    hideDynamicInput();
                }
            }
        }

        dynInput.value = ''; 
        drawEverything();
        if (mode === 'line' && isDrawing) setTimeout(() => dynInput.focus(), 10);
    }

    if (e.key === 'Escape') {
        if (activeGrip) cancelGripMove();
        else resetDrawingState();
        drawEverything();
    }
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); let mouseWorldBefore = screenToWorld(e.clientX, e.clientY);
    if (e.deltaY < 0) scale *= 1.1; else scale /= 1.1; scale = Math.max(0.05, Math.min(scale, 30));
    panX = e.clientX - mouseWorldBefore.x * scale; panY = e.clientY + mouseWorldBefore.y * scale;
    if (!isPrinting) {
        mouseWorldPos = getWorldMousePos(e); 
        if (isDrawing && mode === 'line') currentPoint = orthoEnabled ? orthoCorrectedWorldPos : mouseWorldPos;
    }
    drawEverything();
}, { passive: false });

function deleteSelected() { if (selectedElements.length > 0) { elements = elements.filter(el => !selectedElements.includes(el)); selectedElements = []; resetDrawingState(); hidePropsMenu(); drawEverything(); } }

function getElementsBoundingBox(targetElements) {
    if (!targetElements || targetElements.length === 0) return null;
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;

    function includePoint(pt) {
        if (!pt) return;
        if (pt.x < xMin) xMin = pt.x;
        if (pt.x > xMax) xMax = pt.x;
        if (pt.y < yMin) yMin = pt.y;
        if (pt.y > yMax) yMax = pt.y;
    }

    targetElements.forEach(el => {
        if (el.type === 'line') { includePoint(el.p1); includePoint(el.p2); }
        else if (el.type === 'rect' && el.pts) { el.pts.forEach(includePoint); }
        else if (el.type === 'circle' && el.p1) {
            let r = (el.radius !== undefined) ? el.radius : Math.hypot(el.p2.x - el.p1.x, el.p2.y - el.p1.y);
            includePoint({ x: el.p1.x - r, y: el.p1.y - r });
            includePoint({ x: el.p1.x + r, y: el.p1.y + r });
        }
        else if (el.type === 'bezier' && el.nodes) {
            el.nodes.forEach(n => { includePoint(n.anchor); });
        }
        else if ((el.type === 'polygon' || el.type === 'polyline') && el.pts) {
            el.pts.forEach(includePoint);
        }
        else if (el.type === 'dimension') {
            let pts = getDimEndpoints(el);
            includePoint(el.p1); includePoint(el.p2);
            if (pts) { includePoint(pts.p1); includePoint(pts.p2); }
        }
        else if (el.type === 'text') { includePoint(el.p1); }
    });

    if (xMin === Infinity) return null;
    return { xMin, xMax, yMin, yMax, w: xMax - xMin, h: yMax - yMin, cx: (xMin + xMax) / 2, cy: (yMin + yMax) / 2 };
}

function printCanvas(modeType = 'standard') {
    let paperDim = getPaperWorldDimensions();
    if (!paperDim) { alert("Izaberite format papira iz menija pre printanja!"); return; }

    let targetElements = (modeType === 'selection') ? selectedElements : elements;
    if (targetElements.length === 0) {
        alert(modeType === 'selection' ? "Nema selektovanih elemenata za printanje!" : "Crtež je prazan!");
        return;
    }

    isPrinting = true; 
    isPrintingBestFit = (modeType === 'best_fit' || modeType === 'selection');

    hideDynamicInput(); 
    hidePropsMenu();

    const oldScale = scale, oldPanX = panX, oldPanY = panY, oldW = canvas.width, oldH = canvas.height;
    const oldElements = [...elements];

    if (modeType === 'selection') {
        elements = [...selectedElements];
    }

    canvas.width = 2400; 
    canvas.height = 2400 * (paperDim.h / paperDim.w);

    if (isPrintingBestFit) {
        let bbox = getElementsBoundingBox(elements);
        if (bbox && bbox.w > 0 && bbox.h > 0) {
            let marginMM = 5;
            let scaleSelect = document.getElementById('scale-select');
            let unitSelect = document.getElementById('unit-select');
            let selectedScaleVal = scaleSelect ? parseFloat(scaleSelect.value) : 1;
            let unit = unitSelect ? unitSelect.value : 'cm';
            let unitFactor = 1.0; if (unit === 'cm') unitFactor = 0.1; if (unit === 'm') unitFactor = 0.001;

            let marginWorld = marginMM * unitFactor * selectedScaleVal;
            let availW = Math.max(0.1, paperDim.w - 2 * marginWorld);
            let availH = Math.max(0.1, paperDim.h - 2 * marginWorld);

            let fitScaleFactor = Math.min(availW / bbox.w, availH / bbox.h);
            scale = (canvas.width / paperDim.w) * fitScaleFactor;

            let screenCenterX = canvas.width / 2;
            let screenCenterY = canvas.height / 2;

            panX = screenCenterX - bbox.cx * scale;
            panY = screenCenterY + bbox.cy * scale;
        } else {
            scale = canvas.width / paperDim.w; panX = 0; panY = canvas.height;
        }
    } else {
        scale = canvas.width / paperDim.w; panX = 0; panY = canvas.height; 
    }

    let currentSel = [...selectedElements];
    selectedElements = [];

    drawEverything();
    window.print();

    isPrinting = false; 
    isPrintingBestFit = false;
    elements = oldElements;
    selectedElements = currentSel;

    canvas.width = oldW; canvas.height = oldH; scale = oldScale; panX = oldPanX; panY = oldPanY;
    drawEverything(); canvas.focus();
}

function updateSidebarPosition() {
    const toolbar = document.getElementById('toolbar');
    const sidebar = document.getElementById('sidebar');
    if (toolbar && sidebar) {
        const toolbarRect = toolbar.getBoundingClientRect();
        sidebar.style.top = (toolbarRect.bottom + 10) + 'px';
    }
}

if (window.ResizeObserver) {
    const toolbar = document.getElementById('toolbar');
    if (toolbar) {
        const toolbarObserver = new ResizeObserver(() => {
            updateSidebarPosition();
        });
        toolbarObserver.observe(toolbar);
    }
}

function zoomToPaper() {
    let paperDim = getPaperWorldDimensions();
    if (!paperDim) return;

    let toolbar = document.getElementById('toolbar');
    let sidebar = document.getElementById('sidebar');

    let toolbarBottom = toolbar ? toolbar.getBoundingClientRect().bottom : 0;
    let sidebarRight = sidebar ? sidebar.getBoundingClientRect().right : 0;

    let padding = 20;

    let visibleXMin = sidebarRight + padding;
    let visibleXMax = canvas.width - padding;
    let visibleYMin = toolbarBottom + padding;
    let visibleYMax = canvas.height - padding;

    let availW = visibleXMax - visibleXMin;
    let availH = visibleYMax - visibleYMin;

    if (availW <= 0 || availH <= 0) return;

    scale = availH / paperDim.h;
    scale = Math.max(0.01, Math.min(scale, 50));

    let screenCx = visibleXMin + availW / 2;
    let screenCy = visibleYMin + availH / 2;

    let worldCx = paperDim.w / 2;
    let worldCy = paperDim.h / 2;

    panX = screenCx - worldCx * scale;
    panY = screenCy + worldCy * scale;
}

window.addEventListener('load', () => {
    ensureTextSidebarButton();
    updateSidebarPosition();
    let paperSelect = document.getElementById('paper-select');
    if (paperSelect && (!paperSelect.value || paperSelect.value === 'NONE')) {
        paperSelect.value = 'A4_P';
    }
    updatePaperStyle();
});

window.addEventListener('resize', () => {
    updateSidebarPosition();
    resizeCanvas();
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') { e.preventDefault(); toggleSnap(); }
    if (e.key === 'F3') { e.preventDefault(); toggleOsnap(); }
    if (e.key === 'F4') { e.preventDefault(); toggleOrtho(); }
    if (e.key === 'Delete') deleteSelected();
    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); }
    if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); printCanvas('standard'); }
    
    if (document.activeElement !== dynInput && document.activeElement.tagName !== 'INPUT') {
        if (e.key === 'l' || e.key === 'L') setMode('line');
        if (e.key === 'd' || e.key === 'D') setMode('dimension');
        if (e.key === 't' || e.key === 'T') setMode('text');
        if (e.key === 's' || e.key === 'S') setMode('select');
        if (e.key === 'm' || e.key === 'M') setMode('move');
        if (e.key === 'r' || e.key === 'R') setMode('rotate');
        if (e.key === 'x' || e.key === 'X') setMode('scale');
        if (e.key === 'Escape') { if(activeGrip) cancelGripMove(); else { resetDrawingState(); selectedElements = []; } hidePropsMenu(); drawEverything(); }
    }
});