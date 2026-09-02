/**
 * tools.js - Napredni modul za geometrijske oblike, OSNAP tačke, Transformacije i Bezier krivulje
 * AutoKED by Almedin
 */

const ToolState = {
    step: 0,
    points: [],
    bezierType: 'cubic' // 'cubic' (Photoshop style) ili 'quadratic' (3-tačke)
};

let isDraggingHandle = false;
let activeBezierNode = null;

// Prekidač za Bezier mod
const bezierTypeBtn = document.createElement('button');
bezierTypeBtn.id = 'btn-bezier-type';
bezierTypeBtn.innerText = 'Bezijer: Kubna (sa rukohvatima)';
bezierTypeBtn.style.cssText = 'position: absolute; bottom: 20px; right: 200px; z-index: 1000; padding: 10px 15px; background: #007acc; color: white; border: 1px solid #0098ff; cursor: pointer; border-radius: 5px; display: none; box-shadow: 0 4px 6px rgba(0,0,0,0.3);';
document.body.appendChild(bezierTypeBtn);

bezierTypeBtn.onclick = () => {
    ToolState.bezierType = (ToolState.bezierType === 'cubic') ? 'quadratic' : 'cubic';
    bezierTypeBtn.innerText = (ToolState.bezierType === 'cubic') ? 'Bezijer: Kubna (sa rukohvatima)' : 'Bezijer: Kvadratna (3 tčke)';
    resetToolState();
    if (typeof drawEverything === 'function') drawEverything();
};

function resetToolState() {
    ToolState.step = 0;
    ToolState.points = [];
    isDraggingHandle = false;
    activeBezierNode = null;
}

/* ================= POMOĆNE MATEMATIČKE FUNKCIJE ================= */

function rotatePoint(pt, center, rad) {
    if (!pt) return;
    let dx = pt.x - center.x;
    let dy = pt.y - center.y;
    pt.x = center.x + (dx * Math.cos(rad) - dy * Math.sin(rad));
    pt.y = center.y + (dx * Math.sin(rad) + dy * Math.cos(rad));
}

function scalePoint(pt, center, factor) {
    if (!pt) return;
    pt.x = center.x + (pt.x - center.x) * factor;
    pt.y = center.y + (pt.y - center.y) * factor;
}

function moveElement(el, dx, dy) {
    if (el.pts) { el.pts.forEach(pt => { pt.x += dx; pt.y += dy; }); }
    if (el.p1) { el.p1.x += dx; el.p1.y += dy; }
    if (el.p2) { el.p2.x += dx; el.p2.y += dy; }
    if (el.cp) { el.cp.x += dx; el.cp.y += dy; }
    if (el.nodes) {
        el.nodes.forEach(n => {
            n.anchor.x += dx; n.anchor.y += dy;
            n.handleIn.x += dx; n.handleIn.y += dy;
            n.handleOut.x += dx; n.handleOut.y += dy;
        });
    }
}

function rotateElement(el, center, rad) {
    if (el.pts) { el.pts.forEach(pt => rotatePoint(pt, center, rad)); }
    if (el.p1) rotatePoint(el.p1, center, rad);
    if (el.p2) rotatePoint(el.p2, center, rad);
    if (el.cp) rotatePoint(el.cp, center, rad);
    if (el.nodes) {
        el.nodes.forEach(n => {
            rotatePoint(n.anchor, center, rad);
            rotatePoint(n.handleIn, center, rad);
            rotatePoint(n.handleOut, center, rad);
        });
    }
}

function scaleElement(el, center, factor) {
    if (el.pts) { el.pts.forEach(pt => scalePoint(pt, center, factor)); }
    if (el.p1) scalePoint(el.p1, center, factor);
    if (el.p2) scalePoint(el.p2, center, factor);
    if (el.cp) scalePoint(el.cp, center, factor);
    if (el.offset !== undefined) el.offset *= factor;
    if (el.nodes) {
        el.nodes.forEach(n => {
            scalePoint(n.anchor, center, factor);
            scalePoint(n.handleIn, center, factor);
            scalePoint(n.handleOut, center, factor);
        });
    }
}

function updateNodeHandles(node, movedHandleName, newPos) {
    node[movedHandleName] = { ...newPos };
    if (node.type === 'corner') return;

    const otherHandleName = (movedHandleName === 'handleOut') ? 'handleIn' : 'handleOut';
    const dx = newPos.x - node.anchor.x;
    const dy = newPos.y - node.anchor.y;
    const distMoved = Math.hypot(dx, dy);

    if (distMoved === 0) return;

    if (node.type === 'symmetric') {
        node[otherHandleName] = {
            x: node.anchor.x - dx,
            y: node.anchor.y - dy
        };
    } else if (node.type === 'smooth') {
        const otherDx = node[otherHandleName].x - node.anchor.x;
        const otherDy = node[otherHandleName].y - node.anchor.y;
        let otherLen = Math.hypot(otherDx, otherDy);
        if (otherLen === 0) otherLen = distMoved;

        const dirX = -dx / distMoved;
        const dirY = -dy / distMoved;

        node[otherHandleName] = {
            x: node.anchor.x + dirX * otherLen,
            y: node.anchor.y + dirY * otherLen
        };
    }
}

function findHitElement(pos, elements, currentScale) {
    let threshold = 10 / currentScale;
    for (let i = elements.length - 1; i >= 0; i--) {
        let el = elements[i];
        let hit = false;
        if (el.type === 'line') {
            hit = distToSegment(pos, el.p1, el.p2) < threshold;
        } else if (el.type === 'rect') {
            if (el.pts && el.pts.length === 4) {
                for (let j = 0; j < 4; j++) {
                    if (distToSegment(pos, el.pts[j], el.pts[(j + 1) % 4]) < threshold) { hit = true; break; }
                }
            }
        } else if (el.type === 'circle') {
            let r = Math.hypot(el.p2.x - el.p1.x, el.p2.y - el.p1.y);
            hit = Math.abs(Math.hypot(pos.x - el.p1.x, pos.y - el.p1.y) - r) < threshold;
        } else if (el.type === 'dimension') {
            hit = distToSegment(pos, el.p1, el.p2) < threshold;
        } else if (el.type === 'bezier') {
            if (el.nodes) {
                for (let j = 0; j < el.nodes.length - 1; j++) {
                    if (distToSegment(pos, el.nodes[j].anchor, el.nodes[j+1].anchor) < threshold * 2) { hit = true; break; }
                }
            } else if (el.p1 && el.p2) {
                hit = distToSegment(pos, el.p1, el.p2) < threshold;
            }
        }
        if (hit) return el;
    }
    return null;
}

/* ================= PROŠIRENE OSNAP TAČKE ================= */

function getExtendedSnapPoints(el) {
    let pts = [];
    if (!el) return pts;

    if (el.type === 'rect') {
        if (el.pts && el.pts.length === 4) {
            pts.push(...el.pts);
            for (let i = 0; i < 4; i++) {
                let pA = el.pts[i], pB = el.pts[(i + 1) % 4];
                pts.push({ x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 });
            }
            pts.push({
                x: (el.pts[0].x + el.pts[1].x + el.pts[2].x + el.pts[3].x) / 4,
                y: (el.pts[0].y + el.pts[1].y + el.pts[2].y + el.pts[3].y) / 4
            });
        }
    } else if (el.type === 'circle') {
        let r = Math.hypot(el.p2.x - el.p1.x, el.p2.y - el.p1.y);
        pts.push({ ...el.p1 });
        pts.push({ x: el.p1.x + r, y: el.p1.y }, { x: el.p1.x - r, y: el.p1.y });
        pts.push({ x: el.p1.x, y: el.p1.y + r }, { x: el.p1.x, y: el.p1.y - r });
    } else if (el.type === 'dimension') {
        pts.push({ ...el.p1 }, { ...el.p2 });
    } else if (el.type === 'bezier') {
        if (el.nodes) {
            el.nodes.forEach(n => pts.push({ ...n.anchor }, { ...n.handleIn }, { ...n.handleOut }));
        } else {
            if (el.p1) pts.push({ ...el.p1 });
            if (el.p2) pts.push({ ...el.p2 });
            if (el.cp) pts.push({ ...el.cp });
        }
    }
    return pts;
}

/* ================= RENDERING ELEMENATA ================= */

function renderExtendedElement(ctx, el, isSel, isPrinting, currentScale) {
    let color = isPrinting ? '#000000' : (isSel ? '#ff3333' : (el.color || '#ffffff'));
    let baseThick = (el.thickness !== undefined) ? el.thickness * 10 : 2;
    let thickness = isPrinting ? (baseThick * 1.25 / currentScale) : ((isSel ? baseThick * 1.5 : baseThick) / currentScale);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = thickness;

    if (el.type === 'rect') {
        if (el.pts && el.pts.length === 4) {
            ctx.beginPath();
            ctx.moveTo(el.pts[0].x, el.pts[0].y);
            ctx.lineTo(el.pts[1].x, el.pts[1].y);
            ctx.lineTo(el.pts[2].x, el.pts[2].y);
            ctx.lineTo(el.pts[3].x, el.pts[3].y);
            ctx.closePath();
            ctx.stroke();
        }
    } else if (el.type === 'circle') {
        let r = Math.hypot(el.p2.x - el.p1.x, el.p2.y - el.p1.y);
        ctx.beginPath(); ctx.arc(el.p1.x, el.p1.y, r, 0, Math.PI * 2); ctx.stroke();
    } else if (el.type === 'bezier') {
        if (el.bezierKind === 'cubic' && el.nodes && el.nodes.length > 1) {
            ctx.beginPath();
            ctx.moveTo(el.nodes[0].anchor.x, el.nodes[0].anchor.y);
            for (let i = 0; i < el.nodes.length - 1; i++) {
                let curr = el.nodes[i];
                let next = el.nodes[i + 1];
                ctx.bezierCurveTo(curr.handleOut.x, curr.handleOut.y, next.handleIn.x, next.handleIn.y, next.anchor.x, next.anchor.y);
            }
            ctx.stroke();

            if (isSel && !isPrinting) {
                ctx.lineWidth = 1 / currentScale;
                el.nodes.forEach(n => {
                    ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
                    ctx.beginPath();
                    ctx.moveTo(n.anchor.x, n.anchor.y); ctx.lineTo(n.handleIn.x, n.handleIn.y);
                    ctx.moveTo(n.anchor.x, n.anchor.y); ctx.lineTo(n.handleOut.x, n.handleOut.y);
                    ctx.stroke();

                    ctx.fillStyle = '#00e5ff';
                    [n.handleIn, n.handleOut].forEach(h => {
                        ctx.fillRect(h.x - 3 / currentScale, h.y - 3 / currentScale, 6 / currentScale, 6 / currentScale);
                    });

                    ctx.fillStyle = '#ff3333';
                    ctx.beginPath(); ctx.arc(n.anchor.x, n.anchor.y, 4 / currentScale, 0, Math.PI * 2); ctx.fill();
                });
            }
        } else if (el.bezierKind === 'quadratic' && el.p1 && el.p2 && el.cp) {
            ctx.beginPath();
            ctx.moveTo(el.p1.x, el.p1.y);
            ctx.quadraticCurveTo(el.cp.x, el.cp.y, el.p2.x, el.p2.y);
            ctx.stroke();

            if (isSel && !isPrinting) {
                ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
                ctx.lineWidth = 1 / currentScale;
                ctx.beginPath();
                ctx.moveTo(el.p1.x, el.p1.y); ctx.lineTo(el.cp.x, el.cp.y); ctx.lineTo(el.p2.x, el.p2.y);
                ctx.stroke();
                ctx.fillStyle = '#00e5ff';
                ctx.fillRect(el.cp.x - 3 / currentScale, el.cp.y - 3 / currentScale, 6 / currentScale, 6 / currentScale);
            }
        }
    } else if (el.type === 'hatch') {
        let x = Math.min(el.p1.x, el.p2.x), y = Math.min(el.p1.y, el.p2.y);
        let w = Math.abs(el.p2.x - el.p1.x), h = Math.abs(el.p2.y - el.p1.y);
        ctx.strokeRect(x, y, w, h);
    }

    ctx.restore();
}

/* ================= PRETPREGLED (PREVIEW) ================= */

function drawToolPreview(ctx, mode, mousePos, currentScale) {
    ctx.save();

    if (mode === 'move' && ToolState.step === 2 && selectedElements.length > 0 && ToolState.points.length > 0) {
        let p1 = ToolState.points[0];
        let dx = mousePos.x - p1.x, dy = mousePos.y - p1.y;
        ctx.beginPath(); ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)'; ctx.lineWidth = 1 / currentScale;
        ctx.setLineDash([4 / currentScale, 4 / currentScale]); ctx.moveTo(p1.x, p1.y); ctx.lineTo(mousePos.x, mousePos.y); ctx.stroke(); ctx.setLineDash([]);
        selectedElements.forEach(el => {
            let tempEl = JSON.parse(JSON.stringify(el));
            moveElement(tempEl, dx, dy);
            renderExtendedElement(ctx, tempEl, false, false, currentScale);
        });
    } else if (mode === 'rotate' && ToolState.step === 2 && selectedElements.length > 0 && ToolState.points.length > 0) {
        let center = ToolState.points[0];
        let rad = Math.atan2(mousePos.y - center.y, mousePos.x - center.x);
        selectedElements.forEach(el => {
            let tempEl = JSON.parse(JSON.stringify(el));
            rotateElement(tempEl, center, rad);
            renderExtendedElement(ctx, tempEl, false, false, currentScale);
        });
    } else if (mode === 'scale' && ToolState.step === 2 && selectedElements.length > 0 && ToolState.points.length > 0) {
        let center = ToolState.points[0];
        let dist = Math.hypot(mousePos.x - center.x, mousePos.y - center.y);
        let factor = Math.max(0.05, dist / 20);
        selectedElements.forEach(el => {
            let tempEl = JSON.parse(JSON.stringify(el));
            scaleElement(tempEl, center, factor);
            renderExtendedElement(ctx, tempEl, false, false, currentScale);
        });
    } else if (mode === 'bezier' && ToolState.points.length > 0) {
        if (ToolState.bezierType === 'cubic') {
            let nodes = ToolState.points;
            let lastNode = nodes[nodes.length - 1];

            if (nodes.length > 1) {
                ctx.strokeStyle = '#00e5ff';
                ctx.lineWidth = 1.5 / currentScale;
                ctx.beginPath();
                ctx.moveTo(nodes[0].anchor.x, nodes[0].anchor.y);
                for (let i = 0; i < nodes.length - 1; i++) {
                    ctx.bezierCurveTo(nodes[i].handleOut.x, nodes[i].handleOut.y, nodes[i + 1].handleIn.x, nodes[i + 1].handleIn.y, nodes[i + 1].anchor.x, nodes[i + 1].anchor.y);
                }
                ctx.stroke();
            }

            ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
            ctx.setLineDash([4 / currentScale, 4 / currentScale]);
            ctx.beginPath();
            ctx.moveTo(lastNode.anchor.x, lastNode.anchor.y);
            ctx.bezierCurveTo(lastNode.handleOut.x, lastNode.handleOut.y, mousePos.x, mousePos.y, mousePos.x, mousePos.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Prikaz svih rukohvata i čvorova tokom crtanja
            nodes.forEach(n => {
                ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
                ctx.lineWidth = 1 / currentScale;
                ctx.beginPath();
                ctx.moveTo(n.anchor.x, n.anchor.y); ctx.lineTo(n.handleIn.x, n.handleIn.y);
                ctx.moveTo(n.anchor.x, n.anchor.y); ctx.lineTo(n.handleOut.x, n.handleOut.y);
                ctx.stroke();

                ctx.fillStyle = '#00e5ff';
                [n.handleIn, n.handleOut].forEach(h => {
                    ctx.fillRect(h.x - 3 / currentScale, h.y - 3 / currentScale, 6 / currentScale, 6 / currentScale);
                });

                ctx.fillStyle = '#ff3333';
                ctx.beginPath(); ctx.arc(n.anchor.x, n.anchor.y, 4 / currentScale, 0, Math.PI * 2); ctx.fill();
            });
        } else if (ToolState.bezierType === 'quadratic') {
            let pts = ToolState.points;
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
            ctx.lineWidth = 1.5 / currentScale;
            if (pts.length === 1) {
                ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(mousePos.x, mousePos.y); ctx.stroke();
            } else if (pts.length === 2) {
                ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.quadraticCurveTo(mousePos.x, mousePos.y, pts[1].x, pts[1].y); ctx.stroke();
            }
        }
    } else if (mode === 'rect' && ToolState.points.length > 0) {
        let p1 = ToolState.points[0];
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
        ctx.lineWidth = 1.5 / currentScale;
        ctx.strokeRect(Math.min(p1.x, mousePos.x), Math.min(p1.y, mousePos.y), Math.abs(mousePos.x - p1.x), Math.abs(mousePos.y - p1.y));
    } else if (mode === 'circle' && ToolState.points.length > 0) {
        let p1 = ToolState.points[0];
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
        ctx.lineWidth = 1.5 / currentScale;
        let r = Math.hypot(mousePos.x - p1.x, mousePos.y - p1.y);
        ctx.beginPath(); ctx.arc(p1.x, p1.y, r, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.restore();
}

/* ================= OBRADA ALATA ================= */

function handleToolClick(mode, pos, elements) {
    if (['move', 'rotate', 'scale'].includes(mode)) {
        if (ToolState.step === 0) {
            let clickedEl = findHitElement(pos, elements, scale);
            if (clickedEl) {
                let idx = selectedElements.indexOf(clickedEl);
                if (idx > -1) selectedElements.splice(idx, 1);
                else selectedElements.push(clickedEl);
            }
            if (selectedElements.length > 0) {
                return { finished: false, inputPrompt: true, placeholder: `${selectedElements.length} selektovano (Enter za Baznu tčku)` };
            } else {
                return { finished: false, inputPrompt: true, placeholder: `Klikni objekte za ${mode}` };
            }
        }

        if (ToolState.step === 1) {
            if (selectedElements.length === 0) {
                ToolState.step = 0;
                return { finished: false, inputPrompt: true, placeholder: "Klikni objekte (Enter za kraj)" };
            }
            ToolState.points = [{ ...pos }];
            ToolState.step = 2;
            let placeholder = mode === 'rotate' ? "Ugao rotacije" : (mode === 'scale' ? "Faktor skalu" : "Ciljna tačka ili dX,dY");
            return { finished: false, inputPrompt: true, placeholder: placeholder };
        }

        if (ToolState.step === 2) {
            let center = ToolState.points[0];
            if (mode === 'move') {
                let dx = pos.x - center.x, dy = pos.y - center.y;
                selectedElements.forEach(el => moveElement(el, dx, dy));
            } else if (mode === 'rotate') {
                let rad = Math.atan2(pos.y - center.y, pos.x - center.x);
                selectedElements.forEach(el => rotateElement(el, center, rad));
            } else if (mode === 'scale') {
                let dist = Math.hypot(pos.x - center.x, pos.y - center.y);
                let factor = Math.max(0.05, dist / 20);
                selectedElements.forEach(el => scaleElement(el, center, factor));
            }
            resetToolState();
            return { finished: true };
        }
    }

    if (mode === 'bezier' && ToolState.bezierType === 'quadratic') {
        if (ToolState.step === 0) {
            ToolState.points = [{ ...pos }]; ToolState.step = 1;
            return { finished: false, inputPrompt: true, placeholder: "Krajnja tačka krive" };
        } else if (ToolState.step === 1) {
            ToolState.points.push({ ...pos }); ToolState.step = 2;
            return { finished: false, inputPrompt: true, placeholder: "Kontrolna tačka (zakrivljenost)" };
        } else if (ToolState.step === 2) {
            elements.push({
                type: 'bezier', bezierKind: 'quadratic',
                p1: { ...ToolState.points[0] }, p2: { ...ToolState.points[1] }, cp: { ...pos },
                thickness: 0.2, color: '#ffffff'
            });
            resetToolState();
            return { finished: true };
        }
    }

    if (mode === 'rect') {
        if (ToolState.step === 0) {
            ToolState.points = [{ ...pos }]; ToolState.step = 1;
            return { finished: false, inputPrompt: true, placeholder: "Širina,Visina" };
        } else {
            let p1 = ToolState.points[0];
            let p2 = pos;
            elements.push({
                type: 'rect',
                pts: [
                    { x: p1.x, y: p1.y },
                    { x: p2.x, y: p1.y },
                    { x: p2.x, y: p2.y },
                    { x: p1.x, y: p2.y }
                ],
                thickness: 0.2, color: '#ffffff'
            });
            resetToolState();
            return { finished: true };
        }
    }

    if (mode === 'circle') {
        if (ToolState.step === 0) {
            ToolState.points = [{ ...pos }]; ToolState.step = 1;
            return { finished: false, inputPrompt: true, placeholder: "Poluprečnik R" };
        } else {
            elements.push({
                type: 'circle', p1: { ...ToolState.points[0] }, p2: { ...pos },
                thickness: 0.2, color: '#ffffff'
            });
            resetToolState();
            return { finished: true };
        }
    }

    return null;
}

function handleToolMouseDown(mode, pos) {
    if (mode === 'bezier' && ToolState.bezierType === 'cubic') {
        let newNode = {
            anchor: { ...pos },
            handleIn: { ...pos },
            handleOut: { ...pos },
            type: 'symmetric'
        };
        ToolState.points.push(newNode);
        activeBezierNode = newNode;
        isDraggingHandle = true;
        return true;
    }
    return false;
}

function handleToolMouseMove(mode, pos) {
    if (mode === 'bezier' && ToolState.bezierType === 'cubic' && isDraggingHandle && activeBezierNode) {
        updateNodeHandles(activeBezierNode, 'handleOut', pos);
        return true;
    }
    return false;
}

function handleToolMouseUp(mode) {
    if (mode === 'bezier' && ToolState.bezierType === 'cubic' && isDraggingHandle) {
        isDraggingHandle = false;
        activeBezierNode = null;
        return true;
    }
    return false;
}