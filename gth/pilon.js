// script.js

// ----------------------------------------------------------------
// 1. KORELACIONE TABELE ξ (EN 1997-1, A.8 – A.11)
// ----------------------------------------------------------------
const xiTabele1 = {
    "1": { xi1: 1.40, xi2: 1.40 },
    "2": { xi1: 1.30, xi2: 1.20 },
    "3": { xi1: 1.20, xi2: 1.05 },
    "4": { xi1: 1.10, xi2: 1.00 },
    "5": { xi1: 1.00, xi2: 1.00 }
};
const xiTabele2 = {
    "1": { xi1: 1.40, xi2: 1.40 },
    "2": { xi1: 1.35, xi2: 1.27 },
    "3": { xi1: 1.33, xi2: 1.23 },
    "4": { xi1: 1.31, xi2: 1.20 },
    "5": { xi1: 1.29, xi2: 1.15 },
    "6": { xi1: 1.27, xi2: 1.12 },
    "7": { xi1: 1.25, xi2: 1.08 }
};
const xiTabele3 = {
    "2": { xi1: 1.60, xi2: 1.50 },
    "5": { xi1: 1.50, xi2: 1.35 },
    "10": { xi1: 1.45, xi2: 1.30 },
    "15": { xi1: 1.42, xi2: 1.25 },
    "20": { xi1: 1.40, xi2: 1.25 }
};

// ----------------------------------------------------------------
// 2. DEFINICIJA 4 PRORAČUNSKA PRISTUPA
// ----------------------------------------------------------------
const pristupi = [{
    id: 'pp1k1',
    naziv: 'PP1/K1 (A1+M1+R1)',
    gammaG: 1.35,
    gammaQ: 1.5,
    gammaB: 1.25,
    gammaS: 1.0,
    elStatus: 'status-pp1k1',
    elEd: 'ed-pp1k1',
    elRd: 'rd-pp1k1',
    elUtil: 'util-pp1k1'
}, {
    id: 'pp1k2',
    naziv: 'PP1/K2 (A2+M1+R4)',
    gammaG: 1.0,
    gammaQ: 1.3,
    gammaB: 1.6,
    gammaS: 1.3,
    elStatus: 'status-pp1k2',
    elEd: 'ed-pp1k2',
    elRd: 'rd-pp1k2',
    elUtil: 'util-pp1k2'
}, {
    id: 'pp2',
    naziv: 'PP2 (A1+M1+R2)',
    gammaG: 1.35,
    gammaQ: 1.5,
    gammaB: 1.1,
    gammaS: 1.1,
    elStatus: 'status-pp2',
    elEd: 'ed-pp2',
    elRd: 'rd-pp2',
    elUtil: 'util-pp2'
}, {
    id: 'pp3',
    naziv: 'PP3 (A1/A2+M2+R3)',
    gammaG: 1.0,
    gammaQ: 1.3,
    gammaB: 1.6,
    gammaS: 1.3,
    elStatus: 'status-pp3',
    elEd: 'ed-pp3',
    elRd: 'rd-pp3',
    elUtil: 'util-pp3'
}];

// ----------------------------------------------------------------
// 3. GLOBALNI PODACI O SLOJEVIMA
// ----------------------------------------------------------------
let geoloskiSlojevi = [
    { id: 1, tip: 'pijesak', debljina: 4.0, gama: 16, param_srednja: 6.33, param_min: 5 },
    { id: 2, tip: 'glina', debljina: 4.0, gama: 21, param_srednja: 163.66, param_min: 152 },
    { id: 3, tip: 'tvrdo', debljina: 3.0, gama: 19.5, param_srednja: 300, param_min: 250 }
];

// ----------------------------------------------------------------
// 4. POMOĆNE FUNKCIJE
// ----------------------------------------------------------------
function izracunajNc(cu) {
    const tab_cu = [25, 50, 100, 200];
    const tab_Nc = [6.5, 8.0, 8.7, 9.0];
    if (cu <= tab_cu[0]) return tab_Nc[0];
    if (cu >= tab_cu[tab_cu.length - 1]) return tab_Nc[tab_cu.length - 1];
    for (let i = 0; i < tab_cu.length - 1; i++) {
        if (cu >= tab_cu[i] && cu <= tab_cu[i + 1]) {
            let t = (cu - tab_cu[i]) / (tab_cu[i + 1] - tab_cu[i]);
            return tab_Nc[i] + t * (tab_Nc[i + 1] - tab_Nc[i]);
        }
    }
    return 9.0;
}

function getZabijeniNekoherentnoParametre(Nspt) {
    const tab_N = [0, 4, 10, 30, 50, 100];
    const tab_Nq = [8, 8, 12, 20, 40, 50];
    const tab_delta = [15, 15, 20, 25, 30, 35];
    const tab_qsmax = [2000, 2000, 3000, 5000, 10000, 12000];
    if (Nspt <= tab_N[0]) return { nq1: tab_Nq[0], delta: tab_delta[0], qsmax: tab_qsmax[0] };
    if (Nspt >= tab_N[tab_N.length - 1]) return {
        nq1: tab_Nq[tab_N.length - 1], delta: tab_delta[tab_delta.length - 1],
        qsmax: tab_qsmax[tab_qsmax.length - 1]
    };
    for (let i = 0; i < tab_N.length - 1; i++) {
        if (Nspt >= tab_N[i] && Nspt <= tab_N[i + 1]) {
            let t = (Nspt - tab_N[i]) / (tab_N[i + 1] - tab_N[i]);
            return {
                nq1: tab_Nq[i] + t * (tab_Nq[i + 1] - tab_Nq[i]),
                delta: tab_delta[i] + t * (tab_delta[i + 1] - tab_delta[i]),
                qsmax: tab_qsmax[i] + t * (tab_qsmax[i + 1] - tab_qsmax[i])
            };
        }
    }
}

function eflectivniNaponNaDubini(dubina, npv) {
    let tren = 0,
        napon = 0;
    for (let sl of geoloskiSlojevi) {
        if (dubina <= tren) break;
        let dz = Math.min(sl.debljina, dubina - tren);
        let d_voda = 0,
            d_suho = dz;
        if (tren >= npv) {
            d_voda = dz;
            d_suho = 0;
        } else if (tren + dz > npv) {
            d_suho = npv - tren;
            d_voda = tren + dz - npv;
        }
        napon += d_suho * sl.gama + d_voda * (sl.gama - 9.81);
        tren += sl.debljina;
    }
    return napon;
}

// ----------------------------------------------------------------
// 5. PRORAČUN KARAKTERISTIČNE NOSIVOSTI ŠIPA
// ----------------------------------------------------------------
function proracunajSipKapacitet(D, L, npv, modStatistike, tehnologija) {
    const Ab = Math.PI * D * D / 4;
    const O = Math.PI * D;

    // Vertikalni naponi na granicama slojeva
    let granice = [0];
    let tren = 0,
        napon = 0;
    for (let sl of geoloskiSlojevi) {
        let dz = sl.debljina;
        let d_voda = 0,
            d_suho = dz;
        if (tren >= npv) {
            d_voda = dz;
            d_suho = 0;
        } else if (tren + dz > npv) {
            d_suho = npv - tren;
            d_voda = tren + dz - npv;
        }
        napon += d_suho * sl.gama + d_voda * (sl.gama - 9.81);
        tren += dz;
        granice.push(napon);
    }

    // Otpor omotača
    let Rsk = 0;
    let preostalo = L;
    let trenDub = 0;
    let idx = 0;
    for (let sl of geoloskiSlojevi) {
        if (preostalo <= 0) break;
        let dz = Math.min(sl.debljina, preostalo);
        let z_sredina = trenDub + dz / 2;
        let param = modStatistike === 'srednja' ? sl.param_srednja : sl.param_min;

        let naporGore = granice[idx];
        let d_voda_lam = 0,
            d_suho_lam = dz / 2;
        if (trenDub >= npv) {
            d_voda_lam = dz / 2;
            d_suho_lam = 0;
        } else if (trenDub + dz / 2 > npv) {
            d_suho_lam = npv - trenDub;
            d_voda_lam = trenDub + dz / 2 - npv;
        }
        let sigma_y = naporGore + d_suho_lam * sl.gama + d_voda_lam * (sl.gama - 9.81);
        let qs = 0;

        if (tehnologija === 'buseni') {
            if (sl.tip === 'glina') {
                let Patm = 100;
                let odnos = param / Patm;
                let alpha = 0.55;
                if (odnos >= 1.5 && odnos <= 2.5) alpha = 0.55 - 0.1 * (odnos - 1.5);
                else if (odnos > 2.5) alpha = 0.45;
                qs = alpha * param;
            } else {
                let N60 = param;
                let N_bar = N60 > 15 ? 1.0 : N60 / 11;
                let beta = Math.max(0.25, N_bar * (1.5 - 0.25 * Math.sqrt(z_sredina)));
                qs = beta * sigma_y;
            }
        } else { // zabijeni
            if (sl.tip === 'glina') {
                let odnos = param / Math.max(sigma_y, 0.1);
                let alpha = 0.55;
                if (odnos <= 1.0) alpha = 0.5 * Math.pow(odnos, -0.5);
                else alpha = Math.min(1.0, 0.5 * Math.pow(odnos, -0.25));
                qs = alpha * param;
            } else {
                let p = getZabijeniNekoherentnoParametre(param);
                let K = 1.0;
                qs = K * sigma_y * Math.tan(p.delta * Math.PI / 180);
                if (qs > p.qsmax) qs = p.qsmax;
            }
        }
        Rsk += O * dz * qs;
        trenDub += sl.debljina;
        preostalo -= dz;
        idx++;
    }

    // Otpor baze
    let qbk = 0;
    let slojBaze = geoloskiSlojevi[geoloskiSlojevi.length - 1];
    let dubDo = 0;
    for (let i = 0; i < geoloskiSlojevi.length; i++) {
        let sl = geoloskiSlojevi[i];
        if (L >= dubDo && L <= dubDo + sl.debljina) { slojBaze = sl; break; }
        dubDo += sl.debljina;
    }
    let bParam = modStatistike === 'srednja' ? slojBaze.param_srednja : slojBaze.param_min;
    let sigma_baza = eflectivniNaponNaDubini(L, npv);

    if (slojBaze.tip === 'tvrdo') {
        let Nc = izracunajNc(bParam);
        qbk = Nc * bParam;
    } else {
        if (tehnologija === 'buseni') {
            if (slojBaze.tip === 'glina') {
                let Nc = izracunajNc(bParam);
                qbk = Nc * bParam;
            } else {
                let b = D / 2;
                if (L / b <= 10) qbk = 60 * bParam * (L / (10 * b));
                else qbk = 60 * bParam;
            }
        } else {
            if (slojBaze.tip === 'glina') {
                qbk = 9.0 * bParam;
            } else {
                let p = getZabijeniNekoherentnoParametre(bParam);
                qbk = sigma_baza * p.nq1;
            }
        }
    }
    let Rbk = (Math.PI * D * D / 4) * qbk;
    return { Rbk, Rsk, Rtotal: Rbk + Rsk, sigma_baza };
}

// ----------------------------------------------------------------
// 6. GLAVNA FUNKCIJA – KOMPLETNA ANALIZA
// ----------------------------------------------------------------
function izvrsiKompletnuAnalizu() {
    // Čitanje ulaza
    const D = parseFloat(document.getElementById('pile-d').value) || 0.5;
    const L = parseFloat(document.getElementById('pile-l').value) || 8.0;
    const Gk = parseFloat(document.getElementById('pile-gk').value) || 250;
    const Qk = parseFloat(document.getElementById('pile-qk').value) || 80;
    const npv = parseFloat(document.getElementById('w-level').value) || 2.0;
    const tehnologija = document.getElementById('pile-type').value;
    const tipIspitivanja = document.getElementById('test-type').value;
    const profilKljuč = document.getElementById('num-profiles').value;

    // Odabir tabele ξ
    let xiTabele;
    if (tipIspitivanja === 'static') xiTabele = xiTabele1;
    else if (tipIspitivanja === 'spt') xiTabele = xiTabele2;
    else if (tipIspitivanja === 'dynamic') xiTabele = xiTabele3;

    let kljuc = profilKljuč;
    if (tipIspitivanja === 'dynamic') {
        let keys = Object.keys(xiTabele).map(Number).sort((a, b) => a - b);
        let n = parseInt(profilKljuč);
        let izabrani = keys[0];
        for (let k of keys) {
            if (k <= n) izabrani = k;
            else break;
        }
        kljuc = String(izabrani);
    }
    const xi1 = xiTabele[kljuc]?.xi1 || 1.40;
    const xi2 = xiTabele[kljuc]?.xi2 || 1.40;
    document.getElementById('val-xi1').innerText = xi1.toFixed(2);
    document.getElementById('val-xi2').innerText = xi2.toFixed(2);

    // Proračun kapaciteta za srednje i minimalne parametre
    const capSrednja = proracunajSipKapacitet(D, L, npv, 'srednja', tehnologija);
    const capMinimalna = proracunajSipKapacitet(D, L, npv, 'min', tehnologija);

    // Karakteristične vrijednosti (EN 1997-1, 7.6.2.2)
    const R_b_k = Math.min(capSrednja.Rbk / xi1, capMinimalna.Rbk / xi2);
    const R_s_k = Math.min(capSrednja.Rsk / xi1, capMinimalna.Rsk / xi2);
    const R_c_k = R_b_k + R_s_k;

    // Težina šipa
    const Ab = Math.PI * D * D / 4;
    const W = Ab * L * 25; // kN

    // Grupa
    const nx = parseInt(document.getElementById('group-nx').value) || 1;
    const ny = parseInt(document.getElementById('group-ny').value) || 1;
    const sx = parseFloat(document.getElementById('group-sx').value) || 2.5;
    const sy = parseFloat(document.getElementById('group-sy').value) || 2.5;
    const capT = parseFloat(document.getElementById('cap-t').value) || 1.5;
    const n_total = nx * ny;

    let η = 1.0;
    if (n_total > 1) {
        let theta = Math.atan(D / ((sx + sy) / 2)) * (180 / Math.PI);
        η = 1 - (theta / 90) * (((nx - 1) * ny + (ny - 1) * nx) / (nx * ny));
    }

    // Prikaz karakterističnih
    document.getElementById('val-rbk').innerText = R_b_k.toFixed(1);
    document.getElementById('val-rsk').innerText = R_s_k.toFixed(1);
    document.getElementById('val-rck').innerText = R_c_k.toFixed(1);
    document.getElementById('val-sigma-baza').innerText = capSrednja.sigma_baza.toFixed(1);

    // Tekstualni izvještaj
    let tekst = `[STATISTIČKA OBRADA (EN 1997-1)]\n`;
    tekst += `Tehnologija: ${tehnologija.toUpperCase()}  |  Ispitivanje: ${tipIspitivanja.toUpperCase()}\n`;
    tekst += `ξ₁ = ${xi1.toFixed(2)}  ξ₂ = ${xi2.toFixed(2)}  (n = ${profilKljuč})\n\n`;
    tekst += `• Efektivni napon na bazi: σ'_y = ${capSrednja.sigma_baza.toFixed(1)} kPa\n`;
    tekst += `• R_b,k = ${R_b_k.toFixed(1)} kN  (srednja=${capSrednja.Rbk.toFixed(1)}, min=${capMinimalna.Rbk.toFixed(1)})\n`;
    tekst += `• R_s,k = ${R_s_k.toFixed(1)} kN  (srednja=${capSrednja.Rsk.toFixed(1)}, min=${capMinimalna.Rsk.toFixed(1)})\n`;
    tekst += `• R_c,k = ${R_c_k.toFixed(1)} kN\n\n`;
    tekst += `[GRUPA ŠIPOVA]  n = ${n_total}  η = ${η.toFixed(3)}  W = ${W.toFixed(1)} kN/šipu\n\n`;

    // Računanje za svaki pristup
    for (let p of pristupi) {
        const E_d = (p.gammaG * (Gk + W) + p.gammaQ * Qk) * n_total;
        const R_d = n_total * η * ((R_b_k / p.gammaB) + (R_s_k / p.gammaS));
        const util = (E_d / R_d) * 100;

        document.getElementById(p.elEd).innerText = E_d.toFixed(1) + ' kN';
        document.getElementById(p.elRd).innerText = R_d.toFixed(1) + ' kN';
        document.getElementById(p.elUtil).innerText = util.toFixed(1) + '%';
        let elStatus = document.getElementById(p.elStatus);
        let ok = util <= 100;
        elStatus.innerText = ok ? `✓ ZADOVOLJAVA (${util.toFixed(1)}%)` : `✗ PAD (${util.toFixed(1)}%)`;
        elStatus.className = `status-badge ${ok ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'}`;

        // Dodaj u izvještaj
        tekst += `[${p.naziv}]\n`;
        tekst += `  E_d = ${E_d.toFixed(1)} kN   R_d = ${R_d.toFixed(1)} kN   Iskorištenost = ${util.toFixed(1)}%\n`;
        tekst += `  ${ok ? '✅' : '❌'}  Nosivost ${ok ? 'ZADOVOLJAVA' : 'NIJE ZADOVOLJENA'}\n\n`;
    }

    document.getElementById('izvjestaj-tekst').innerHTML = tekst.replace(/\n/g, '<br>');

    // Vraćamo podatke za 3D
    return { D, L, nx, ny, sx, sy, capT, npv, n_total };
}

// ----------------------------------------------------------------
// 7. UI FUNKCIJE ZA SLOJEVE
// ----------------------------------------------------------------
function iscrtajSlojeveUSidebaru() {
    const container = document.getElementById('proceduralni-slojevi');
    container.innerHTML = '';
    geoloskiSlojevi.forEach((sloj, index) => {
        const naslov = sloj.tip === 'pijesak' ? 'N_SPT / N60' : 'c_u (kPa)';
        const div = document.createElement('div');
        div.className = "sloj-card bg-slate-950 rounded border border-slate-800 space-y-1.5";
        div.innerHTML = `
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-[0.65rem] ${sloj.tip === 'pijesak' ? 'text-amber-500' : sloj.tip === 'glina' ? 'text-indigo-400' : 'text-white'}">Sloj ${index + 1}: ${sloj.tip.toUpperCase()}</span>
                        <button onclick="obrisiSloj(${sloj.id})" class="text-slate-500 hover:text-red-400 font-bold text-[0.6rem]">Ukloni</button>
                    </div>
                    <div class="grid grid-cols-2 gap-1">
                        <div><label class="sidebar-label">Debljina (m)</label>
                            <input type="number" value="${sloj.debljina}" oninput="izmjeniSloj(${sloj.id}, 'debljina', this.value)" class="sidebar-input"></div>
                        <div><label class="sidebar-label">γ (kN/m³)</label>
                            <input type="number" value="${sloj.gama}" oninput="izmjeniSloj(${sloj.id}, 'gama', this.value)" class="sidebar-input"></div>
                    </div>
                    <div class="grid grid-cols-2 gap-1">
                        <div><label class="sidebar-label text-amber-400">Srednji ${naslov}</label>
                            <input type="number" value="${sloj.param_srednja}" oninput="izmjeniSloj(${sloj.id}, 'param_srednja', this.value)" class="sidebar-input font-bold"></div>
                        <div><label class="sidebar-label text-red-400">Minimalni ${naslov}</label>
                            <input type="number" value="${sloj.param_min}" oninput="izmjeniSloj(${sloj.id}, 'param_min', this.value)" class="sidebar-input font-bold"></div>
                    </div>
                    <div class="flex gap-2 pt-0.5 text-[0.6rem] text-slate-400 flex-wrap">
                        <span>Tip:</span>
                        <label class="inline-flex items-center gap-0.5"><input type="radio" name="tip-${sloj.id}" value="pijesak" ${sloj.tip === 'pijesak' ? 'checked' : ''} onchange="izmjeniSloj(${sloj.id}, 'tip', 'pijesak')" class="scale-80"> Pijesak</label>
                        <label class="inline-flex items-center gap-0.5"><input type="radio" name="tip-${sloj.id}" value="glina" ${sloj.tip === 'glina' ? 'checked' : ''} onchange="izmjeniSloj(${sloj.id}, 'tip', 'glina')" class="scale-80"> Glina</label>
                        <label class="inline-flex items-center gap-0.5"><input type="radio" name="tip-${sloj.id}" value="tvrdo" ${sloj.tip === 'tvrdo' ? 'checked' : ''} onchange="izmjeniSloj(${sloj.id}, 'tip', 'tvrdo')" class="scale-80"> Tvrdo</label>
                    </div>
                `;
        container.appendChild(div);
    });
}

function dodajSloj() {
    const noviId = geoloskiSlojevi.length > 0 ? Math.max(...geoloskiSlojevi.map(s => s.id)) + 1 : 1;
    geoloskiSlojevi.push({ id: noviId, tip: 'glina', debljina: 4.0, gama: 18.0, param_srednja: 80, param_min: 60 });
    iscrtajSlojeveUSidebaru();
    azurirajSve();
}

function obrisiSloj(id) {
    geoloskiSlojevi = geoloskiSlojevi.filter(s => s.id !== id);
    iscrtajSlojeveUSidebaru();
    azurirajSve();
}

function izmjeniSloj(id, polje, vrijednost) {
    let sloj = geoloskiSlojevi.find(s => s.id === id);
    if (!sloj) return;
    if (polje === 'tip') {
        sloj.tip = vrijednost;
        if (vrijednost === 'pijesak') {
            sloj.param_srednja = 20;
            sloj.param_min = 12;
        } else if (vrijednost === 'glina') {
            sloj.param_srednja = 80;
            sloj.param_min = 60;
        } else if (vrijednost === 'tvrdo') {
            sloj.param_srednja = 163.66;
            sloj.param_min = 152;
        }
        iscrtajSlojeveUSidebaru();
    } else {
        sloj[polje] = parseFloat(vrijednost) || 0;
    }
    azurirajSve();
}

// ----------------------------------------------------------------
// 8. 3D SCENA (THREE.JS)
// ----------------------------------------------------------------
let scene, camera, renderer, controls;
let tloGrupa, sipoGrupa;

function inicijalizuj3DProzor() {
    const container = document.getElementById('canvas-container');
    if (!container) return;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);
    camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(18, 14, 24);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    let dLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dLight.position.set(15, 35, 15);
    scene.add(dLight);
    tloGrupa = new THREE.Group();
    sipoGrupa = new THREE.Group();
    scene.add(tloGrupa);
    scene.add(sipoGrupa);

    function animiraj() {
        requestAnimationFrame(animiraj);
        controls.update();
        renderer.render(scene, camera);
    }
    animiraj();
}

function generisiProceduralni3DModel(podaci) {
    if (!scene) return;
    while (tloGrupa.children.length) tloGrupa.remove(tloGrupa.children[0]);
    while (sipoGrupa.children.length) sipoGrupa.remove(sipoGrupa.children[0]);

    const širina = Math.max(podaci.nx * podaci.sx * 2.5, 18);
    const dužina = Math.max(podaci.ny * podaci.sy * 2.5, 18);
    const boje = [0xd4a373, 0x5c7aad, 0x4895ef];
    let akum = 0;
    geoloskiSlojevi.forEach((sloj, idx) => {
        const h = sloj.debljina;
        if (h <= 0) return;
        let boja = boje[idx % boje.length];
        if (sloj.tip === 'pijesak') boja = 0xd4a373;
        if (sloj.tip === 'tvrdo') boja = 0x334155;
        const geo = new THREE.BoxGeometry(širina, h, dužina);
        const mat = new THREE.MeshStandardMaterial({
            color: boja, transparent: true, opacity: sloj.tip === 'tvrdo' ? 0.6 :
                0.35, depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, -akum - h / 2, 0);
        tloGrupa.add(mesh);
        akum += h;
    });

    // Voda
    const geoVoda = new THREE.PlaneGeometry(širina + 0.4, dužina + 0.4);
    geoVoda.rotateX(-Math.PI / 2);
    const matVoda = new THREE.MeshStandardMaterial({
        color: 0x0ea5e9, transparent: true, opacity: 0.5, side: THREE
            .DoubleSide, depthWrite: true
    });
    const meshVoda = new THREE.Mesh(geoVoda, matVoda);
    meshVoda.position.set(0, -podaci.npv, 0);
    meshVoda.renderOrder = 10;
    tloGrupa.add(meshVoda);

    // Kapa
    const capW = (podaci.nx - 1) * podaci.sx + podaci.D * 1.8;
    const capD = (podaci.ny - 1) * podaci.sy + podaci.D * 1.8;
    const geoCap = new THREE.BoxGeometry(capW, podaci.capT, capD);
    const matCap = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4 });
    const meshCap = new THREE.Mesh(geoCap, matCap);
    meshCap.position.set(0, podaci.capT / 2, 0);
    sipoGrupa.add(meshCap);

    // Šipovi
    const startX = -((podaci.nx - 1) * podaci.sx) / 2;
    const startZ = -((podaci.ny - 1) * podaci.sy) / 2;
    const geoŠip = new THREE.CylinderGeometry(podaci.D / 2, podaci.D / 2, podaci.L, 16);
    const matŠip = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
    for (let i = 0; i < podaci.nx; i++) {
        for (let j = 0; j < podaci.ny; j++) {
            const mesh = new THREE.Mesh(geoŠip, matŠip);
            mesh.position.set(startX + i * podaci.sx, -podaci.L / 2, startZ + j * podaci.sy);
            sipoGrupa.add(mesh);
        }
    }
    controls.target.set(0, -podaci.L / 2, 0);
}

// ----------------------------------------------------------------
// 9. POVEZIVANJE
// ----------------------------------------------------------------
function azurirajSve() {
    const podaci = izvrsiKompletnuAnalizu();
    generisiProceduralni3DModel(podaci);
}

window.onload = function () {
    iscrtajSlojeveUSidebaru();
    inicijalizuj3DProzor();
    azurirajSve();
};

window.addEventListener('resize', () => {
    const container = document.getElementById('canvas-container');
    if (!container || !camera || !renderer) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});