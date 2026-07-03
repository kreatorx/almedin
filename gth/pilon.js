function toggleSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden');
        sidebar.classList.add('flex');
    } else {
        sidebar.classList.remove('flex');
        sidebar.classList.add('hidden');
    }
    setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 50);
}

// Tabela 4-1: Linearna interpolacija za Nc kod gline
function izracunajNc(cu) {
    const tab_cu = [25, 50, 100, 200];
    const tab_Nc = [6.5, 8.0, 8.7, 9.0];
    if (cu <= tab_cu[0]) return tab_Nc[0];
    if (cu >= tab_cu[tab_cu.length - 1]) return tab_Nc[tab_Nc.length - 1];
    for (let i = 0; i < tab_cu.length - 1; i++) {
        if (cu >= tab_cu[i] && cu <= tab_cu[i + 1]) {
            let x0 = tab_cu[i], x1 = tab_cu[i + 1];
            let y0 = tab_Nc[i], y1 = tab_Nc[i + 1];
            return y0 + (cu - x0) * (y1 - y0) / (x1 - x0);
        }
    }
    return 9.0;
}

// Tabela 4-3: Interpolacija empirijskih vrijednosti za zabijene šipove u nekoherentnom tlu
function getZabijeniNekoherentnoParametre(Nspt) {
    const tab_N = [0, 4, 10, 30, 50, 100];
    const tab_Nq_minus_1 = [8, 8, 12, 20, 40, 50];
    const tab_delta = [15, 15, 20, 25, 30, 35];
    const tab_qsmax = [2000, 2000, 3000, 5000, 10000, 12000]; // u kPa (iz MPa)

    if (Nspt <= tab_N[0]) return { nq1: tab_Nq_minus_1[0], delta: tab_delta[0], qsmax: tab_qsmax[0] };
    if (Nspt >= tab_N[tab_N.length - 1]) return { nq1: tab_Nq_minus_1[tab_N.length - 1], delta: tab_delta[tab_delta.length - 1], qsmax: tab_qsmax[tab_qsmax.length - 1] };

    for (let i = 0; i < tab_N.length - 1; i++) {
        if (Nspt >= tab_N[i] && Nspt <= tab_N[i + 1]) {
            let factor = (Nspt - tab_N[i]) / (tab_N[i + 1] - tab_N[i]);
            return {
                nq1: tab_Nq_minus_1[i] + factor * (tab_Nq_minus_1[i + 1] - tab_Nq_minus_1[i]),
                delta: tab_delta[i] + factor * (tab_delta[i + 1] - tab_delta[i]),
                qsmax: tab_qsmax[i] + factor * (tab_qsmax[i + 1] - tab_qsmax[i])
            };
        }
    }
}

//EC 7-1 2.4.7.3.4
let projektniPristup = [
    { id: 1, naziv: 'P1K1', opis: 'Konstruktivna (A1+M1+R1)', faktor_baza: 1.25, faktor_omotac: 1.0 }, // PP1 K1 Plitki temelji, potporni zidovi itd. 
    { id: 2, naziv: 'P1K2', opis: 'Geotehnička (A2+M2+R1)', faktor_baza: 1.60, faktor_omotac: 1.30 },    // PP1 K2 Šipovi i sidra
    { id: 3, naziv: 'P2K1', opis: 'Geotehnička (A1+M1/M2+R2)', faktor_baza: 1.60, faktor_omotac: 1.30 },     // PP2 K1 Šipovi i sidra, redukcija otpora R 
    { id: 4, naziv: 'P3K1', opis: 'Geotehnička (A1/A2+M2+R3)', faktor_baza: 1.60, faktor_omotac: 1.30 }     // PP3 K1 Šipovi i sidra, razdvaja izvor opterećenja
    ]




// Podaci o slojevima. Parametar predstavlja cu za glinu ili N60/Nspt za pijesak
let geoloskiSlojevi = [
    { id: 1, tip: 'pijesak', debljina: 4.0, gama: 16, param_srednja: 6.33, param_min: 5 },
    { id: 2, tip: 'glina', debljina: 4.0, gama: 21, param_srednja: 163.66, param_min: 152 },
    { id: 3, tip: 'tvrdo', debljina: 3.0, gama: 19.5, param_srednja: 300, param_min: 250 }
];


// KORELACIONI FAKTORI
// xi1 i xi2 Statička ispitivanja, hidraulične prese i kontrategovi
const xiTabele1 = {
    "1": { xi1: 1.40, xi2: 1.40 },
    "2": { xi1: 1.30, xi2: 1.20 },
    "3": { xi1: 1.20, xi2: 1.05 },
    "4": { xi1: 1.10, xi2: 1.00 },
    "5": { xi1: 1.00, xi2: 1.00 }
};

//xi3 i xi4 Geotehnički ogledi broj udaraca SPT ili otpor na vrhu pentrometra CPT
const xiTabele2 = {  
    "1": { xi1: 1.40, xi2: 1.40 },
    "2": { xi1: 1.35, xi2: 1.27 },
    "3": { xi1: 1.33, xi2: 1.23 },
    "4": { xi1: 1.31, xi2: 1.20 },
    "5": { xi1: 1.29, xi2: 1.15 },
    "6": { xi1: 1.27, xi2: 1.12 },
    "7": { xi1: 1.25, xi2: 1.08 }
};

//xi5 i xi6 Dinamička ispitivanja, PDA i signal matching
const xiTabele3 = {
    "2": { xi1: 1.60, xi2: 1.50 },
    "5": { xi1: 1.50, xi2: 1.35 },
    "10": { xi1: 1.45, xi2: 1.30 },
    "15": { xi1: 1.42, xi2: 1.25 },
    "20": { xi1: 1.40, xi2: 1.25 }
};


// EQU (EQUILIBRIUM) - GRANIČNO STANJE GUBITKA STATIČKE RAVNOTEŽE
// Parcijalni faktori za dejstva
const gammaGdst = 1.1; // stalno destabilizirajuće
const gammaGst = 1.0;  // stalno stabilizirajuće
const gammaQdst = 1.5; // promjenjivo destabilizirajuće
const gammaQst = 0;    // promjenjivo stabilizirajuće

// Parcijalni faktori za parametre tla gammaM - primjenjuje se na tang Fi'
const gammaFi = 1.25;   // efektivni ugao otpornosti na trenje
const gammaC = 1.25;    // efektivna kohzija  
const gammaGama = 1.00; // jedinična težina
const gammaCu = 1.4;    // nedrenirana otpornost na smicanje
const gammaQu = 1.4;    // jednoaksijalna pritisna čvstoća


// STR (STRUCTURE) - GRANIČNO STANJE LOMA ILI PREKOMJERNE DEFORMACIJE KONSTRUKCIJE
// Parcijalni faktori za dejstva
const gammaGA1 = 1.35; // stalno nepovoljno
const gammaGA2 = 1.0;  // stalno povoljno
const gammaQA1 = 1.5; // promjenjivo nepovoljno
const gammaQA2 = 1.3;    // promjenjivo povoljno

// Parcijalni faktori za parametre tla gammaM M1 i M2 - primjenjuje se na tang Fi'
const gammaFiM = [1.0,1.25];   // efektivni ugao otpornosti na trenje
const gammaCM = [1.0, 1.25];    // efektivna kohzija  
const gammaGamaM = [1.0, 1.4]; // jedinična težina
const gammaCuM = [1.0, 1.4];    // nedrenirana otpornost na smicanje
const gammaQuM = [1.0, 1.0];    // jednoaksijalna pritisna čvstoća


// PARCIJALNI FAKTORI ZA OTPORE TEMELJENJA NA ŠIPOVIMA gammaR
// Za plitko temeljenje i potporne zidove (R1 , R2, R3) otpori gammaRv - sila u podtlu i gammaRh - klizanje
const gammaRv = [1.0, 1.4, 1.0]; // otpor u podtlu
const GammaRh = [1.0, 1.1, 1.0]; // otpor klizanja

// Za duboko temeljenje na zabijenim šipovima (R1 , R2, R3, R4)
const gammaRbz = [1.0, 1.1, 1.0, 1.3]; // otpor u podtlu
const GammaRsz = [1.0, 1.1, 1.0, 1.3]; // otpor klizanja
const gammaRtz = [1.0, 1.1, 1.0, 1.3]; // ukupni otpor
const gammaRstz = [1.25, 1.15, 1.1, 1.6]; // omotač, zategnuti šip

// Za duboko temeljenje na bušenim šipovima (R1 , R2, R3, R4)
const gammaRbb = [1.25, 1.1, 1.0, 1.6]; // otpor u podtlu
const GammaRsb = [1.0, 1.1, 1.0, 1.3]; // otpor klizanja
const gammaRtb = [1.15, 1.1, 1.0, 1.5]; // ukupni otpor
const gammaRstb = [1.25, 1.15, 1.1, 1.6]; // omotač, zategnuti šip

// Za duboko temeljenje na uvrnutim u tlo šipovima (R1 , R2, R3, R4)
const gammaRbb = [1.1, 1.1, 1.0, 1.45]; // otpor u podtlu
const GammaRsb = [1.0, 1.1, 1.0, 1.3]; // otpor klizanja
const gammaRtb = [1.1, 1.1, 1.0, 1.4]; // ukupni otpor
const gammaRstb = [1.25, 1.15, 1.15, 1.6]; // omotač, zategnuti šip


function iscrtajSlojeveUSidebaru() {
    const container = document.getElementById('proceduralni-slojevi');
    container.innerHTML = '';

    geoloskiSlojevi.forEach((sloj, index) => {
        const naslov = sloj.tip === 'pijesak' ? 'N_SPT / N60' : 'c_u (kPa)';
        const slId = sloj.id;

        const div = document.createElement('div');
        div.className = "p-3 bg-slate-950 rounded border border-slate-800 space-y-2 text-xs relative";
        div.innerHTML = `
                    <div class="flex justify-between items-center">
                        <span class="font-bold ${sloj.tip === 'pijesak' ? 'text-amber-500' : sloj.tip === 'glina' ? 'text-indigo-400' : 'text-white'}">Sloj ${index + 1}: ${sloj.tip.toUpperCase()}</span>
                        <button onclick="obrisiSloj(${slId})" class="text-slate-500 hover:text-red-400 font-bold text-[10px]">Ukloni</button>
                    </div>
                    <div class="grid grid-cols-2 gap-1.5">
                        <div>
                            <label class="text-[10px] text-slate-500 block">Debljina (m)</label>
                            <input type="number" value="${sloj.debljina}" oninput="izmjeniSloj(${slId}, 'debljina', this.value)" class="w-full p-1 bg-slate-800 border border-slate-700 rounded text-white text-center">
                        </div>
                        <div>
                            <label class="text-[10px] text-slate-500 block">γ (kN/m³)</label>
                            <input type="number" value="${sloj.gama}" oninput="izmjeniSloj(${slId}, 'gama', this.value)" class="w-full p-1 bg-slate-800 border border-slate-700 rounded text-white text-center">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-1.5">
                        <div>
                            <label class="text-[10px] text-amber-400 block">Srednji ${naslov}</label>
                            <input type="number" value="${sloj.param_srednja}" oninput="izmjeniSloj(${slId}, 'param_srednja', this.value)" class="w-full p-1 bg-slate-800 border border-slate-700 rounded text-white text-center font-bold">
                        </div>
                        <div>
                            <label class="text-[10px] text-red-400 block">Minimalni ${naslov}</label>
                            <input type="number" value="${sloj.param_min}" oninput="izmjeniSloj(${slId}, 'param_min', this.value)" class="w-full p-1 bg-slate-800 border border-slate-700 rounded text-white text-center font-bold">
                        </div>
                    </div>
                    <div class="text-[10px] flex gap-2 pt-1 text-slate-400">
                        <span>Tip tla:</span>
                        <label class="inline-flex items-center gap-1"><input type="radio" name="tip-${slId}" value="pijesak" ${sloj.tip === 'pijesak' ? 'checked' : ''} onchange="izmjeniSloj(${slId}, 'tip', 'pijesak')" class="scale-90"> Pijesak/Šljunak</label>
                        <label class="inline-flex items-center gap-1"><input type="radio" name="tip-${slId}" value="glina" ${sloj.tip === 'glina' ? 'checked' : ''} onchange="izmjeniSloj(${slId}, 'tip', 'glina')" class="scale-90"> Glina</label>
                        <label class="inline-flex items-center gap-1"><input type="radio" name="tip-${slId}" value="tvrdo" ${sloj.tip === 'tvrdo' ? 'checked' : ''} onchange="izmjeniSloj(${slId}, 'tip', 'tvrdo')" class="scale-90"> Tvrdo tlo (Stijena)</label>
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
            sloj.param_srednja = 20; sloj.param_min = 12;
        } else if (vrijednost === 'glina') {
            sloj.param_srednja = 80; sloj.param_min = 60;
        } else if (vrijednost === 'tvrdo') {
            sloj.param_srednja = 163.66; sloj.param_min = 152;

        }
        iscrtajSlojeveUSidebaru();
    } else {
        sloj[polje] = parseFloat(vrijednost) || 0;
    }
    azurirajSve();
}

// GLAVNI GEOTEHNIČKI PRORAČUN SA INTEGRISANIM SLIKAMA/TABELAMA
function proracunajSipKapacitet(D, L, npv, modStatistike, tehnologija) {
    const Ab = (Math.PI * Math.pow(D, 2)) / 4;
    const O = Math.PI * D;

    let Rsk = 0;
    let preostaloL = L;
    let trenutnaDubina = 0;

    // Prvo izračunajmo vertikalna efektivna naprezanja na granicama slojeva za potrebe integracije napona
    let efektivniNaponiGranice = [0];
    let kumulativniNapon = 0;

    geoloskiSlojevi.forEach((sl) => {
        let d_voda = 0;
        let d_suho = sl.debljina;

        let nivoGore = trenutnaDubina;
        let nivoDole = trenutnaDubina + sl.debljina;

        if (nivoGore >= npv) {
            d_voda = sl.debljina;
            d_suho = 0;
        } else if (nivoDole > npv) {
            d_suho = npv - nivoGore;
            d_voda = nivoDole - npv;
        }

        let prirastaj = (d_suho * sl.gama) + (d_voda * (sl.gama - 9.81));
        kumulativniNapon += prirastaj;
        efektivniNaponiGranice.push(kumulativniNapon);
        trenutnaDubina += sl.debljina;
    });

    // Ponovo prolazimo za proračun otpora omotača Rsk duž šipa L
    preostaloL = L;
    trenutnaDubina = 0;
    let brojacSloja = 0;

    geoloskiSlojevi.forEach((sl) => {
        if (preostaloL <= 0) return;
        let dz = Math.min(sl.debljina, preostaloL);

        let z_sredina = trenutnaDubina + (dz / 2);
        let valParam = modStatistike === 'srednja' ? sl.param_srednja : sl.param_min;
        let qs_k = 0;

        // Računanje efektivnog napona na sredini ove lamele šipa
        let naporGore = efektivniNaponiGranice[brojacSloja];
        let d_voda_lamela = 0;
        let d_suho_lamela = dz / 2;
        if (trenutnaDubina >= npv) {
            d_voda_lamela = dz / 2;
            d_suho_lamela = 0;
        } else if ((trenutnaDubina + dz / 2) > npv) {
            d_suho_lamela = npv - trenutnaDubina;
            d_voda_lamela = (trenutnaDubina + dz / 2) - npv;
        }
        let sigma_y_sr = naporGore + (d_suho_lamela * sl.gama) + (d_voda_lamela * (sl.gama - 9.81));

        if (tehnologija === 'buseni') {
            // TABELA 4-2: BUŠENI ŠIPOVI
            if (sl.tip === 'glina') {
                let Patm = 100; // kPa
                let odnos = valParam / Patm;
                let alpha = 0.55;
                if (odnos >= 1.5 && odnos <= 2.5) {
                    alpha = 0.55 - 0.1 * (odnos - 1.5);
                } else if (odnos > 2.5) {
                    alpha = 0.45;
                }
                qs_k = alpha * valParam;
            } else {
                // BETA postupak za pijeske
                let N60 = valParam;
                let beta = 0.25;
                let N_bar = N60 > 15 ? 1.0 : N60 / 11;
                beta = Math.max(0.25, N_bar * (1.5 - 0.25 * Math.sqrt(z_sredina)));
                qs_k = beta * sigma_y_sr;
            }
        } else {
            // TABELA 4-3: ZABIJENI ŠIPOVI (API 1987)
            if (sl.tip === 'glina') {
                if (sigma_y_sr <= 0) sigma_y_sr = 1.0;
                let odnos = valParam / sigma_y_sr;
                let alpha = 0.55;
                if (odnos <= 1.0) {
                    alpha = 0.5 * Math.pow(odnos, -0.5);
                } else {
                    alpha = Math.min(1.0, 0.5 * Math.pow(odnos, -0.25));
                }
                qs_k = alpha * valParam;
            } else {
                let params = getZabijeniNekoherentnoParametre(valParam);
                let K = 1.0; // Puni šip prema slici
                qs_k = K * sigma_y_sr * Math.tan(params.delta * Math.PI / 180);
                if (qs_k > params.qsmax) qs_k = params.qsmax;
            }
        }

        Rsk += O * dz * qs_k;
        trenutnaDubina += sl.debljina;
        preostaloL -= dz;
        brojacSloja++;
    });

    // PRORAČUN OTPORA BAZE (qbk -> Rbk)
    let qbk = 0;
    let zadnjiSloj = geoloskiSlojevi[geoloskiSlojevi.length - 1];
    let indeksBaze = geoloskiSlojevi.findIndex((sl, i) => {
        let dubDoGore = geoloskiSlojevi.slice(0, i).reduce((acc, s) => acc + s.debljina, 0);
        return L >= dubDoGore && L <= (dubDoGore + sl.debljina);
    });
    let slojBaze = indeksBaze !== -1 ? geoloskiSlojevi[indeksBaze] : zadnjiSloj;
    let bParam = modStatistike === 'srednja' ? slojBaze.param_srednja : slojBaze.param_min;

    // Efektivni napon na samom vrhu/bazi šipa (y = L)
    let sigma_y_baza = eflectivniNaponNaDubini(L, npv);

    if (slojBaze.tip === 'tvrdo') {
        let Nc = izracunajNc(bParam); // Koristi postojeću linearnu interpolaciju iz Tabele 4-1
        qbk = Nc * bParam;
    } else {

        if (tehnologija === 'buseni') {
            // TABELA 4-1: BUŠENI ŠIPOVI (BAZA)
            if (slojBaze.tip === 'glina') {
                let Nc = izracunajNc(bParam);
                qbk = Nc * bParam;
            } else {
                let b = D / 2; // poluprečnik baze
                if ((L / b) <= 10) {
                    qbk = 60 * bParam * (L / (10 * b));
                } else {
                    qbk = 60 * bParam;
                }
            }
        } else {
            // TABELA 4-3: ZABIJENI ŠIPOVI (API 1987 - BAZA)
            if (slojBaze.tip === 'glina') {
                qbk = 9.0 * bParam;
            } else {
                let params = getZabijeniNekoherentnoParametre(bParam);
                qbk = sigma_y_baza * params.nq1;
            }
        }
    }

    let Rbk = Ab * qbk;
    return { Rbk, Rsk, Rtotal: Rbk + Rsk, sigma_baza: sigma_y_baza };
}

function eflectivniNaponNaDubini(dubina, npv) {
    let trenDub = 0;
    let napon = 0;
    for (let i = 0; i < geoloskiSlojevi.length; i++) {
        let sl = geoloskiSlojevi[i];
        if (dubina <= trenDub) break;
        let dz = Math.min(sl.debljina, dubina - trenDub);

        let d_voda = 0;
        let d_suho = dz;
        if (trenDub >= npv) {
            d_voda = dz; d_suho = 0;
        } else if ((trenDub + dz) > npv) {
            d_suho = npv - trenDub;
            d_voda = (trenDub + dz) - npv;
        }
        napon += (d_suho * sl.gama) + (d_voda * (sl.gama - 9.81));
        trenDub += sl.debljina;
    }
    return napon;
}

function izvrsiKompletnuAnalizu() {
    const D = parseFloat(document.getElementById('pile-d').value) || 0.5;
    const L = parseFloat(document.getElementById('pile-l').value) || 8.0;
    const Gk = parseFloat(document.getElementById('pile-gk').value) || 250;
    const Qk = parseFloat(document.getElementById('pile-qk').value) || 80;
    const npv = parseFloat(document.getElementById('w-level').value) || 2.0;
    const tehnologija = document.getElementById('pile-type').value;

    const nx = parseInt(document.getElementById('group-nx').value) || 1;
    const ny = parseInt(document.getElementById('group-ny').value) || 1;
    const sx = parseFloat(document.getElementById('group-sx').value) || 2.5;
    const sy = parseFloat(document.getElementById('group-sy').value) || 2.5;
    const capT = parseFloat(document.getElementById('cap-t').value) || 1.5;

    const profilKljuč = document.getElementById('num-profiles').value;
    const xi1 = xiTabele[profilKljuč].xi1;
    const xi2 = xiTabele[profilKljuč].xi2;

    document.getElementById('val-xi1').innerText = xi1.toFixed(2);
    document.getElementById('val-xi2').innerText = xi2.toFixed(2);

    const capSrednja = proracunajSipKapacitet(D, L, npv, 'srednja', tehnologija);
    const capMinimalna = proracunajSipKapacitet(D, L, npv, 'min', tehnologija);

    -const R_b_k = Math.min(capSrednja.Rbk / xi1, capMinimalna.Rbk / xi2);    //EC 7-1 7.6.2.2
    const R_s_k = Math.min(capSrednja.Rsk / xi1, capMinimalna.Rsk / xi2);
    const R_c_k = R_b_k + R_s_k;

    let n_total = nx * ny;
    let η = 1.0;
    if (n_total > 1) {
        let theta = Math.atan(D / ((sx + sy) / 2)) * (180 / Math.PI);
        η = 1 - (theta / 90) * (((nx - 1) * ny + (ny - 1) * nx) / (nx * ny));
    }

    let E_d_K1 = (1.35 * Gk + 1.50 * Qk) * n_total;
    let R_d_K1 = n_total * η * ((R_b_k / 1.25) + (R_s_k / 1.0));
    let u_K1 = (E_d_K1 / R_d_K1) * 100;

    document.getElementById('val-ed-k1').innerText = E_d_K1.toFixed(1) + " kN";
    document.getElementById('val-rd-k1').innerText = R_d_K1.toFixed(1) + " kN";
    let lblK1 = document.getElementById('status-k1');
    lblK1.innerText = u_K1 <= 100 ? `ZADOVOLJAVA (${u_K1.toFixed(1)}%)` : `PAD (${u_K1.toFixed(1)}%)`;
    lblK1.className = u_K1 <= 100 ? "bg-emerald-950 text-emerald-400 border border-emerald-800 px-1 rounded" : "bg-red-950 text-red-400 border border-red-800 px-1 rounded";

    let E_d_K2 = (1.00 * Gk + 1.30 * Qk) * n_total;
    let R_d_K2 = n_total * η * ((R_b_k / 1.60) + (R_s_k / 1.30));
    let u_K2 = (E_d_K2 / R_d_K2) * 100;

    document.getElementById('val-ed-k2').innerText = E_d_K2.toFixed(1) + " kN";
    document.getElementById('val-rd-k2').innerText = R_d_K2.toFixed(1) + " kN";
    let lblK2 = document.getElementById('status-k2');
    lblK2.innerText = u_K2 <= 100 ? `ZADOVOLJAVA (${u_K2.toFixed(1)}%)` : `PAD (${u_K2.toFixed(1)}%)`;
    lblK2.className = u_K2 <= 100 ? "bg-emerald-950 text-emerald-400 border border-emerald-800 px-1 rounded" : "bg-red-950 text-red-400 border border-red-800 px-1 rounded";

    let tekst = `[STATISTIČKA OBRADA PODATAKA TLA (EN 1997-1) - METODA: ${tehnologija.toUpperCase()}]\n`;
    tekst += `• Efektivni vertikalni napon na bazi šipa (z=${L}m): σ'_y = ${capSrednja.sigma_baza.toFixed(1)} kPa\n`;
    tekst += `• Karakteristični otpor baze (srednja/min): R_bk = ${capSrednja.Rbk.toFixed(1)} / ${capMinimalna.Rbk.toFixed(1)} kN\n`;
    tekst += `• Karakteristični otpor omotača (srednja/min): R_sk = ${capSrednja.Rsk.toFixed(1)} / ${capMinimalna.Rsk.toFixed(1)} kN\n\n`;

    tekst += `[PRORAČUN VEZE PROJEKTNIH OTPORA SXI]:\n`;
    tekst += `• Karakteristična vrijednost baze R_b,k = ${R_b_k.toFixed(1)} kN (parcijalni faktor ξ₁=${xi1} / ξ₂=${xi2})\n`;
    tekst += `• Karakteristična vrijednost omotača R_s,k = ${R_s_k.toFixed(1)} kN\n`;
    tekst += `• Ukupna nosivost pojedinačnog šipa R_c,k = ${R_c_k.toFixed(1)} kN\n\n`;

    tekst += `[GEOMETRIJSKI UKUPNI BLOK]:\n`;
    tekst += `• Broj šipova u grupi n = ${n_total} kom | Efikasnost grupe η = ${η.toFixed(3)}\n`;
    tekst += `• Projektni pristup 1 (DA1):\n`;
    tekst += `   -> K1 (Konstruktivna) [A1+M1+R1]: Efekat=${E_d_K1.toFixed(1)} kN | Otpor=${R_d_K1.toFixed(1)} kN -> Iskoristivost: ${u_K1.toFixed(1)}%\n`;
    tekst += `   -> K2 (Geotehnička)  [A2+M2+R4]: Efekat=${E_d_K2.toFixed(1)} kN | Otpor=${R_d_K2.toFixed(1)} kN -> Iskoristivost: ${u_K2.toFixed(1)}%\n`;

    document.getElementById('izvjestaj-tekst').innerHTML = tekst.replace(/\n/g, '<br>');

    return { D, L, nx, ny, sx, sy, capT, npv };
}

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

    while (tloGrupa.children.length > 0) tloGrupa.remove(tloGrupa.children[0]);
    while (sipoGrupa.children.length > 0) sipoGrupa.remove(sipoGrupa.children[0]);

    const širinaScene = Math.max(podaci.nx * podaci.sx * 2.5, 18);
    const dužinaScene = Math.max(podaci.ny * podaci.sy * 2.5, 18);
    const bojeSlojeva = [0xd4a373, 0x5c7aad, 0x4895ef];

    let akumuliranaDubina = 0;
    geoloskiSlojevi.forEach((sloj, index) => {
        const hSloja = sloj.debljina;
        if (hSloja <= 0) return;

        const geoSloj = new THREE.BoxGeometry(širinaScene, hSloja, dužinaScene);

        let bojaSlojaFin = bojeSlojeva[index % bojeSlojeva.length];
        if (sloj.tip === 'pijesak') bojaSlojaFin = 0xd4a373; // Pješčana
        if (sloj.tip === 'tvrdo') bojaSlojaFin = 0x334155;   // Tamno siva

        const matSloj = new THREE.MeshStandardMaterial({
            color: bojaSlojaFin,
            transparent: true,
            opacity: sloj.tip === 'tvrdo' ? 0.6 : 0.35,
            depthWrite: false
        });

        const meshSloj = new THREE.Mesh(geoSloj, matSloj);
        meshSloj.position.set(0, -akumuliranaDubina - hSloja / 2, 0);
        tloGrupa.add(meshSloj);
        akumuliranaDubina += hSloja;
    });

    const geoVoda = new THREE.PlaneGeometry(širinaScene + 0.4, dužinaScene + 0.4);
    geoVoda.rotateX(-Math.PI / 2);
    const matVoda = new THREE.MeshStandardMaterial({
        color: 0x0ea5e9, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: true
    });
    const meshVoda = new THREE.Mesh(geoVoda, matVoda);
    meshVoda.position.set(0, -podaci.npv, 0);
    meshVoda.renderOrder = 10;
    tloGrupa.add(meshVoda);

    const capW = (podaci.nx - 1) * podaci.sx + podaci.D * 1.8;
    const capD = (podaci.ny - 1) * podaci.sy + podaci.D * 1.8;
    const geoCap = new THREE.BoxGeometry(capW, podaci.capT, capD);
    const matCap = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4 });
    const meshCap = new THREE.Mesh(geoCap, matCap);
    meshCap.position.set(0, podaci.capT / 2, 0);
    sipoGrupa.add(meshCap);

    const startX = -((podaci.nx - 1) * podaci.sx) / 2;
    const startZ = -((podaci.ny - 1) * podaci.sy) / 2;
    const geoSip = new THREE.CylinderGeometry(podaci.D / 2, podaci.D / 2, podaci.L, 16);
    const matSip = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });

    for (let i = 0; i < podaci.nx; i++) {
        for (let j = 0; j < podaci.ny; j++) {
            const meshSip = new THREE.Mesh(geoSip, matSip);
            const pX = startX + i * podaci.sx;
            const pZ = startZ + j * podaci.sy;
            meshSip.position.set(pX, -podaci.L / 2, pZ);
            sipoGrupa.add(meshSip);
        }
    }
    controls.target.set(0, -podaci.L / 2, 0);
}

function azurirajSve() {
    const podaciZaRender = izvrsiKompletnuAnalizu();
    generisiProceduralni3DModel(podaciZaRender);
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