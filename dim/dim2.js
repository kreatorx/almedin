
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
let fck = 20; //C20/25  //MPa
let fcm = 0;
let fctm = 0;
let gamma1 = 1.15;
let gammac = 1.5;
let acc = 0.85; //1.0 0.85
let Ec = 30000;  //MPa
let Es = 210000; //MPa
let E = 30000;   //MPa (Dodano za E)
let sigSd = 435; //MPa
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
let es1 = 0;
let es2 = 0;
let ecd = 0;
let ec = 0;
let es = 0;

//dynamic
let ecu3=0;
let ec3=0;
let n=0;
let lambda=0;
let eta=0;
let eyd=0; // Granica elastičnog zatezanja armature
let xlim=0; // Granica pritisnute zone
let signc=0;
let signs1=0;
let signs2=0;
let suma_=0;

// Globalne varijable za raspoređenu armaturu (za potrebe crtanja i težišta)
let rasporedDonja = [[18,18]]; // Array redova, npr. [[16, 16], [16]]
let rasporedGornja = [[14,14]];
let stub = false;

const TextEdit = { format: format };

// Osluškivanje input polja za parametre grede
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


function proracun() {

    ecu3 = fck < 55 ? 0.0035 : 0.0026 + 0.035 * ((90 - fck) / 100) ** 4;
    ec3 = fck < 55 ? 0.00175 : 0.00175 + 0.00055 * ((fck - 50) / 40);
    n = fck < 55 ? 2 : 1.4+23.4*((90-fck)/100)**4;
    lambda = fck < 55 ? 0.8 : 0.8 - (fck - 50) / 400;
    eta = fck < 55 ? 1.0 : 1.0 - (fck - 50) / 200;
    fctm = fck < 55 ? 0.3*fck : 2.12*Math.log10(1+((fck+8)/10));
    eyd = kcal * fyk / gamma1 / Es; // Granica elastičnog zatezanja armature
    xlim = d*(ecu3/(ecu3+eyd)); // Granica pritisnute zone
    //sign = Math.sign(N);

    fcd_ = fck / gammac;
    fcd = acc * fck / gammac;  

    fyd_ = fyk / gamma1;
    fyd = kcal * fyk / gamma1; // hardening
    fyd_cm = fyd / 10;

    //položaji težišta armature d1 i d2 iz RasporedArmature.js
    d1 = c + fiV / 10 + fiL / 20;
    d2 = c + fiV / 10 + fiL2 / 20;
    if (proracunskiRaspored) {
        if (proracunskiRaspored.d1 !== null) d1 = proracunskiRaspored.d1.y;
        if (proracunskiRaspored.d2 !== null) d2 = proracunskiRaspored.d2.y;
    }
    d = h - d1;
    zs1 = d-h/2;
    zs2 = (h-d2)-h/2;

    let Mq = q * L * L / 8;  //kNm
    let M_ = M;
    NEd = N;
    MEds = Mq + M_ ;//- NEd*zs1/100;
    let MEds_cm = MEds*100 //kNcm
    let fcd_cm = fcd/10;  //MPa = MN/m2 = N/mm2 = /10 = kN/cm2 

    let e = MEds / NEd;
    let e0 = Math.max(h/3000,0.02);
    if ( e <= e0 ) { mali_e = true } else { mali_e = false }


    let Asmin_ = 0.26*fctm/fyk*b*d;
    let Asmin = Math.max(Asmin_, 0.0013*b*d);
    document.getElementById("As_min").innerText = "Minimalna armatura je potrebna: " + Asmin.toFixed(2) + " cm2";


    //podrucje 3a 
    uEds = MEds_cm/(eta*b*d*d*fcd_cm);
    vEd = NEd/(b*d*fcd_cm);
    //zeta = Math.min(0.5*(1+Math.sqrt(1-2*uEds)),0.951);
    zeta = 0.5*(1+Math.sqrt(1-2*uEds));
    xi = 2/lambda*(1-zeta);
    x=xi*d;
    console.log(x);
    z=zeta*d;

   // ec = es * xi/(1-xi);

    //bilinearni dijagram za beton
    if (0 <= ec <= ec3) {
        sigC = fcd*ec/ec3;
    }
    else if(ec3 < ec <= ecu3) {
        sigC = fcd;
    }

    //bilinearni dijagram za čelik
    if (0 <= es <= eyd) {
        sigS = fyd*fyd/Es;
    }
    else if(eyd < es <= eud) {
        sigS = fyd;
    }
    


    //linija e (eps_lim)
    //xi = 2/lambda*(1-zeta_lim);
    //zeta = zeta_lim;

    //podrucje 5
    if (MEds===0 && NEd!==0) {
        if (mali_e) {return;}
    x=h;
    uEds = MEds_cm/(b*h*h*fcd_cm);
    vEd = NEd/(b*h*fcd_cm);
    }
    

    es1 = 0.0035*(d-x)/x;

    //console.log(  uEds + "  Mmax  " + Mmax + "  fcd_  " + fcd_+ "  fcd  " + fcd );

    if (MEds !== 0 && NEd === 0) {
        // jednostrano armiran
        if (xi < xi_lim) {
            As1 = 1/fyd_cm*(MEds_cm/zeta/d);
        }
        // dvostrano armiran
        else {
            let uEds_lim = lambda * xi_lim * zeta_lim;
            let MEds_lim = uEds_lim * eta * b * d * d * fcd_cm;
            let d_MEds = MEds_cm - MEds_lim;
            As1 = 1/fyd_cm*(MEds_lim/zeta_lim/d + d_MEds/(d-d2));
            As2 = 1/fyd_cm*(d_MEds/(d-d2));
        }
    }
    else if (MEds === 0 && NEd !== 0) {
        ec3 = 3.5/2000;
        As1 = (NEd - eta * fcd_cm * b * h)/fyd_cm/2;
        As2 = As1;
    }
    else if (MEds !== 0 && NEd !== 0 ) {
        // jednostrano armiran
        if (xi < xi_lim) {
            As1 = 1/fyd_cm*(MEds_cm/zeta/d-NEd);
        }
        // dvostrano armiran
        else {
            let uEds_lim = lambda * xi_lim * zeta_lim;
            let MEds_lim = uEds_lim * eta * b * d * d * fcd_cm;
            let d_MEds = MEds_cm - MEds_lim;
            As1 = 1/fyd_cm*(MEds_lim/zeta_lim/d + d_MEds/(d-d2)-NEd);
            As2 = 1/fyd_cm*(d_MEds/(d-d2));
        }
    }
    else {
        nultoOpt = true;
        x = 0;
        xi = 0;
        Fc = 0;
        Fs = 0;
        ec3 = 0;
        es1 = 0;
        As1 = 0;
        As2 = 0;
    // Nacrtaj ravan, nedeformisan presjek
    }

    Fs1 = As1*sigSd;
    Fs2 = As2*sigSd;
    Fc = b*x*lambda*fcd*eta;

    signs1 = Math.sign(Fs1);
    signs2 = Math.sign(Fs2);
    signc  = Math.sign(Fc);

    w1 = As1*fyd/(b*d*fcd+NEd);
    w2 = As2*fyd/(b*d*fcd);

    let As_max = (As1+As2)/(b*h);
    if (Math.abs(As_max) < Math.max(0.1*NEd/fyd, 0.002) || Math.abs(As_max) > (stub ? 0.08 : 0.04) ) {
        document.getElementById("As_max").style.color = "#dc3545";
    } else {
        document.getElementById("As_max").style.color = "#0eb30e";
    }
    let As_max_ = suma_/(b*h);
    if (Math.abs(As_max_) < Math.max(0.1*NEd/fyd, 0.002) || Math.abs(As_max_) > (stub ? 0.08 : 0.04)) {
        document.getElementById("As_max_").style.color = "#dc3545";
    } else {
        document.getElementById("As_max_").style.color = "#0eb30e";
    }
    
    document.getElementById("As_max").textContent = (As_max*100).toFixed(2) + "%";
    document.getElementById("As_max_").textContent = (As_max_*100).toFixed(2) + "%";

    // KOEFICIJENT SMICUCEG ARMIRANJA
    let Asw = 2*Math.pow(fiV/2,2)*2;
    let s = 10; //poduzni razmak vilica
    let alpha = Math.PI/2; //ugao vilica naspram poduzne ose elementa
    let row_min=0.08*Math.sqrt(fck)/fyk;
    let row = Asw/(s*b*Math.sin(alpha));
    //--------------------------------

    //proracun izduzenja epsilon
    // ec2/x = es2/(x-d2) = es1/(d-x) = ec1/(h-x)
  /*  if (podrucje = "234") {
        let es2 =  ec3 * (1-d2/(xi*d));
        let es1 = ec3 * (1/xi-1);
        let ec1 = ec3 * (h/(xi*d)-1);
    }
    else if (podrucje = "5") {
        let ec = 0.002;
        let ec1 = 2*ec3-ec;
        let es2 = ec3 + (ec-ec3)*(1-2*d2/h);
        let es1 = ec3 - (ec-ec3)*(1-2*d1/h);
    }*/
        
        xi_pivot = ecu3/(ecu3+eud);
        C_ = (1-ec3/ecu3)*h;
        if (xi === 0) {
            ec = 0;
            es1 = eud;
            es2 = -eud * (d2 / d);
        }
        if ( xi <= xi_pivot && xi > 0) {
            es1 = eud;
            ec = es1*xi/(1-xi);
            es2 = ec - (d2 / d) * (ec + es1);
        }
        else if (xi > xi_pivot ) {
            ec = ecu3;
            es1 = ec*(1-xi)/xi;
            es2 = ec - (d2 / d) * (ec + es1);
        }

 /*   let w1 = 0.3;
    fcd = acc * fck / gammac;  //MPa
    
    // VAŽNO: Koristimo lokalnu varijablu da ne bismo uništili globalnu vrijednost fyd
    let fyd = fyk / gamma1;    //MPa
    E = 22 * ((fck + 8) / 10) ** 0.3; //GPa  

    lambda = fck < 55 ? 0.8 : 0.8 - (fck - 50) / 400;
    eta = fck < 55 ? 1.0 : 1.0 - (fck - 50) / 200;
    let elim = fck < 55 ? 0.45 : 0.35;

    let d1 = c + fiV / 10 + fiL / 20; // cm (ispravljeno: fiV/10 jer je u mm, fiL/20 jer je u mm do centra)
    d = h - d1;
    let d2 = c + fiV / 10 + fiL2 / 20;
    
    MEds = Mmax + NEd * (d - h / 2) / 100;


    // POPRAVKA: Računamo dinamički ecu3 i napon u armaturi direktno ovdje
    es1 = ecu3 * (d - x) / x;
    
    if (es1 <= eyd) {
        sigSd = Es * es1;
    }
    else if (es1 > eyd && es1 <= eud) {
        sigSd = fyd*(1+(kcal-1)*(es1-eyd)/(eud-eyd));
    }
     else {
        sigSd = fyd*kcal;
    }

    z = d - lambda * x / 2;
    let zeta = z / d;
    let xi = x / d;

    // Pretvaranje u kN i cm ISKLJUČIVO lokalno za izračun As
    let fyd_kN_cm2 = fyd / 10;
    let MEds_kN_cm = MEds * 100;
    
    As = (1 / fyd_kN_cm2) * (MEds_kN_cm / (zeta * d) - NEd);

    let vEd = NEd / (b * d * (fcd / 10));
    let uEds = MEds_kN_cm / (b * d * d * (fcd / 10));
    
    w1 = As / (b * d) * (sigSd / (fcd / 10));*/

    // Ažuriranje HTML rezultata
    // Pomoćna funkcija za siguran ispis sa try-catch mehanizmom
    

    popuniRezultate();
    crtajPresjek();
    
}


function popuni(id, vrijednost, decimale, jedinica = "") {
    try {
        document.getElementById(id).innerText = vrijednost.toFixed(decimale) + jedinica;
    } catch (e) {
        try {
            document.getElementById(id).innerText = "greska";
        } catch (err) {
            console.error("Element sa ID-jem " + id + " ne postoji u HTML-u.");
        }
    }
}

function popuniRezultate() {
popuni("res_M", MEds, 2, "  kNm");
popuni("res_N", NEd, 2, "  kN");
popuni("res_uEds", uEds, 4);
popuni("res_vEd", vEd, 2);
popuni("res_d", d, 2, "  cm");
popuni("res_x", x, 2, "  cm");
popuni("res_z", z, 2, "  cm");
popuni("res_xi", xi, 3, "");
popuni("res_zeta", zeta, 3, "");
popuni("res_x_lim", xi_lim*d, 2, "  cm");
popuni("res_z_lim", zeta_lim*d, 2, "  cm");
popuni("res_xi_lim",xi_lim,3,"");
popuni("res_zeta_lim",zeta_lim,3,"");
popuni("res_E", E, 2, "  GPa");
popuni("res_fcd", fcd, 2, "  MPa");
popuni("res_fyd", fyd, 2, "  MPa");
popuni("res_lambdac", lambda, 2);
popuni("res_eta", eta, 2);
popuni("res_sigSd", sigSd, 2, "  MPa");
popuni("res_w1", w1, 4);
popuni("res_w2", w2, 4);
popuni("res_As1", As1, 3, "  cm2");
popuni("res_As2", As2, 3, "  cm2");
}


// ==========================================================================
// FUNKCIJA ZA CRTANJE SVIH ELEMENATA (CANVAS)
// ==========================================================================
function crtajPresjek() {
    const canvas = document.getElementById("presjekCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const maxPixela = 300;
    let skala = maxPixela / h;

    if (b * skala > canvas.width - 100) {
        skala = (canvas.width - 100) / b;
    }

    const b_px = b * skala;
    const h_px = h * skala;

    const x_start = 50;
    const y_start = 20;

   // if (fck < 55) { const ecu3 = 0.0035; } else { const ecu3 = 0.0026 + 0.035 * ((90 - fck) / 100) ** 4; }                      
    

    // Crtanje pravougaonika (beton)
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#333333"; 
    ctx.fillStyle = "#e0e0e0";   
    ctx.beginPath();
    ctx.rect(x_start, y_start, b_px, h_px);
    ctx.fill();

    // Isprekidane kotne linije iz desnih ćoškova ---
    ctx.save(); // Čuvamo trenutni stil (da ne pokvarimo ostale linije)
    ctx.lineWidth = 1;          // Tanka linija
    ctx.strokeStyle = "#888888"; // Svjetlija siva boja
    ctx.setLineDash([5, 5]);    // Uzorak isprekidane linije: 5px puna, 5px prazna
    ctx.beginPath();
    ctx.moveTo(x_start + b_px, y_start);
    ctx.lineTo(canvas.width - 20, y_start); // Ide do 20px pred desnu ivicu canvasa
    ctx.moveTo(x_start + b_px, y_start + h_px);
    ctx.lineTo(canvas.width - 20, y_start + h_px);
    ctx.moveTo(x_start + b_px+(canvas.width-x_start-b_px-20)*0.3, y_start);
    ctx.lineTo(x_start + b_px+(canvas.width-x_start-b_px-20)*0.3, y_start+h_px); // Ide do 20px pred desnu ivicu canvasa
    ctx.moveTo(x_start + b_px+(canvas.width-x_start-b_px-20)*0.8, y_start);
    ctx.lineTo(x_start + b_px+(canvas.width-x_start-b_px-20)*0.8, y_start + h_px);
    ctx.stroke();
    ctx.restore(); // Vraćamo stil na punu liniju za crtanje ostalih stvari

    // Crtanje pritisnute zone
    ctx.save();
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = "#222"; 
    ctx.fillStyle = "#979797";
    ctx.fillStyle = createRotatedHatchPattern(ctx, "line", 45, 10, "#363333", 1); // Šara za pritisnutu zonu
    ctx.beginPath();
    ctx.rect(x_start, y_start, b_px, x * skala);
    ctx.stroke();
    ctx.fill();
    ctx.restore();
    
    //crtanje visine pritisnute zone
    ctx.save();
    ctx.lineWidth = 0.5;          // Tanka linija
    ctx.strokeStyle = "#bd7373"; // Svjetlija siva boja
    ctx.setLineDash([5, 5]);    // Uzorak isprekidane linije: 5px puna, 5px prazna
    ctx.beginPath();
    ctx.moveTo(x_start + b_px, y_start+x * skala);
    ctx.lineTo(canvas.width-20, y_start+x * skala);
    ctx.moveTo(x_start + b_px, y_start+xi_lim * d * skala);
    ctx.lineTo(canvas.width-20, y_start+xi_lim * d * skala);
    ctx.stroke();
    ctx.restore();
    //crtanje napona pritisnute zone
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 0.5;          // Tanka linija
    ctx.strokeStyle = "#333"; // Svjetlija siva boja
    ctx.fillStyle = createRotatedHatchPattern(ctx, "line", 0, 5, "#363333", 1); //
    ctx.rect(x_start + b_px+(canvas.width-x_start-b_px-20)*0.3, y_start, fcd*eta*skala, x * skala);
    ctx.fill();
    ctx.stroke();
    //prikaz teksta pritisnute zone x i xlim
    ctx.save();
    ctx.fillStyle = "#000000";
    ctx.textAlign = "left";
    TextEdit.format( ctx, `x = ${(x).toFixed(2)} cm`, x_start + b_px + 3 * skala, y_start + x * skala, 14 );
    TextEdit.format( ctx, `x_lim = ${(xi_lim*d).toFixed(2)} cm`, x_start + b_px + 3 * skala, y_start + xi_lim * d * skala, 14 );
    ctx.restore();

    //textualni prikaz napona pritisnute zone
    ctx.fillStyle = "#000000";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`fcd*\u03B7 = ${(fcd*eta).toFixed(2)} MPa`, x_start + b_px+(canvas.width-x_start-b_px-20)*0.3 + 5, y_start - 8);
    ctx.restore();

    //prikaz sile pritisnute zone
    ctx.save();
    ctx.fillStyle = "#000000";
    ctx.textAlign = "left";
    TextEdit.format(
            ctx, 
            `F_c = ${(fcd * eta*lambda * x*b).toFixed(2)} N`, 
            x_start + b_px + (canvas.width - x_start - b_px - 20) * 0.3 + (fcd * eta / 2+10) * skala, 
            y_start + Math.max(x/2 * skala+0.6*skala,3*skala), 
            14
        );
    ctx.restore();


   //prikaz napona zategnute armature
    ctx.save();
    ctx.fillStyle = "#000000";
    ctx.textAlign = "right";
    TextEdit.format(
            ctx, 
            `\u03C3_s = ${(sigSd).toFixed(2)} MPa`, 
            x_start + b_px + (canvas.width - x_start - b_px - 20) * 0.3 , 
            y_start + h_px + 3 * skala, 
            14
        );
    ctx.restore();
    
    //prikaz sile zategrnute armature
    ctx.save();
    ctx.fillStyle = "#000000";
    ctx.textAlign = "left";
    TextEdit.format(
            ctx, 
            `F_s = ${(As1 * sigSd).toFixed(2)} N`, 
            x_start + b_px + (canvas.width - x_start - b_px - 20) * 0.3 + (fcd * eta / 2+10) * skala, 
            y_start + h_px - (d1-0.6) * skala, 
            14
        );
    ctx.restore();

    //prikaz sile pritisnute armature
    if (Fs2 !== 0) {
    ctx.save();
    ctx.fillStyle = "#000000";
    ctx.textAlign = "left";
    TextEdit.format(
            ctx, 
            `F_s = ${(As2 * sigSd).toFixed(2)} N`, 
            x_start + b_px + (canvas.width - x_start - b_px - 20) * 0.3 + (fcd * eta / 2+10) * skala, 
            y_start + (d2+0.6) * skala, 
            14
        );
    ctx.restore();
    }

    const arrowStartX = x_start + b_px + (canvas.width - x_start - b_px - 20) * 0.3 + (fcd * eta / 2) * skala;
    const arrowStartY = y_start; // 10px iznad teksta

    //crtanje napona zategnute armature
    if (Fs1 !== 0) {
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth =5;          // Tanka linija
    ctx.strokeStyle = "#333"; // Svjetlija siva boja
    ctx.moveTo(arrowStartX-fcd*skala/2, arrowStartY + h_px - d1*skala);
    ctx.lineTo(arrowStartX-(fcd/2+sigSd/100)*skala, arrowStartY + h_px - d1*skala);
    ctx.stroke();
    ctx.restore();
    }

    //crtanje napona pritisnute armature
     if (Fs2 !== 0 ) {
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth =5;          // Tanka linija
    ctx.strokeStyle = "#333"; // Svjetlija siva boja
    ctx.moveTo(arrowStartX-fcd*skala/2, arrowStartY + d2*skala);
    ctx.lineTo(arrowStartX-(fcd/2-sigSd/100)*skala, arrowStartY + d2*skala);
    ctx.stroke();
    ctx.restore();
     }
    
    // Crtanje strelice Fc
    if (Fc !== 0) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(arrowStartX+8*skala, arrowStartY+x/2*skala);
    ctx.lineTo(arrowStartX, arrowStartY+x/2*skala);
    if (signc >=0) {
    ctx.moveTo(arrowStartX, arrowStartY+x/2*skala);
    ctx.lineTo(arrowStartX+2*skala, arrowStartY-1*skala+x/2*skala);
    ctx.lineTo(arrowStartX+2*skala, arrowStartY+1*skala+x/2*skala);
    } else {
    ctx.moveTo(arrowStartX, arrowStartY+x/2*skala);
    ctx.lineTo(arrowStartX+2*skala, arrowStartY-1*skala+x/2*skala);
    ctx.lineTo(arrowStartX+2*skala, arrowStartY+1*skala+x/2*skala);
    }
    ctx.closePath();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.restore();
    }

    // Crtanje strelice Fs1
    if (Fs1 !== 0) {
    let arrowStartYFs1 = arrowStartY + h_px - d1*skala;
    ctx.moveTo(arrowStartX+8*skala, arrowStartYFs1);
    ctx.lineTo(arrowStartX, arrowStartYFs1);
    if (signs1 >=0 ) {
    ctx.moveTo(arrowStartX+8*skala, arrowStartYFs1);
    ctx.lineTo(arrowStartX+6*skala, arrowStartYFs1-1*skala);
    ctx.lineTo(arrowStartX+6*skala, arrowStartYFs1+1*skala);
    } else {
    ctx.moveTo(arrowStartX, arrowStartYFs1);
    ctx.lineTo(arrowStartX+2*skala, arrowStartYFs1-1*skala);
    ctx.lineTo(arrowStartX+2*skala, arrowStartYFs1+1*skala);
    }
    ctx.closePath();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.restore();
    }

    // Crtanje strelice Fs2
    if (Fs2 !== 0){
    let arrowStartYFs2 = arrowStartY + d2*skala;
    ctx.moveTo(arrowStartX+8*skala, arrowStartYFs2);
    ctx.lineTo(arrowStartX, arrowStartYFs2);
    if (signs1 <=0 ) {
    ctx.moveTo(arrowStartX+8*skala, arrowStartYFs2);
    ctx.lineTo(arrowStartX+6*skala, arrowStartYFs2-1*skala);
    ctx.lineTo(arrowStartX+6*skala, arrowStartYFs2+1*skala);
    } else {
    ctx.moveTo(arrowStartX, arrowStartYFs2);
    ctx.lineTo(arrowStartX+2*skala, arrowStartYFs2-1*skala);
    ctx.lineTo(arrowStartX+2*skala, arrowStartYFs2+1*skala);
    }
    ctx.closePath();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.restore();
}

    // Crtanje dijagrama dilatacija
    ctx.save();
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "#0080e9";
    ctx.setLineDash([]); // Puna linija

    const osa_ec = x_start + b_px + (canvas.width - x_start - b_px - 20) * 0.8;
    const skala_dijagrama = 1000; 
    const y_vrh = y_start;                      
    const y_osax = y_start + x * skala;         
    const y_osas1 = y_start + d * skala;    
    //const es1 = ecu3 * (d - x) / x;          // Sličnost trouglova

    ctx.beginPath();
    ctx.moveTo(osa_ec, y_vrh); 
    ctx.lineTo(osa_ec + (ec * skala_dijagrama), y_vrh);
    ctx.lineTo(osa_ec, y_osax); 
    ctx.lineTo(osa_ec - (es1 * skala_dijagrama), y_osas1);
    ctx.lineTo(osa_ec , y_osas1); 
    ctx.lineTo(osa_ec , y_vrh);
    ctx.moveTo(osa_ec, y_vrh+d2*skala); //es2
    ctx.lineTo(osa_ec + es2*skala, y_vrh+d2*skala); //es2
    ctx.fillStyle = "rgba(0, 128, 233, 0.1)";
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // kraj crtanja dijagrama dilatacija

    //textualni prikaz dilatacije pritisnute zone
    ctx.fillStyle = "#000000";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    TextEdit.format(ctx,`\u03b5_cu3 = ${(ec3).toFixed(4)}`, x_start + b_px+(canvas.width-x_start-b_px-20)*0.8 + 5, y_start -8,14);

    //textualni prikaz dilatacije zategnute armature
    ctx.fillStyle = "#000000";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "right";
    TextEdit.format(ctx,`\u03b5_s1 = ${(es1).toFixed(4)}`, x_start + b_px+(canvas.width-x_start-b_px-20)*0.8 + 5, y_start + h_px + 3 * skala,14);




    // Vanjska ivica grede
    ctx.strokeStyle = "#333333"; 
    ctx.beginPath();
    ctx.rect(x_start, y_start, b_px, h_px);
    ctx.stroke();

    // Crtanje zaštitnog sloja (samo okvirna linija vizuelno)
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#f01e2c"; 
    ctx.beginPath();
    ctx.rect(x_start + c * skala, y_start + c * skala, b_px - 2 * c * skala, h_px - 2 * c * skala);
    ctx.stroke();

    // Crtanje vilice
    ctx.lineWidth = (fiV / 10) * skala;
    ctx.strokeStyle = "#779eb2"; 
    ctx.beginPath();
    ctx.roundRect(x_start + (c + fiV / 20) * skala, y_start + (c + fiV / 20) * skala, b_px - 2 * (c + fiV / 20) * skala, h_px - 2 * (c + fiV / 20) * skala, 10*Math.min(30/b,50/h));
    ctx.stroke();
    
    // Crtanje kukica vilice
    ctx.beginPath();
    ctx.moveTo(x_start + b_px - (c + fiV / 20) * skala, y_start + (c + 3*Math.min(30/b,50/h) + fiV / 20) * skala);
    ctx.lineTo(x_start + b_px - (c + fiV / 20) * skala - 3 * skala, y_start + (c + 3*Math.min(30/b,50/h) + fiV / 20) * skala + 3 * skala);
    ctx.moveTo(x_start + b_px - (c + 3*Math.min(30/b,50/h) + fiV / 20) * skala, y_start + (c + fiV / 20) * skala);
    ctx.lineTo(x_start + b_px - (c + 4*Math.min(30/b,50/h) - fiV / 20) * skala - 3 * skala, y_start + (c + fiV / 20) * skala + 3 * skala);
    ctx.stroke();

    // 3. CRTANJE PODUŽNE ARMATURE (DONJA I GORNJA ZONA)
    const iscrtajSveSipke = (redovi, polozaj) => {
        if (!redovi) return;

        redovi.forEach(red => {
            // Y koordinata na canvasu ovisno o tome da li je donja ili gornja zona
            let y_canvas = polozaj === "donja" 
                ? y_start + h_px - (red.y * skala) 
                : y_start + (red.y * skala);

            red.sipke.forEach(sipka => {
                let x_canvas = x_start + (sipka.x * skala);

                ctx.beginPath();
                ctx.arc(x_canvas, y_canvas, (sipka.fi / 20) * skala, 0, 2 * Math.PI);
                ctx.fillStyle = polozaj === "donja" ? "#779eb2" : "#a85d5d"; 
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = "#333";
                ctx.stroke();
            });
        });
    };

    if (proracunskiRaspored) {
        iscrtajSveSipke(proracunskiRaspored.redoviDonje, "donja");
        iscrtajSveSipke(proracunskiRaspored.redoviGornje, "gornja");
    }
    // 4. Ispis dimenzija na ivicama pravougaonika (b i h)
    ctx.fillStyle = "#000000";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`b = ${b} cm`, x_start + b_px / 2, y_start + h_px + 20);

    ctx.save();
    ctx.translate(x_start - 20, y_start + h_px / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`h = ${h} cm`, 0, 0);
    ctx.restore();
}

// ==========================================================================
// FUNKCIJA ZA ZBIR I CRTANJE ARMATURE
// ==========================================================================
window.preracunajSve = function() {
    const kontejnerDonja = document.getElementById("armatura-kontejner-donja");
    const kontejnerGornja = document.getElementById("armatura-kontejner-gornja");
    
    let As_donja = window.preracunajZonu(kontejnerDonja, "inp-precnik-d", "inp-broj-sipki-d", "lab_arm_d");
    let As_gornja = window.preracunajZonu(kontejnerGornja, "inp-precnik-g", "inp-broj-sipki-g", "lab_arm_g");
    
    // Čuvamo ukupnu površinu armature u cm2
    suma_ = As_donja + As_gornja; 
    
    sakupiIRasporediArmaturu();
    proracun();

    return suma_;
};

// ==========================================================================
// POMOCNA FUNKCIJA ZA SLANJE U KLASU RasporedArmature.js
// ==========================================================================
let proracunskiRaspored = null;

function sakupiIRasporediArmaturu() {
    const sakupiIzKontejnera = (kontejnerId, klasaPrecnika, klasaBroja) => {
        const kontejner = document.getElementById(kontejnerId);
        if (!kontejner) return [];
        const listaRedova = kontejner.querySelector(".arm-lista-redova") || kontejner;
        const sviRedovi = listaRedova.querySelectorAll(".arm_red");
        
        let podaci = []; // Format: [[fi, kom], [fi, kom], ...]
        sviRedovi.forEach(red => {
            const fi = parseFloat(red.querySelector("." + klasaPrecnika).value) || 0;
            const n = parseFloat(red.querySelector("." + klasaBroja).value) || 0;
            if (fi > 0 && n > 0) {
                podaci.push([fi, n]); // Pregledniji i čitljiviji upis!
            }
        });
        return podaci;
    };

    let donjaZonaPodaci = sakupiIzKontejnera("armatura-kontejner-donja", "inp-precnik-d", "inp-broj-sipki-d");
    let gornjaZonaPodaci = sakupiIzKontejnera("armatura-kontejner-gornja", "inp-precnik-g", "inp-broj-sipki-g");

    // Pozivamo naš novi RasporedArmature
    proracunskiRaspored = new RasporedArmature(b, h, c, fiV, donjaZonaPodaci, gornjaZonaPodaci, fck);
}

// ==========================================================================
// POMOCNA FUNKCIJA ZA CRTANJE ŠRAFURE
// ==========================================================================
function createRotatedHatchPattern(ctx, tip, ugao, skala, boja, lineWidth) {
    let pCanvas = document.createElement('canvas');
    pCanvas.width = skala;
    pCanvas.height = skala;
    let pCtx = pCanvas.getContext('2d');

    pCtx.strokeStyle = boja;
    pCtx.lineWidth = lineWidth || 1;
    pCtx.beginPath();

    // 1. Crtamo UVIJEK savršeno ravno pod 0° (nema trigonometrije, nema prekida!)
    pCtx.moveTo(0, 0); 
    pCtx.lineTo(skala, 0); // Obična uspravna linija dužine 'a' (skala)
    
    if (tip === 'grid') {
        pCtx.moveTo(0, 0); 
        pCtx.lineTo(0,skala); // Vodoravna linija koja pravi pravilan plus (+)
    }
    pCtx.stroke();

    // 2. Kreiramo osnovni šablon koji se ponavlja
    let pattern = ctx.createPattern(pCanvas, 'repeat');

    // 3. NAKNADNA ROTACIJA: Rotiramo kompletno spojenu teksturu
    if (ugao !== 0) {
        let matrica = new DOMMatrix();
        matrica = matrica.rotate(-ugao); // Rotiramo za tačan broj stepeni
        pattern.setTransform(matrica);  // Primjenjujemo rotaciju na šablon
    }

    return pattern;
}

// ==========================================================================
// FUNKCIJA ZA ZBIR I CRTANJE PODUŽNE ARMATURE
// ==========================================================================
window.preracunajSve = function() {
    const kontejnerDonja = document.getElementById("armatura-kontejner-donja");
    const kontejnerGornja = document.getElementById("armatura-kontejner-gornja");
    
    let As_donja = window.preracunajZonu(kontejnerDonja, "inp-precnik-d", "inp-broj-sipki-d", "lab_arm_d");
    let As_gornja = window.preracunajZonu(kontejnerGornja, "inp-precnik-g", "inp-broj-sipki-g", "lab_arm_g");
    
    // Čuvamo ukupnu površinu armature u cm2
    suma_ = As_donja + As_gornja; 
    
    sakupiIRasporediArmaturu();
    proracun();
};

// ==========================================================================
// DODAVANJE ARMATURE U LISTU I PRERAČUN (DONJA I GORNJA ZONA)
// ==========================================================================

document.addEventListener("DOMContentLoaded", function () {
    const kontejnerDonja = document.getElementById("armatura-kontejner-donja");
    const kontejnerGornja = document.getElementById("armatura-kontejner-gornja");

    // Funkcija koja prolazi kroz redove i osigurava da samo zadnji ima "+", a ostali "×"
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

    // Funkcija koja računa površinu armature po zonama
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
            if (labArm) {
                labArm.textContent = povrsinaReda.toFixed(2) + " cm²";
            }
            suma += povrsinaReda;
        });

        const ukupnoPrikaz = kontejner.querySelector(".arm-ukupno");
        if (ukupnoPrikaz) {
            ukupnoPrikaz.textContent = suma.toFixed(2) + " cm²";
        }
        
        return suma;
    }

    // Osluškivanje promjena u donjoj zoni
    if (kontejnerDonja) {
        kontejnerDonja.addEventListener("input", function (e) {
            if (e.target.classList.contains("inp-precnik-d") || e.target.classList.contains("inp-broj-sipki-d")) {
                preracunajSve();
            }
        });

        kontejnerDonja.addEventListener("click", function (e) {
            const listaRedova = kontejnerDonja.querySelector(".arm-lista-redova") || kontejnerDonja;

            if (e.target.classList.contains("btn_add_arm_d")) {
                const noviRed = document.createElement("div");
                noviRed.className = "arm_red";
                noviRed.innerHTML = `
                    <span class="redni-broj"></span>
                    <input class="inp-precnik-d" type="number" min="8" max="50" value="14" placeholder="Ø (mm)">
                    <input class="inp-broj-sipki-d" type="number" min="1" max="50" value="2" placeholder="kom">
                    <span class="lab_arm_d">0.00 cm²</span>
                    <button class="btn_add_arm_d" type="button">+</button>
                `;
                listaRedova.appendChild(noviRed);
                osveziDugmadIZnakove(kontejnerDonja, "btn_add_arm_d");
                preracunajSve();
            }

            if (e.target.classList.contains("btn-obrisi")) {
                e.target.closest(".arm_red").remove();
                osveziDugmadIZnakove(kontejnerDonja, "btn_add_arm_d");
                preracunajSve();
            }
        });
    }

    // Osluškivanje promjena u gornjoj zoni
    if (kontejnerGornja) {
        kontejnerGornja.addEventListener("input", function (e) {
            if (e.target.classList.contains("inp-precnik-g") || e.target.classList.contains("inp-broj-sipki-g")) {
                preracunajSve();
            }
        });

        kontejnerGornja.addEventListener("click", function (e) {
            const listaRedova = kontejnerGornja.querySelector(".arm-lista-redova") || kontejnerGornja;

            if (e.target.classList.contains("btn_add_arm_g")) {
                const noviRed = document.createElement("div");
                noviRed.className = "arm_red";
                noviRed.innerHTML = `
                    <span class="redni-broj"></span>
                    <input class="inp-precnik-g" type="number" min="8" max="50" value="14" placeholder="Ø (mm)">
                    <input class="inp-broj-sipki-g" type="number" min="1" max="50" value="2" placeholder="kom">
                    <span class="lab_arm_g">0.00 cm²</span>
                    <button class="btn_add_arm_g" type="button">+</button>
                `;
                listaRedova.appendChild(noviRed);
                osveziDugmadIZnakove(kontejnerGornja, "btn_add_arm_g");
                preracunajSve();
            }

            if (e.target.classList.contains("btn-obrisi")) {
                e.target.closest(".arm_red").remove();
                osveziDugmadIZnakove(kontejnerGornja, "btn_add_arm_g");
                preracunajSve();
            }
        });
    }

    // Inicijalno podešavanje stanja dugmića pri prvom učitavanju
    osveziDugmadIZnakove(kontejnerDonja, "btn_add_arm_d");
    osveziDugmadIZnakove(kontejnerGornja, "btn_add_arm_g");

    // Prvi, inicijalni proračun
    preracunajSve();
});

window.addEventListener("DOMContentLoaded", () => {
    document.body.style.zoom = "80%";
});

