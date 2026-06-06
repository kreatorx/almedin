const canvas = document.getElementById('cadCanvas');
        const ctx = canvas.getContext('2d');
        const infoPanel = document.getElementById('info-panel');
        const dynContainer = document.getElementById('dynamic-input-container');
        const dynInput = document.getElementById('dynamic-input');

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

        let mode = 'select'; 
        let elements = []; 
        let isDrawing = false;
        let snapEnabled = false;   
        let osnapEnabled = true;   
        let orthoEnabled = true;   
        let isPrinting = false; 
        
        let startPoint = { x: 0, y: 0 }; 
        let currentPoint = { x: 0, y: 0 }; 
        let orthoCorrectedWorldPos = { x: 0, y: 0 }; 
        
        let dimStep = 0, dimP1 = null, dimP2 = null;

        let selectedElements = []; 
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

        window.addEventListener('contextmenu', e => e.preventDefault());

        function updatePaperStyle() {
            let paperKey = document.getElementById('paper-select').value;
            if (PAPERS[paperKey]) {
                styleTag.innerHTML = `@media print { @page { size: ${PAPERS[paperKey].css}; margin: 5mm 5mm 5mm 20mm; } }`;
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
            if (newMode !== 'select') selectedElements = [];
            ['btn-select', 'btn-line', 'btn-dimension'].forEach(id => document.getElementById(id).classList.remove('active'));
            let btn = document.getElementById(`btn-${newMode}`); if(btn) btn.classList.add('active');
            drawEverything();
        }

        function toggleSnap() { snapEnabled = !snapEnabled; document.getElementById('btn-snap').classList.toggle('active', snapEnabled); drawEverything(); }
        function toggleOsnap() { osnapEnabled = !osnapEnabled; document.getElementById('btn-osnap').classList.toggle('active', osnapEnabled); drawEverything(); }
        function toggleOrtho() { orthoEnabled = !orthoEnabled; document.getElementById('btn-ortho').classList.toggle('active', orthoEnabled); drawEverything(); }
        
        function undo() {
            if (elements.length > 0) {
                elements.pop(); selectedElements = []; resetDrawingState(); drawEverything();
            }
        }

        function clearAll() { if(confirm("Obrisati kompletan crtež?")) { elements = []; selectedElements = []; resetDrawingState(); drawEverything(); } }
        function resetDrawingState() { isDrawing = false; dimStep = 0; dimP1 = null; dimP2 = null; isBoxSelecting = false; if(activeGrip) cancelGripMove(); hideDynamicInput(); }
        
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
            let paperKey = document.getElementById('paper-select').value;
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
                        let pointsToCheck = [el.p1, el.p2];
                        if(el.type === 'line') pointsToCheck.push({ x: (el.p1.x+el.p2.x)/2, y: (el.p1.y+el.p2.y)/2 });
                        pointsToCheck.forEach(pt => {
                            let d = Math.hypot(world.x - pt.x, world.y - pt.y);
                            if (d < bestDist) { bestDist = d; osnapTarget = { ...pt }; }
                        });
                    });
                }

                if (osnapTarget) { orthoCorrectedWorldPos = { ...osnapTarget }; return { ...osnapTarget }; }
            }

            if (orthoEnabled && (isDrawing || activeGrip)) {
                let base = { x: 0, y: 0 };
                if (mode === 'line' && isDrawing) base = startPoint;
                else if (mode === 'select' && activeGrip && selectedElements[0]) {
                    if (activeGrip === 'p1') base = selectedElements[0].p2;
                    else if (activeGrip === 'p2') base = selectedElements[0].p1;
                    else if (activeGrip === 'center') base = originalGripState.center;
                }
                let dx = world.x - base.x; let dy = world.y - base.y;
                if (Math.abs(dx) > Math.abs(dy)) { orthoCorrectedWorldPos = { x: world.x, y: base.y }; return { x: world.x, y: base.y }; } 
                else { orthoCorrectedWorldPos = { x: base.x, y: world.y }; return { x: base.x, y: world.y }; }
            }

            let finalPos = snapEnabled ? { x: Math.round(world.x / gridSize) * gridSize, y: Math.round(world.y / gridSize) * gridSize } : world;
            orthoCorrectedWorldPos = { ...finalPos };
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
            }

            elements.forEach(el => {
                let isSel = selectedElements.includes(el);
                let color = isPrinting ? '#000000' : (isSel ? '#ff3333' : '#ffffff');
                let thickness = isPrinting ? (2.5 / scale) : ((isSel ? 3 : 2) / scale);
                if (el.type === 'line') drawLine(el.p1, el.p2, color, thickness);
                if (el.type === 'dimension') drawAutoCADDimension(el.p1, el.p2, el.offset, false, isSel);
            });

            if (!isPrinting) {
                if (mode === 'line' && isDrawing) drawLine(startPoint, currentPoint, '#007acc', 2 / scale);
                else if (mode === 'dimension') {
                    if (dimStep === 1) drawLine(dimP1, mouseWorldPos, 'rgba(0, 229, 255, 0.4)', 1 / scale);
                    else if (dimStep === 2) drawAutoCADDimension(dimP1, dimP2, calculateLiveOffset(dimP1, dimP2, mouseWorldPos), true);
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
            for (let x = startX; x <= endX; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, start.y); ctx.lineTo(x, end.y); strokeGridLine(x, start.y, x, end.y); }
            for (let y = startY; y <= endY; y += gridSize) { ctx.beginPath(); ctx.moveTo(start.x, y); ctx.lineTo(end.x, y); strokeGridLine(start.x, y, end.x, y); }
        }
        function strokeGridLine(x1,y1,x2,y2) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }

        document.getElementById('toolbar').addEventListener('mousedown', (e) => {
            if (isDrawing || activeGrip) {
                e.preventDefault(); 
                setTimeout(() => dynInput.focus(), 5); 
            }
        });

        function drawUCS() {
            ctx.lineWidth = 2 / scale;
            ctx.strokeStyle = '#ff3333'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(40 / scale, 0); ctx.stroke();
            ctx.strokeStyle = '#33ff33'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 40 / scale); ctx.stroke();
        }

        function drawLine(p1, p2, color, width) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }

        function drawGrips(el) {
            ctx.fillStyle = activeGrip ? '#ff3333' : '#0055ff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
            let pts = [worldToScreen(el.p1.x, el.p1.y), worldToScreen(el.p2.x, el.p2.y)];
            if(el.type === 'line') pts.push(worldToScreen((el.p1.x + el.p2.x) / 2, (el.p1.y + el.p2.y) / 2));
            pts.forEach(pt => { ctx.fillRect(pt.x - gripRadius, pt.y - gripRadius, gripRadius * 2, gripRadius * 2); ctx.strokeRect(pt.x - gripRadius, pt.y - gripRadius, gripRadius * 2, gripRadius * 2); });
        }

        function drawCadCursor(x, y) {
            const size = 8; const crossSize = 20;
            ctx.strokeStyle = isPanning ? '#ff00ff' : (osnapTarget ? '#00ff00' : (snapEnabled ? '#00ff00' : '#ffea00')); ctx.lineWidth = 1;
            ctx.strokeRect(x - size/2, y - size/2, size, size);
            ctx.beginPath(); ctx.moveTo(x - crossSize, y); ctx.lineTo(x + crossSize, y); ctx.moveTo(x, y - crossSize); ctx.lineTo(x, y + crossSize); ctx.stroke();
        }

        function showDynamicInput(x, y) { dynContainer.style.display = 'block'; dynContainer.style.left = (x + 15) + 'px'; dynContainer.style.top = (y + 15) + 'px'; }
        function hideDynamicInput() { dynContainer.style.display = 'none'; dynInput.value = ''; canvas.focus(); }
        function calculateLiveOffset(p1, p2, mousePos) { let dx = p2.x - p1.x; let dy = p2.y - p1.y; let len = Math.sqrt(dx * dx + dy * dy); if (len < 1) return 0; return (mousePos.x - p1.x) * (-dy / len) + (mousePos.y - p1.y) * (dx / len); }

        // --- DRASTIČNO MODIFIKOVANA I POPRAVLJENA ROTACIJA TEKSTA KOTE ---
        function drawAutoCADDimension(p1, p2, offset, isPreview = false, isSelected = false) {
            let dx = p2.x - p1.x; let dy = p2.y - p1.y;
            let distance = Math.sqrt(dx * dx + dy * dy); if (distance < 1) return;
            let nx = -dy / distance; let ny = dx / distance;
            let dimLineP1 = { x: p1.x + nx * offset, y: p1.y + ny * offset };
            let dimLineP2 = { x: p2.x + nx * offset, y: p2.y + ny * offset };

            let mainColor = isPrinting ? '#000000' : (isSelected ? '#ff3333' : (isPreview ? '#ffaa00' : '#00e5ff'));
            let thickness = 1.5 / scale;

            ctx.strokeStyle = isPrinting ? 'rgba(0,0,0,0.3)' : 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 0.5 / scale;
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(dimLineP1.x, dimLineP1.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(p2.x, p2.y); ctx.lineTo(dimLineP2.x, dimLineP2.y); ctx.stroke();

            drawLine(dimLineP1, dimLineP2, mainColor, thickness);
            drawCadTick(dimLineP1, Math.atan2(dy, dx), mainColor);
            drawCadTick(dimLineP2, Math.atan2(dy, dx), mainColor);
            
            let mx = (dimLineP1.x + dimLineP2.x) / 2; let my = (dimLineP1.y + dimLineP2.y) / 2;
            
            let fontSize = isPrinting ? (14 / scale) : (12 / scale);
            ctx.fillStyle = mainColor; ctx.font = `bold ${fontSize}px Arial`; ctx.textAlign = 'center';
            
            ctx.save(); 
            ctx.translate(mx, my); 
            
            // KLJUČNA ISPRAVKA: Radimo zrcaljenje teksta po Y osi sa [1, -1] da bi neutralisali globalni CAD flip.
            // Zbog ovoga tekst više nikada neće biti okrenut naopačke ili zrcalno!
            ctx.scale(1, -1); 
            
            // Izračunavamo ugao u standardnom matematičkom smjeru
            let angle = -Math.atan2(dy, dx); 
            if (angle > Math.PI/2) angle -= Math.PI;
            if (angle < -Math.PI/2) angle += Math.PI;
            ctx.rotate(angle);
            
            let selectedScale = parseFloat(document.getElementById('scale-select').value);
            let txt = (distance / selectedScale).toFixed(1) + " " + document.getElementById('unit-select').value;
            
            // Odmak je sada uvek tačno 8px direktno IZNAD linije kote
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
            let p1Scr = worldToScreen(el.p1.x, el.p1.y); let p2Scr = worldToScreen(el.p2.x, el.p2.y);
            if (Math.hypot(scrX - p1Scr.x, scrY - p1Scr.y) < gripRadius + 6) return 'p1';
            if (Math.hypot(scrX - p2Scr.x, scrY - p2Scr.y) < gripRadius + 6) return 'p2';
            if (el.type === 'line') {
                let midScr = worldToScreen((el.p1.x + el.p2.x) / 2, (el.p1.y + el.p2.y) / 2);
                if (Math.hypot(scrX - midScr.x, scrY - midScr.y) < gripRadius + 6) return 'center';
            }
            return null;
        }

        function cancelGripMove() { if (selectedElements[0] && originalGripState) { selectedElements[0].p1 = { ...originalGripState.p1 }; selectedElements[0].p2 = { ...originalGripState.p2 }; } activeGrip = null; originalGripState = null; hideDynamicInput(); }

        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1) { e.preventDefault(); isPanning = true; startPanX = e.clientX - panX; startPanY = e.clientY - panY; return; }
            if (e.button === 2) { e.preventDefault(); if (activeGrip) cancelGripMove(); else resetDrawingState(); drawEverything(); return; }

            let pos = getWorldMousePos(e);

            if (mode === 'select') {
                if (activeGrip) { activeGrip = null; originalGripState = null; hideDynamicInput(); } 
                else {
                    let grip = checkGripClick(e.clientX, e.clientY);
                    if (grip) {
                        activeGrip = grip;
                        originalGripState = { p1: { ...selectedElements[0].p1 }, p2: { ...selectedElements[0].p2 }, center: { x: (selectedElements[0].p1.x + selectedElements[0].p2.x)/2, y: (selectedElements[0].p1.y + selectedElements[0].p2.y)/2 } };
                        startPoint = { ...pos }; 
                        showDynamicInput(e.clientX, e.clientY); 
                        setTimeout(() => dynInput.focus(), 10);
                    } else {
                        let threshold = 10 / scale; let clickedEl = null;
                        for (let el of elements) {
                            let hit = false;
                            if (el.type === 'line') hit = distToSegment(pos, el.p1, el.p2) < threshold;
                            if (el.type === 'dimension') {
                                let hitOrigin = distToSegment(pos, el.p1, el.p2) < threshold;
                                let len = Math.hypot(el.p2.x - el.p1.x, el.p2.y - el.p1.y);
                                let nx = -(el.p2.y - el.p1.y) / len; let ny = (el.p2.x - el.p1.x) / len;
                                let dimLineP1 = { x: el.p1.x + nx * el.offset, y: el.p1.y + ny * el.offset };
                                let dimLineP2 = { x: el.p2.x + nx * el.offset, y: el.p2.y + ny * el.offset };
                                hit = hitOrigin || (distToSegment(pos, dimLineP1, dimLineP2) < threshold);
                            }
                            if (hit) { clickedEl = el; break; }
                        }
                        if (clickedEl) { selectedElements = [clickedEl]; } else { isBoxSelecting = true; boxStartWorld = { ...rawMouseWorldPos }; }
                    }
                }
            }
            else if (mode === 'line') {
                if (!isDrawing) { 
                    isDrawing = true; startPoint = { ...pos }; currentPoint = { ...startPoint }; 
                    showDynamicInput(e.clientX, e.clientY); 
                    setTimeout(() => dynInput.focus(), 10); 
                } 
                else {
                    if (startPoint.x !== pos.x || startPoint.y !== pos.y) { elements.push({ type: 'line', p1: { ...startPoint }, p2: { ...pos } }); }
                    startPoint = { ...pos }; dynInput.value = '';
                    setTimeout(() => dynInput.focus(), 10);
                }
            } 
            else if (mode === 'dimension') {
                if (dimStep === 0) { dimP1 = { ...pos }; dimStep = 1; }
                else if (dimStep === 1) { dimP2 = { ...pos }; if (dimP1.x !== dimP2.x || dimP1.y !== dimP2.y) { dimStep = 2; showDynamicInput(e.clientX, e.clientY); setTimeout(() => dynInput.focus(), 10); } }
                else if (dimStep === 2) {
                    elements.push({ type: 'dimension', p1: { ...dimP1 }, p2: { ...dimP2 }, offset: calculateLiveOffset(dimP1, dimP2, pos) });
                    dimStep = 0; dimP1 = null; dimP2 = null; hideDynamicInput();
                }
            }
            drawEverything();
        });

        canvas.addEventListener('mousemove', (e) => {
            if (isPanning) { panX = e.clientX - startPanX; panY = e.clientY - startPanY; mouseScreenPos = { x: e.clientX, y: e.clientY }; drawEverything(); return; }
            if (isPrinting) return; 

            mouseWorldPos = getWorldMousePos(e);

            if (mode === 'select' && activeGrip && selectedElements[0]) {
                let el = selectedElements[0];
                if (activeGrip === 'p1') el.p1 = { ...mouseWorldPos };
                if (activeGrip === 'p2') el.p2 = { ...mouseWorldPos };
                if (activeGrip === 'center' && el.type === 'line') {
                    let dx = mouseWorldPos.x - startPoint.x; let dy = mouseWorldPos.y - startPoint.y;
                    el.p1.x += dx; el.p1.y += dy; el.p2.x += dx; el.p2.y += dy; startPoint = { ...mouseWorldPos };
                }
                showDynamicInput(e.clientX, e.clientY);
            }
            if (isDrawing && mode === 'line') { currentPoint = { ...mouseWorldPos }; showDynamicInput(e.clientX, e.clientY); }
            if (mode === 'dimension' && dimStep === 2) showDynamicInput(e.clientX, e.clientY);
            drawEverything();
        });

        canvas.addEventListener('mouseup', (e) => {
            if (e.button === 1) isPanning = false;
            if (mode === 'select' && isBoxSelecting) {
                isBoxSelecting = false;
                let xMin = Math.min(boxStartWorld.x, rawMouseWorldPos.x), xMax = Math.max(boxStartWorld.x, rawMouseWorldPos.x);
                let yMin = Math.min(boxStartWorld.y, rawMouseWorldPos.y), yMax = Math.max(boxStartWorld.y, rawMouseWorldPos.y);
                selectedElements = [];
                elements.forEach(el => { if (el.p1.x >= xMin && el.p1.x <= xMax && el.p1.y >= yMin && el.p1.y <= yMax && el.p2.x >= xMin && el.p2.x <= xMax && el.p2.y >= yMin && el.p2.y <= yMax) selectedElements.push(el); });
                drawEverything();
            }
        });

        dynInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                let val = dynInput.value.trim(); if (!val) return;
                if (val.includes(',')) {
                    let isRelative = val.startsWith('@'); let cleanVal = isRelative ? val.substring(1) : val;
                    let parts = cleanVal.split(','); let targetX = parseFloat(parts[0]), targetY = parseFloat(parts[1]);
                    if (isNaN(targetX) || isNaN(targetY)) return;
                    let finalWorldX = targetX, finalWorldY = targetY;
                    if (isRelative) { let basePoint = (mode === 'line') ? startPoint : (activeGrip ? startPoint : { x: 0, y: 0 }); finalWorldX = basePoint.x + targetX; finalWorldY = basePoint.y + targetY; }

                    if (mode === 'line' && isDrawing) { elements.push({ type: 'line', p1: { ...startPoint }, p2: { x: finalWorldX, y: finalWorldY } }); startPoint = { x: finalWorldX, y: finalWorldY }; currentPoint = { ...startPoint }; } 
                    else if (mode === 'select' && activeGrip && selectedElements[0]) {
                        let el = selectedElements[0]; if (activeGrip === 'p1') el.p1 = { x: finalWorldX, y: finalWorldY }; if (activeGrip === 'p2') el.p2 = { x: finalWorldX, y: finalWorldY };
                        activeGrip = null; originalGripState = null; hideDynamicInput();
                    }
                } else {
                    let length = parseFloat(val); if (isNaN(length) || length <= 0) return;
                    if (mode === 'line' && isDrawing) {
                        let angle = Math.atan2(orthoCorrectedWorldPos.y - startPoint.y, orthoCorrectedWorldPos.x - startPoint.x);
                        let finalPoint = { x: startPoint.x + Math.cos(angle) * length, y: startPoint.y + Math.sin(angle) * length };
                        elements.push({ type: 'line', p1: { ...startPoint }, p2: finalPoint }); startPoint = finalPoint; currentPoint = finalPoint;
                    } else if (mode === 'dimension' && dimStep === 2) {
                        let currentOffset = calculateLiveOffset(dimP1, dimP2, mouseWorldPos);
                        elements.push({ type: 'dimension', p1: { ...dimP1 }, p2: { ...dimP2 }, offset: length * (currentOffset >= 0 ? 1 : -1) });
                        dimStep = 0; dimP1 = null; dimP2 = null; hideDynamicInput();
                    }
                }
                dynInput.value = ''; 
                drawEverything();
                if (mode === 'line' && isDrawing) setTimeout(() => dynInput.focus(), 10);
            }
            if (e.key === 'Escape') { if(activeGrip) cancelGripMove(); else resetDrawingState(); drawEverything(); }
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault(); let mouseWorldBefore = screenToWorld(e.clientX, e.clientY);
            if (e.deltaY < 0) scale *= 1.1; else scale /= 1.1; scale = Math.max(0.05, Math.min(scale, 30));
            panX = e.clientX - mouseWorldBefore.x * scale; panY = e.clientY + mouseWorldBefore.y * scale;
            if (!isPrinting) {
                mouseWorldPos = getWorldMousePos(e); 
                if (isDrawing && mode === 'line') currentPoint = { ...mouseWorldPos };
            }
            drawEverything();
        }, { passive: false });

        function deleteSelected() { if (selectedElements.length > 0) { elements = elements.filter(el => !selectedElements.includes(el)); selectedElements = []; resetDrawingState(); drawEverything(); } }

        function printCanvas() {
            let paperDim = getPaperWorldDimensions();
            if (!paperDim) { alert("Izaberite format papira iz menija pre printanja!"); return; }
            isPrinting = true; selectedElements = []; hideDynamicInput(); 
            const oldScale = scale, oldPanX = panX, oldPanY = panY, oldW = canvas.width, oldH = canvas.height;
            canvas.width = 1600; canvas.height = 1600 * (paperDim.h / paperDim.w);
            scale = canvas.width / paperDim.w; panX = 0; panY = canvas.height; 
            drawEverything();
            window.print();
            isPrinting = false; canvas.width = oldW; canvas.height = oldH; scale = oldScale; panX = oldPanX; panY = oldPanY;
            drawEverything(); canvas.focus();
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'F2') { e.preventDefault(); toggleSnap(); }
            if (e.key === 'F3') { e.preventDefault(); toggleOsnap(); }
            if (e.key === 'F4') { e.preventDefault(); toggleOrtho(); }
            if (e.key === 'Delete') deleteSelected();
            if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); }
            
            if (document.activeElement !== dynInput) {
                if (e.key === 'l' || e.key === 'L') setMode('line');
                if (e.key === 'd' || e.key === 'D') setMode('dimension');
                if (e.key === 's' || e.key === 'S') setMode('select');
                if (e.key === 'Escape') { if(activeGrip) cancelGripMove(); else { resetDrawingState(); selectedElements = []; } drawEverything(); }
            }
        });
