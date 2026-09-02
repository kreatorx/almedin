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

let dimForceOrtho = false; 

let startPoint = { x: 0, y: 0 }; 
let currentPoint = { x: 0, y: 0 }; 
let orthoCorrectedWorldPos = { x: 0, y: 0 }; 

let dimStep = 0, dimP1 = null, dimP2 = null;

let selectedElements = []; 
let selectedBezierNodeIndex = null; // Praćenje pojedinačno selektovanog tjemena Beziera
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
    dimForceOrtho = !dimForceOrtho;
    updateDimBtnUI();
    drawEverything();
};

function updateDimBtnUI() {
    mobileDimBtn.style.background = dimForceOrtho ? '#00e5ff' : '#333';
    mobileDimBtn.style.color = dimForceOrtho ? '#000' : '#fff';
    mobileDimBtn.innerText = dimForceOrtho ? 'Kotiranje: Ortogonalno' : 'Kotiranje: Dijagonalno';
}

window.addEventListener('contextmenu', e => e.preventDefault());

function updatePaperStyle() {
    let paperKey = document.getElementById('paper-select').value;
    if (PAPERS[paperKey]) {
        styleTag.innerHTML = `@media print { @page { size: ${PAPERS[paperKey].css}; margin: 5mm 5mm 5mm 20mm; } }`;
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
function resetDrawingState() { isDrawing = false; dimStep = 0; dimP1 = null; dimP2 = null; selectedBezierNodeIndex = null; isBoxSelecting = false; if(activeGrip) cancelGripMove(); hideDynamicInput(); hidePropsMenu(); if (typeof resetToolState === 'function') resetToolState(); }

function screenToWorld(screenX, screenY) { return { x: (screenX - panX) / scale, y: -(screenY - panY) / scale }; }
function worldToScreen(worldX, worldY) { return { x: worldX * scale + panX, y: -(worldY * scale) + panY }; }

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

function getWorldMousePos(e) {
    let scrX = e.clientX, scrY = e.clientY;
    mouseScreenPos = { x: scrX, y: scrY };
    let world = screenToWorld(scrX, scrY);
    rawMouseWorldPos = { ...world };
    osnapTarget = null;

    if (osnapEnabled && !isPanning) {
        let bestDist = 15 / scale;
        
        for (let i = 0; i < elements.length; i++) {
            for (let j = i + 1; j < elements.length; j++) {
                if (elements[i].type === 'line' && elements[j].type === 'line') {
                    let intersect = findLineIntersection(elements[i].p1, elements[i].p2, elements[j].p1, elements[j].p2);
                    if (intersect) {
                        let d = Math.hypot(world.x - intersect.x, world.y - intersect.y);
                        if (d < bestDist) { bestDist = d; osnapTarget = { ...intersect }; }
                    }
                }
            }
        }

        if (!osnapTarget) {
            elements.forEach(el => {
                let pointsToCheck = [];
                if (el.type === 'line') {
                    pointsToCheck.push(el.p1, el.p2, { x: (el.p1.x + el.p2.x) / 2, y: (el.p1.y + el.p2.y) / 2 });
                } else if (typeof getExtendedSnapPoints === 'function') {
                    pointsToCheck = getExtendedSnapPoints(el);
                }

                pointsToCheck.forEach(pt => {
                    let d = Math.hypot(world.x - pt.x, world.y - pt.y);
                    if (d < bestDist) { bestDist = d; osnapTarget = { ...pt }; }
                });
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
    if (paperDim) {
        ctx.strokeStyle = isPrinting ? '#000000' : 'rgba(255, 80, 80, 0.5)';
        ctx.lineWidth = isPrinting ? 2.5 / scale : 1.5 / scale; 
        ctx.strokeRect(0, 0, paperDim.w, paperDim.h);
        ctx.strokeStyle = isPrinting ? '#000000' : 'rgba(255, 80, 80, 0.3)';
        ctx.lineWidth = isPrinting ? 1.5 / scale : 1 / scale;
        ctx.strokeRect(paperDim.leftMargin, paperDim.margin, paperDim.w - paperDim.leftMargin - paperDim.margin, paperDim.h - paperDim.margin * 2);

        // POTPIS: Van okvira dole lijevo, uspravno prema gore, visina fonta 18px
        if (isPrinting) {
            ctx.save();
            let posX = paperDim.leftMargin - 0.2; // Između ivice papira i okvira sa lijeve strane
            let posY = paperDim.margin + 0.05;         // Počinje od dno okvira dole lijevo
            ctx.translate(posX, posY);
            ctx.scale(1, -1);
            ctx.rotate(-Math.PI / 2);           // Uspravna rotacija odozdo prema gore
            ctx.fillStyle = '#000000';
            ctx.font = `${18 / scale}px Arial`;
            ctx.textAlign = 'left';
            ctx.fillText("almedin.vercel.app    husalmedin@gmail.com", 0, 0);
            ctx.restore();
        }
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
            drawAutoCADDimension(el.p1, el.p2, el.offset, false, isSel, el.dimType || 'aligned');
        } else if (typeof renderExtendedElement === 'function') {
            renderExtendedElement(ctx, el, isSel, isPrinting, scale);
        }
    });

    if (!isPrinting) {
        if (mode === 'line' && isDrawing) drawLine(startPoint, currentPoint, '#007acc', 2 / scale);
        else if (mode === 'dimension') {
            if (dimStep === 1) drawLine(dimP1, mouseWorldPos, 'rgba(0, 229, 255, 0.4)', 1 / scale);
            else if (dimStep === 2) {
                let params = getDimParams(dimP1, dimP2, mouseWorldPos);
                drawAutoCADDimension(dimP1, dimP2, params.offset, true, false, params.type);
            }
        } else if (typeof drawToolPreview === 'function') {
            drawToolPreview(ctx, mode, mouseWorldPos, scale);
        }
    }

    ctx.restore();

    if (!isPrinting) {
        if (mode === 'select' && selectedElements.length === 1) drawGrips(selectedElements[0]);
        if (mode === 'select' && isBoxSelecting) {
            let p1Scr = worldToScreen(boxStartWorld.x, boxStartWorld.y);
            ctx.fillStyle = 'rgba(0, 122, 204, 0.15)'; ctx.strokeStyle = '#007acc'; ctx.lineWidth = 1;
            ctx.fillRect(p1Scr.x, p1Scr.y, mouseScreenPos.x - p1Scr.x, mouseScreenPos.y - p1Scr.y);
            ctx.strokeRect(p1Scr.x, p1Scr.y, mouseScreenPos.x - p1Scr.x, mouseScreenPos.y - p1Scr.y);
        }
        if (osnapTarget) {
            let scrOsnap = worldToScreen(osnapTarget.x, osnapTarget.y);
            ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 2; ctx.strokeRect(scrOsnap.x - 6, scrOsnap.y - 6, 12, 12);
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
    if (!el) return;
    ctx.fillStyle = activeGrip ? '#ff3333' : '#0055ff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    if (el.type === 'rect' && el.pts) {
        el.pts.forEach(pt => {
            let scr = worldToScreen(pt.x, pt.y);
            ctx.fillRect(scr.x - gripRadius, scr.y - gripRadius, gripRadius * 2, gripRadius * 2);
            ctx.strokeRect(scr.x - gripRadius, scr.y - gripRadius, gripRadius * 2, gripRadius * 2);
        });
    } else if (el.type === 'bezier') {
        if (el.bezierKind === 'quadratic' && el.p1 && el.p2 && el.cp) {
            [el.p1, el.p2, el.cp].forEach(pt => {
                let scr = worldToScreen(pt.x, pt.y);
                ctx.fillRect(scr.x - gripRadius, scr.y - gripRadius, gripRadius * 2, gripRadius * 2);
                ctx.strokeRect(scr.x - gripRadius, scr.y - gripRadius, gripRadius * 2, gripRadius * 2);
            });
        } else if (el.nodes) {
            el.nodes.forEach((n, i) => {
                let isNodeSel = (selectedBezierNodeIndex === i);
                let aScr = worldToScreen(n.anchor.x, n.anchor.y);
                let inScr = worldToScreen(n.handleIn.x, n.handleIn.y);
                let outScr = worldToScreen(n.handleOut.x, n.handleOut.y);

                ctx.fillStyle = isNodeSel ? '#ffaa00' : (activeGrip ? '#ff3333' : '#0055ff');
                ctx.fillRect(aScr.x - gripRadius, aScr.y - gripRadius, gripRadius * 2, gripRadius * 2);
                ctx.strokeRect(aScr.x - gripRadius, aScr.y - gripRadius, gripRadius * 2, gripRadius * 2);

                if (Math.hypot(n.handleIn.x - n.anchor.x, n.handleIn.y - n.anchor.y) > 0.001) {
                    ctx.beginPath(); ctx.arc(inScr.x, inScr.y, gripRadius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                }
                if (Math.hypot(n.handleOut.x - n.anchor.x, n.handleOut.y - n.anchor.y) > 0.001) {
                    ctx.beginPath(); ctx.arc(outScr.x, outScr.y, gripRadius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                }
            });
        }
    } else if (el.p1 && el.p2) {
        let pts = [worldToScreen(el.p1.x, el.p1.y), worldToScreen(el.p2.x, el.p2.y)];
        if(el.type === 'line') pts.push(worldToScreen((el.p1.x + el.p2.x) / 2, (el.p1.y + el.p2.y) / 2));
        pts.forEach(pt => { ctx.fillRect(pt.x - gripRadius, pt.y - gripRadius, gripRadius * 2, gripRadius * 2); ctx.strokeRect(pt.x - gripRadius, pt.y - gripRadius, gripRadius * 2, gripRadius * 2); });
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
    
    let menuW = 250, menuH = 360;
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

// AŽURIRANO: Promjena vrste zaobljenja se primjenjuje ISKLJUČIVO na izabrano tjeme
function setBezierHandleType(type) {
    if (selectedElements.length !== 1 || selectedElements[0].type !== 'bezier') return;
    let el = selectedElements[0];
    if (!el.nodes || el.nodes.length === 0) return;

    let targetIdx = (selectedBezierNodeIndex !== null && selectedBezierNodeIndex >= 0 && selectedBezierNodeIndex < el.nodes.length)
        ? selectedBezierNodeIndex
        : 0;

    let node = el.nodes[targetIdx];
    node.type = type; // 'corner', 'symmetric', ili 'smooth'

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
    if (!dimForceOrtho) return { type: 'aligned', offset: calculateLiveOffset(p1, p2, mousePos) };
    let midX = (p1.x + p2.x) / 2; let midY = (p1.y + p2.y) / 2;
    if (Math.abs(mousePos.y - midY) > Math.abs(mousePos.x - midX)) {
        return { type: 'horizontal', offset: mousePos.y - p1.y };
    } else {
        return { type: 'vertical', offset: mousePos.x - p1.x };
    }
}

function drawAutoCADDimension(p1, p2, offset, isPreview = false, isSelected = false, dimType = 'aligned') {
    let distance, dimLineP1, dimLineP2;
    let mainColor = isPrinting ? '#000000' : (isSelected ? '#ff3333' : (isPreview ? '#ffaa00' : '#00e5ff'));
    let thickness = 1.5 / scale;

    ctx.strokeStyle = isPrinting ? 'rgba(0,0,0,0.3)' : 'rgba(255, 255, 255, 0.3)'; 
    ctx.lineWidth = 0.5 / scale;

    if (dimType === 'horizontal') {
        distance = Math.abs(p2.x - p1.x); if (distance < 1) return;
        let dimLineY = p1.y + offset;
        dimLineP1 = { x: p1.x, y: dimLineY };
        dimLineP2 = { x: p2.x, y: dimLineY };
        
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(dimLineP1.x, dimLineP1.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p2.x, p2.y); ctx.lineTo(dimLineP2.x, dimLineP2.y); ctx.stroke();
    } 
    else if (dimType === 'vertical') {
        distance = Math.abs(p2.y - p1.y); if (distance < 1) return;
        let dimLineX = p1.x + offset;
        dimLineP1 = { x: dimLineX, y: p1.y };
        dimLineP2 = { x: dimLineX, y: p2.y };
        
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(dimLineX, p1.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p2.x, p2.y); ctx.lineTo(dimLineX, p2.y); ctx.stroke();
    } 
    else {
        let dx = p2.x - p1.x; let dy = p2.y - p1.y;
        distance = Math.sqrt(dx * dx + dy * dy); if (distance < 1) return;
        let nx = -dy / distance; let ny = dx / distance;
        dimLineP1 = { x: p1.x + nx * offset, y: p1.y + ny * offset };
        dimLineP2 = { x: p2.x + nx * offset, y: p2.y + ny * offset };
        
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(dimLineP1.x, dimLineP1.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p2.x, p2.y); ctx.lineTo(dimLineP2.x, dimLineP2.y); ctx.stroke();
    }

    let dx = dimLineP2.x - dimLineP1.x;
    let dy = dimLineP2.y - dimLineP1.y;
    let angle = Math.atan2(dy, dx);

    drawLine(dimLineP1, dimLineP2, mainColor, thickness);
    drawCadTick(dimLineP1, angle, mainColor);
    drawCadTick(dimLineP2, angle, mainColor);
    
    let mx = (dimLineP1.x + dimLineP2.x) / 2; 
    let my = (dimLineP1.y + dimLineP2.y) / 2;
    let fontSize = isPrinting ? (14 / scale) : (12 / scale);
    
    ctx.fillStyle = mainColor; 
    ctx.font = `bold ${fontSize}px Arial`; 
    ctx.textAlign = 'center';
    
    ctx.save(); 
    ctx.translate(mx, my); 
    ctx.scale(1, -1); 
    
    let txtAngle = -angle; 
    while (txtAngle > Math.PI / 2) txtAngle -= Math.PI;
    while (txtAngle <= -Math.PI / 2) txtAngle += Math.PI;
    
    ctx.rotate(txtAngle);
    
    let scaleSelect = document.getElementById('scale-select');
    let unitSelect = document.getElementById('unit-select');
    let selectedScale = scaleSelect ? parseFloat(scaleSelect.value) : 1;
    let unit = unitSelect ? unitSelect.value : 'cm';
    let txt = (distance / selectedScale).toFixed(1) + " " + unit;
    
    let cleanPadding = 8 / scale;
    ctx.fillText(txt, 0, -cleanPadding);
    ctx.restore();
}

function drawCadTick(pt, lineAngle, color) {
    let tickLength = 5 / scale; let tickAngle = lineAngle + Math.PI / 4;
    ctx.strokeStyle = color; ctx.lineWidth = isPrinting ? (2.0 / scale) : (2 / scale);
    ctx.beginPath(); ctx.moveTo(pt.x - Math.cos(tickAngle) * tickLength, pt.y - Math.sin(tickAngle) * tickLength); ctx.lineTo(pt.x + Math.cos(tickAngle) * tickLength, pt.y + Math.sin(tickAngle) * tickLength); ctx.stroke();
}

function distToSegment(p, v, w) {
    let l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2); if (l2 == 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = Math.max(0, Math.min(1, ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

function checkGripClick(scrX, scrY) {
    if (selectedElements.length !== 1) return null;
    let el = selectedElements[0];

    if (el.type === 'bezier') {
        if (el.bezierKind === 'quadratic' && el.p1 && el.p2 && el.cp) {
            let p1Scr = worldToScreen(el.p1.x, el.p1.y);
            let p2Scr = worldToScreen(el.p2.x, el.p2.y);
            let cpScr = worldToScreen(el.cp.x, el.cp.y);
            if (Math.hypot(scrX - p1Scr.x, scrY - p1Scr.y) < gripRadius + 6) return { type: 'bz_quad', target: 'p1' };
            if (Math.hypot(scrX - p2Scr.x, scrY - p2Scr.y) < gripRadius + 6) return { type: 'bz_quad', target: 'p2' };
            if (Math.hypot(scrX - cpScr.x, scrY - cpScr.y) < gripRadius + 6) return { type: 'bz_quad', target: 'cp' };
        } else if (el.nodes) {
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

    if (typeof handleToolClick === 'function') {
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
                let clickedEl = typeof findHitElement === 'function' ? findHitElement(pos, elements, scale) : null;
                if (!clickedEl) {
                    let threshold = 10 / scale;
                    for (let el of elements) {
                        let hit = false;
                        if (el.type === 'line') hit = distToSegment(pos, el.p1, el.p2) < threshold;
                        else if (el.type === 'rect') {
                            if (el.pts && el.pts.length === 4) {
                                for (let j = 0; j < 4; j++) {
                                    if (distToSegment(pos, el.pts[j], el.pts[(j + 1) % 4]) < threshold) { hit = true; break; }
                                }
                            } else if (el.p1 && el.p2) {
                                let xMin = Math.min(el.p1.x, el.p2.x), xMax = Math.max(el.p1.x, el.p2.x);
                                let yMin = Math.min(el.p1.y, el.p2.y), yMax = Math.max(el.p1.y, el.p2.y);
                                hit = (pos.x >= xMin && pos.x <= xMax && pos.y >= yMin && pos.y <= yMax);
                            }
                        }
                        else if (el.type === 'circle') {
                            let r = Math.hypot(el.p2.x - el.p1.x, el.p2.y - el.p1.y);
                            hit = Math.abs(Math.hypot(pos.x - el.p1.x, pos.y - el.p1.y) - r) < threshold;
                        }
                        if (hit) { clickedEl = el; break; }
                    }
                }
                if (clickedEl) { 
                    selectedElements = [clickedEl]; 
                    selectedBezierNodeIndex = 0; // Defaultno prvi čvor selektovanog objekta
                } else { 
                    isBoxSelecting = true; 
                    boxStartWorld = { ...rawMouseWorldPos }; 
                }
            }
        }
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
        if (dimStep === 0) { dimP1 = { ...pos }; dimStep = 1; }
        else if (dimStep === 1) { dimP2 = { ...pos }; if (dimP1.x !== dimP2.x || dimP1.y !== dimP2.y) { dimStep = 2; showDynamicInput(e.clientX, e.clientY); setTimeout(() => dynInput.focus(), 10); } }
        else if (dimStep === 2) {
            let params = getDimParams(dimP1, dimP2, pos);
            elements.push({ type: 'dimension', p1: { ...dimP1 }, p2: { ...dimP2 }, offset: params.offset, dimType: params.type });
            dimStep = 0; dimP1 = null; dimP2 = null; hideDynamicInput();
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
            dimForceOrtho = !dimForceOrtho;
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
            if (el.p1 && el.p2 && el.p1.x >= xMin && el.p1.x <= xMax && el.p1.y >= yMin && el.p1.y <= yMax && el.p2.x >= xMin && el.p2.x <= xMax && el.p2.y >= yMin && el.p2.y <= yMax) {
                selectedElements.push(el);
            }
        });
        drawEverything();
    }

    if (mode === 'bezier' && typeof ToolState !== 'undefined' && ToolState.bezierType === 'cubic') {
        if (typeof handleToolMouseUp === 'function') handleToolMouseUp('bezier');
        drawEverything();
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
        dimForceOrtho = !dimForceOrtho;
        updateDimBtnUI();
        if (mode === 'dimension') drawEverything();
    }
});

dynInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        let val = dynInput.value.trim();

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

function printCanvas() {
    let paperDim = getPaperWorldDimensions();
    if (!paperDim) { alert("Izaberite format papira iz menija pre printanja!"); return; }
    isPrinting = true; selectedElements = []; hideDynamicInput(); hidePropsMenu();
    const oldScale = scale, oldPanX = panX, oldPanY = panY, oldW = canvas.width, oldH = canvas.height;
    canvas.width = 1600; canvas.height = 1600 * (paperDim.h / paperDim.w);
    scale = canvas.width / paperDim.w; panX = 0; panY = canvas.height; 
    drawEverything();
    window.print();
    isPrinting = false; canvas.width = oldW; canvas.height = oldH; scale = oldScale; panX = oldPanX; panY = oldPanY;
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

    let scaleX = availW / paperDim.w;
    let scaleY = availH / paperDim.h;
    scale = Math.min(scaleX, scaleY);
    scale = Math.max(0.01, Math.min(scale, 50));

    let screenCx = visibleXMin + availW / 2;
    let screenCy = visibleYMin + availH / 2;

    let worldCx = paperDim.w / 2;
    let worldCy = paperDim.h / 2;

    panX = screenCx - worldCx * scale;
    panY = screenCy + worldCy * scale;
}

window.addEventListener('load', updateSidebarPosition);
window.addEventListener('resize', updateSidebarPosition);

window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') { e.preventDefault(); toggleSnap(); }
    if (e.key === 'F3') { e.preventDefault(); toggleOsnap(); }
    if (e.key === 'F4') { e.preventDefault(); toggleOrtho(); }
    if (e.key === 'Delete') deleteSelected();
    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); }
    
    if (document.activeElement !== dynInput && document.activeElement.tagName !== 'INPUT') {
        if (e.key === 'l' || e.key === 'L') setMode('line');
        if (e.key === 'd' || e.key === 'D') setMode('dimension');
        if (e.key === 's' || e.key === 'S') setMode('select');
        if (e.key === 'm' || e.key === 'M') setMode('move');
        if (e.key === 'r' || e.key === 'R') setMode('rotate');
        if (e.key === 'x' || e.key === 'X') setMode('scale');
        if (e.key === 'Escape') { if(activeGrip) cancelGripMove(); else { resetDrawingState(); selectedElements = []; } hidePropsMenu(); drawEverything(); }
    }
});