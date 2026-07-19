/**
 * ==========================================================================
 * MODUL ZA RAČUNANJE I CRTANJE DIJAGRAMA INTERAKCIJE N-M (Eurocode 2)
 * ==========================================================================
 * 
 * Ovaj fajl je potpuno nezavisan i autonoman komponentni dio proračuna.
 * Služi za generisanje zatvorene granične krive nosivosti (anvelope) 
 * pravougaonog armiranobetonskog presjeka i mapiranje trenutne radne tačke.
 */

/**
 * Računa i iscrtava čist N-M dijagram interakcije za zadati presjek u jednom canvas elementu.
 * 
 * @param {string} canvasId - Jedinstveni ID <canvas> elementa iz HTML-a (npr. "interakcijaCanvas").
 * @param {Object} p - Objekat koji sadrži sve geometrijske i materijalne parametre presjeka.
 * @param {number} p.b - Širina poprečnog presjeka (cm).
 * @param {number} p.h - Visina poprečnog presjeka (cm).
 * @param {number} p.d1 - Rastojanje od donje ivice do težišta donje armature (cm).
 * @param {number} p.d2 - Rastojanje od gornje ivice do težišta gornje armature (cm).
 * @param {number} p.As1 - Površina usvojene donje armature (cm²).
 * @param {number} p.As2 - Površina usvojene gornje armature (cm²).
 * @param {number} p.fck - Karakteristična čvrstoća betona na pritisak (MPa).
 * @param {number} p.fyk - Karakteristična granica razvlačenja čelika (MPa).
 * @param {number} p.gammac - Parcijalni koeficijent sigurnosti za beton (npr. 1.5).
 * @param {number} p.gammaS - Parcijalni koeficijent sigurnosti za čelik (npr. 1.15).
 * @param {number} p.acc - Koeficijent dugotrajnih uticaja na čvrstoću betona (npr. 0.85).
 * @param {number} p.Es - Modul elastičnosti čelika (MPa, npr. 210000).
 * @param {number|null} p.MEd - Trenutni računski moment savijanja za radnu tačku (kNm).
 * @param {number|null} p.NEd - Trenutna računska aksijalna sila (kN).
 * @param {number} p.es1 - Trenutna dilatacija donje armature iz glavnog proračuna.
 * @param {number} p.es2 - Trenutna dilatacija gornje armature iz glavnog proračuna.
 * @param {number} p.ec2 - Trenutna granična dilatacija betona iz glavnog proračuna.
 * @param {number} p.sigSd1 - Trenutni napon u donjoj armaturi (MPa).
 * @param {number} p.sigSd2 - Trenutni napon u gornjoj armaturi (MPa).
 */
function iscrtajNMInterakciju(canvasId, p) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // 1. INPUT PARAMETRI SA FALLBACK VRIJEDNOSTIMA
    const b = parseFloat(p.b) || 30;
    const h = parseFloat(p.h) || 50;
    const d1 = parseFloat(p.d1) || 4.5;
    const d2 = parseFloat(p.d2) || 4.5;
    const As1 = parseFloat(p.As1) || 0; 
    const As2 = parseFloat(p.As2) || 0; 
    const fck = parseFloat(p.fck) || 20;
    const fyk = parseFloat(p.fyk) || 500;
    const gammac = parseFloat(p.gammac) || 1.5;
    const gammaS = parseFloat(p.gammaS) || 1.15;
    const acc = parseFloat(p.acc) || 0.85;
    const Es = parseFloat(p.Es) || 210000;

    const M_ed = p.MEd !== undefined ? parseFloat(p.MEd) : null; 
    const N_ed = p.NEd !== undefined ? parseFloat(p.NEd) : null; 
    
    const trenutno_es1 = p.es1 || 0;
    const trenutno_es2 = p.es2 || 0;
    const trenutno_ec2 = p.ec2 || 0;
    const trenutno_sig1 = p.sigSd1 || 0;
    const trenutno_sig2 = p.sigSd2 || 0;

    const ecu3 = fck < 55 ? 0.0035 : 0.0026 + 0.035 * Math.pow((90 - fck) / 100, 4);
    const lambda = fck < 55 ? 0.8 : 0.8 - (fck - 50) / 400;
    const eta = fck < 55 ? 1.0 : 1.0 - (fck - 50) / 200;
    
    const fcd = acc * fck / gammac; 
    const fyd = fyk / gammaS;       
    const eud = 0.025; 

    let points = [];
    const koraci = 50; 

    function proracunajTacku(epsTop, epsBottom) {
        let es2 = epsTop + (epsBottom - epsTop) * (d2 / h);
        let es1 = epsTop + (epsBottom - epsTop) * ((h - d1) / h);

        // Naponi: Kompresija je (-), Tenzija je (+)
        let sigSd2 = Math.max(-fyd, Math.min(fyd, -es2 * Es));
        let sigSd1 = Math.max(-fyd, Math.min(fyd, -es1 * Es));

        // Sile u čeliku (kN): Pritisak (-), Zatezanje (+)
        let Fs2 = As2 * sigSd2 / 10;
        let Fs1 = As1 * sigSd1 / 10;

        let Fc = 0; 
        let y_c = h / 2; 

        if (Math.abs(epsTop - epsBottom) < 1e-7) {
            if (epsTop > 0) {
                let x_blok = h;
                Fc = b * x_blok * (fcd * eta / 10);
                y_c = x_blok / 2;
            }
        } else {
            if (epsTop > 0 && epsTop >= epsBottom) {
                let x = (epsTop * h) / (epsTop - epsBottom);
                let x_blok = Math.min(lambda * x, h);
                Fc = b * x_blok * (fcd * eta / 10);
                y_c = x_blok / 2;
            } else if (epsBottom > 0 && epsBottom > epsTop) {
                let x_b = (epsBottom * h) / (epsBottom - epsTop);
                let x_blok = Math.min(lambda * x_b, h);
                Fc = b * x_blok * (fcd * eta / 10);
                y_c = h - (x_blok / 2);
            }
        }

        // POPRAVKA MATEMATIČKOG ZNAKA:
        // Beton je uvijek u pritisku (-Fc). Čelik direktno dodajemo jer već ima ispravan znak (+ ili -)
        let N = -Fc + Fs1 + Fs2;
        
        // Moment oko težišta presjeka h/2
        let M = (Fs1 * (h / 2 - d1) - Fs2 * (h / 2 - d2) + Fc * (h / 2 - y_c)) / 100; 

        return { M: M, N: N };
    }

    // Kontinuirani prolaz kroz deformaciona stanja ivica presjeka
    for (let i = 0; i <= koraci; i++) points.push(proracunajTacku(-eud + (i/koraci)*(ecu3+eud), -eud));
    for (let i = 1; i <= koraci; i++) points.push(proracunajTacku(ecu3, -eud + (i/koraci)*(ecu3+eud)));
    for (let i = 1; i <= koraci; i++) points.push(proracunajTacku(ecu3 - (i/koraci)*(ecu3+eud), ecu3));
    for (let i = 1; i <= koraci; i++) points.push(proracunajTacku(-eud, ecu3 - (i/koraci)*(ecu3+eud)));
    points.push(points[0]);

    // 2. PRIPREMA CANVAS-A I DIMENZIJA
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 800;
    const h_c = canvas.clientHeight || 400;
    
    canvas.width = w * dpr;
    canvas.height = h_c * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h_c);

    // SISTEM STRUČNIH MARGINA ZA MATRICU GRAFIKA
    const padLeft = 85;     
    const padRight = 210;    
    const padTop = 45;      
    const padBottom = 45;   

    const plotWidth = w - padLeft - padRight;
    const plotHeight = h_c - padTop - padBottom;

    let sveN = points.map(p => p.N);
    let sveM = points.map(p => p.M);
    if (N_ed !== null) sveN.push(N_ed);
    if (M_ed !== null) sveM.push(M_ed);

    let minN = Math.min(...sveN), maxN = Math.max(...sveN);
    let maxAbsM = Math.max(...sveM.map(Math.abs), 30); 

    let minM = -maxAbsM * 1.15;
    let maxM = maxAbsM * 1.15;
    let rasponN = Math.max(maxN - minN, 100);
    minN -= rasponN * 0.1;
    maxN += rasponN * 0.1;

    function kX(mVal) { return padLeft + plotWidth * (mVal - minM) / (maxM - minM); }
    function kY(nVal) { return padTop + plotHeight * (nVal - minN) / (maxN - minN); }

    // 3. CRTANJE POZADINSKE MREŽE (GRID)
    ctx.strokeStyle = "#eff1f4";
    ctx.lineWidth = 1;
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#7a869a";

    let korakM = (maxM - minM) / 6;
    for (let i = 0; i <= 6; i++) {
        let val = minM + i * korakM;
        ctx.beginPath(); ctx.moveTo(kX(val), padTop); ctx.lineTo(kX(val), h_c - padBottom); ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillText(val.toFixed(0), kX(val), h_c - padBottom + 14);
    }

    let korakN = (maxN - minN) / 5;
    for (let i = 0; i <= 5; i++) {
        let val = minN + i * korakN;
        ctx.beginPath(); ctx.moveTo(padLeft, kY(val)); ctx.lineTo(padLeft + plotWidth, kY(val)); ctx.stroke();
        ctx.textAlign = "right";
        ctx.fillText(val.toFixed(0), padLeft - 10, kY(val) + 4);
    }

    // GLAVNE STATIČKE OSE (M=0, N=0)
    ctx.strokeStyle = "#8993a4";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(kX(0), padTop); ctx.lineTo(kX(0), h_c - padBottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(padLeft, kY(0)); ctx.lineTo(padLeft + plotWidth, kY(0)); ctx.stroke();

    // 4. CRTANJE GRANIČNE LINIJE DIJAGRAMA INTERAKCIJE
    ctx.fillStyle = "rgba(40, 167, 69, 0.06)";
    ctx.beginPath();
    ctx.moveTo(kX(points[0].M), kY(points[0].N));
    for (let i = 1; i < points.length; i++) ctx.lineTo(kX(points[i].M), kY(points[i].N));
    ctx.fill();

    ctx.strokeStyle = "#28a745";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(kX(points[0].M), kY(points[0].N));
    for (let i = 1; i < points.length; i++) ctx.lineTo(kX(points[i].M), kY(points[i].N));
    ctx.stroke();

    // Labele koordinatnih osa
    ctx.fillStyle = "#172b4d";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("M_Rd [kNm]", padLeft + plotWidth - 5, kY(0) - 8);
    
    ctx.save();
    ctx.translate(22, padTop + plotHeight / 2); 
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("N_Rd [kN]   ( Pritisak [-] \u2191 / Zatezanje [+] \u2193 )", 0, 0);
    ctx.restore();

    // 5. RENDEROVANJE TRENUTNE RADNE TAČKE I DESNOG PANELA
    if (M_ed !== null && N_ed !== null) {
        let unutra = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            let xi = points[i].M, yi = points[i].N;
            let xj = points[j].M, yj = points[j].N;
            let intersect = ((yi > N_ed) !== (yj > N_ed)) && (M_ed < (xj - xi) * (N_ed - yi) / (yj - yi) + xi);
            if (intersect) unutra = !unutra;
        }

        let pX = kX(M_ed), pY = kY(N_ed);
        
        ctx.strokeStyle = "rgba(0, 82, 204, 0.35)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(pX, pY); ctx.lineTo(kX(0), pY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pX, pY); ctx.lineTo(pX, kY(0)); ctx.stroke();
        ctx.setLineDash([]); 

        ctx.beginPath(); ctx.arc(pX, pY, 6, 0, 2 * Math.PI);
        ctx.fillStyle = unutra ? "#0052cc" : "#de350b"; 
        ctx.fill();
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.stroke();

        // Desna informativna traka
        const panelX = w - padRight + 25;
        ctx.fillStyle = "#f4f5f7";
        ctx.fillRect(panelX - 10, padTop, padRight - 35, plotHeight);
        ctx.strokeStyle = "#dfe1e6";
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX - 10, padTop, padRight - 35, plotHeight);

        ctx.fillStyle = "#172b4d";
        ctx.textAlign = "left";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("TRENUTNO STANJE", panelX, padTop + 20);
        
        ctx.fillStyle = unutra ? "#006644" : "#bf2600";
        ctx.fillText(unutra ? "Dokaz: ZADOVOLJAVA" : "Dokaz: OTKAZUJE!", panelX, padTop + 38);

        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#42526e";
        ctx.fillText(`MEd = ${M_ed.toFixed(1)} kNm`, panelX, padTop + 65);
        ctx.fillText(`NEd = ${(-N_ed).toFixed(1)} kN`, panelX, padTop + 80); 
        
        ctx.fillStyle = "#172b4d";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("Deformacije (\u2030):", panelX, padTop + 110);
        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#42526e";
        ctx.fillText(`\u03B5_c (ivica) = ${(trenutno_ec2 * 1000).toFixed(2)} \u2030`, panelX, padTop + 125);
        ctx.fillText(`\u03B5_s2 (gornja) = ${(trenutno_es2 * 1000).toFixed(2)} \u2030`, panelX, padTop + 140);
        ctx.fillText(`\u03B5_s1 (donja) = ${(trenutno_es1 * 1000).toFixed(2)} \u2030`, panelX, padTop + 155);

        ctx.fillStyle = "#172b4d";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("Naponi u čeliku:", panelX, padTop + 185);
        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#42526e";
        ctx.fillText(`\u03C3_s2 = ${trenutno_sig2.toFixed(1)} MPa`, panelX, padTop + 200);
        ctx.fillText(`\u03C3_s1 = ${trenutno_sig1.toFixed(1)} MPa`, panelX, padTop + 215);
    }
}