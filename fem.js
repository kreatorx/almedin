const canvas = document.getElementById('femCanvas');
const ctx = canvas.getContext('2d');
const E = 3e7, A = 0.18, I = 0.0054;
const SCALE = 50;
let currentZoom = 1.0; // Početni zoom faktor
const BASE_SCALE = 50;  // Tvoja osnovna skala
let panX = 0, panY = 0;
let diagScale = 1.0;

// Settings varijable
let showGrid = true;
let gridStep = 0.5;
let useSnap = true;
let snapStep = 0.5;

let nodes = [], elements = [], historyLog = [];
let mode = 'draw', currentView = 'model';
let isDrawing = false, startNode = null;
let selectedNode = null, selectedElement = null, selectedLoad = null;

let dragNode = null;
let isDraggingNode = false;
let dragStartPos = { x: 0, y: 0 };
let isPanning = false;
let lastPanPos = { x: 0, y: 0 };

function saveHistory() {
    let cleanElements = elements.map(e => ({ n1: e.n1, n2: e.n2, loads: e.loads ? JSON.parse(JSON.stringify(e.loads)) : [] }));
    let cleanNodes = nodes.map(n => ({ x: n.x, y: n.y, res: n.res, fx: n.fx, fy: n.fy, m: n.m }));
    historyLog.push(JSON.stringify({ nodes: cleanNodes, elements: cleanElements }));
    if (historyLog.length > 30) historyLog.shift();
}

function undo() {
    if (historyLog.length === 0) return;
    let state = JSON.parse(historyLog.pop());
    nodes = state.nodes; elements = state.elements;
    selectedNode = null; selectedElement = null; selectedLoad = null;
    closeModals();
    if (currentView !== 'model') runFEM(); else draw();
}

function toCanvas(mx, my) { return { x: panX + mx * (BASE_SCALE*currentZoom), y: panY - my * (BASE_SCALE*currentZoom) }; }
function toModel(cx, cy) { return { x: (cx - panX) / (BASE_SCALE * currentZoom), y: -(cy - panY) / (BASE_SCALE * currentZoom) }; }

function getSnapped(cx, cy) {
    let raw = toModel(cx, cy);
    let snapped = { x: raw.x, y: raw.y };
    if (useSnap && snapStep > 0) {
        snapped.x = Math.round(snapped.x / snapStep) * snapStep;
        snapped.y = Math.round(snapped.y / snapStep) * snapStep;
    }
    return { raw: raw, snapped: snapped, cSnap: toCanvas(snapped.x, snapped.y) };
}

function resize() {
    canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight;
    if (panX === 0) { panX = canvas.width / 2; panY = canvas.height - 150; }
    draw();
}
window.addEventListener('resize', resize); setTimeout(resize, 50);

// Kada korisnik završi kucanje i klikne van inputa
document.addEventListener('focusout', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Vraćamo viewport na normalu
        setTimeout(() => {
            window.scrollTo(0, 0); // Vraća skrol na početak
            document.querySelector('meta[name="viewport"]').setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        }, 300);
    }
});

function setMode(m) {
    mode = m; document.getElementById('btn-draw').className = m === 'draw' ? 'active' : '';
    document.getElementById('btn-select').className = m === 'select' ? 'active' : '';
    closeModals();
}
function changeView(val) { currentView = val; draw(); }

function clearAll() {
    saveHistory(); nodes = []; elements = []; closeModals();
    panX = canvas.width / 2; panY = canvas.height - 150;
    changeView('model'); document.getElementById('result-view').value = 'model';
}

function openSettings() {
    document.getElementById('settingsModal').style.display = 'block';
    document.getElementById('set-grid-vis').checked = showGrid;
    document.getElementById('set-grid-step').value = gridStep;
    document.getElementById('set-snap-vis').checked = useSnap;
    document.getElementById('set-snap-step').value = snapStep;
    closeModals(false);
}
function closeSettings() { document.getElementById('settingsModal').style.display = 'none'; }
function updateSettings() {
    showGrid = document.getElementById('set-grid-vis').checked;
    let gs = parseFloat(document.getElementById('set-grid-step').value);
    gridStep = (isNaN(gs) || gs <= 0) ? 0.1 : gs;
    useSnap = document.getElementById('set-snap-vis').checked;
    let ss = parseFloat(document.getElementById('set-snap-step').value);
    snapStep = (isNaN(ss) || ss <= 0) ? 0.1 : ss;
    draw();
}

canvas.addEventListener('contextmenu', e => e.preventDefault());

// SKALIRANJE DIJAGRAMA SCROLLOM (Točkić miša)
// SKALIRANJE MIŠEM (Scroll)
canvas.addEventListener('wheel', e => {
    e.preventDefault(); // Sprječava skrolanje cijele stranice

    // Zadržavanje fokusa ispod miša
    const r = canvas.getBoundingClientRect();
    let focusX = e.clientX - r.left;
    let focusY = e.clientY - r.top;

    // Dobijamo koordinate modela ispod miša za provjeru
    let posData = getSnapped(focusX, focusY);
    let hit = findHit(posData.raw.x, posData.raw.y);

    // Ako smo u modu dijagrama i miš je na elementu, skaliramo dijagram
    if (['N', 'V', 'M', 'def'].includes(currentView) && hit && hit.type === 'element') {
        if (e.deltaY > 0) {
            diagScale /= 1.1; // Smanjuje dijagram (skrol dole)
        } else {
            diagScale *= 1.1; // Povećava dijagram (skrol gore)
        }
    }
    // U suprotnom, radimo klasični zoom modela
    else {
        let oldZoom = currentZoom;
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        currentZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.2), 5.0);

        panX = focusX - (focusX - panX) * (currentZoom / oldZoom);
        panY = focusY - (focusY - panY) * (currentZoom / oldZoom);
    }

    draw();
}, { passive: false });

// PODRŠKA ZA MOBILNI PINCH-TO-ZOOM I PAN
let initialPinchDist = 0;
let pinchCenter = { x: 0, y: 0 };

canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
        // Zabilježi centar između dva prsta za Pinch-to-zoom
        pinchCenter.x = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        pinchCenter.y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        initialPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
    else if (e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        const pos = getCanvasCoords(touch.clientX, touch.clientY);
        lastPanPos = { x: pos.x, y: pos.y };
        handleStart(pos.x, pos.y);
    }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
        e.preventDefault();
        let dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);

        if (initialPinchDist > 0) {
            let oldZoom = currentZoom;
            let zoomFactor = dist / initialPinchDist;

            // Ažuriramo globalni zoom
            currentZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.2), 5.0);

            // Izračunaj koordinate centra prstiju unutar canvasa
            const r = canvas.getBoundingClientRect();
            let focusX = pinchCenter.x - r.left;
            let focusY = pinchCenter.y - r.top;

            // Matematika za fiksiranje crteža ispod prstiju
            panX = focusX - (focusX - panX) * (currentZoom / oldZoom);
            panY = focusY - (focusY - panY) * (currentZoom / oldZoom);

            initialPinchDist = dist;
            draw();
        }
    }
    else if (e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        const pos = getCanvasCoords(touch.clientX, touch.clientY);
        handleMove(pos.x, pos.y);
    }
}, { passive: false });

canvas.addEventListener('touchend', e => {
    const touch = e.changedTouches[0];
    const pos = getCanvasCoords(touch.clientX, touch.clientY);
    handleEnd( pos.x, pos.y );
}, { passive: false });

canvas.addEventListener('mousedown', e => {
    const pos = getCanvasCoords(e.clientX, e.clientY);
    if (e.button === 1 || e.button === 2) { e.preventDefault(); isPanning = true; lastPanPos = { x: pos.x, y: pos.y }; return; }
    handleStart(pos.x, pos.y);
});

canvas.addEventListener('mousemove', e => {
    const pos = getCanvasCoords(e.clientX, e.clientY);
    if (isPanning) { panX += (pos.x - lastPanPos.x); panY += (pos.y - lastPanPos.y); lastPanPos = { x: pos.x, y: pos.y }; draw(); return; }
    handleMove(pos.x, pos.y);
});

canvas.addEventListener('mouseup', e => {
    const pos = getCanvasCoords(e.clientX, e.clientY);
    handleEnd(pos.x, pos.y);
});

window.addEventListener('keydown', e => {
    // Reaguj na tastaturu samo ako smo u pregledu dijagrama (N, V, M)
    if (['N', 'V', 'M', 'def'].includes(currentView)) {
        if (e.key === '+' || e.key === '=' || e.key === 'NumpadAdd') {
            diagScale *= 1.1;
            draw();
        } else if (e.key === '-' || e.key === 'NumpadSubtract') {
            diagScale /= 1.1;
            draw();
        }
    }
});

function getCanvasCoords(cx, cy) { const r = canvas.getBoundingClientRect(); return { x: cx - r.left, y: cy - r.top }; }

function findHit(mx, my) {
    for (let n of nodes) { if (Math.hypot(n.x - mx, n.y - my) < 0.4) return { type: 'node', node: n }; }

    for (let el of elements) {
        if (!el.loads) continue;
        let n1 = nodes[el.n1], n2 = nodes[el.n2];
        let dx = n2.x - n1.x, dy = n2.y - n1.y, L = Math.hypot(dx, dy);
        if (L === 0) continue;
        let nx = -dy / L, ny = dx / L;

        for (let ld of el.loads) {
            if (ld.q === 0 && !ld.Fx && !ld.Fy && !ld.M) continue;
            let vx = mx - n1.x, vy = my - n1.y;
            let d_along = (vx * dx + vy * dy) / L;
            let d_normal = vx * nx + vy * ny;

            let isLoadHit = false;
            if (ld.q !== 0 && d_along >= (ld.x1 || 0) - 0.2 && d_along <= (L - (ld.x2 || 0)) + 0.2) {
                if (Math.abs(d_normal) > 0.2 && Math.abs(d_normal) < 0.9) isLoadHit = true;
            }
            if ((ld.Fx || ld.Fy || ld.M) && Math.abs(d_along - (ld.px || 0)) < 0.4) {
                if (Math.abs(d_normal) > 0.2 && Math.abs(d_normal) < 0.9) isLoadHit = true;
            }
            if (isLoadHit) return { type: 'load', element: el, load: ld };
        }
    }

    for (let el of elements) {
        let n1 = nodes[el.n1], n2 = nodes[el.n2];
        let l2 = Math.hypot(n1.x - n2.x, n1.y - n2.y) ** 2;
        if (l2 === 0) continue;
        let t = ((mx - n1.x) * (n2.x - n1.x) + (my - n1.y) * (n2.y - n1.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        if (Math.hypot(mx - (n1.x + t * (n2.x - n1.x)), my - (n1.y + t * (n2.y - n1.y))) < 0.25) return { type: 'element', element: el };
    }
    return null;
}

function handleStart(cx, cy) {
    const posData = getSnapped(cx, cy);
    closeModals();

    if (mode === 'draw') {
        const hit = findHit(posData.raw.x, posData.raw.y);
        if (hit && hit.type === 'node') { isDrawing = true; startNode = hit.node; }
        else {
            saveHistory();
            let nX = posData.snapped.x, nY = posData.snapped.y;
            if (nodes.length === 0) { panX = cx; panY = cy; nX = 0; nY = 0; }
            let newNode = { x: nX, y: nY, res: 'none', fx: 0, fy: 0, m: 0 };
            nodes.push(newNode);
            isDrawing = true; startNode = newNode; draw();
        }
    } else if (mode === 'select') {
        const hit = findHit(posData.raw.x, posData.raw.y);
        if (hit) {
            if (hit.type === 'node') {
                saveHistory();
                dragNode = hit.node;
                isDraggingNode = false;
                dragStartPos = { x: cx, y: cy };

                dragNode.connElems = elements.filter(el => nodes[el.n1] === dragNode || nodes[el.n2] === dragNode).map(el => {
                    let n1 = nodes[el.n1], n2 = nodes[el.n2];
                    let L_old = Math.hypot(n2.x - n1.x, n2.y - n1.y);
                    let loadsData = (el.loads || []).map(ld => ({
                        ld: ld,
                        r1: L_old > 0 ? (ld.x1 || 0) / L_old : 0,
                        r2: L_old > 0 ? (ld.x2 || 0) / L_old : 0,
                        rp: L_old > 0 ? (ld.px || 0) / L_old : 0
                    }));
                    return { element: el, loadsData: loadsData };
                });
                return;
            }
            if (hit.type === 'load') {
                selectedElement = hit.element; selectedLoad = hit.load;
                document.getElementById('load-modal-title').innerText = "Uredi Opterećenje";
                openElementModal(hit.element, hit.load, cx, cy); draw(); return;
            }
            if (hit.type === 'element') {
                saveHistory();
                selectedElement = hit.element;
                if (!selectedElement.loads) selectedElement.loads = [];
                let newLoad = { q: 0, x1: 0, x2: 0, type: 'gravity', Fx: 0, Fy: 0, M: 0, px: 0 };
                selectedElement.loads.push(newLoad); selectedLoad = newLoad;
                document.getElementById('load-modal-title').innerText = "Dodaj Opterećenje";
                openElementModal(selectedElement, newLoad, cx, cy); draw(); return;
            }
        }
        isPanning = true; lastPanPos = { x: cx, y: cy };
    }
}

function handleMove(cx, cy) {
    // 1. PANNING (Samo ako smo u select modu i nismo vukli čvor)
    if (isPanning) {
        panX += (cx - lastPanPos.x);
        panY += (cy - lastPanPos.y);
        lastPanPos = { x: cx, y: cy };
        draw();
        return;
    }
    const posData = getSnapped(cx, cy);
    if (isDrawing && startNode) {
        draw();
        const startC = toCanvas(startNode.x, startNode.y);
        ctx.beginPath(); ctx.moveTo(startC.x, startC.y); ctx.lineTo(posData.cSnap.x, posData.cSnap.y);
        ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);

        if (useSnap) {
            ctx.beginPath(); ctx.arc(posData.cSnap.x, posData.cSnap.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 255, 136, 0.5)'; ctx.fill();
        }
    } else if (mode === 'select' && dragNode) {
        if (Math.hypot(cx - dragStartPos.x, cy - dragStartPos.y) > 3) {
            isDraggingNode = true;
            dragNode.x = posData.snapped.x;
            dragNode.y = posData.snapped.y;

            if (dragNode.connElems) {
                dragNode.connElems.forEach(conn => {
                    let n1 = nodes[conn.element.n1], n2 = nodes[conn.element.n2];
                    let L_new = Math.hypot(n2.x - n1.x, n2.y - n1.y);
                    if (L_new > 0) {
                        conn.loadsData.forEach(data => {
                            if (data.ld.x1 !== undefined) data.ld.x1 = parseFloat((data.r1 * L_new).toFixed(2));
                            if (data.ld.x2 !== undefined) data.ld.x2 = parseFloat((data.r2 * L_new).toFixed(2));
                            if (data.ld.px !== undefined) data.ld.px = parseFloat((data.rp * L_new).toFixed(2));
                        });
                    }
                });
            }
            if (currentView !== 'model') runFEM(); else draw();
        }
    }
}

function handleEnd(cx, cy) {
    if (isPanning) { isPanning = false; return; }

    const posData = getSnapped(cx, cy);
    let target = useSnap ? posData.snapped : posData.raw;

    if (isDrawing && startNode) {
        const hit = findHit(posData.raw.x, posData.raw.y);
        const endNode = (hit && hit.type === 'node') ? hit.node : null;

        let dist = Math.hypot(posData.snapped.x - startNode.x, posData.snapped.y - startNode.y);

        if (dist < 0.05) {
            isDrawing = false;
            startNode = null;
            draw();
            return;
        }

        saveHistory();
        if (endNode && endNode !== startNode) {
            const exists = elements.some(el => (el.n1 === nodes.indexOf(startNode) && el.n2 === nodes.indexOf(endNode)) || (el.n1 === nodes.indexOf(endNode) && el.n2 === nodes.indexOf(startNode)));
            if (!exists) elements.push({ n1: nodes.indexOf(startNode), n2: nodes.indexOf(endNode), loads: [] });
        } else if (!endNode) {
            nodes.push({ x: target.x, y: target.y, res: 'none', fx: 0, fy: 0, m: 0 });
            elements.push({ n1: nodes.indexOf(startNode), n2: nodes.length - 1, loads: [] });
        }

        isDrawing = false;
        startNode = null;
    } else if (mode === 'select' && dragNode) {
        if (!isDraggingNode) { selectedNode = dragNode; openNodeModal(dragNode, dragStartPos.x, dragStartPos.y); }
        dragNode = null; isDraggingNode = false;
    }
    draw();
}

function positionModal(modal, cx, cy) {
    modal.style.display = 'block'; const rect = modal.getBoundingClientRect();
    let top = cy + 20, left = cx - rect.width / 2;
    if (top + rect.height > window.innerHeight - 10) top = cy - rect.height - 20;
    if (top < 10) top = 10;
    if (left < 10) left = 10; if (left + rect.width > window.innerWidth - 10) left = window.innerWidth - rect.width - 10;
    modal.style.top = top + 'px'; modal.style.left = left + 'px';
}

function openNodeModal(node, cx, cy) {
    setRestraint(node.res, false);
    document.getElementById('node-fx').value = node.fx; document.getElementById('node-fy').value = node.fy; document.getElementById('node-m').value = node.m;
    document.getElementById('node-x').value = node.x.toFixed(2); document.getElementById('node-y').value = node.y.toFixed(2);
    positionModal(document.getElementById('nodeModal'), cx, cy);
}

function setRestraint(type, apply = true) {
    const btns = document.getElementById('restraint-icons').children; const types = ['none', 'pinned', 'roller-x', 'fixed'];
    for (let i = 0; i < 4; i++) btns[i].className = (types[i] === type) ? 'icon-btn active' : 'icon-btn';

    if (selectedNode && apply) {
        saveHistory();
        selectedNode.res = type;
        draw();
        if (currentView !== 'model') runFEM();
    }
}

function saveNode() {
    if (!selectedNode) return;
    saveHistory();
    selectedNode.fx = parseFloat(document.getElementById('node-fx').value) || 0;
    selectedNode.fy = parseFloat(document.getElementById('node-fy').value) || 0;
    selectedNode.m = parseFloat(document.getElementById('node-m').value) || 0;
    let valX = parseFloat(document.getElementById('node-x').value); let valY = parseFloat(document.getElementById('node-y').value);
    if (!Number.isNaN(valX)) selectedNode.x = valX; if (!Number.isNaN(valY)) selectedNode.y = valY;
    closeModals(); draw(); if (currentView !== 'model') runFEM();
}

function deleteNode() {
    if (!selectedNode) return;
    saveHistory();
    const idx = nodes.indexOf(selectedNode);
    elements = elements.filter(el => el.n1 !== idx && el.n2 !== idx);
    elements.forEach(el => { if (el.n1 > idx) el.n1--; if (el.n2 > idx) el.n2--; });
    nodes.splice(idx, 1); closeModals(); draw(); if (currentView !== 'model') runFEM();
}

function toggleQType() {
    let btn = document.getElementById('btn-q-type');
    if (btn.innerText === '↓') { btn.innerText = '⊥'; if (selectedLoad) selectedLoad.type = 'normal'; }
    else { btn.innerText = '↓'; if (selectedLoad) selectedLoad.type = 'gravity'; }
    draw();
}

function openElementModal(elem, load, cx, cy) {
    document.getElementById('elem-q').value = load.q || 0;
    document.getElementById('elem-x1').value = load.x1 || 0;
    document.getElementById('elem-x2').value = load.x2 || 0;

    document.getElementById('elem-fx-load').value = load.Fx || 0;
    document.getElementById('elem-fy-load').value = load.Fy || 0;
    document.getElementById('elem-m-load').value = load.M || 0;
    document.getElementById('elem-px').value = load.px || 0;

    document.getElementById('btn-q-type').innerText = (load.type === 'normal') ? '⊥' : '↓';
    positionModal(document.getElementById('elementModal'), cx, cy);
}

function saveElementLoad() {
    if (!selectedElement || !selectedLoad) return;
    saveHistory();
    selectedLoad.q = parseFloat(document.getElementById('elem-q').value) || 0;
    selectedLoad.x1 = parseFloat(document.getElementById('elem-x1').value) || 0;
    selectedLoad.x2 = parseFloat(document.getElementById('elem-x2').value) || 0;

    selectedLoad.Fx = parseFloat(document.getElementById('elem-fx-load').value) || 0;
    selectedLoad.Fy = parseFloat(document.getElementById('elem-fy-load').value) || 0;
    selectedLoad.M = parseFloat(document.getElementById('elem-m-load').value) || 0;
    selectedLoad.px = parseFloat(document.getElementById('elem-px').value) || 0;

    if (selectedLoad.q === 0 && selectedLoad.Fx === 0 && selectedLoad.Fy === 0 && selectedLoad.M === 0) {
        selectedElement.loads = selectedElement.loads.filter(l => l !== selectedLoad);
    }
    closeModals(); draw(); if (currentView !== 'model') runFEM();
}

function deleteElementLoad() {
    if (selectedElement && selectedLoad) { saveHistory(); selectedElement.loads = selectedElement.loads.filter(l => l !== selectedLoad); }
    closeModals(); draw(); if (currentView !== 'model') runFEM();
}

function closeModals(hideSettings = true) {
    document.getElementById('nodeModal').style.display = 'none'; document.getElementById('elementModal').style.display = 'none';
    if (hideSettings) document.getElementById('settingsModal').style.display = 'none';
    if (selectedElement && selectedLoad && selectedLoad.q === 0 && !selectedLoad.Fx && !selectedLoad.Fy && !selectedLoad.M) {
        selectedElement.loads = selectedElement.loads.filter(l => l !== selectedLoad);
    }
    selectedNode = null; selectedElement = null; selectedLoad = null; draw();
}

/* --- FEM ENGINE ( ANALITIČKA INTEGRACIJA ) --- */
function runFEM() {
    if (nodes.length < 2 || elements.length < 1) return;
    const Ndof = nodes.length * 3;
    let K = Array(Ndof).fill(0).map(() => Array(Ndof).fill(0)); let F = Array(Ndof).fill(0);

    nodes.forEach((n, i) => { F[i * 3] = n.fx || 0; F[i * 3 + 1] = -(n.fy || 0); F[i * 3 + 2] = n.m || 0; n.R = [0, 0, 0]; });

    elements.forEach(el => {
        const n1 = nodes[el.n1], n2 = nodes[el.n2];
        const dx = n2.x - n1.x, dy = n2.y - n1.y, L = Math.hypot(dx, dy);
        if (L === 0) return; const c = dx / L, s = dy / L;
        const T = [[c, s, 0, 0, 0, 0], [-s, c, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 0, c, s, 0], [0, 0, 0, -s, c, 0], [0, 0, 0, 0, 0, 1]];
        const klok = Array(6).fill(0).map(() => Array(6).fill(0));
        klok[0][0] = E * A / L; klok[0][3] = -E * A / L;
        klok[1][1] = 12 * E * I / (L * L * L); klok[1][2] = 6 * E * I / (L * L); klok[1][4] = -12 * E * I / (L * L * L); klok[1][5] = 6 * E * I / (L * L);
        klok[2][1] = 6 * E * I / (L * L); klok[2][2] = 4 * E * I / L; klok[2][4] = -6 * E * I / (L * L); klok[2][5] = 2 * E * I / L;
        klok[3][0] = -E * A / L; klok[3][3] = E * A / L;
        klok[4][1] = -12 * E * I / (L * L * L); klok[4][2] = -6 * E * I / (L * L); klok[4][4] = 12 * E * I / (L * L * L); klok[4][5] = -6 * E * I / (L * L);
        klok[5][1] = 6 * E * I / (L * L); klok[5][2] = 2 * E * I / L; klok[5][4] = -6 * E * I / (L * L); klok[5][5] = 4 * E * I / L;

        let fe_lok = [0, 0, 0, 0, 0, 0];
        if (el.loads) {
            el.loads.forEach(ld => {
                if (ld.q) {
                    let q_local_y = (ld.type === 'normal') ? -ld.q : -ld.q * c;
                    let q_local_x = (ld.type === 'normal') ? 0 : -ld.q * s;
                    let steps = 100, dx_step = L / steps;
                    for (let i = 0; i < steps; i++) {
                        let x = i * dx_step + dx_step / 2;
                        if (x >= ld.x1 && x <= L - ld.x2) {
                            let N1 = 1 - 3 * (x / L) ** 2 + 2 * (x / L) ** 3, N2 = x - 2 * (x ** 2) / L + (x ** 3) / (L ** 2);
                            let N3 = 3 * (x / L) ** 2 - 2 * (x / L) ** 3, N4 = -(x ** 2) / L + (x ** 3) / (L ** 2);
                            fe_lok[1] += q_local_y * N1 * dx_step; fe_lok[2] += q_local_y * N2 * dx_step;
                            fe_lok[4] += q_local_y * N3 * dx_step; fe_lok[5] += q_local_y * N4 * dx_step;
                            let Na1 = 1 - x / L, Na2 = x / L;
                            fe_lok[0] += q_local_x * Na1 * dx_step; fe_lok[3] += q_local_x * Na2 * dx_step;
                        }
                    }
                }

                if (ld.Fx || ld.Fy || ld.M) {
                    let xp = ld.px || 0;
                    if (xp >= 0 && xp <= L) {
                        let userFx = ld.Fx || 0; let userFy = -(ld.Fy || 0);
                        let Fx_loc = userFx * c + userFy * s; let Fy_loc = -userFx * s + userFy * c;
                        let Mm = ld.M || 0;
                        let xi = xp / L;
                        let N1 = 1 - 3 * xi * xi + 2 * xi * xi * xi, N2 = xp - 2 * xp * xi + xp * xi * xi;
                        let N3 = 3 * xi * xi - 2 * xi * xi * xi, N4 = -xp * xi + xp * xi * xi;
                        let dN1 = (-6 * xi + 6 * xi * xi) / L, dN2 = 1 - 4 * xi + 3 * xi * xi;
                        let dN3 = (6 * xi - 6 * xi * xi) / L, dN4 = -2 * xi + 3 * xi * xi;

                        fe_lok[0] += Fx_loc * (1 - xi); fe_lok[3] += Fx_loc * xi;
                        fe_lok[1] += Fy_loc * N1 + Mm * dN1; fe_lok[2] += Fy_loc * N2 + Mm * dN2;
                        fe_lok[4] += Fy_loc * N3 + Mm * dN3; fe_lok[5] += Fy_loc * N4 + Mm * dN4;
                    }
                }
            });
        }

        const Tt = T[0].map((_, i) => T.map(row => row[i]));
        const kglob = multiply(multiply(Tt, klok), T); const fe_glob = Array(6).fill(0);
        for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) fe_glob[i] += Tt[i][j] * fe_lok[j];
        const dofs = [el.n1 * 3, el.n1 * 3 + 1, el.n1 * 3 + 2, el.n2 * 3, el.n2 * 3 + 1, el.n2 * 3 + 2];
        for (let i = 0; i < 6; i++) { F[dofs[i]] += fe_glob[i]; for (let j = 0; j < 6; j++) K[dofs[i]][dofs[j]] += kglob[i][j]; }
        el.FEM_DATA = { L, T, klok, fe_lok, dofs };
    });

    const K_orig = K.map(row => [...row]); const F_orig = [...F];

    nodes.forEach((n, i) => {
        let rx = 0, ry = 0, rm = 0;
        if (n.res === 'fixed') rx = ry = rm = 1; else if (n.res === 'pinned') rx = ry = 1; else if (n.res === 'roller-x') ry = 1;
        if (rx) applyBnd(K, F, i * 3); if (ry) applyBnd(K, F, i * 3 + 1); if (rm) applyBnd(K, F, i * 3 + 2);
    });

    const U = gauss(K, F);
    if (!U) { if (!isDraggingNode) alert("Sistem je labilan!"); return; }
    nodes.forEach((n, i) => n.u = [U[i * 3], U[i * 3 + 1], U[i * 3 + 2]]);

    nodes.forEach((n, i) => {
        if (n.res !== 'none') {
            for (let j = 0; j < Ndof; j++) { n.R[0] += K_orig[i * 3][j] * U[j]; n.R[1] += K_orig[i * 3 + 1][j] * U[j]; n.R[2] += K_orig[i * 3 + 2][j] * U[j]; }
            n.R[0] -= F_orig[i * 3]; n.R[1] -= F_orig[i * 3 + 1]; n.R[2] -= F_orig[i * 3 + 2];
        }
    });

    elements.forEach(el => {
        const fd = el.FEM_DATA; const ug = fd.dofs.map(d => U[d]); const ul = Array(6).fill(0);
        for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) ul[i] += fd.T[i][j] * ug[j];
        const S_lok = Array(6).fill(0);
        for (let i = 0; i < 6; i++) { for (let j = 0; j < 6; j++) S_lok[i] += fd.klok[i][j] * ul[j]; S_lok[i] -= fd.fe_lok[i]; }

        let pts_N = [], pts_V = [], pts_M = [];
        let n_pts = 100;
        let dx_s = fd.L / n_pts;
        const c = fd.T[0][0], s = fd.T[0][1];

        // POTPUNA ANALITIČKA SUPERPOZICIJA ZA SVAKU TAČKU (UKLANJA ZUBE)
        for (let i = 0; i <= n_pts; i++) {
            let x = i * dx_s;
            let N_int = -S_lok[0];
            let V_int = S_lok[1];
            let M_int = -S_lok[2] + S_lok[1] * x; // Linearni dio od reznih sila na krajevima

            if (el.loads) {
                el.loads.forEach(ld => {
                    if (ld.q) {
                        let q_local_y = (ld.type === 'normal') ? -ld.q : -ld.q * c;
                        let q_local_x = (ld.type === 'normal') ? 0 : -ld.q * s;
                        let start_q = ld.x1 || 0;
                        let end_q = fd.L - (ld.x2 || 0);

                        if (x > start_q) {
                            let x_end = Math.min(x, end_q);
                            let x_loaded = x_end - start_q;
                            if (x_loaded > 0) {
                                let centroid = start_q + x_loaded / 2;
                                V_int += q_local_y * x_loaded;
                                M_int += q_local_y * x_loaded * (x - centroid);
                                N_int -= q_local_x * x_loaded;
                            }
                        }
                    }
                    let xp = ld.px || 0;
                    if (ld.Fx || ld.Fy || ld.M) {
                        let userFx = ld.Fx || 0; let userFy = -(ld.Fy || 0);
                        let Fx_loc = userFx * c + userFy * s; let Fy_loc = -userFx * s + userFy * c;
                        if (x > xp) {
                            N_int -= Fx_loc; V_int += Fy_loc; M_int += Fy_loc * (x - xp) - (ld.M || 0);
                        } else if (Math.abs(x - xp) < 1e-5) {
                            N_int -= Fx_loc; V_int += Fy_loc; M_int -= (ld.M || 0);
                        }
                    }
                });
            }
            pts_N.push(N_int); pts_V.push(V_int); pts_M.push(M_int);
        }
        el.DIAG = { N: pts_N, V: pts_V, M: pts_M };
    });

    if (currentView === 'model') { changeView('R'); document.getElementById('result-view').value = 'R'; }
    else draw();
}

function applyBnd(K, F, d) { for (let i = 0; i < K.length; i++) { K[d][i] = 0; K[i][d] = 0; } K[d][d] = 1; F[d] = 0; }
function multiply(A, B) { let C = Array(A.length).fill(0).map(() => Array(B[0].length).fill(0)); for (let i = 0; i < A.length; i++) for (let j = 0; j < B[0].length; j++) for (let k = 0; k < A[0].length; k++) C[i][j] += A[i][k] * B[k][j]; return C; }
function gauss(A, B) {
    let n = B.length;
    for (let i = 0; i < n; i++) {
        let maxEl = Math.abs(A[i][i]), maxRow = i;
        for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > maxEl) { maxEl = Math.abs(A[k][i]); maxRow = k; }
        if (maxEl < 1e-9) return null;
        for (let k = i; k < n; k++) { let tmp = A[maxRow][k]; A[maxRow][k] = A[i][k]; A[i][k] = tmp; }
        let tmp = B[maxRow]; B[maxRow] = B[i]; B[i] = tmp;
        for (let k = i + 1; k < n; k++) { let c = -A[k][i] / A[i][i]; for (let j = i; j < n; j++) A[k][j] += c * A[i][j]; B[k] += c * B[i]; }
    }
    let x = Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { x[i] = B[i] / A[i][i]; for (let k = i - 1; k >= 0; k--) B[k] -= A[k][i] * x[i]; }
    return x;
}

/* --- CRTANJE --- */
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let currentScale = BASE_SCALE * currentZoom; // Dinamička skala

    if (showGrid) {
        ctx.strokeStyle = '#22222a'; ctx.lineWidth = 1;
        let stepPx = gridStep * currentScale;
        let startX = panX % stepPx, startY = panY % stepPx;
        for (let x = startX; x < canvas.width; x += stepPx) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
        for (let y = startY; y < canvas.height; y += stepPx) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
        ctx.strokeStyle = '#333344'; ctx.lineWidth = 1.5;
        if (panX >= 0 && panX <= canvas.width) { ctx.beginPath(); ctx.moveTo(panX, 0); ctx.lineTo(panX, canvas.height); ctx.stroke(); }
        if (panY >= 0 && panY <= canvas.height) { ctx.beginPath(); ctx.moveTo(0, panY); ctx.lineTo(canvas.width, panY); ctx.stroke(); }
    }

    // --- CRTA SE KORISNIČKI MODEL ---
    elements.forEach(el => {
        let n1 = nodes[el.n1], n2 = nodes[el.n2];
        let c1 = toCanvas(n1.x, n1.y), c2 = toCanvas(n2.x, n2.y);
        let dx = c2.x - c1.x, dy = c2.y - c1.y, Lg = Math.hypot(dx, dy);
        if (Lg === 0) return; let nx = -dy / Lg, ny = dx / Lg;

        if (currentView === 'model' && el.loads) {
            let L_real = Math.hypot(n2.x - n1.x, n2.y - n1.y);
            el.loads.forEach(ld => {
                if (ld.q !== 0) {
                    let r1 = ld.x1 / L_real, r2 = (L_real - ld.x2) / L_real;
                    if (r1 < 0) r1 = 0; if (r2 > 1) r2 = 1;
                    let p1x = c1.x + dx * r1, p1y = c1.y + dy * r1, p2x = c1.x + dx * r2, p2y = c1.y + dy * r2;
                    let vecX = 0, vecY = 1;
                    if (ld.type === 'normal') { vecX = nx; vecY = ny; }
                    let h = 25, sign = ld.q > 0 ? 1 : -1;
                    if (ld.type === 'gravity' && ld.q < 0) sign = -1;

                    ctx.fillStyle = (selectedLoad === ld) ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 170, 0, 0.2)';
                    ctx.strokeStyle = (selectedLoad === ld) ? '#00ff88' : '#ffaa00';

                    ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y);
                    ctx.lineTo(p2x - vecX * h * sign, p2y - vecY * h * sign); ctx.lineTo(p1x - vecX * h * sign, p1y - vecY * h * sign);
                    ctx.closePath(); ctx.fill(); ctx.stroke();

                    let stepCount = Math.max(2, Math.floor((r2 - r1) * L_real * 2));
                    for (let i = 0; i <= stepCount; i++) {
                        let t = r1 + (r2 - r1) * (i / stepCount);
                        drawArrow(c1.x + dx * t - vecX * h * sign, c1.y + dy * t - vecY * h * sign, c1.x + dx * t, c1.y + dy * t, ctx.strokeStyle);
                    }
                    let t_mid = (r1 + r2) / 2;
                    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.setTimeout = 'center'; ctx.textAlign = 'center';
                    ctx.fillText(`${ld.q} kN/m`, c1.x + dx * t_mid - vecX * (h * sign + 10), c1.y + dy * t_mid - vecY * (h * sign + 10) + (sign > 0 ? -2 : 12));
                    ctx.textAlign = 'left';
                }

                let xp = ld.px || 0;
                if ((ld.Fx || ld.Fy || ld.M) && xp >= 0 && xp <= L_real) {
                    let ratio = xp / L_real;
                    let px = c1.x + dx * ratio, py = c1.y + dy * ratio;

                    if (ld.Fx) {
                        drawArrow(px - (ld.Fx > 0 ? 40 : -40), py, px, py, '#00ff88');
                        ctx.fillStyle = '#00ff88'; ctx.fillText(`${ld.Fx} kN`, px - (ld.Fx > 0 ? 45 : -15), py - 8);
                    }
                    if (ld.Fy) {
                        drawArrow(px, py - (ld.Fy > 0 ? 40 : -40), px, py, '#00ff88');
                        ctx.fillStyle = '#00ff88'; ctx.fillText(`${ld.Fy} kN`, px + 8, py - (ld.Fy > 0 ? 45 : -15));
                    }
                    if (ld.M) {
                        ctx.beginPath(); ctx.arc(px, py, 16, 0, Math.PI * 1.5 * (ld.M > 0 ? -1 : 1), ld.M > 0);
                        ctx.strokeStyle = '#00ff88'; ctx.stroke();
                        ctx.fillStyle = '#00ff88'; ctx.fillText(`${ld.M} kNm`, px + 18, py + 18);
                    }
                }
            });
        }
    });

    // --- SLOJ ZA DIJAGRAME (SADA GLATKI I PRECIZNI) ---
    elements.forEach(el => {
        if (el.DIAG && ['N', 'V', 'M'].includes(currentView)) {
            let n1 = nodes[el.n1], n2 = nodes[el.n2];
            let c1 = toCanvas(n1.x, n1.y), c2 = toCanvas(n2.x, n2.y);
            let dx = c2.x - c1.x, dy = c2.y - c1.y, Lg = Math.hypot(dx, dy);
            if (Lg === 0) return; let nx = -dy / Lg, ny = dx / Lg;

            let pts = el.DIAG[currentView];
            let V_pts = el.DIAG['V'];
            let n_pts = pts.length - 1;

            if (currentView === 'N') { ctx.strokeStyle = '#ff4a4a'; ctx.fillStyle = 'rgba(255,74,74,0.15)'; }
            if (currentView === 'V') { ctx.strokeStyle = '#00bfff'; ctx.fillStyle = 'rgba(0,191,255,0.15)'; }
            if (currentView === 'M') { ctx.strokeStyle = '#00ff88'; ctx.fillStyle = 'rgba(0,255,136,0.15)'; }

            // 1. Crtanje popunjene površine (baze dijagrama)
            ctx.beginPath();
            ctx.moveTo(c1.x, c1.y);
            for (let i = 0; i <= n_pts; i++) {
                let px = c1.x + dx * (i / n_pts), py = c1.y + dy * (i / n_pts);
                let val = pts[i] * 1.5 * diagScale;
                ctx.lineTo(px + nx * val, py + ny * val);
            }
            ctx.lineTo(c2.x, c2.y);
            ctx.closePath();
            ctx.fill();

            // 2. Crtanje krovne oštre linije omotača
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i <= n_pts; i++) {
                let px = c1.x + dx * (i / n_pts), py = c1.y + dy * (i / n_pts);
                let val = pts[i] * 1.5 * diagScale;
                if (i === 0) ctx.moveTo(px + nx * val, py + ny * val);
                else ctx.lineTo(px + nx * val, py + ny * val);
            }
            ctx.stroke();
            ctx.lineWidth = 1;

            // Ispis vrijednosti na čvorovima
            ctx.fillStyle = '#fff'; ctx.font = '11px Arial';
            let v1 = pts[0] * 1.5 * diagScale, v2 = pts[n_pts] * 1.5 * diagScale;
            ctx.fillText(pts[0].toFixed(1), c1.x + nx * (v1) + 5, c1.y + ny * (v1) + 5);
            ctx.fillText(pts[n_pts].toFixed(1), c2.x + nx * (v2) + 5, c2.y + ny * (v2) + 5);

            // 3. JAKE I VIDLJIVE VERTIKALNE ŽUTE LINIJE DISKONTINUITETA
            ctx.strokeStyle = 'rgba(255, 230, 0, 0.7)';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([4, 4]);

            if (el.loads) {
                el.loads.forEach(ld => {
                    let xs = [];
                    if (ld.q) { xs.push(ld.x1 || 0); xs.push(el.FEM_DATA.L - (ld.x2 || 0)); }
                    if (ld.Fx || ld.Fy || ld.M) { xs.push(ld.px || 0); }
                    xs.forEach(x_load => {
                        if (x_load > 0.05 && x_load < el.FEM_DATA.L - 0.05) {
                            let ratio = x_load / el.FEM_DATA.L;
                            let idx = Math.round(ratio * n_pts);
                            let ax = c1.x + dx * ratio, ay = c1.y + dy * ratio;
                            let mx = ax + nx * (pts[idx] * 1.5 * diagScale), my = ay + ny * (pts[idx] * 1.5 * diagScale);
                            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(mx, my); ctx.stroke();
                        }
                    });
                });
            }
            ctx.setLineDash([]); // Reset linije

            // Ekstremi za Momente (M)
            if (currentView === 'M') {
                for (let i = 1; i <= n_pts; i++) {
                    if ((V_pts[i - 1] * V_pts[i] < 0) || (V_pts[i] === 0 && V_pts[i - 1] !== 0)) {
                        let t = (V_pts[i - 1] * V_pts[i] < 0) ? Math.abs(V_pts[i - 1]) / (Math.abs(V_pts[i - 1]) + Math.abs(V_pts[i])) : 0;
                        let exact_idx = i - 1 + t;
                        let M_val = pts[i - 1] + t * (pts[i] - pts[i - 1]);

                        if (Math.abs(M_val) > 0.1) {
                            let mx = c1.x + dx * (exact_idx / n_pts) + nx * (M_val * 1.5 * diagScale);
                            let my = c1.y + dy * (exact_idx / n_pts) + ny * (M_val * 1.5 * diagScale);

                            ctx.beginPath(); ctx.moveTo(c1.x + dx * (exact_idx / n_pts), c1.y + dy * (exact_idx / n_pts)); ctx.lineTo(mx, my);
                            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();

                            ctx.fillStyle = '#00ff88'; ctx.font = 'bold 11px Arial';
                            ctx.fillText(`Mmax=${Math.abs(M_val).toFixed(2)}`, mx + 4, my + (M_val > 0 ? 12 : -4));
                        }
                    }
                }
            }
        }
    });

    // Greda (Konstruktivni elementi)
    // --- SKALIRANJE DEFORMACIJA ---
    // Računamo automatsku skalu tako da maksimalni ugib bude uvijek vidljiv (npr. 40 piksela na ekranu)
    let dispScale = 1;
    if (currentView === 'def') {
        let maxU = 1e-9;
        nodes.forEach(n => { if (n.u) maxU = Math.max(maxU, Math.hypot(n.u[0], n.u[1])); });
        let targetMeters = 40 / (BASE_SCALE * currentZoom); // Pretvaramo 40px u metrike modela
        dispScale = (targetMeters / maxU) * diagScale;
    }

    // Greda (Konstruktivni elementi)
    elements.forEach(el => {
        let n1 = nodes[el.n1], n2 = nodes[el.n2];
        let c1 = toCanvas(n1.x, n1.y), c2 = toCanvas(n2.x, n2.y);
        let dx = c2.x - c1.x, dy = c2.y - c1.y, Lg = Math.hypot(dx, dy);
        if (Lg === 0) return; let nx = -dy / Lg, ny = dx / Lg;

        // Crtanje osnovne (nedeformisane) linije
        ctx.beginPath(); ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y);
        if (currentView === 'def') {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; // Blijeda silueta originalnog štapa
            ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
        } else {
            ctx.strokeStyle = currentView === 'model' ? '#ffffff' : '#555566'; ctx.lineWidth = 4; ctx.stroke();
        }

        // Crtanje PRAVE krive linije ugiba
        if (currentView === 'def' && n1.u && n2.u && el.FEM_DATA) {
            let fd = el.FEM_DATA;
            let ug = [n1.u[0], n1.u[1], n1.u[2], n2.u[0], n2.u[1], n2.u[2]];
            let ul = Array(6).fill(0);
            for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) ul[i] += fd.T[i][j] * ug[j];

            ctx.beginPath();
            let steps = 20; // Dijelimo element na 20 segmenata za glatku krivu
            for (let i = 0; i <= steps; i++) {
                let xi = i / steps;
                let x = xi * fd.L;

                // Hermitovi polinomi za poprečno pomjeranje (savijanje)
                let N1 = 1 - 3 * xi * xi + 2 * xi * xi * xi, N2 = x - 2 * x * xi + x * xi * xi;
                let N3 = 3 * xi * xi - 2 * xi * xi * xi, N4 = -x * xi + x * xi * xi;
                let vy = ul[1] * N1 + ul[2] * N2 + ul[4] * N3 + ul[5] * N4;

                // Linearna interpolacija za uzdužno pomjeranje
                let vx = ul[0] * (1 - xi) + ul[3] * xi;

                // Transformacija nazad u globalni sistem
                let c = fd.T[0][0], s = fd.T[0][1];
                let dx_glob = vx * c - vy * s;
                let dy_glob = vx * s + vy * c;

                // Skaliranje pomjeranja dodato na stvarne koordinate modela
                let defModelX = (n1.x + (n2.x - n1.x) * xi) + dx_glob * dispScale;
                let defModelY = (n1.y + (n2.y - n1.y) * xi) + dy_glob * dispScale;
                let p = toCanvas(defModelX, defModelY);

                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            }
            ctx.strokeStyle = '#00ff88'; // Jarko zelena za deformisanu gredu
            ctx.lineWidth = 3; ctx.stroke();
        }

        if (currentView === 'model') {
            let L_real = Math.hypot(n2.x - n1.x, n2.y - n1.y);
            ctx.fillStyle = '#888'; ctx.font = '11px Arial'; ctx.textAlign = 'left';
            ctx.fillText(`L = ${L_real.toFixed(2)}m`, c1.x + dx / 2 + nx * 15, c1.y + dy / 2 + ny * 15);
        }
    });

    // Čvorovi i Oslonci
    nodes.forEach(n => {
        let c = toCanvas(n.x, n.y);

        // Crtanje deformisane pozicije čvora
        if (currentView === 'def' && n.u) {
            c = toCanvas(n.x + n.u[0] * dispScale, n.y + n.u[1] * dispScale);
        }

        ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = (n === selectedNode || n === dragNode) ? '#4a4ae7' : '#00ff88'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();

        // --- ISPIS DEFORMACIJA NA ČVORU ---
        if (currentView === 'def' && n.u) {
            ctx.fillStyle = '#ffffff'; // Bijela boja teksta
            ctx.font = '10px Arial';
            ctx.textAlign = 'left';

            // Pomoćna funkcija za lijepo formatiranje malih brojeva (prebacuje u naučni zapis ako je broj < 0.0001)
            let fmt = (val) => (Math.abs(val) > 0 && Math.abs(val) < 0.0001) ? val.toExponential(2) : val.toFixed(4);

            // Ispisujemo u, v, fi pomaknuto malo udesno od čvora
            ctx.fillText(`u: ${fmt(n.u[0])}`, c.x + 12, c.y - 12);
            ctx.fillText(`v: ${fmt(n.u[1])}`, c.x + 12, c.y);
            ctx.fillText(`fi: ${fmt(n.u[2])}`, c.x + 12, c.y + 12);
        }

        if (currentView === 'model' || currentView === 'R') {
            ctx.strokeStyle = '#ff0055'; ctx.lineWidth = 2;
            if (n.res === 'fixed') {
                ctx.beginPath(); ctx.moveTo(c.x - 10, c.y); ctx.lineTo(c.x + 10, c.y); ctx.stroke();
                for (let d = -10; d <= 10; d += 4) { ctx.beginPath(); ctx.moveTo(c.x + d, c.y); ctx.lineTo(c.x + d - 4, c.y + 6); ctx.stroke(); }
            } else if (n.res === 'pinned') {
                ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x - 8, c.y + 12); ctx.lineTo(c.x + 8, c.y + 12); ctx.closePath(); ctx.stroke();
            } else if (n.res === 'roller-x') {
                ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x - 8, c.y + 10); ctx.lineTo(c.x + 8, c.y + 10); ctx.closePath(); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(c.x - 8, c.y + 14); ctx.lineTo(c.x + 8, c.y + 14); ctx.stroke();
            }

            if (currentView === 'model') {
                if (n.fx !== 0) { drawArrow(c.x - (n.fx > 0 ? 40 : -40), c.y, c.x, c.y, '#ffaa00'); ctx.fillStyle = '#ffaa00'; ctx.fillText(`${n.fx} kN`, c.x - (n.fx > 0 ? 45 : -15), c.y - 8); }
                if (n.fy !== 0) { drawArrow(c.x, c.y - (n.fy > 0 ? 40 : -40), c.x, c.y, '#ffaa00'); ctx.fillStyle = '#ffaa00'; ctx.fillText(`${n.fy} kN`, c.x + 8, c.y - (n.fy > 0 ? 45 : -15)); }
                if (n.m !== 0) { ctx.beginPath(); ctx.arc(c.x, c.y, 16, 0, Math.PI * 1.5 * (n.m > 0 ? -1 : 1), n.m > 0); ctx.strokeStyle = '#ffaa00'; ctx.stroke(); }
            }

            if (currentView === 'R' && n.R) {
                let rx = n.R[0], ry = n.R[1], rm = n.R[2];
                if (Math.abs(rx) > 0.01) {
                    let fx = rx > 0 ? c.x - 40 : c.x + 40;
                    drawArrow(fx, c.y, c.x, c.y, '#da70d6');
                    ctx.fillStyle = '#da70d6'; ctx.font = 'bold 12px Arial';
                    ctx.fillText(`Rx: ${rx.toFixed(2)}`, fx - 10, c.y - 12);
                }
                if (Math.abs(ry) > 0.01) {
                    let fy = ry > 0 ? c.y + 40 : c.y - 40;
                    drawArrow(c.x, fy, c.x, c.y, '#da70d6');
                    ctx.fillStyle = '#da70d6'; ctx.font = 'bold 12px Arial';
                    ctx.fillText(`Ry: ${ry.toFixed(2)}`, c.x + 12, fy + (ry > 0 ? 15 : -5));
                }
                if (Math.abs(rm) > 0.01) {
                    ctx.beginPath(); ctx.arc(c.x, c.y, 22, 0, Math.PI * 1.5 * (rm > 0 ? -1 : 1), rm > 0);
                    ctx.strokeStyle = '#da70d6'; ctx.stroke();
                    ctx.fillText(`Mz: ${rm.toFixed(2)}`, c.x + 24, c.y + 24);
                }
            }
        }
    });
}
function drawArrow(fx, fy, tx, ty, c) { ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(tx, ty); ctx.stroke(); let a = Math.atan2(ty - fy, tx - fx); ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - 8 * Math.cos(a - Math.PI / 6), ty - 8 * Math.sin(a - Math.PI / 6)); ctx.lineTo(tx - 8 * Math.cos(a + Math.PI / 6), ty - 8 * Math.sin(a + Math.PI / 6)); ctx.fill(); }


async function generateAI() {
    const prompt = document.getElementById('ai-prompt').value;
    if (!prompt) { alert("Unesi tekst za AI generisanje!"); return; }

    const btn = document.getElementById('btn-ai');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Generišem...";
    btn.disabled = true;

    try {
        const response = await fetch('https://almedin.vercel.app/api/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) throw new Error("Serverska greška");

        const data = await response.json();

        if (data && data.nodes && data.elements) {
            saveHistory(); // Spašava prethodno stanje za Undo
            nodes = data.nodes;
            elements = data.elements;
            closeModals();

            // Automatsko centriranje vizure na novo-generisani model
            if (nodes.length > 0) {
                let maxX = Math.max(...nodes.map(n => n.x));
                panX = (canvas.width - maxX * currentScale) / 2;
                panY = canvas.height - 100; // Baza u dnu ekrana
            }

            changeView('model');
            document.getElementById('result-view').value = 'model';

            // Odmah preračunaj sistem
            runFEM();
        } else {
            alert("AI nije uspio da konstruiše validan sistem.");
        }
    } catch (e) {
        console.error("AI Greška: ", e);
        alert("Došlo je do greške prilikom generisanja. Provjeri konzolu.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}
