// ==========================================================================
// 1. GLOBALNE VARIJABLE I INICIJALNI PARAMETRI PRESJEKA
// ==========================================================================
let b = 30; //cm
let h = 50; //cm
let c = 3; //cm
let L = 5; //m
let q = 20; //kN/m
let M = 0; //kNm
let V = 0; //kN
let N = 0; //kN
let fiL = 16; //mm
let fiL2 = 14;
let fiV = 8; //mm

let fyk = 500; //MPa
let fck = 20; //MPa
let fcm = 0;
let fctm = 0;
let gamma1 = 1.15;
let gammac = 1.5;
let acc = 0.85; 
let Ec = 30000;  //MPa
let Es = 210000; //MPa
let E = 30000;   //MPa 
let sigSd = 435; //MPa
let sigSd1 = 0;
let sigSd2 = 0;
let d = 0;
let d1 = 0;
let d2 = 0;
let fcd = 0;
let fyd = 0;
let x = 0;
let z = 0;
let As = 0; //cm^2
let As1 = 0;
let As2 = 0;
let Mmax = 0;
let NEd = 0;
let MEds = 0;

let uEds = 0;
let vEd = 0;
let w1 = 0;
let xi = 0;
let zeta = 0;
let xi_lim = 0.617;
let zeta_lim = 0.7437;

const kcal = 1.00;
const eud = 25 / 1000;
let es1 = 0, es2 = 0, ec1 = 0, ec2 = 0, ecd = 0, ec = 0, es = 0;

let ecu3 = 0, ec3 = 0, n = 0, lambda = 0, eta = 0, eyd = 0, xlim = 0;
let signc = 0, signs1 = 0, signs2 = 0, suma_ = 0;
let xi_pivot = 0, x_p = 0, C_ = 0, uEds_lim = 0, MEd0 = 0, fcd_ = 0, fyd_ = 0, fyd_cm = 0, zs1 = 0, zs2 = 0, sigC = 0, sigS = 0, Fs1_ = 0, Fs2_ = 0, Fs1 = 0, Fs2 = 0, Fc = 0;

let podrucje = "";
let x_crtanje = 0;
let x_blok = 0;

const TOL = 1e-9;
let rasporedDonja = [[18,18]]; 
let rasporedGornja = [[14,14]];
let stub = false;
let proracunskiRaspored = null;

////fiksirana amratura
let eps_c_stv = 0;
let eps_c1_stv = 0;
let eps_s1_stv = 0;
let eps_s2_stv = 0;
let x_stv = 0;
let e_real = 0;
let As1_act = 0;
let As2_act = 0;
/////////////////////

const TextEdit = { format: format };

// ==========================================================================
// 2. EVENT LISTENERS ZA ULAZNE PODATKE ELEMENTA
// ==========================================================================
document.getElementById("inp-b").addEventListener("input", function (event) { b = parseFloat(event.target.value) || 0; proracun(); });
document.getElementById("inp-h").addEventListener("input", function (event) { h = parseFloat(event.target.value) || 0; proracun(); });
document.getElementById("inp-c").addEventListener("input", function (event) { c = parseFloat(event.target.value) || 0; proracun(); });
document.getElementById("inp-L").addEventListener("input", function (event) { L = parseFloat(event.target.value) || 0; proracun(); });
document.getElementById("inp-q").addEventListener("input", function (event) { q = parseFloat(event.target.value) || 0; proracun(); });
document.getElementById("inp-M").addEventListener("input", function (event) { M = parseFloat(event.target.value) || 0; proracun(); });
document.getElementById("inp-V").addEventListener("input", function (event) { V = parseFloat(event.target.value) || 0; proracun(); });
document.getElementById("inp-N").addEventListener("input", function (event) { N = parseFloat(event.target.value) || 0; proracun(); });
document.getElementById("inp-fiL").addEventListener("input", function (event) { fiL = parseFloat(event.target.value) || 0; proracun(); });
document.getElementById("inp-fiL2").addEventListener("input", function (event) { fiL2 = parseFloat(event.target.value) || 0; proracun(); });
document.getElementById("inp-fiV").addEventListener("input", function (event) { fiV = parseFloat(event.target.value) || 0; proracun(); });
document.getElementById("inp-E").addEventListener("input", function (event) { E = parseFloat(event.target.value) || 0; proracun(); });
document.getElementById("inp-fyk").addEventListener("input", function (event) { fyk = parseFloat(event.target.value) || 0; proracun(); });
document.getElementById("inp-g1").addEventListener("input", function (event) { gamma1 = parseFloat(event.target.value) || 0; proracun(); });
document.getElementById("inp-gc").addEventListener("input", function (event) { gammac = parseFloat(event.target.value) || 0; proracun(); });
document.getElementById("inp-fck").addEventListener("input", function (event) { fck = parseFloat(event.target.value) || 0; proracun(); });

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function naponCelik(es) { return clamp(Es * es, -fyd, fyd); }

// ==========================================================================
// 3. ODREĐIVANJE DILATACIJA PO PODRUČJIMA RAZMAKA NEUTRALNE OSE
// ==========================================================================
function odrediDilatacijePoX(xVal) {
    const xi_pivot_local = ecu3 / (ecu3 + eud);
    const x_p_local = xi_pivot_local * d;
    const x_lim_local = xi_lim * d;

    if (!Number.isFinite(xVal) || xVal > 1e8) {
        podrucje = "5 - centrični pritisak / mala ekscentričnost";
        x = Infinity;
        ec2 = ec3; ec1 = ec3; ec = ec2;
        es1 = -ec3; es2 = ec3;
        x_crtanje = h; x_blok = h;
        return;
    }

    x = Math.max(xVal, TOL);

    if (x <= x_p_local) {
        podrucje = "2 - savijanje, rotacija oko A";
        es1 = eud;
        ec2 = es1 * x / (d - x);
        ec1 = ec2 * (1 - h / x);
        es2 = ec2 * (1 - d2 / x);
        ec = ec2;
    } else if (x <= h) {
        ec2 = ecu3; ec1 = ec2 * (1 - h / x);
        es1 = ec2 * (d - x) / x; es2 = ec2 * (1 - d2 / x);
        ec = ec2;
        podrucje = (x <= x_lim_local) ? "3 - beton i zategnuta armatura iskorišteni" : "4 - pritisak sa savijanjem, zategnuta armatura nije iskorištena";
    } else {
        podrucje = "5 - pritisak, neutralna osa van presjeka";
        const C = h * (1 - ec3 / ecu3);
        ec2 = ec3 * x / (x - C);
        ec1 = ec2 * (1 - h / x);
        ec = ec2;
        es1 = -ec2 * (1 - d / x);
        es2 = ec2 * (1 - d2 / x);
    }
    x_crtanje = Math.min(Math.max(x, 0), h);
    x_blok = Math.min(Math.max(lambda * x, 0), h);
}

// ==========================================================================
// 4. GLAVNI STATIČKI PRORAČUN I DIMENZIONISANJE PRESJEKA
// ==========================================================================
function proracun() {
    ecu3 = fck < 55 ? 0.0035 : 0.0026 + 0.035 * ((90 - fck) / 100) ** 4;
    ec3 = fck < 55 ? 0.00175 : 0.00175 + 0.00055 * ((fck - 50) / 40);
    n = fck < 55 ? 2 : 1.4 + 23.4 * ((90 - fck) / 100) ** 4;
    lambda = fck < 55 ? 0.8 : 0.8 - (fck - 50) / 400;
    eta = fck < 55 ? 1.0 : 1.0 - (fck - 50) / 200;
    fctm = fck < 55 ? 0.3 * Math.pow(fck, 2 / 3) : 2.12 * Math.log(1 + (fck + 8) / 10);
    eyd = kcal * fyk / gamma1 / Es;

    fcd_ = fck / gammac;
    fcd = acc * fck / gammac;  

    fyd_ = fyk / gamma1;
    fyd = kcal * fyk / gamma1; 
    fyd_cm = fyd / 10;

    d1 = c + fiV / 10 + fiL / 20;
    d2 = c + fiV / 10 + fiL2 / 20;
    if (proracunskiRaspored) {
        if (proracunskiRaspored.d1 !== null) d1 = proracunskiRaspored.d1.y;
        if (proracunskiRaspored.d2 !== null) d2 = proracunskiRaspored.d2.y;
    }
    d = h - d1;
    zs1 = d - h / 2;
    zs2 = (h - d2) - h / 2;

    xi_lim = ecu3 / (ecu3 + eyd);
    zeta_lim = 1 - lambda * xi_lim / 2;
    uEds_lim = lambda * xi_lim * zeta_lim;
    xlim = xi_lim * d;

    let Mq = q * L * L / 8;  
    let M_ = M;
    MEd0 = Mq + M_;
    let MEd_design = MEd0;
    NEd = N;

    let e0 = Math.max(h / 3000, 0.02); 
    e_real = Infinity;
    let maliEkscentricitetPritisak = false;
    let cistiPritisakZaKlasifikaciju = false;

    if (Math.abs(NEd) > TOL) { e_real = MEd0 / NEd; }
    
    if (NEd > 0) {
        if (Math.abs(MEd0) < TOL) {
            cistiPritisakZaKlasifikaciju = true;
            maliEkscentricitetPritisak = true;
        } else if (Math.abs(e_real) <= e0) {
            maliEkscentricitetPritisak = true;
        }
        if (maliEkscentricitetPritisak) {
            const smjer = Math.abs(MEd0) < TOL ? 1 : Math.sign(MEd0);
            MEd_design = smjer * NEd * e0;
        }
        if (stub && !maliEkscentricitetPritisak) {
            console.warn("Stub sa N+M: potrebno koristiti interakcioni dijagram N-M.");
        }
    }

    Mmax = MEd_design;
    MEds = Mmax + NEd * zs1 / 100;
    let MEds_cm = MEds * 100;
    let fcd_cm = fcd / 10;  

    let Asmin_ = 0.26 * fctm / fyk * b * d;
    let Asmin = Math.max(Asmin_, 0.0013 * b * d);
    document.getElementById("As_min").innerText = "Minimalna armatura je potrebna: " + Asmin.toFixed(2) + " cm2";

    uEds = MEds_cm / (eta * b * d * d * fcd_cm);
    vEd = NEd / (b * d * fcd_cm);

    As1_act = 0, As2_act = 0;
    if (proracunskiRaspored) {
        if (proracunskiRaspored.redoviDonje) {
            proracunskiRaspored.redoviDonje.forEach(red => {
                red.sipke.forEach(sipka => { As1_act += Math.PI * (sipka.fi / 10) ** 2 / 4; });
            });
        }
        if (proracunskiRaspored.redoviGornje) {
            proracunskiRaspored.redoviGornje.forEach(red => {
                red.sipke.forEach(sipka => { As2_act += Math.PI * (sipka.fi / 10) ** 2 / 4; });
            });
        }
    }
    if (As1_act === 0) As1_act = As1 || 1.0;
    if (As2_act === 0) As2_act = As2 || 1.0;

    if (Math.abs(MEd0) < TOL && Math.abs(NEd) < TOL) {
        podrucje = "0 - Neopterećen presjek";
        x = 0; xi = 0; z = d; zeta = 1;
        ec2 = 0; ec1 = 0; ec = 0; es1 = 0; es2 = 0;
        x_crtanje = 0; x_blok = 0;
    }
    else if (NEd < 0 && Math.abs(MEd0) < TOL) {
        podrucje = "1 - čisto aksijalno zatezanje";
        x = 0; xi = 0; z = 0; zeta = 0; ec2 = 0; ec1 = 0; ec = 0; es1 = eud; es2 = eud; x_crtanje = 0; x_blok = 0;
    } 
    else if (NEd > 0 && maliEkscentricitetPritisak) {
        podrucje = "5 - čisti/mali ekscentrični pritisak";
        odrediDilatacijePoX(Infinity);
        xi = Infinity; z = h / 2; zeta = z / d;
    } 
    else if (Math.abs(NEd) < TOL) {
        if (uEds <= uEds_lim) {
            zeta = 0.5 * (1 + Math.sqrt(1 - 2 * uEds));
            xi = 2 / lambda * (1 - zeta); x = xi * d; z = zeta * d;
        } else {
            xi = xi_lim; zeta = zeta_lim; x = xlim; z = zeta_lim * d;
        }
        odrediDilatacijePoX(x);
    } 
    else {
        const funkcijaRavnoteze = (test_x) => {
            let test_ec2 = 0, test_ec1 = 0, test_es1 = 0, test_es2 = 0;
            const xi_pivot_local = ecu3 / (ecu3 + eud);
            const x_p_local = xi_pivot_local * d;
            if (test_x <= x_p_local) {
                test_es1 = eud; test_ec2 = test_es1 * test_x / (d - test_x);
                test_ec1 = test_ec2 * (1 - h / test_x); test_es2 = test_ec2 * (1 - d2 / test_x);
            } else if (test_x <= h) {
                test_ec2 = ecu3; test_ec1 = test_ec2 * (1 - h / test_x);
                test_es1 = test_ec2 * (d - test_x) / test_x; test_es2 = test_ec2 * (1 - d2 / test_x);
            } else {
                const C = h * (1 - ec3 / ecu3); test_ec2 = ec3 * test_x / (test_x - C);
                test_ec1 = test_ec2 * (1 - h / test_x); test_es1 = -test_ec2 * (1 - d / test_x); test_es2 = test_ec2 * (1 - d2 / test_x);
            }
            let sig1 = clamp(test_es1 * Es, -fyd, fyd);
            let sig2 = clamp(test_es2 * Es, -fyd, fyd);
            let test_x_blok = Math.min(lambda * test_x, h);
            let test_Fc = b * test_x_blok * (fcd / 10) * eta;
            return (-As1_act * sig1 / 10 + As2_act * sig2 / 10 + test_Fc) - NEd;
        };

        if (typeof Iter !== 'undefined' && Iter.bisekcija) {
            x = Iter.bisekcija(funkcijaRavnoteze, 1e-4, 10 * h, 1e-6, 100);
            xi = x / d; z = d - lambda * x / 2; zeta = z / d;
            odrediDilatacijePoX(x);
        } else {
            if (NEd > 0) {
                if (Math.abs(e_real) <= h / 100 / 6) {
                    odrediDilatacijePoX(1e9); xi = Infinity; z = h / 2; zeta = z / d;
                } else {
                    xi = x / d; z = d - lambda * x / 2; zeta = z / d; odrediDilatacijePoX(x);
                }
            } else {
                x = Math.max(TOL, 0.1 * d); xi = x / d; z = d - lambda * x / 2; zeta = z / d; odrediDilatacijePoX(x);
            }
        }
    }

    if (0 <= ec && ec <= ec3) { sigC = fcd * ec / ec3; } else if (ec3 < ec && ec <= ecu3) { sigC = fcd; }
    if (0 <= es && es <= eyd) { sigS = es * Es; } else if (eyd < es && es <= eud) { sigS = fyd; }

    if (Math.abs(MEd0) < TOL && Math.abs(NEd) < TOL) {
        As1 = 0; As2 = 0;
    }
    else if (maliEkscentricitetPritisak) {
        let As_potrebno = (NEd - eta * fcd_cm * b * h) / fyd_cm;
        As1 = Math.max(0, As_potrebno / 2); As2 = As1;
    }
    else if (MEds !== 0 && NEd === 0) {
        if (xi < xi_lim) { As1 = 1 / fyd_cm * (MEds_cm / zeta / d); As2 = 0; } 
        else {
            let MEds_lim = uEds_lim * eta * b * d * d * fcd_cm;
            let d_MEds = MEds_cm - MEds_lim;
            As1 = 1 / fyd_cm * (MEds_lim / zeta_lim / d + d_MEds / (d - d2)); As2 = 1 / fyd_cm * (d_MEds / (d - d2));
        }
    } 
    else if (MEds === 0 && NEd !== 0) {
        As1 = (NEd - eta * fcd_cm * b * h) / fyd_cm / 2; As2 = As1;
    } 
    else if (MEds !== 0 && NEd !== 0) {
        if (xi < xi_lim) { As1 = 1 / fyd_cm * (MEds_cm / zeta / d - NEd); As2 = 0; } 
        else {
            let MEds_lim = uEds_lim * eta * b * d * d * fcd_cm;
            let d_MEds = MEds_cm - MEds_lim;
            As1 = 1 / fyd_cm * (MEds_lim / zeta_lim / d + d_MEds / (d - d2) - NEd); As2 = 1 / fyd_cm * (d_MEds / (d - d2));
        }
    }

    w1 = As1 * fyd / (b * d * fcd + NEd);
    w2 = As2 * fyd / (b * d * fcd);

    let As_max = (As1 + As2) / (b * h);
    document.getElementById("As_max").style.color = (Math.abs(As_max) < Math.max(0.1 * NEd / fyd, 0.002) || Math.abs(As_max) > (stub ? 0.08 : 0.04)) ? "#dc3545" : "#0eb30e";
    let As_max_ = suma_ / (b * h);
    document.getElementById("As_max_").style.color = (Math.abs(As_max_) < Math.max(0.1 * NEd / fyd, 0.002) || Math.abs(As_max_) > (stub ? 0.08 : 0.04)) ? "#dc3545" : "#0eb30e";
    
    document.getElementById("As_max").textContent = (As_max * 100).toFixed(2) + "%";
    document.getElementById("As_max_").textContent = (As_max_ * 100).toFixed(2) + "%";

    xi_pivot = ecu3 / (ecu3 + eud);
    x_p = xi_pivot * d;
    C_ = (1 - ec3 / ecu3) * h;
/*
    if (x <= x_p) {
        es1 = eud; ec = es1 * x / (d - x); es2 = ec - (d2 / d) * (ec + es1);
    } else if (x <= h) {
        ec = ecu3; es1 = ec * (d - x) / x; es2 = ec * (1 - d2 / x);
    } else {
        ec = ec3 * xi * d / (xi * d - C_); es1 = -ec3 * (x - d) / (x - C_); es2 = ec3 * (x - d2) / (x - C_);
    }
*/
    sigSd1 = naponCelik(es1);
    sigSd2 = naponCelik(es2);
    Fs1_ = As1 * sigSd1 / 10; Fs2_ = As2 * sigSd2 / 10;
    
    // Zadržavamo stabilne bazične veličine za geometrijski proračun
    Fs1 = As1 * fyd_cm; Fs2 = As2 * fyd_cm;
    x_blok = Number.isFinite(x) ? Math.min(lambda * x, h) : h;
    Fc = b * x_blok * fcd / 10 * eta;
    let a_c = x_blok / 2;

    signs1 = Math.sign(Fs1); signs2 = Math.sign(Fs2); signc = Math.sign(Fc);

    // RAČUNANJE SILA SA POTPUNIM ZNAKOM (Tenzija = +, Pritisak = -)
    let Fs1_potpuni = As1 * sigSd1 / 10; 
    let Fs2_potpuni = -As2 * sigSd2 / 10; 
    let Fc_potpuni = -Math.abs(Fc); 
    let N_potpuni = -NEd; 

    // Postavljanje čistih indikatora smjera: +1 za zatezanje (od presjeka), -1 za pritisak (prema presjeku)
    signc  = Math.sign(Fc_potpuni); // Biće -1 jer je beton uvijek u pritisku
    signs1 = Math.sign(Fs1_potpuni); // +1 ako zateže, -1 ako pritiska
    signs2 = Math.sign(Fs2_potpuni); // +1 ako zateže, -1 ako pritiska

    let sumN = Fs1_potpuni + Fs2_potpuni + Fc_potpuni - N_potpuni;
    let sumM = -Fc_potpuni * (d - a_c) / 100 - Fs2_potpuni * (d - d2) / 100 - MEds;

    document.getElementById("Sum_N").innerText = Fs1_potpuni.toFixed(2) + " + " + Fs2_potpuni.toFixed(2) + " + " + Fc_potpuni.toFixed(2) + " - (" + N_potpuni.toFixed(2) + ") = " + sumN.toFixed(2) + " kN";
    document.getElementById("Sum_M").innerText = (-Fc_potpuni * (d - lambda * x / 2) / 100).toFixed(2) + " + " + (-Fs2_potpuni * (d - d2) / 100).toFixed(2) + " + " + (MEds).toFixed(2) + " = " + sumM.toFixed(2) + " kNm";

    popuniRezultate();
    proracunStvarnihDilatacija();
    crtajPresjek();
    
}

function proracunStvarnihDilatacija() {
    let M_meta = Math.abs(MEd0); // Ciljni moment unesen od korisnika (kNm)
    
    // Ako nema opterećenja ili nema armature, resetuj sve na nulu
    if (M_meta < TOL || (As1_act === 0 && As2_act === 0)) {
        eps_c_stv = 0; eps_c1_stv = 0; eps_s1_stv = 0; eps_s2_stv = 0; x_stv = 0;
        return;
    }

    let niska_ec = 0;
    let visoka_ec = ecu3; // Gornja granica proračuna je granična dilatacija ULS-a
    let konacno_x = 0;    // DEFINISANO OVDJE da bude dostupno na kraju funkcije!
    
    // Vanjska bisekcija: tražimo tačnu dilataciju gornje ivice betona (eps_c) koja daje traženi moment
    for (let iterOuter = 0; iterOuter < 100; iterOuter++) {
        let test_ec = (niska_ec + visoka_ec) / 2;

        // Unutrašnja bisekcija: tražimo položaj neutralne ose (x) za izabranu dilataciju betona tako da je N = 0
        let nisko_x = 0.01;
        let visoko_x = h * 5;
        let test_x = 0;

        for (let iterInner = 0; iterInner < 100; iterInner++) {
            test_x = (nisko_x + visoko_x) / 2;

            // Računanje dilatacija na nivoima armature na osnovu linearnog ponašanja ravnih presjeka
            let t_es1 = test_ec * (d - test_x) / test_x;
            let t_es2 = test_ec * (test_x - d2) / test_x;

            let t_sig1 = clamp(t_es1 * Es, -fyd, fyd);
            let t_sig2 = clamp(t_es2 * Es, -fyd, fyd);

            // Aproksimacija sile u betonu za radno stanje (linearno skaliranje bloka napona)
            let faktor_napona = test_ec <= ec3 ? (test_ec / ec3) : 1.0;
            let t_x_blok = Math.min(lambda * test_x, h);
            let t_Fc = b * t_x_blok * (fcd / 10) * eta * faktor_napona;

            let t_Fs1 = As1_act * t_sig1 / 10;
            let t_Fs2 = As2_act * t_sig2 / 10;
            
            let sumN = t_Fs2 + t_Fc - t_Fs1; // Uslov ravnoteže aksijalnih sila (N = 0)

            if (Math.abs(sumN) < 1e-5) break;
            if (sumN > 0) {
                visoko_x = test_x; // Previše pritiska, pomjeri osu prema gore
            } else {
                nisko_x = test_x;  // Previše zatezanja, pomjeri osu prema dole
            }
        }

        // Sa nađenim 'test_x' računamo unutrašnji moment otpornosti presjeka
        let t_es2 = test_ec * (test_x - d2) / test_x;
        let t_sig2 = clamp(t_es2 * Es, -fyd, fyd);
        let faktor_napona = test_ec <= ec3 ? (test_ec / ec3) : 1.0;
        let t_x_blok = Math.min(lambda * test_x, h);
        let t_Fc = b * t_x_blok * (fcd / 10) * eta * faktor_napona;
        let t_Fs2 = As2_act * t_sig2 / 10;

        let krak_Fc = d - t_x_blok / 2;
        let krak_Fs2 = d - d2;
        let M_unutrasnji = (t_Fc * krak_Fc + t_Fs2 * krak_Fs2) / 100; // Pretvaranje u kNm

        konacno_x = test_x; // Čuvamo vrijednost u varijablu koja je vidljiva van petlje

        if (Math.abs(M_unutrasnji - M_meta) < 1e-4) {
            niska_ec = test_ec; // Osiguraj da niska_ec drži tačnu vrijednost prije prekida
            break;
        }

        if (M_unutrasnji > M_meta) {
            visoka_ec = test_ec; // Presjek ima veći kapacitet, smanji ulaznu dilataciju betona
        } else {
            niska_ec = test_ec;  // Presjek traži više naprezanja, povećaj dilataciju betona
        }
    }

    // Dodjeljivanje stabilnih vrijednosti za ispis i crtanje
    eps_c_stv = niska_ec;
    x_stv = konacno_x;
    eps_s1_stv = eps_c_stv * (d - x_stv) / x_stv;
    eps_s2_stv = eps_c_stv * (x_stv - d2) / x_stv;
    
    // Dilatacija na samom dnu presjeka (koristi se za pravilnu geometriju linije na Canvasu)
    eps_c1_stv = eps_c_stv * (1 - h / x_stv); 
}

function proracunInterakcijeSimetricnoArmiranogPresjeka() { console.warn("Interakcioni dijagram još nije implementiran."); return null; }

// ==========================================================================
// 5. POMOĆNE FUNKCIJE ZA POPUNJAVANJE REZULTATA U HTML ODREDIŠTIMA
// ==========================================================================
function popuni(id, vrijednost, decimale, i = "") {
    try { document.getElementById(id).innerText = vrijednost.toFixed(decimale) + i; } 
    catch (e) { try { document.getElementById(id).innerText = "greska"; } catch (err) {} }
}

function popuniRezultate() {
    popuni("res_M", MEds, 2, "  kNm"); popuni("res_N", NEd, 2, "  kN");
    
    popuni("res_uEds", uEds, 3, ""); let uEl = document.getElementById("res_uEds");
    if (uEl) uEl.style.color = uEds <= uEds_lim ? "#0080e9" : (uEds <= 0.55 ? "#fd7e14" : "#dc3545");

    popuni("res_vEd", vEd, 3);
    popuni("res_d", d, 2, "  cm"); popuni("res_d1", d1, 2, "  cm"); popuni("res_d2", d2, 2, "  cm");
    popuni("res_x", x, 2, "  cm"); popuni("res_z", z, 2, "  cm"); popuni("res_z1", zs1, 2, "  cm"); popuni("res_z2", zs2, 2, "  cm");
    popuni("res_xi", xi, 3, ""); popuni("res_xi_p", xi_pivot, 3, ""); popuni("res_x_p", x_p, 3, ""); popuni("res_zeta", zeta, 3, "");
    popuni("res_x_lim", xi_lim * d, 2, "  cm"); popuni("res_z_lim", zeta_lim * d, 2, "  cm"); popuni("res_xi_lim", xi_lim, 3, ""); popuni("res_zeta_lim", zeta_lim, 3, "");
    popuni("res_E", E, 2, "  GPa"); popuni("res_fcd", fcd, 2, "  MPa"); popuni("res_fyd", fyd, 2, "  MPa");
    popuni("res_lambdac", lambda, 2); popuni("res_eta", eta, 2); popuni("res_sigSd", sigSd, 2, "  MPa"); popuni("res_w1", w1, 4); popuni("res_w2", w2, 4);
    popuni("res_As1", As1, 3, "  cm2"); popuni("res_As2", As2, 3, "  cm2");
}

// ==========================================================================
// 6. GRAFIČKI CANVAS PRIKAZ PRESJEKA, NAPONA I DEFORMACIJA
// ==========================================================================
function crtajPresjek() {
    const canvasEl = document.getElementById("presjekCanvas");
    if (!canvasEl) return;

    // Prilagođavanje rezolucije ekrana i skaliranje dimenzija grednog presjeka
    const setup = rezolucija(canvasEl, window.devicePixelRatio || 2);
    const ctx = setup.ctx;
    const canvas = { get width() { return setup.width; }, get height() { return setup.height; } };
    const maxPixela = 300;
    let skala = maxPixela / h;

    const xGeomDraw = Number.isFinite(x) ? Math.min(Math.max(x, 0), h) : h;
    const xBlockDraw = Number.isFinite(x) ? Math.min(Math.max(lambda * x, 0), h) : h;

    if (b * skala > canvas.width - 100) { skala = (canvas.width - 100) / b; }

    const b_px = b * skala, h_px = h * skala;
    const x_start = 50, y_start = 20;
    const skala_dijagrama = 5000;

    // --- 6.1. SIVI PRAVOUGAONIK (Betonski presjek) ---
    ctx.lineWidth = 3; ctx.strokeStyle = "#333333"; ctx.fillStyle = "#e0e0e0";   
    ctx.beginPath(); ctx.rect(x_start, y_start, b_px, h_px); ctx.fill();

    // --- 6.2. POMOĆNE ISPREKIDANE OSI (Osa 0.3 za napone i 0.9 za dilatacije) ---
    ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = "#888888"; ctx.setLineDash([5, 5]); ctx.beginPath();
    ctx.moveTo(x_start + b_px, y_start); ctx.lineTo(canvas.width - 20, y_start);
    ctx.moveTo(x_start + b_px, y_start + h_px); ctx.lineTo(canvas.width - 20, y_start + h_px);
    ctx.moveTo(x_start + b_px+(canvas.width-x_start-b_px-20)*0.3, y_start-20); ctx.lineTo(x_start + b_px+(canvas.width-x_start-b_px-20)*0.3, y_start+h_px+20); 
    ctx.moveTo(x_start + b_px+(canvas.width-x_start-b_px-20)*0.9, y_start-20); ctx.lineTo(x_start + b_px+(canvas.width-x_start-b_px-20)*0.9, y_start + h_px+20);
    ctx.stroke(); ctx.restore();

    // Horizontalne linije nivoa gornje i donje armature na desnoj strani
    ctx.save(); ctx.strokeStyle="#000";ctx.lineWidth=1; ctx.beginPath();
    ctx.moveTo(x_start + b_px+(canvas.width-x_start-b_px-20)*0.9, y_start+d*skala);
    ctx.lineTo(x_start + b_px+(canvas.width-x_start-b_px-20)*0.9+es1*skala_dijagrama*(-1),y_start+d*skala);
    ctx.stroke(); ctx.beginPath();
    ctx.moveTo(x_start + b_px+(canvas.width-x_start-b_px-20)*0.9, y_start+d1*skala);
    ctx.lineTo(x_start + b_px+(canvas.width-x_start-b_px-20)*0.9+es2*skala_dijagrama,y_start+d1*skala);
    ctx.stroke(); ctx.restore();

    // Šatiranje pritisnutog dijela betona unutar samog presjeka (pod 45 stepeni)
    ctx.save(); ctx.lineWidth = 0.7; ctx.strokeStyle = "#222"; ctx.fillStyle = "#979797";
    ctx.fillStyle = createRotatedHatchPattern(ctx, "line", 45, 10, "#363333", 1); 
    ctx.beginPath(); ctx.rect(x_start, y_start, b_px, xGeomDraw * skala); ctx.stroke(); ctx.fill(); ctx.restore();
    
    // Crvene isprekidane linije za stvarnu neutralnu osu (x) i graničnu (x_lim)
    ctx.save(); ctx.lineWidth = 0.5; ctx.strokeStyle = "#bd7373"; ctx.setLineDash([5, 5]); ctx.beginPath();
    ctx.moveTo(x_start + b_px, y_start+x * skala); ctx.lineTo(canvas.width-20, y_start+x * skala);
    ctx.moveTo(x_start + b_px, y_start+xi_lim * d * skala); ctx.lineTo(canvas.width-20, y_start+xi_lim * d * skala);
    ctx.stroke(); ctx.restore();

    // --- 6.3. PRAVOUGAONI BLOK NAPONA BETONA (Šatirani blok na osi 0.3) ---
    ctx.save(); ctx.beginPath(); ctx.lineWidth = 0.5; ctx.strokeStyle = "#333"; 
    ctx.fillStyle = createRotatedHatchPattern(ctx, "line", 0, 5, "#363333", 1); 
    ctx.rect(x_start + b_px + (canvas.width - x_start - b_px - 20) * 0.3, y_start, fcd * eta * skala, xBlockDraw * skala); ctx.fill(); ctx.stroke();

    // Ispis geometrijskih vrijednosti (visina ose x, bloka lambda*x, granične ose x_lim)
    ctx.save(); ctx.fillStyle = "#000000"; ctx.font = "14px sans-serif"; ctx.textAlign = "left";
    TextEdit.format(ctx, `x = ${(x).toFixed(2)} cm`, x_start + b_px + 3 * skala, y_start + xGeomDraw * skala - 2 * skala, 14);
    TextEdit.format(ctx, `\u03BB·x = ${(lambda * x).toFixed(2)} cm`, x_start + b_px + (canvas.width - x_start - b_px - 20) * 0.3 + fcd * eta * skala + 5, y_start + xBlockDraw * skala, 14);
    TextEdit.format(ctx, `x_lim = ${(xi_lim*d).toFixed(2)} cm`, x_start + b_px + 3 * skala, y_start + xi_lim * d * skala, 14);
    ctx.restore();

    // Ispis granične čvrstoće pritisnutog betona (fcd * eta) iznad bloka
    ctx.fillStyle = "#000000"; ctx.font = "14px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`fcd·\u03B7 = ${(fcd*eta).toFixed(2)} MPa`, x_start + b_px+(canvas.width-x_start-b_px-20)*0.3 + 5, y_start - 8);

    // --- 6.4. TEKSTUALNI ISPIS REZULTUJUĆIH SILA I NAPONA U MATERIJALIMA ---
    let Fs1_potpuni = As1 * sigSd1 / 10;
    let Fs2_potpuni = -As2 * sigSd2 / 10;
    let Fc_potpuni = -Math.abs(fcd / 10 * eta * xBlockDraw * b);

    // Ispis unutrašnjih sila Fc, Fs1, Fs2 i napona u čeliku sigma_s1 i sigma_s2
    ctx.save(); ctx.fillStyle = "#000000"; ctx.textAlign = "left";
    TextEdit.format(ctx, `F_c = ${Fc_potpuni.toFixed(2)} kN`, x_start + b_px + (canvas.width - x_start - b_px - 20) * 0.3 + (fcd * eta / 2 + 10) * skala, y_start + Math.max(xBlockDraw / 2 * skala + 0.6 * skala, 3 * skala), 14);
    ctx.restore();
    ctx.save(); ctx.fillStyle = "#000000"; ctx.textAlign = "right";
    TextEdit.format(ctx, `\u03C3_s1 = ${(sigSd1).toFixed(2)} MPa`, x_start + b_px + (canvas.width - x_start - b_px - 20) * 0.3 -5, y_start + h_px + 3 * skala, 14);
    ctx.restore();
    ctx.save(); ctx.fillStyle = "#000000"; ctx.textAlign = "right";
    TextEdit.format(ctx, `\u03C3_s2 = ${(sigSd2).toFixed(2)} MPa`, x_start + b_px + (canvas.width - x_start - b_px - 20) * 0.3 -5 , y_start - 8, 14);
    ctx.restore();
    ctx.save(); ctx.fillStyle = "#000000"; ctx.textAlign = "left";
    TextEdit.format(ctx, `F_s1 = ${Fs1_potpuni.toFixed(2)} kN`, x_start + b_px + (canvas.width - x_start - b_px - 20) * 0.3 + (fcd * eta / 2+10) * skala, y_start + h_px - (d1-0.6) * skala, 14);
    ctx.restore();
    if (Fs2 !== 0) {
        ctx.save(); ctx.fillStyle = "#000000"; ctx.textAlign = "left";
        TextEdit.format(ctx, `F_s2 = ${Fs2_potpuni.toFixed(2)} kN`, x_start + b_px + (canvas.width - x_start - b_px - 20) * 0.3 + (fcd * eta / 2+10) * skala, y_start + (d2+0.6) * skala, 14);
        ctx.restore();
    }

    // Crtanje crnih horizontalnih linija i strelica za pravac i intenzitet unutrašnjih sila
    const arrowStartX = x_start + b_px + (canvas.width - x_start - b_px - 20) * 0.3 + (fcd * eta / 2) * skala;
    const arrowStartY = y_start;

    if (rasporedDonja.some(x => x[0] > 0 && x[1] > 0)) {
        ctx.save(); ctx.beginPath(); ctx.lineWidth = 5; ctx.strokeStyle = "#333"; 
        ctx.moveTo(arrowStartX-fcd*skala/2, arrowStartY + h_px - d1*skala);
        ctx.lineTo(arrowStartX-(fcd/2+signs1*sigSd1/100)*skala, arrowStartY + h_px - d1*skala);
        ctx.stroke(); ctx.restore();
    }
    if (rasporedGornja.some(x => x[0] > 0 && x[1] > 0) ) {
        ctx.save(); ctx.beginPath(); ctx.lineWidth = 5; ctx.strokeStyle = "#333"; 
        ctx.moveTo(arrowStartX-fcd*skala/2, arrowStartY + d2*skala);
        ctx.lineTo(arrowStartX-(fcd/2-signs2*sigSd2/100)*skala, arrowStartY + d2*skala);
        ctx.stroke(); ctx.restore();
    }
    
    // Grafički indikatori/strelice smijera (pritisak "prit." ili zatezanje "zat.") za beton i armature
    if (Fc !== 0) {
        ctx.save(); ctx.beginPath(); ctx.moveTo(arrowStartX+8*skala, arrowStartY+lambda*x/2*skala); ctx.lineTo(arrowStartX, arrowStartY+lambda*x/2*skala);
        if (signc >=0) {
            ctx.moveTo(arrowStartX+8*skala, arrowStartY+lambda*x/2*skala); ctx.lineTo(arrowStartX+6*skala, arrowStartY-1*skala+lambda*x/2*skala); ctx.lineTo(arrowStartX+6*skala, arrowStartY+1*skala+lambda*x/2*skala);
        } else {
            ctx.moveTo(arrowStartX, arrowStartY+lambda*x/2*skala); ctx.lineTo(arrowStartX+2*skala, arrowStartY-1*skala+lambda*x/2*skala); ctx.lineTo(arrowStartX+2*skala, arrowStartY+1*skala+lambda*x/2*skala);
        }
        ctx.closePath(); ctx.strokeStyle = "#000000"; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = "#000000"; ctx.fill();
        ctx.font = "10px sans-serif"; ctx.textAlign = "center"; ctx.fillText("prit.", arrowStartX + 4*skala, arrowStartY + lambda*x/2*skala - 3);
        ctx.restore();
    }
    if (Fs1 !== 0) {
        ctx.save(); let arrowStartYFs1 = arrowStartY + h_px - d1*skala; ctx.beginPath();
        ctx.moveTo(arrowStartX+8*skala, arrowStartYFs1); ctx.lineTo(arrowStartX, arrowStartYFs1);
        if (signs1 >=0 ) {
            ctx.moveTo(arrowStartX+8*skala, arrowStartYFs1); ctx.lineTo(arrowStartX+6*skala, arrowStartYFs1-1*skala); ctx.lineTo(arrowStartX+6*skala, arrowStartYFs1+1*skala);
        } else {
            ctx.moveTo(arrowStartX, arrowStartYFs1); ctx.lineTo(arrowStartX+2*skala, arrowStartYFs1-1*skala); ctx.lineTo(arrowStartX+2*skala, arrowStartYFs1+1*skala);
        }
        ctx.closePath(); ctx.strokeStyle = "#000000"; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = "#000000"; ctx.fill();
        ctx.font = "10px sans-serif"; ctx.textAlign = "center"; ctx.fillText(es1 >= 0 ? "zat." : "prit.", arrowStartX + 4*skala, arrowStartYFs1 - 3);
        ctx.restore();
    }
    if (Fs2 !== 0){
        ctx.save(); let arrowStartYFs2 = arrowStartY + d2*skala; ctx.beginPath();
        ctx.moveTo(arrowStartX+8*skala, arrowStartYFs2); ctx.lineTo(arrowStartX, arrowStartYFs2);
        if (signs2 >=0 ) {
            ctx.moveTo(arrowStartX+8*skala, arrowStartYFs2); ctx.lineTo(arrowStartX+6*skala, arrowStartYFs2-1*skala); ctx.lineTo(arrowStartX+6*skala, arrowStartYFs2+1*skala);
        } else {
            ctx.moveTo(arrowStartX, arrowStartYFs2); ctx.lineTo(arrowStartX+2*skala, arrowStartYFs2-1*skala); ctx.lineTo(arrowStartX+2*skala, arrowStartYFs2+1*skala);
        }
        ctx.closePath(); ctx.strokeStyle = "#000000"; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = "#000000"; ctx.fill();
        ctx.font = "10px sans-serif"; ctx.textAlign = "center"; ctx.fillText(es2 >= 0 ? "prit." : "zat.", arrowStartX + 4*skala, arrowStartYFs2 - 3);
        ctx.restore();
    }

    // --- 6.5. PLAVI DIJAGRAM GRANIČNIH DILATACIJA (ULS - Granično stanje sloma na osi 0.9) ---
    ctx.save(); ctx.lineWidth = 0.8; ctx.strokeStyle = "#0080e9"; ctx.setLineDash([]);
    const osa_ec = x_start + b_px + (canvas.width - x_start - b_px - 20) * 0.9;
    const yTop = y_start, yBottom = y_start + h_px, yS1 = y_start + d * skala, yS2 = y_start + d2 * skala;
    const xTop = osa_ec + ec2 * skala_dijagrama, xBottom = osa_ec + ec1 * skala_dijagrama;

    // Crtanje i prozirno plavo bojenje trouglova graničnih deformacija (slom betona/tečenje čelika)
    ctx.beginPath(); ctx.moveTo(xTop, yTop); ctx.lineTo(xBottom, yBottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(osa_ec, yTop); ctx.lineTo(xTop, yTop); ctx.lineTo(xBottom, yBottom); ctx.lineTo(osa_ec, yBottom); ctx.closePath();
    ctx.fillStyle = "rgba(0, 128, 233, 0.10)"; ctx.fill(); ctx.stroke();

    // Označavanje nivoa granične neutralne ose na plavom dijagramu
    if (Number.isFinite(x) && x >= 0 && x <= h) {
        ctx.beginPath(); ctx.strokeStyle = "#0080e9"; ctx.setLineDash([4, 4]);
        ctx.moveTo(osa_ec - 30, y_start + x * skala); ctx.lineTo(osa_ec + 30, y_start + x * skala); ctx.stroke();
    }

    // Iscrtavanje pomoćnih crvenih markera za maksimalne dozvoljene dilatacije čelika (eud i eyd)
    ctx.beginPath(); ctx.strokeStyle = "#ff0040"; ctx.setLineDash([5, 5]);
    ctx.moveTo(osa_ec - eud * skala_dijagrama, yBottom + 10); ctx.lineTo(osa_ec - eud * skala_dijagrama, yBottom - 40);
    ctx.moveTo(osa_ec - eyd * skala_dijagrama, yBottom + 10); ctx.lineTo(osa_ec - eyd * skala_dijagrama, yBottom - 40);
    ctx.stroke(); ctx.restore();

    // Ispis brojčanih vrijednosti teoretskih graničnih dilatacija (plavi tekstovi)
    ctx.fillStyle = "#000000"; ctx.font = "14px sans-serif"; ctx.textAlign = "left";
    TextEdit.format(ctx, `\u03B5_c3 = ${(ec2).toFixed(4)}`, osa_ec + 5, yTop - 8, 14);
    TextEdit.format(ctx, `\u03B5_c1 = ${(ec1).toFixed(4)}`, osa_ec + 5, yBottom + 18, 14);
    ctx.textAlign = "right";
    TextEdit.format(ctx, `\u03B5_s2 = ${(es2).toFixed(4)}`, osa_ec - 5, yS2 - 8, 14);
    ctx.textAlign = "right";
    TextEdit.format(ctx, `\u03B5_s1 = ${(es1).toFixed(4)}`, x_start + b_px+(canvas.width-x_start-b_px-20)*0.9 - 5, y_start + h_px + 3 * skala, 14);

    // --- 6.6. CRVENA LINIJA REALNIH DILATACIJA (Stvarno radno stanje za unijeti moment) ---
    if (typeof eps_c_stv !== 'undefined' && eps_c_stv > 1e-6) {
        ctx.save();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#dc3545"; // Pune crvene linije
        ctx.setLineDash([]);

        const xTopStv = osa_ec + eps_c_stv * skala_dijagrama;
        const xBottomStv = osa_ec + eps_c1_stv * skala_dijagrama; 

        // Vučenje crvene linije kroz osu (reaktivno se naginje zavisno od momenta)
        ctx.beginPath();
        ctx.moveTo(xTopStv, yTop);
        ctx.lineTo(xBottomStv, yBottom);
        ctx.stroke();

        // Crtanje male crvene crtice na nivou stvarne neutralne ose x_stv
        if (Number.isFinite(x_stv) && x_stv > 0 && x_stv <= h) {
            ctx.beginPath();
            ctx.strokeStyle = "#dc3545";
            ctx.lineWidth = 1.5;
            ctx.moveTo(osa_ec - 15, y_start + x_stv * skala);
            ctx.lineTo(osa_ec + 15, y_start + x_stv * skala);
            ctx.stroke();
        }

        // Boldirani ispis stvarnih dilatacija u promilima (crveni tekst)
        ctx.fillStyle = "#dc3545";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "left";
        TextEdit.format(ctx, `\u03B5_c,act = ${(eps_c_stv).toFixed(4)}`, osa_ec + 20, yTop + 14, 12);
        ctx.textAlign = "right";
        TextEdit.format(ctx, `\u03B5_s1,act = ${(eps_s1_stv).toFixed(4)}`, osa_ec - 10, y_start + (d-1) * skala, 12);
        
        ctx.restore();
    }

    // --- 6.7. GEOMETRIJA ARMATURE (Konstruktivni detalji: oplata, uzengije i šipke) ---
    // Crtanje spoljne crne oplate i crvene unutrašnje linije zaštitnog sloja (c)
    ctx.strokeStyle = "#333333"; ctx.beginPath(); ctx.rect(x_start, y_start, b_px, h_px); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = "#f01e2c"; ctx.beginPath(); ctx.rect(x_start + c * skala, y_start + c * skala, b_px - 2 * c * skala, h_px - 2 * c * skala); ctx.stroke();

    // Crtanje plave zatvorene linije uzengije (fiV) sa zaobljenim uglovima i kukama
    ctx.lineWidth = (fiV / 10) * skala; ctx.strokeStyle = "#779eb2"; ctx.beginPath();
    ctx.roundRect(x_start + (c + fiV / 20) * skala, y_start + (c + fiV / 20) * skala, b_px - 2 * (c + fiV / 20) * skala, h_px - 2 * (c + fiV / 20) * skala, 10*Math.min(30/b,50/h));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x_start + b_px - (c + fiV / 20) * skala, y_start + (c + 3*Math.min(30/b,50/h) + fiV / 20) * skala); ctx.lineTo(x_start + b_px - (c + fiV / 20) * skala - 3 * skala, y_start + (c + 3*Math.min(30/b,50/h) + fiV / 20) * skala + 3 * skala);
    ctx.moveTo(x_start + b_px - (c + 3*Math.min(30/b,50/h) + fiV / 20) * skala, y_start + (c + fiV / 20) * skala); ctx.lineTo(x_start + b_px - (c + 4*Math.min(30/b,50/h) - fiV / 20) * skala - 3 * skala, y_start + (c + fiV / 20) * skala + 3 * skala);
    ctx.stroke();

    // Funkcija za crtanje krugova armaturnih šipki na tačnim distancama unutar gornje/donje zone
    const iscrtajSveSipke = (redovi, polozaj) => {
        if (!redovi) return;
        redovi.forEach(red => {
            let y_canvas = polozaj === "donja" ? y_start + h_px - (red.y * skala) : y_start + (red.y * skala);
            red.sipke.forEach(sipka => {
                let x_canvas = x_start + (sipka.x * skala);
                ctx.beginPath(); ctx.arc(x_canvas, y_canvas, (sipka.fi / 20) * skala, 0, 2 * Math.PI);
                ctx.fillStyle = polozaj === "donja" ? "#779eb2" : "#a85d5d"; ctx.fill();
                ctx.lineWidth = 1; ctx.strokeStyle = "#333"; ctx.stroke();
            });
        });
    };

    // Pokretanje crtanja šipki i konačni ispis glavnih spoljnih dimenzija b i h grede
    if (proracunskiRaspored) { iscrtajSveSipke(proracunskiRaspored.redoviDonje, "donja"); iscrtajSveSipke(proracunskiRaspored.redoviGornje, "gornja"); }
    ctx.fillStyle = "#000000"; ctx.font = "14px sans-serif"; ctx.textAlign = "center"; ctx.fillText(`b = ${b} cm`, x_start + b_px / 2, y_start + h_px + 20);
    ctx.save(); ctx.translate(x_start - 20, y_start + h_px / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(`h = ${h} cm`, 0, 0); ctx.restore();
}

// ==========================================================================
// 7. PRERAČUNAVANJE I REGENERACIJA ZONE ARMATURA I RAZMAKA SVIH REDOVA
// ==========================================================================
window.preracunajSve = function() {
    const kontejnerDonja = document.getElementById("armatura-kontejner-donja");
    const kontejnerGornja = document.getElementById("armatura-kontejner-gornja");
    let As_donja = window.preracunajZonu(kontejnerDonja, "inp-precnik-d", "inp-broj-sipki-d", "lab_arm_d");
    let As_gornja = window.preracunajZonu(kontejnerGornja, "inp-precnik-g", "inp-broj-sipki-g", "lab_arm_g");
    suma_ = As_donja + As_gornja; 
    sakupiIRasporediArmaturu();
    proracun();
    return suma_;
};

function sakupiIRasporediArmaturu() {
    const sakupiIzKontejnera = (kontejnerId, klasaPrecnika, klasaBroja) => {
        const kontejner = document.getElementById(kontejnerId); if (!kontejner) return [];
        const listaRedova = kontejner.querySelector(".arm-lista-redova") || kontejner;
        const sviRedovi = listaRedova.querySelectorAll(".arm_red");
        let podaci = []; 
        sviRedovi.forEach(red => {
            const fi = parseFloat(red.querySelector("." + klasaPrecnika).value) || 0;
            const n = parseFloat(red.querySelector("." + klasaBroja).value) || 0;
            if (fi > 0 && n > 0) { podaci.push([fi, n]); }
        });
        return podaci;
    };
    let donjaZonaPodaci = sakupiIzKontejnera("armatura-kontejner-donja", "inp-precnik-d", "inp-broj-sipki-d");
    let gornjaZonaPodaci = sakupiIzKontejnera("armatura-kontejner-gornja", "inp-precnik-g", "inp-broj-sipki-g");
    proracunskiRaspored = new RasporedArmature(b, h, c, fiV, donjaZonaPodaci, gornjaZonaPodaci, fck);
}

function createRotatedHatchPattern(ctx, tip, ugao, skala, boja, lineWidth) {
    let pCanvas = document.createElement('canvas'); pCanvas.width = skala; pCanvas.height = skala;
    let pCtx = pCanvas.getContext('2d'); pCtx.strokeStyle = boja; pCtx.lineWidth = lineWidth || 1;
    pCtx.beginPath(); pCtx.moveTo(0, 0); pCtx.lineTo(skala, 0);
    if (tip === 'grid') { pCtx.moveTo(0, 0); pCtx.lineTo(0,skala); }
    pCtx.stroke();
    let pattern = ctx.createPattern(pCanvas, 'repeat');
    if (ugao !== 0) { let matrica = new DOMMatrix(); matrica = matrica.rotate(-ugao); pattern.setTransform(matrica); }
    return pattern;
}

// ==========================================================================
// 8. DINAMIČKA OBRADA LISTI (DODAVANJE I BRISANJE ELEMENTA REDOVA ARMATURE)
// ==========================================================================
document.addEventListener("DOMContentLoaded", function () {
    const kontejnerDonja = document.getElementById("armatura-kontejner-donja");
    const kontejnerGornja = document.getElementById("armatura-kontejner-gornja");

    function osveziDugmadIZnakove(kontejner, klasaDugmetaKlasicna) {
        if (!kontejner) return;
        const listaRedova = kontejner.querySelector(".arm-lista-redova") || kontejner;
        const sviRedovi = listaRedova.querySelectorAll(".arm_red");
        sviRedovi.forEach((red, indeks) => {
            red.querySelector(".redni-broj").textContent = `${indeks + 1}:`;
            const poslednjaCelija = red.children[4] || red.querySelector("button");
            if (!poslednjaCelija) return;
            if (indeks === sviRedovi.length - 1) {
                poslednjaCelija.outerHTML = `<button class="${klasaDugmetaKlasicna}" type="button">+</button>`;
            } else {
                poslednjaCelija.outerHTML = `<button class="btn-obrisi" type="button">×</button>`;
            }
        });
    }

    window.preracunajZonu = function(kontejner, klasaPrecnika, klasaBroja, klasaLab) {
        if (!kontejner) return 0;
        const listaRedova = kontejner.querySelector(".arm-lista-redova") || kontejner;
        const sviRedovi = listaRedova.querySelectorAll(".arm_red");
        let suma = 0;
        sviRedovi.forEach(red => {
            const fi = parseFloat(red.querySelector("." + klasaPrecnika).value) || 0;
            const n = parseFloat(red.querySelector("." + klasaBroja).value) || 0;
            const povrsinaReda = n * Math.PI * (fi / 10) ** 2 / 4;
            const labArm = red.querySelector("." + klasaLab);
            if (labArm) { labArm.textContent = povrsinaReda.toFixed(2) + " cm²"; }
            suma += povrsinaReda;
        });
        const ukupnoPrikaz = kontejner.querySelector(".arm-ukupno");
        if (ukupnoPrikaz) { ukupnoPrikaz.textContent = suma.toFixed(2) + " cm²"; }
        return suma;
    }

    if (kontejnerDonja) {
        kontejnerDonja.addEventListener("input", function (e) { if (e.target.classList.contains("inp-precnik-d") || e.target.classList.contains("inp-broj-sipki-d")) { preracunajSve(); } });
        kontejnerDonja.addEventListener("click", function (e) {
            const listaRedova = kontejnerDonja.querySelector(".arm-lista-redova") || kontejnerDonja;
            if (e.target.classList.contains("btn_add_arm_d")) {
                const noviRed = document.createElement("div"); noviRed.className = "arm_red";
                noviRed.innerHTML = `<span class="redni-broj"></span><input class="inp-precnik-d" type="number" min="8" max="50" value="14" placeholder="Ø (mm)"><input class="inp-broj-sipki-d" type="number" min="1" max="50" value="2" placeholder="kom"><span class="lab_arm_d">0.00 cm²</span><button class="btn_add_arm_d" type="button">+</button>`;
                listaRedova.appendChild(noviRed); osveziDugmadIZnakove(kontejnerDonja, "btn_add_arm_d"); preracunajSve();
            }
            if (e.target.classList.contains("btn-obrisi")) { e.target.closest(".arm_red").remove(); osveziDugmadIZnakove(kontejnerDonja, "btn_add_arm_d"); preracunajSve(); }
        });
    }

    if (kontejnerGornja) {
        kontejnerGornja.addEventListener("input", function (e) { if (e.target.classList.contains("inp-precnik-g") || e.target.classList.contains("inp-broj-sipki-g")) { preracunajSve(); } });
        kontejnerGornja.addEventListener("click", function (e) {
            const listaRedova = kontejnerGornja.querySelector(".arm-lista-redova") || kontejnerGornja;
            if (e.target.classList.contains("btn_add_arm_g")) {
                const noviRed = document.createElement("div"); noviRed.className = "arm_red";
                noviRed.innerHTML = `<span class="redni-broj"></span><input class="inp-precnik-g" type="number" min="8" max="50" value="14" placeholder="Ø (mm)"><input class="inp-broj-sipki-g" type="number" min="1" max="50" value="2" placeholder="kom"><span class="lab_arm_g">0.00 cm²</span><button class="btn_add_arm_g" type="button">+</button>`;
                listaRedova.appendChild(noviRed); osveziDugmadIZnakove(kontejnerGornja, "btn_add_arm_g"); preracunajSve();
            }
            if (e.target.classList.contains("btn-obrisi")) { e.target.closest(".arm_red").remove(); osveziDugmadIZnakove(kontejnerGornja, "btn_add_arm_g"); preracunajSve(); }
        });
    }

    osveziDugmadIZnakove(kontejnerDonja, "btn_add_arm_d");
    osveziDugmadIZnakove(kontejnerGornja, "btn_add_arm_g");
    preracunajSve();
});

function rezolucija(canvasEl, faktor = window.devicePixelRatio || 1) {
    const ctx = canvasEl.getContext("2d");
    const cssW = Math.round(canvasEl.clientWidth);
    const cssH = Math.round(canvasEl.clientHeight);
    if (canvasEl.width !== Math.round(cssW * faktor) || canvasEl.height !== Math.round(cssH * faktor)) {
        canvasEl.width = Math.round(cssW * faktor); canvasEl.height = Math.round(cssH * faktor);
    }
    ctx.setTransform(faktor, 0, 0, faktor, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    return { ctx, width: cssW, height: cssH, faktor };
}
document.body.style.zoom = "80%";