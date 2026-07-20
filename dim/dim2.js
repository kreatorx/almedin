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
let kcal = 1.05;
let acc = 0.85; 
let Ec = 30000;  //MPa
let Es = 210000; //MPa
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
let koristiMinimalniEkscentricitet = false;
let koristiPojednostavljeno = false;
let koristiPravacParabola = false;

let uEds = 0;
let vEd = 0;
let w1 = 0;
let w2 = 0;
let xi = 0;
let zeta = 0;
let xi_lim = 0.617;
let zeta_lim = 0.7437;

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

// Fiksirana armatura
let eps_c_stv = 0;
let eps_c1_stv = 0;
let eps_s1_stv = 0;
let eps_s2_stv = 0;
let x_stv = 0;
let e_real = 0;
let As1_act = 0;
let As2_act = 0;
let a_c = 0;

const TextEdit = { format: typeof format !== 'undefined' ? format : function(ctx, text, x, y) { ctx.fillText(text, x, y); } };

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function naponCelik(es) { return clamp(Es * es, -fyd, fyd); }

// ==========================================================================
// 2. GLAVNI STATIČKI PRORAČUN I DIMENZIONISANJE PRESJEKA
// ==========================================================================
function proracun() {
    if (koristiPravacParabola) {
        // PRAVAC-PARABOLA MODEL (EN 1992-1-1, Tabela 3.1)
        ecu3 = fck < 55 ? 0.0035 : 0.0026 + 0.035 * ((90 - fck) / 100) ** 4; // \u03B5_cu2
        ec3 = fck < 55 ? 0.0020 : 0.0020 + 0.00085 * ((fck - 50) / 40) ** 0.53; // \u03B5_c2
        n = fck < 55 ? 2.0 : 1.4 + 23.4 * ((90 - fck) / 100) ** 4;
        
        // Za pravac-parabolu, pritisak se proteže kroz cijelu visinu 'x', nema skraćivanja sa lambda!
        lambda = 1.0; 
        eta = 1.0;
    } else {
        // UPROŠTENI PRAVOUGAONI BLOK (EN 1992-1-1, Poglavlje 3.1.7)
        ecu3 = fck < 55 ? 0.0035 : 0.0026 + 0.035 * ((90 - fck) / 100) ** 4; // \u03B5_cu3
        ec3 = fck < 55 ? 0.00175 : 0.00175 + 0.00055 * ((fck - 50) / 40); // \u03B5_c3
        n = fck < 55 ? 2.0 : 1.4 + 23.4 * ((90 - fck) / 100) ** 4;
        lambda = fck < 55 ? 0.8 : 0.8 - (fck - 50) / 400;
        eta = fck < 55 ? 1.0 : 1.0 - (fck - 50) / 200;
    }

    azurirajXiLimVrijednost();
    let elXiLimInp = document.getElementById("inp-xi-lim");
    xi_lim = elXiLimInp ? parseFloat(elXiLimInp.value) || xi_lim : 0.617;

    fctm = fck < 55 ? 0.3 * Math.pow(fck, 2 / 3) : 2.12 * Math.log(1 + (fck + 8) / 10);
    eyd = kcal * fyk / gamma1 / Es;

    fcd_ = fck / gammac;
    fcd = acc * fck / gammac;  
    let fcd_cm = fcd / 10;

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
console.log(xi_lim);
   // xi_lim = 0.450; //ecu3 / (ecu3 + eyd);
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

    if (Math.abs(NEd) > TOL) { e_real = MEd0 / NEd; }

    if (NEd > 0 && koristiMinimalniEkscentricitet) {
        if (Math.abs(MEd0) < TOL || Math.abs(e_real) <= e0 ) {
            maliEkscentricitetPritisak = true;
            const smjer = Math.abs(MEd0) < TOL ? 1 : Math.sign(MEd0);
            MEd_design = smjer * NEd * e0;
        }
    }

    Mmax = MEd_design;
    MEds = Mmax + NEd * zs1 / 100; 
    let MEds_cm = MEds * 100;

    let Asmin_ = 0.26 * fctm / fyk * b * d;
    let Asmin = Math.max(Asmin_, 0.0013 * b * d);
    
    let elAsMin = document.getElementById("As_min");
    if (elAsMin) elAsMin.innerText = "Minimalna armatura je potrebna: " + Asmin.toFixed(2) + " cm2";
    let Asmin_stub = Math.max(0.10 * NEd / fyd_cm, 0.002 * b * h);
    if (NEd > 0 && maliEkscentricitetPritisak && elAsMin) { elAsMin.innerText = "Minimalna armatura je potrebna: " + Asmin_stub.toFixed(2) + " cm2"; }

    As1_act = 0; As2_act = 0;
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

// ==========================================================================
    // SELEKCIJA METODE PRORAČUNA: POJEDNOSTAVLJENO PREMA TABELI 5.3
    // ==========================================================================
    if (Math.abs(MEd0) < TOL && Math.abs(NEd) < TOL) {
        x = 0; x_blok = 0; x_crtanje = 0;
        ec2 = 0; ec1 = 0; ec = 0; es1 = 0; es2 = 0;
        sigSd1 = 0; sigSd2 = 0; As1 = 0; As2 = 0; Fc = 0; a_c = h / 2;
        xi = 0; z = d; zeta = 1; uEds = 0; vEd = 0;
        w1 = 0; w2 = 0;
        podrucje = "Presjek neopterećen";
    } 
else if (koristiPojednostavljeno) {
        if (Math.abs(MEd0) < TOL && NEd > 0) {
            // ==========================================================================
            // KOREKCIJA: ČISTI CENTRISANI PRITISAK (STUBOVI) - GEOMETRIJSKI EKSPLOATISAN PRESJEK
            // ==========================================================================
            x = h; 
            x_blok = h; 
            x_crtanje = h;
            
            // Pri čistom pritisku dilatacija je ravnomjerna po čitavom presjeku (granica ec3)
            ec2 = ec3; 
            ec1 = ec3; 
            ec = ec3; 
            es1 = ec3; 
            es2 = ec3;
            
            // Napon u čeliku se računa strogo preko dilatacije sabijanja betona
            sigSd1 = clamp(es1 * Es, -fyd, fyd);
            sigSd2 = clamp(es2 * Es, -fyd, fyd);
            
            // Maksimalna računska nosivost čistog betonskog presjeka pod pritiskom
            let Nc_max = b * h * fcd_cm * eta; 
            Fc = Nc_max;
            a_c = h / 2;
            
            z = 0;
            zeta = 0;
            uEds = 0;
            vEd = NEd / (b * d * fcd_cm);
            w1 = 0;
            w2 = 0;
            
            // Ako vanjska sila pritiska pređe graničnu nosivost samog betona
            if (NEd > Nc_max) {
                let Delta_N = NEd - Nc_max;
                // Dodavanje savršeno simetrične površine armature u obje zone da podnesu višak napona
                As1 = (Delta_N / 2) / (sigSd1 / 10);
                As2 = As1;
            } else {
                As1 = 0;
                As2 = 0;
            }
            podrucje = "Pojednostavljeno: Čisti pritisak (Simetrična armatura)";
        } 
        else {
            // ==========================================================================
            // SAVIJANJE SA ILI BEZ NORMALNE SILE (GREDE - TABELA 5.2 I 5.3)
            // ==========================================================================
            // Računanje bezdimenzionalnog momenta strictly prema definiciji sa vrha tabele (bez eta)
            uEds = MEds_cm / (b * d * d * fcd_cm);
            vEd = NEd / (b * d * fcd_cm);
            
            let uEds_lim_tabele = 0.2961; // Granična vrijednost za ksi = 0.450
            let w_lim_tabele = 0.3643;
            
            if (uEds <= uEds_lim_tabele) {
                // TABELA 5.2 - JEDNOSTRANO ARMIRAN PRESJEK (ČISTO TEORETSKI PRORAČUN)
                w1 = 1 - Math.sqrt(1 - 2 * uEds);
                w2 = 0;
                xi = w1 / lambda;
                x = xi * d;
                x_blok = lambda * x;
                z = d * (1 - w1 / 2);
                zeta = z / d;
                Fc = w1 * b * d * fcd_cm * eta;
                a_c = x_blok / 2;
                
                ec2 = ecu3;
                ec1 = ecu3 * (1 - h / x);
                es1 = ecu3 * (1 - d / x);
                es2 = ecu3 * (1 - d2 / x);
                
                sigSd1 = clamp(es1 * Es, -fyd, fyd);
                sigSd2 = clamp(es2 * Es, -fyd, fyd);
                
                As2 = 0;
                As1 = (w1 * b * d * fcd_cm + NEd) / (fyd / 10);
                podrucje = "Pojednostavljeno: Jednostrano armirano (Tabela 5.2)";
            } else {
                // TABELA 5.3 - DVOSTRUKO ARMIRAN PRESJEK (ČISTO TEORETSKI PRORAČUN)
                xi = 0.450; 
                x = xi * d;
                x_blok = lambda * x;
                
                let delta_mu = uEds - uEds_lim_tabele;
                w2 = delta_mu / (1 - d2 / d);
                w1 = w_lim_tabele + w2;
                
                ec2 = ecu3;
                ec1 = ecu3 * (1 - h / x);
                es1 = ecu3 * (1 - d / x);
                es2 = ecu3 * (1 - d2 / x);
                
                let stvarni_sigSd2 = Math.abs(clamp(es2 * Es, -fyd, fyd)); 
                
                As2 = w2 * b * d * fcd_cm / (stvarni_sigSd2 / 10);
                As1 = (w1 * b * d * fcd_cm + NEd) / (fyd / 10);
                
                Fc = w_lim_tabele * b * d * fcd_cm;
                a_c = 0.1872 * d; 
                z = d - a_c;
                zeta = z / d;
                
                sigSd1 = fyd; 
                sigSd2 = es2 < 0 ? -stvarni_sigSd2 : stvarni_sigSd2;
                
                podrucje = "Pojednostavljeno: Dvostruko armirano (Tabela 5.3)";
            }
        }
    } else {
        let optimalnoStanje = null;
        let minUkupnaArmatura = Infinity;
        let profili = [];
        const koraciSweep = 500; // Povećana rezolucija za veću glatkoću decimala

        for (let i = 0; i <= koraciSweep; i++) {
            let t_top = -eud + (i / koraciSweep) * (ecu3 + eud);
            let t_bot = t_top + ((-eud - t_top) / d) * h;
            profili.push({ top: t_top, bottom: t_bot, pivot: "A" });
        }
        for (let i = 0; i <= koraciSweep; i++) {
            let t_bot = -eud + (i / koraciSweep) * (0 + eud);
            profili.push({ top: ecu3, bottom: t_bot, pivot: "B" });
        }
        for (let i = 0; i <= koraciSweep; i++) {
            let t_top = ecu3 - (i / koraciSweep) * (ecu3 - ec3);
            let t_bot = ecu3 - t_top; 
            profili.push({ top: t_top, bottom: t_bot, pivot: "C" });
        }
        for (let i = 0; i <= koraciSweep; i++) {
            let t_uni = (i / koraciSweep) * ec3;
            profili.push({ top: t_uni, bottom: t_uni, pivot: "C" });
        }

        profili.forEach(p => {
            let epsTop = p.top;
            let epsBottom = p.bottom;
            let t_x = (Math.abs(epsTop - epsBottom) < 1e-7) ? Infinity : (epsTop * h) / (epsTop - epsBottom);
            
            if (t_x > xi_lim * d && NEd <= 0) {
                return; // Preskače ovaj profil i ide na sljedeći zbog osiguranja duktilnosti prema EC2
    }

            let t_Fc = 0;
            let t_Mc_as1 = 0;
            let nSlices = 30;
            let dy = h / nSlices;

            for (let s = 0; s < nSlices; s++) {
                let y_center = (s + 0.5) * dy; 
                let eps_y = epsTop - (epsTop - epsBottom) * (y_center / h);
                
                if (eps_y > 0) { 
                    let sig_c = 0;
                    if (eps_y < ec3) {
                        sig_c = fcd * (1 - Math.pow(1 - eps_y / ec3, n));
                    } else {
                        sig_c = fcd;
                    }
                    let dFc = b * dy * (sig_c / 10); 
                    t_Fc += dFc;
                    t_Mc_as1 += dFc * (d - y_center); 
                }
            }

            let t_yc = t_Fc > 0 ? d - (t_Mc_as1 / t_Fc) : h / 2;
            let t_x_blok = Number.isFinite(t_x) ? Math.min(lambda * t_x, h) : h;
            if (t_x <= 0) t_x_blok = 0;

            let t_es2 = epsTop - (epsTop - epsBottom) * (d2 / h);
            let t_es1 = epsTop - (epsTop - epsBottom) * ((h - d1) / h);

            let t_sig2 = clamp(t_es2 * Es, -fyd, fyd);
            let t_sig1 = clamp(t_es1 * Es, -fyd, fyd);

            let t_Fs2 = (MEds_cm - t_Mc_as1) / (d - d2);
            let t_Fs1 = NEd - t_Fc - t_Fs2;

            if (Math.abs(t_Fs1) > 1e-3) {
                if (Math.sign(t_Fs1) !== Math.sign(t_sig1) || Math.abs(t_sig1) < 1e-5) return;
            }
            if (Math.abs(t_Fs2) > 1e-3) {
                if (Math.sign(t_Fs2) !== Math.sign(t_sig2) || Math.abs(t_sig2) < 1e-5) return;
            }

            let t_As1 = Math.abs(t_sig1) > 1e-3 ? (t_Fs1 * 10) / t_sig1 : 0;
            let t_As2 = Math.abs(t_sig2) > 1e-3 ? (t_Fs2 * 10) / t_sig2 : 0;

            if (t_As1 >= 0 && t_As2 >= 0) {
                // KOREKCIJA 2: Uključujemo Asmin filter direktno unutar selekcije profila
                // Ovo sprečava algoritam da bira lažne profile sa gornjom armaturom dok je donja ispod minimuma
                let efektivno_As1 = t_As1;
                if (!(NEd > 0 && maliEkscentricitetPritisak) && t_As1 < Asmin) {
                    efektivno_As1 = Asmin;
                }
                
                let ukupnoAs = efektivno_As1 + t_As2;
                if (ukupnoAs < minUkupnaArmatura) {
                    minUkupnaArmatura = ukupnoAs;
                    optimalnoStanje = {
                        top: epsTop, bottom: epsBottom, x: t_x, x_blok: t_x_blok,
                        Fc: t_Fc, y_c: t_yc, es1: t_es1, es2: t_es2,
                        sig1: t_sig1, sig2: t_sig2, As1: t_As1, As2: t_As2,
                        pivot: p.pivot
                    };
                }
            }
        });

        if (optimalnoStanje) {
            x = optimalnoStanje.x;
            x_blok = optimalnoStanje.x_blok;
            x_crtanje = Math.min(Math.max(x, 0), h);
            ec2 = optimalnoStanje.top;
            ec1 = optimalnoStanje.bottom;
            ec = ec2;
            es1 = optimalnoStanje.es1;
            es2 = optimalnoStanje.es2;
            sigSd1 = optimalnoStanje.sig1;
            sigSd2 = optimalnoStanje.sig2;
            As1 = optimalnoStanje.As1;
            As2 = optimalnoStanje.As2;
            Fc = optimalnoStanje.Fc;
            a_c = optimalnoStanje.y_c;
            xi = Number.isFinite(x) ? x / d : 999;
            z = d - x_blok / 2;
            zeta = z / d;
            uEds = MEds_cm / (eta * b * d * d * fcd_cm);
            vEd = NEd / (b * d * fcd_cm);

            if (optimalnoStanje.pivot === "A") podrucje = "2 - savijanje, rotacija oko A (Pivot A)";
            else if (optimalnoStanje.pivot === "B") podrucje = (x <= xi_lim * d) ? "3 - greda, visoko iskorištena (Pivot B)" : "4 - pritisak sa savijanjem (Pivot B)";
            else podrucje = "5 - pritisak, osa van presjeka (Pivot C)";
        } else {
            podrucje = "Otkazivanje! Presjek preopterećen.";
            As1 = 999; As2 = 999;
            x = Infinity; x_blok = h; ec2 = ecu3; ec1 = ecu3;
        }
        w1 = As1 * fyd / (b * d * fcd + NEd); 
        w2 = As2 * fyd / (b * d * fcd);
    }

    // Korekcija minimalne armature se izvršava samo ako je presjek pod nekim teretom
    if (Math.abs(MEd0) > TOL || Math.abs(NEd) > TOL) {
        if (NEd > 0 && maliEkscentricitetPritisak) {
            if ((As1 + As2) < Asmin_stub) { As1 = Asmin_stub / 2; As2 = Asmin_stub / 2; }
        } else {
            if (As1 < Asmin) { As1 = Asmin; }
        }
    }

    let As_max = (As1 + As2) / (b * h);
    let elAsMax = document.getElementById("As_max");
    if (elAsMax) {
        elAsMax.style.color = (Math.abs(As_max) < Math.max(0.1 * NEd / fyd, 0.002) || Math.abs(As_max) > (stub ? 0.08 : 0.04)) ? "#dc3545" : "#0eb30e";
        elAsMax.textContent = (As_max * 100).toFixed(2) + "%";
    }
    let elAsMax_ = document.getElementById("As_max_");
    if (elAsMax_) {
        let As_max_ = suma_ / (b * h);
        elAsMax_.style.color = (Math.abs(As_max_) < Math.max(0.1 * NEd / fyd, 0.002) || Math.abs(As_max_) > (stub ? 0.08 : 0.04)) ? "#dc3545" : "#0eb30e";
        elAsMax_.textContent = (As_max_ * 100).toFixed(2) + "%";
    }

    xi_pivot = ecu3 / (ecu3 + eyd);
    x_p = xi_pivot * d;
    C_ = (1 - ec3 / ecu3) * h;

    let Fs1_teorijski = As1 * sigSd1 / 10;
    let Fs2_teorijski = As2 * sigSd2 / 10;
    signs1 = Math.sign(sigSd1);
    signs2 = Math.sign(sigSd2);
    signc = -1;

    let sumN = Fc + Fs1_teorijski + Fs2_teorijski - NEd;
    let sumM = Fc * (d - a_c) / 100 + Fs2_teorijski * (d - d2) / 100 - MEds;

    let elSumN = document.getElementById("Sum_N");
    if (elSumN) elSumN.innerText = `${Fc.toFixed(2)} + ${Fs1_teorijski.toFixed(2)} + ${Fs2_teorijski.toFixed(2)} - ${(NEd).toFixed(2)} = ${sumN.toFixed(2)} kN`;
    let elSumM = document.getElementById("Sum_M");
    if (elSumM) elSumM.innerText = `${(Fc * (d - a_c) / 100).toFixed(2)} + ${(Fs2_teorijski * (d - d2) / 100).toFixed(2)} - ${MEds.toFixed(2)} = ${sumM.toFixed(2)} kNm`;
 
    Fs1 = As1 * fyd_cm; Fs2 = As2 * fyd_cm;

    proracunInterakcijeSimetricnoArmiranogPresjeka();
    popuniRezultate();
    proracunStvarnihDilatacija();
    crtajPresjek();
}

// ==========================================================================
// 3. PRORAČUN REALNIH/STVARNIH DILATACIJA IZ DODIJELJENE ARMATURE
// ==========================================================================
function proracunStvarnihDilatacija() {
    let M_meta = Math.abs(MEd0); 
    if (M_meta < TOL || (As1_act === 0 && As2_act === 0)) {
        eps_c_stv = 0; eps_c1_stv = 0; eps_s1_stv = 0; eps_s2_stv = 0; x_stv = 0;
        return;
    }

    let niska_ec = 0;
    let visoka_ec = ecu3; 
    let konacno_x = 0;    
    
    for (let iterOuter = 0; iterOuter < 100; iterOuter++) {
        let test_ec = (niska_ec + visoka_ec) / 2;
        let nisko_x = 0.01;
        let visoko_x = h * 20; 
        let test_x = 0;

        for (let iterInner = 0; iterInner < 100; iterInner++) {
            test_x = (nisko_x + visoko_x) / 2;

            let t_es1 = test_ec * (1 - d / test_x);
            let t_es2 = test_ec * (1 - d2 / test_x);
            let t_sig1 = clamp(t_es1 * Es, -fyd, fyd);
            let t_sig2 = clamp(t_es2 * Es, -fyd, fyd);

            let faktor_napona = test_ec <= ec3 ? (test_ec / ec3) : 1.0;
            let t_x_blok = Math.min(lambda * test_x, h);
            let t_Fc = b * t_x_blok * (fcd / 10) * eta * faktor_napona;

            let sumN = t_Fc + (As1_act * t_sig1 / 10) + (As2_act * t_sig2 / 10) - NEd;

            if (Math.abs(sumN) < 1e-5) break;
            if (sumN > 0) { visoko_x = test_x; } else { nisko_x = test_x; }
        }

        let t_es2 = test_ec * (1 - d2 / test_x);
        let t_sig2 = clamp(t_es2 * Es, -fyd, fyd);
        let faktor_napona = test_ec <= ec3 ? (test_ec / ec3) : 1.0;
        let t_x_blok = Math.min(lambda * test_x, h);
        let t_Fc = b * t_x_blok * (fcd / 10) * eta * faktor_napona;
        let t_Fs2 = As2_act * t_sig2 / 10;

        let M_unutrasnji = (t_Fc * (d - t_x_blok / 2) + t_Fs2 * (d - d2)) / 100;
        konacno_x = test_x;

        if (Math.abs(M_unutrasnji - M_meta) < 1e-4) { niska_ec = test_ec; break; }
        if (M_unutrasnji > M_meta) { visoka_ec = test_ec; } else { niska_ec = test_ec; }
    }

    eps_c_stv = niska_ec;
    x_stv = konacno_x;
    eps_s1_stv = eps_c_stv * (1 - d / x_stv);
    eps_s2_stv = eps_c_stv * (1 - d2 / x_stv);
    eps_c1_stv = eps_c_stv * (1 - h / x_stv); 
}

function proracunInterakcijeSimetricnoArmiranogPresjeka() { 
    let As1_stvarno = 0;
    let As2_stvarno = 0;
    
    if (proracunskiRaspored) {
        if (proracunskiRaspored.redoviDonje) {
            proracunskiRaspored.redoviDonje.forEach(red => {
                red.sipke.forEach(sipka => { As1_stvarno += Math.PI * (sipka.fi / 10) ** 2 / 4; });
            });
        }
        if (proracunskiRaspored.redoviGornje) {
            proracunskiRaspored.redoviGornje.forEach(red => {
                red.sipke.forEach(sipka => { As2_stvarno += Math.PI * (sipka.fi / 10) ** 2 / 4; });
            });
        }
    }

    if (As1_stvarno === 0) As1_stvarno = As1 || 0;
    if (As2_stvarno === 0) As2_stvarno = As2 || 0;

    if (typeof iscrtajNMInterakciju === "function") {
        iscrtajNMInterakciju("interakcijaCanvas", {
            b: b, h: h, d1: d1, d2: d2,
            As1: As1_stvarno, As2: As2_stvarno,
            fck: fck, fyk: fyk, gammac: gammac, gammaS: gamma1,
            acc: acc, kcal: kcal, Ec: Ec, Es: Es, MEd: Mmax, NEd: -NEd,
            koristiParabolu: koristiPravacParabola  
        });
    }
}

// ==========================================================================
// 4. POMOĆNE FUNKCIJE ZA POPUNJAVANJE REZULTATA U HTML ODREDIŠTIMA
// ==========================================================================
function popuni(id, vrijednost, decimale, i = "") {
    let el = document.getElementById(id);
    if (el) { el.innerText = vrijednost.toFixed(decimale) + i; }
}

function popuniRezultate() {
    popuni("res_M", MEds, 2, "   kNm"); popuni("res_N", NEd, 2, "   kN");
    popuni("res_uEds", uEds, 3, ""); 
    let uEl = document.getElementById("res_uEds");
    if (uEl) uEl.style.color = uEds <= uEds_lim ? "#0080e9" : (uEds <= 0.55 ? "#fd7e14" : "#dc3545");

    popuni("res_vEd", vEd, 3);
    popuni("res_d", d, 2, "   cm"); popuni("res_d1", d1, 2, "   cm"); popuni("res_d2", d2, 2, "   cm");
    popuni("res_x", x, 2, "   cm"); popuni("res_z", z, 2, "   cm"); popuni("res_z1", zs1, 2, "   cm"); popuni("res_z2", zs2, 2, "   cm");
    popuni("res_xi", xi, 3, ""); popuni("res_xi_p", xi_pivot, 3, ""); popuni("res_x_p", x_p, 3, ""); popuni("res_zeta", zeta, 3, "");
    popuni("res_x_lim", xi_lim * d, 2, "   cm"); popuni("res_z_lim", zeta_lim * d, 2, "   cm"); popuni("res_xi_lim", xi_lim, 3, ""); popuni("res_zeta_lim", zeta_lim, 3, "");
    popuni("res_Ec", Ec, 2, "   GPa"); popuni("res_Es", Es, 2, "   GPa"); popuni("res_fcd", fcd, 2, "   MPa"); popuni("res_fyd", fyd, 2, "   MPa");
    popuni("res_lambdac", lambda, 2); popuni("res_eta", eta, 2); popuni("res_sigSd1", sigSd1, 2, "   MPa"); popuni("res_sigSd2", sigSd2, 2, "   MPa"); popuni("res_w1", w1, 4); popuni("res_w2", w2, 4);
    
    let elAs1 = document.getElementById("res_As1");
    if (elAs1) elAs1.innerHTML = As1 >= 0 && As1 < TOL ? "<span style='color:#0eb30e; font-weight:bold;'>min</span>" : As1.toFixed(3) + " cm2";
    let elAs2 = document.getElementById("res_As2");
    if (elAs2) elAs2.innerHTML = As2 >= 0 && As2 < TOL ? "<span style='color:#0eb30e; font-weight:bold;'>min</span>" : As2.toFixed(3) + " cm2";
    
    let elMEd = document.getElementById("res_MEd");
    if (elMEd) elMEd.innerText = Mmax.toFixed(2) + " kNm";
}

function azurirajXiLimVrijednost() {
    const tipEl = document.getElementById("inp-xi-type");
    const valInput = document.getElementById("inp-xi-lim");
    if (!tipEl || !valInput) return;

    const tip = tipEl.value;
    
    // Ako je izabran ručni unos, otključavamo polje i ne prebrisujemo vrijednost
    if (tip === "custom") {
        valInput.readOnly = false;
        valInput.style.backgroundColor = "#ffffff";
        return;
    }

    // U suprotnom, polje je zaklučano i vrijednost se računa automatski
    valInput.readOnly = true;
    valInput.style.backgroundColor = "#e9ecef";

    // Dinamički računamo eyd i ecu3 na osnovu fck i fyk
    const t_ecu3 = fck < 55 ? 0.0035 : 0.0026 + 0.035 * Math.pow((90 - fck) / 100, 4);
    const t_eyd = (kcal*fyk / gamma1) / Es;

    if (tip === "odr") {
        // Statički određeni nosači: ecu3 / (ecu3 + eyd) -> Daje 0.617 za <=C50/60 ili ~0.588 za >C50/60
        valInput.value = (t_ecu3 / (t_ecu3 + t_eyd)).toFixed(3);
    } else if (tip === "neodr") {
        // Statički neodređeni (bez preraspodjele)
        valInput.value = fck < 55 ? "0.450" : "0.350";
    } else if (tip === "ploca") {
        // Ploče po teoriji plastičnosti
        valInput.value = fck < 55 ? "0.250" : "0.150";
    }
}

// ==========================================================================
// 5. GRAFIČKI CANVAS PRIKAZ PRESJEKA, NAPONA I DEFORMACIJA
// ==========================================================================
function crtajPresjek() {
    const canvasEl = document.getElementById("presjekCanvas");
    if (!canvasEl) return;

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

    let poz_d_sigma = 0.28;   // Pozicija nulte ose za napone
    let poz_d_epsilon = 0.85; // Pozicija nulte ose za deformacije

    const osa_sigma = x_start + b_px + (canvas.width - x_start - b_px - 20) * poz_d_sigma;
    const osa_ec = x_start + b_px + (canvas.width - x_start - b_px - 20) * poz_d_epsilon;
    
    // Vertikalno poravnanje sila desno od maksimalnog betonskog bloka
    const sirinaBetonskogBloka = fcd * eta * skala;
    const osa_sile = osa_sigma + sirinaBetonskogBloka + 60; 

    // Računanje vertikalnih pozicija elemenata
    const y_Fs2 = y_start + d2 * skala;
    const y_Fs1 = y_start + h_px - d1 * skala;
    const y_Fc = y_start + a_c * skala;

    // ==========================================================================
    // a) CRTANJE GEOMETRIJE BETONSKOG PRESJEKA
    // ==========================================================================
    ctx.lineWidth = 3; ctx.strokeStyle = "#333"; ctx.fillStyle = "#e0e0e0";   
    ctx.beginPath(); ctx.rect(x_start, y_start, b_px, h_px); ctx.stroke(); ctx.fill();

    // ==========================================================================
    // b) CRTANJE VERTIKALNIH I HORIZONTALNIH NULTIH LINIJA OSA
    // ==========================================================================
    ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = "#888888"; ctx.setLineDash([5, 5]); ctx.beginPath();
    ctx.moveTo(x_start + b_px, y_start); ctx.lineTo(canvas.width - 20, y_start);
    ctx.moveTo(x_start + b_px, y_start + h_px); ctx.lineTo(canvas.width - 20, y_start + h_px);
    ctx.moveTo(osa_sigma, y_start - 20); ctx.lineTo(osa_sigma, y_start + h_px + 20); 
    ctx.moveTo(osa_ec, y_start - 20); ctx.lineTo(osa_ec, y_start + h_px + 20);
    
    ctx.strokeStyle = "#bbbbbb";
    ctx.moveTo(osa_sile, y_start - 20); ctx.lineTo(osa_sile, y_start + h_px + 20);
    ctx.stroke(); ctx.restore();

    // Horizontalne linije veza na dijagramu deformacija za As1 i As2
    ctx.save(); ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(osa_ec, y_start + d * skala); ctx.lineTo(osa_ec + es1 * skala_dijagrama, y_start + d * skala);
    ctx.stroke(); ctx.beginPath();
    ctx.moveTo(osa_ec, y_start + d1 * skala); ctx.lineTo(osa_ec + es2 * skala_dijagrama, y_start + d1 * skala);
    ctx.stroke(); ctx.restore();

    // ==========================================================================
    // c) ŠRAFURA PRITISNUTE ZONE UNUTAR BETONA
    // ==========================================================================
    if (xGeomDraw > TOL) {
        ctx.save(); ctx.lineWidth = 0.7; ctx.strokeStyle = "#222";
        ctx.fillStyle = createRotatedHatchPattern(ctx, "line", 45, 10, "#363333", 1); 
        ctx.beginPath(); ctx.rect(x_start, y_start, b_px, xGeomDraw * skala); ctx.stroke(); ctx.fill(); ctx.restore();
    }

    // Horizontalne linije položaja neutralnih osa (x i x_lim)
    ctx.save(); ctx.lineWidth = 0.5; ctx.strokeStyle = "#bd7373"; ctx.setLineDash([5, 5]); ctx.beginPath();
    ctx.moveTo(x_start + b_px, y_start + x * skala); ctx.lineTo(osa_sile - 10, y_start + x * skala);
    ctx.moveTo(x_start + b_px, y_start + xi_lim * d * skala); ctx.lineTo(osa_sile - 10, y_start + xi_lim * d * skala);
    ctx.stroke(); ctx.restore();

    // Geometrijski tekstovi visina
    ctx.save(); ctx.lineWidth = 1; ctx.fillStyle = "#000000"; ctx.font = "14px sans-serif"; ctx.textAlign = "left";
    TextEdit.format(ctx, `x = ${Number.isFinite(x) ? x.toFixed(2) + " cm" : "Infinity"}`, x_start + b_px + 3 * skala, y_start + xGeomDraw * skala - 2 * skala, 14);
    TextEdit.format(ctx, `\u03BB·x = ${Number.isFinite(x) ? (lambda * x).toFixed(2) + " cm" : h.toFixed(2) + " cm"}`, osa_sigma + sirinaBetonskogBloka + 5, y_start + Math.max(xBlockDraw, 7.5) * skala, 14);
    TextEdit.format(ctx, `x_lim = ${(xi_lim * d).toFixed(2)} cm`, x_start + b_px + 3 * skala, y_start + xi_lim * d * skala, 14);
    ctx.restore();

    // ==========================================================================
    // d) DIJAGRAM 1: ČISTI NAPONI
    // ==========================================================================
if (xGeomDraw > TOL) {
        ctx.save();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#333";
        ctx.fillStyle = createRotatedHatchPattern(ctx, "line", 0, 5, "#363333", 0.7);
        
        ctx.beginPath();
        
        if (koristiPravacParabola) {
            // 1. KRAK PARABOLE: Krećemo od neutralne ose (gdje je napon jednak nuli)
            ctx.moveTo(osa_sigma, y_start + xGeomDraw * skala);
            
            // Iscrtavanje realne krive linije parabole tačku po tačku
            let brojSegmenata = 25;
            for (let i = brojSegmenata; i >= 0; i--) {
                let procenatVisine = i / brojSegmenata;
                let y_tacke = y_start + (xGeomDraw * procenatVisine) * skala;
                let eps_y = ec2 * (1 - procenatVisine);
                
                let trenutniNapon = 0;
                if (eps_y > 0) {
                    trenutniNapon = eps_y < ec3 ? fcd * (1 - Math.pow(1 - eps_y / ec3, n)) : fcd;
                }
                
                let x_tacke = osa_sigma + (trenutniNapon * skala * eta);
                ctx.lineTo(x_tacke, y_tacke);
            }
            ctx.lineTo(osa_sigma, y_start);
        } else {
            // 2. KRAK POJEDNOSTAVLJENOG PRORAČUNA: Čisti fiksni pravougaonik visine lambda * x
            ctx.moveTo(osa_sigma, y_start);                                             // Gore lijevo
            ctx.lineTo(osa_sigma + sirinaBetonskogBloka, y_start);                      // Gore desno
            ctx.lineTo(osa_sigma + sirinaBetonskogBloka, y_start + xBlockDraw * skala); // Dolje desno (\u03BB·x)
            ctx.lineTo(osa_sigma, y_start + xBlockDraw * skala);                        // Dolje lijevo (\u03BB·x)
        }
        
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        
        ctx.fillStyle = "#000000"; ctx.font = "14px sans-serif"; ctx.textAlign = "left";
        TextEdit.format(ctx, `\u03B7·f_cd = ${(fcd).toFixed(2)} MPa`, osa_sigma + 5, y_start - 8, 14);
    }

    let skalaNaponaCelika = 45 / fyd; 

   function nacrtajLinijuNapona(y, napon, boja) {
        ctx.save();
        ctx.lineWidth = 4;
        ctx.strokeStyle = boja;
        ctx.beginPath();
        ctx.moveTo(osa_sigma, y);
        ctx.lineTo(osa_sigma + (napon * skalaNaponaCelika), y);
        ctx.stroke();
        ctx.restore();
        
        ctx.save(); ctx.fillStyle = "#000000"; ctx.font = "14px sans-serif"; ctx.textAlign = "right";
        TextEdit.format(ctx, `\u03C3 = ${napon.toFixed(1)} MPa`, osa_sigma - 8, y + 15, 14);
        ctx.restore();
    }

    if (As1 > 0) nacrtajLinijuNapona(y_Fs1, sigSd1, sigSd1 >= 0 ? "#0056b3" : "#dc3545");
    if (As2 > 0) nacrtajLinijuNapona(y_Fs2, sigSd2, sigSd2 >= 0 ? "#0056b3" : "#dc3545");

    // ==========================================================================
    // e) DIJAGRAM 2: STATIČKE STRELICE SILA
    // ==========================================================================
    let Fs1_potpuni = As1 * sigSd1 / 10;
    let Fs2_potpuni = As2 * sigSd2 / 10;
    let Fc_potpuni = -Math.abs(Fc);

    function nacrtajRobusnuStrelicuSile(y, vrijednostSile, tip, sufiks) {
        if (Math.abs(vrijednostSile) < 0.1) return;
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = "#000000";

        let duzinaStrelice = 45;
        let smjer = (tip === "PRIT") ? -1 : 1;
        let krajX = osa_sile + (smjer * duzinaStrelice);
        let sfx = sufiks;

        ctx.beginPath();
        ctx.moveTo(osa_sile, y);
        ctx.lineTo(krajX, y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(krajX, y);
        ctx.lineTo(krajX - (smjer * 8), y - 5);
        ctx.lineTo(krajX - (smjer * 8), y + 5);
        ctx.closePath();
        ctx.fill();

        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(tip, osa_sile + (smjer * duzinaStrelice / 2), y - 3);

        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "left";
        if (tip === "PRIT") {
            TextEdit.format(ctx, `F_${sfx} = ${Math.abs(vrijednostSile).toFixed(2)} kN`, osa_sile+5, y + 4, 14);
        } else {
            TextEdit.format(ctx, `F_${sfx} = ${Math.abs(vrijednostSile).toFixed(2)} kN`, osa_sile+5, y + 14, 14);
        }
        ctx.restore();
    }

    if (Fc !== 0) nacrtajRobusnuStrelicuSile(y_Fc, Fc_potpuni, "PRIT", "c");
    if (As1 > 0) nacrtajRobusnuStrelicuSile(y_Fs1, Fs1_potpuni, es1 < 0 ? "ZAT" : "PRIT", "s1");
    if (As2 > 0) nacrtajRobusnuStrelicuSile(y_Fs2, Fs2_potpuni, es2 < 0 ? "ZAT" : "PRIT", "s2");

    // ==========================================================================
    // f) DIJAGRAM 3: PROFILI DEFORMACIJA (PLAVI TEORIJSKI I CRVENI STVARNI)
    // ==========================================================================
    ctx.save(); ctx.lineWidth = 0.8; ctx.strokeStyle = "#0080e9"; ctx.setLineDash([]);
    const yTop = y_start, yBottom = y_start + h_px;
    
    const xTop = osa_ec + ec2 * skala_dijagrama;
    const xBottom = osa_ec + ec1 * skala_dijagrama;

    // Plavi profil
    ctx.beginPath(); ctx.moveTo(xTop, yTop); ctx.lineTo(xBottom, yBottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(osa_ec, yTop); ctx.lineTo(xTop, yTop); ctx.lineTo(xBottom, yBottom); ctx.lineTo(osa_ec, yBottom); ctx.closePath();
    ctx.fillStyle = "rgba(0, 128, 233, 0.10)"; ctx.fill(); ctx.stroke();

    // Crveni profil stvarnog stanja
    if (Math.abs(eps_c_stv) > 1e-6 || Math.abs(eps_c1_stv) > 1e-6) {
        ctx.save();
        ctx.lineWidth = 2.0;
        ctx.strokeStyle = "#dc3545"; 
        const xTopStv = osa_ec + eps_c_stv * skala_dijagrama;
        const xBottomStv = osa_ec + eps_c1_stv * skala_dijagrama;
        
        ctx.beginPath();
        ctx.moveTo(xTopStv, yTop);
        ctx.lineTo(xBottomStv, yBottom);
        ctx.stroke();
        ctx.restore();
    }

    if (Number.isFinite(x) && x >= 0 && x <= h) {
        ctx.beginPath(); ctx.strokeStyle = "#0080e9"; ctx.setLineDash([4, 4]);
        ctx.moveTo(osa_ec - 30, y_start + x * skala); ctx.lineTo(osa_ec + 30, y_start + x * skala); ctx.stroke();
    }

    ctx.beginPath(); ctx.strokeStyle = "#ff0040"; ctx.setLineDash([5, 5]);
    ctx.moveTo(osa_ec - eud * skala_dijagrama, yBottom + 10); ctx.lineTo(osa_ec - eud * skala_dijagrama, yBottom - 40);
    ctx.moveTo(osa_ec - eyd * skala_dijagrama, yBottom + 10); ctx.lineTo(osa_ec - eyd * skala_dijagrama, yBottom - 40);
    ctx.stroke(); ctx.restore();

    ctx.fillStyle = "#000000"; ctx.font = "14px sans-serif"; ctx.textAlign = "left";
    TextEdit.format(ctx, `\u03B5_top = ${(ec2).toFixed(4)}`, osa_ec + 5, yTop - 8, 14);
    TextEdit.format(ctx, `\u03B5_bot = ${(ec1).toFixed(4)}`, osa_ec + 5, yBottom + 18, 14);
    ctx.textAlign = "right";
    TextEdit.format(ctx, `\u03B5_s2 = ${(es2).toFixed(4)}`, osa_ec - 5, y_Fs2 - 8, 14);
    ctx.textAlign = "right";
    TextEdit.format(ctx, `\u03B5_s1 = ${(es1).toFixed(4)}`, x_start + b_px + (canvas.width - x_start - b_px - 20) * poz_d_epsilon - 5, y_start + h_px + 3 * skala, 14);

    // ==========================================================================
    // g) RENDEROVANJE REAKTIVNE TAČKE PIVOTA (A, B I C)
    // ==========================================================================
    ctx.save();
    let x_PivotA = osa_ec - eud * skala_dijagrama;
    let y_PivotA = y_start + d * skala;
    let x_PivotB = osa_ec + ecu3 * skala_dijagrama;
    let y_PivotB = y_start;
    let x_PivotC = osa_ec + ec3 * skala_dijagrama;
    let y_PivotC = y_start + h * 0.5 * skala; 

    let aktivanPivot = "A";
    if (ec2 >= ecu3 - 1e-5 && ec1 < 0) { aktivanPivot = "B"; }
    else if (ec2 >= ec3 - 1e-5 && ec1 >= 0) { aktivanPivot = "C"; }
    else { aktivanPivot = "A"; }

    ctx.beginPath(); ctx.arc(x_PivotA, y_PivotA, 5, 0, 2 * Math.PI);
    ctx.fillStyle = (aktivanPivot === "A") ? "#dc3545" : "rgba(220, 53, 69, 0.25)";
    ctx.fill(); ctx.strokeStyle = "#333"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#000"; ctx.font = "bold 10px sans-serif"; ctx.fillText("A", x_PivotA - 12, y_PivotA + 3);

    ctx.beginPath(); ctx.arc(x_PivotB, y_PivotB, 5, 0, 2 * Math.PI);
    ctx.fillStyle = (aktivanPivot === "B") ? "#dc3545" : "rgba(220, 53, 69, 0.25)";
    ctx.fill(); ctx.stroke();
    ctx.fillText("B", x_PivotB + 8, y_PivotB + 10);

    ctx.beginPath(); ctx.arc(x_PivotC, y_PivotC, 5, 0, 2 * Math.PI);
    ctx.fillStyle = (aktivanPivot === "C") ? "#dc3545" : "rgba(220, 53, 69, 0.25)";
    ctx.fill(); ctx.stroke();
    ctx.fillText("C", x_PivotC + 8, y_PivotC + 3);
    ctx.restore();

    // ==========================================================================
    // h) CRTEŽ UNUTRAŠNJEG SKELETA (UZENGIJE I ŠIPKE)
    // ==========================================================================
    ctx.strokeStyle = "#333333"; ctx.beginPath(); ctx.rect(x_start, y_start, b_px, h_px); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = "#f01e2c"; ctx.beginPath(); ctx.rect(x_start + c * skala, y_start + c * skala, b_px - 2 * c * skala, h_px - 2 * c * skala); ctx.stroke();

    ctx.lineWidth = (fiV / 10) * skala; ctx.strokeStyle = "#779eb2"; ctx.beginPath();
    ctx.roundRect(x_start + (c + fiV / 20) * skala, y_start + (c + fiV / 20) * skala, b_px - 2 * (c + fiV / 20) * skala, h_px - 2 * (c + fiV / 20) * skala, 10 * Math.min(30 / b, 50 / h));
    ctx.stroke();

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

    if (proracunskiRaspored) { iscrtajSveSipke(proracunskiRaspored.redoviDonje, "donja"); iscrtajSveSipke(proracunskiRaspored.redoviGornje, "gornja"); }
    ctx.fillStyle = "#000000"; ctx.font = "14px sans-serif"; ctx.textAlign = "center"; ctx.fillText(`b = ${b} cm`, x_start + b_px / 2, y_start + h_px + 20);
    ctx.save(); ctx.translate(x_start - 20, y_start + h_px / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(`h = ${h} cm`, 0, 0); ctx.restore();
}

// ==========================================================================
// 5-B. PRORAČUN I ISCRTAVANJE DIJAGRAMA INTERAKCIJE (N-M)
// ==========================================================================
function iscrtajNMInterakciju(canvasId, p) {
    if (typeof proracunStvarnihDilatacija === "function") {
        proracunStvarnihDilatacija();
    }

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const setup = rezolucija(canvas, window.devicePixelRatio || 2);
    const ctx = setup.ctx;
    const w = setup.width;
    const h_c = setup.height;

    // Fiksne margine - Legenda je stalno aktivna i ima stabilan prostor
    const padLeft = 85;     
    const padRight = 210;    
    const padTop = 35;      
    const padBottom = 45;   
    const padT = padTop; 

    const plotWidth = w - padLeft - padRight;
    const plotHeight = h_c - padTop - padBottom;

    const b = parseFloat(p.b) || 30;
    const h = parseFloat(p.h) || 50;
    const d1 = parseFloat(p.d1) || 4.7;
    const d2 = parseFloat(p.d2) || 4.5;
    const As1 = parseFloat(p.As1) || 0; 
    const As2 = parseFloat(p.As2) || 0; 
    const fck = parseFloat(p.fck) || 20;
    const fyk = parseFloat(p.fyk) || 500;
    const gammac = parseFloat(p.gammac) || 1.5;
    const gammaS = parseFloat(p.gammaS) || 1.15;
    const acc = parseFloat(p.acc) || 0.85;
    const kcal = parseFloat(p.kcal) || 1.05;
    const Ec = parseFloat(p.Ec) || 30000;
    const Es = parseFloat(p.Es) || 210000;

    const M_ed = p.MEd !== undefined ? parseFloat(p.MEd) : null; 
    const N_ed = p.NEd !== undefined ? parseFloat(p.NEd) : null; 

    const trenutno_ec2 = typeof eps_c_stv !== "undefined" ? eps_c_stv : 0;
    const trenutno_es2 = typeof eps_s2_stv !== "undefined" ? eps_s2_stv : 0;
    const trenutno_es1 = typeof eps_s1_stv !== "undefined" ? eps_s1_stv : 0;

    const ecu3 = fck < 55 ? 0.0035 : 0.0026 + 0.035 * Math.pow((90 - fck) / 100, 4);
    const lambda = fck < 55 ? 0.8 : 0.8 - (fck - 50) / 400;
    const eta = fck < 55 ? 1.0 : 1.0 - (fck - 50) / 200;
    
    const fcd = acc * fck / gammac; 
    const fyd = kcal * fyk / gammaS;       
    const eud = 0.025;              

    let points = [];
    const koraci = 50; 

    function proracunajTacku(epsTop, epsBottom) {
        let es2 = epsTop + (epsBottom - epsTop) * (d2 / h);
        let es1 = epsTop + (epsBottom - epsTop) * ((h - d1) / h);
        let sigSd2 = Math.max(-fyd, Math.min(fyd, -es2 * Es));
        let sigSd1 = Math.max(-fyd, Math.min(fyd, -es1 * Es));
        let Fs2 = As2 * sigSd2 / 10;
        let Fs1 = As1 * sigSd1 / 10;
        let Fc = 0; let y_c = h / 2; 

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
        let N = -Fc + Fs1 + Fs2;
        let M = (Fs1 * (h / 2 - d1) - Fs2 * (h / 2 - d2) + Fc * (h / 2 - y_c)) / 100; 
        return { M: M, N: N };
    }

    for (let i = 0; i <= koraci; i++) points.push(proracunajTacku(-eud + (i/koraci)*(ecu3+eud), -eud));
    for (let i = 1; i <= koraci; i++) points.push(proracunajTacku(ecu3, -eud + (i/koraci)*(ecu3+eud)));
    for (let i = 1; i <= koraci; i++) points.push(proracunajTacku(ecu3 - (i/koraci)*(ecu3+eud), ecu3));
    for (let i = 1; i <= koraci; i++) points.push(proracunajTacku(-eud, ecu3 - (i/koraci)*(ecu3+eud)));
    points.push(points[0]);

    let sveN = points.map(p => p.N);
    let sveM = points.map(p => p.M);
    if (N_ed !== null) sveN.push(N_ed);
    if (M_ed !== null) sveM.push(M_ed);

    let minN = Math.min(...sveN), maxN = Math.max(...sveN);
    let maxAbsM = Math.max(...sveM.map(Math.abs), 30); 

    function izracunajLijepeGranice(minV, maxV, brRazmaka) {
        let raspon = maxV - minV;
        let grubiKorak = raspon / brRazmaka;
        let log = Math.log10(grubiKorak);
        let stepen = Math.floor(log);
        let baza = Math.pow(10, stepen);
        let norm = grubiKorak / baza;
        let korak;
        if (norm < 1.5) korak = 1 * baza;
        else if (norm < 3.0) korak = 2 * baza;
        else if (norm < 7.0) korak = 5 * baza;
        else korak = 10 * baza;
        return { min: Math.floor(minV / korak) * korak, max: Math.ceil(maxV / korak) * korak, step: korak };
    }

    let limM = izracunajLijepeGranice(-maxAbsM * 1.15, maxAbsM * 1.15, 6);
    let limN = izracunajLijepeGranice(minN - (maxN - minN) * 0.05, maxN + (maxN - minN) * 0.05, 5);

    function kX(mVal) { return padLeft + plotWidth * (mVal - limM.min) / (limM.max - limM.min); }
    function kY(nVal) { return padTop + plotHeight * (nVal - limN.min) / (limN.max - limN.min); }

    // Čišćenje kompletne pozadine u bijelu boju
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h_c);

    ctx.fillStyle = "#000000";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("N-M DIJAGRAM INTERAKCIJE PRESJEKA", plotWidth/2, 13);

    ctx.strokeStyle = "#eff1f4";
    ctx.lineWidth = 1;
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#000000";

    for (let m = limM.min; m <= limM.max; m += limM.step) {
        ctx.beginPath(); ctx.moveTo(kX(m), padT); ctx.lineTo(kX(m), h_c - padBottom); ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillText(Math.round(m).toString(), kX(m), h_c - padBottom + 14);
    }

    for (let n = limN.min; n <= limN.max; n += limN.step) {
        ctx.beginPath(); ctx.moveTo(padLeft, kY(n)); ctx.lineTo(padLeft + plotWidth, kY(n)); ctx.stroke();
        ctx.textAlign = "right";
        ctx.fillText(Math.round(n).toString(), padLeft - 10, kY(n) + 4);
    }

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(kX(0), padT); ctx.lineTo(kX(0), h_c - padBottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(padLeft, kY(0)); ctx.lineTo(padLeft + plotWidth, kY(0)); ctx.stroke();

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

    ctx.fillStyle = "#000000";
    let mLabX = padLeft + plotWidth - 65;
    let mLabY = kY(0) - 8;
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("M", mLabX, mLabY);
    let wM = ctx.measureText("M").width;
    ctx.font = "bold 10px sans-serif";
    ctx.fillText("Rd", mLabX + wM, mLabY + 5);
    let wRd = ctx.measureText("Rd").width;
    ctx.font = "12px sans-serif";
    ctx.fillText(" [kNm]", mLabX + wM + wRd, mLabY);
    
    ctx.save();
    ctx.translate(22, padT + plotHeight / 2); 
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("N", 160, 0);
    let wN = ctx.measureText("N").width+2;
    ctx.font = "bold 10px sans-serif";
    ctx.fillText("Rd", 160 + wN, 3);
    let wRdN = ctx.measureText("Rd").width+6;
    ctx.font = "12px sans-serif";
    ctx.fillText(" [kN]", 160 + wN + wRdN, 0);
    ctx.restore();

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

        // RENDEROVANJE LEGENDE SA ČISTOM BIJELOM POZADINOM (#ffffff)
        const panelX = w - padRight + 25;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(panelX - 10, padT, padRight - 35, plotHeight);

        ctx.fillStyle = "#000000"; 
        ctx.textAlign = "left";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText("TRENUTNO STANJE", panelX, padT + 20);
        
        ctx.fillStyle = unutra ? "#006644" : "#bf2600"; 
        ctx.fillText(unutra ? "Dokaz: ZADOVOLJAVA" : "Dokaz: OTKAZUJE!", panelX, padT + 38);

        let stvarni_sig1 = Math.max(-fyd, Math.min(fyd, trenutno_es1 * Es));
        let stvarni_sig2 = Math.max(-fyd, Math.min(fyd, trenutno_es2 * Es));

        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#000000"; 
        ctx.fillText(`MEd = ${Math.abs(M_ed).toFixed(1)} kNm`, panelX, padT + 65);
        ctx.fillText(`NEd = ${N_ed.toFixed(1)} kN`, panelX, padT + 80); 
        
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("Deformacije (\u2030):", panelX, padT + 110);
        ctx.font = "12px sans-serif";
        ctx.fillText(`\u03B5_c (ivica) = ${(trenutno_ec2 * 1000).toFixed(2)} \u2030`, panelX, padT + 125);
        ctx.fillText(`\u03B5_s2 (gornja) = ${(trenutno_es2 * 1000).toFixed(2)} \u2030`, panelX, padT + 140);
        ctx.fillText(`\u03B5_s1 (donja) = ${(trenutno_es1 * 1000).toFixed(2)} \u2030`, panelX, padT + 155);

        ctx.font = "bold 11px sans-serif";
        ctx.fillText("Naponi u čeliku:", panelX, padT + 185);
        ctx.font = "12px sans-serif";
        ctx.fillText(`\u03C3_s2 = ${stvarni_sig2.toFixed(1)} MPa`, panelX, padT + 200);
        ctx.fillText(`\u03C3_s1 = ${stvarni_sig1.toFixed(1)} MPa`, panelX, padT + 215);
    }
}

// ==========================================================================
// 6. PRERAČUNAVANJE I REGENERACIJA ZONE ARMATURA I RAZMAKA SVIH REDOVA
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
    if (typeof RasporedArmature === "function") {
        proracunskiRaspored = new RasporedArmature(b, h, c, fiV, donjaZonaPodaci, gornjaZonaPodaci, fck);
    }
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

// ==========================================================================
// 7. OBRADA DINAMIČKIH LISTA (SVE NA JEDNOM MJESTU UNUTAR DOM CONTENT LOADED)
// ==========================================================================
document.addEventListener("DOMContentLoaded", function () {
    const bindInput = (id, eventType, callback) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(eventType, callback);
    };

    bindInput("inp-b", "input", function (e) { b = parseFloat(e.target.value) || 0; proracun(); });
    bindInput("inp-h", "input", function (e) { h = parseFloat(e.target.value) || 0; proracun(); });
    bindInput("inp-c", "input", function (e) { c = parseFloat(e.target.value) || 0; proracun(); });
    bindInput("inp-L", "input", function (e) { L = parseFloat(e.target.value) || 0; proracun(); });
    bindInput("inp-q", "input", function (e) { q = parseFloat(e.target.value) || 0; proracun(); });
    bindInput("inp-M", "input", function (e) { M = parseFloat(e.target.value) || 0; proracun(); });
    bindInput("inp-V", "input", function (e) { V = parseFloat(e.target.value) || 0; proracun(); });
    bindInput("inp-N", "input", function (e) { N = parseFloat(e.target.value) || 0; proracun(); });
    bindInput("inp-fiL", "input", function (e) { fiL = parseFloat(e.target.value) || 0; proracun(); });
    bindInput("inp-fiL2", "input", function (e) { fiL2 = parseFloat(e.target.value) || 0; proracun(); });
    bindInput("inp-fiV", "input", function (e) { fiV = parseFloat(e.target.value) || 0; proracun(); });
    bindInput("inp-E", "input", function (e) { E = parseFloat(e.target.value) || 0; proracun(); });
    bindInput("inp-fyk", "input", function (e) { fyk = parseFloat(e.target.value) || 0; proracun(); });
    bindInput("inp-g1", "input", function (e) { gamma1 = parseFloat(e.target.value) || 0; proracun(); });
    bindInput("inp-gc", "input", function (e) { gammac = parseFloat(e.target.value) || 0; proracun(); });
    bindInput("inp-fck", "input", function (e) { fck = parseFloat(e.target.value) || 0; azurirajXiLimVrijednost(); proracun(); });
    bindInput("inp-kcal", "input", function (e) { kcal = parseFloat(e.target.value) || 0; proracun(); });
    bindInput("inp-acc", "input", function (e) { acc = parseFloat(e.target.value) || 0; proracun(); });
 
    bindInput("inp-xi-type", "change", function () { proracun(); });
    bindInput("inp-xi-lim", "input", function () { proracun(); });
    
    bindInput("toggle-parabola", "change", function (e) { koristiPravacParabola = e.target.checked; proracun(); });
    bindInput("inp-min-e", "change", function (e) { koristiMinimalniEkscentricitet = e.target.checked; proracun(); });
    bindInput("toggle-simplified", "change", function (e) { koristiPojednostavljeno = e.target.checked; proracun(); });

    const kontejnerDonja = document.getElementById("armatura-kontejner-donja");
    const kontejnerGornja = document.getElementById("armatura-kontejner-gornja");

    function osveziDugmadIZnakove(kontejner, klasaDugmetaKlasicna) {
        if (!kontejner) return;
        const listaRedova = kontejner.querySelector(".arm-lista-redova") || kontejner;
        const sviRedovi = listaRedova.querySelectorAll(".arm_red");
        sviRedovi.forEach((red, indeks) => {
            let rb = red.querySelector(".redni-broj");
            if (rb) rb.textContent = `${indeks + 1}:`;
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
    };

    if (kontejnerDonja) {
        kontejnerDonja.addEventListener("input", function (e) { if (e.target.matches(".inp-precnik-d, .inp-broj-sipki-d")) { preracunajSve(); } });
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
        kontejnerGornja.addEventListener("input", function (e) { if (e.target.matches(".inp-precnik-g, .inp-broj-sipki-g")) { preracunajSve(); } });
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


// Osluškivač promjene veličine prozora koji eliminiše deformaciju brojeva na canvasu
let resizeTimeout;
window.addEventListener("resize", function () {
    clearTimeout(resizeTimeout);
    // Debounce filter od 50ms da proračun teče glatko i bez trzanja procesora
    resizeTimeout = setTimeout(function () {
        if (typeof proracun === "function") {
            proracun();
        }
    }, 50);
});

document.body.style.zoom = "100%";