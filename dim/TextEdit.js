/**
 * Iscrtava tekst na Canvasu sa podrškom za subscript (_) i superscript (^)
 * 
 * Pravila pisanja:
 * - Koristi '_' da započneš donji indeks (subscript) -> f_cd
 * - Koristi '^' da započneš gornji indeks (superscript) -> cm^2
 * - Razmak (' ') automatski vraća tekst u normalno stanje.
 * 
 * @param {CanvasRenderingContext2D} ctx - Kontekst tvog canvasa
 * @param {string} text - Tekst koji sadrži formate (npr. "\u03b5_c" ili "cm^2")
 * @param {number} x - Početna X koordinata
 * @param {number} y - Početna Y koordinata (bazna linija teksta)
 * @param {number} baseSize - Osnovna veličina fonta u pikselima (default: 15)
 */
/**
 * Iscrtava tekst na Canvasu sa podrškom za subscript (_) i superscript (^)
 * Podržava ctx.textAlign ("left", "right", "center")
 */
function format(ctx, text, x, y, baseSize = 15) {
    const fontFamily = "sans-serif";
    const subSuperSize = Math.round(baseSize * 0.65); // Indeksi su 65% veličine glavnog teksta

    ctx.save();
    
    // --- 1. PRORAČUN UKUPNE ŠIRINE TEKSTA ZA PORAVNANJE ---
    const originalniAlign = ctx.textAlign; // Pamtimo šta je korisnik postavio ("right", "center"...)
    let ukupnaSirina = 0;
    let provjeraStanja = "normal";
    
    for (let i = 0; i < text.length; i++) {
        let char = text[i];
        if (char === '_') { provjeraStanja = "sub"; continue; }
        if (char === '^') { provjeraStanja = "super"; continue; }
        if (char === ' ') { provjeraStanja = "normal"; }
        
        if (provjeraStanja === "normal") {
            ctx.font = `${baseSize}px ${fontFamily}`;
        } else {
            ctx.font = `${subSuperSize}px ${fontFamily}`;
        }
        ukupnaSirina += ctx.measureText(char).width;
    }
    
    // Korekcija početne X koordinate na osnovu željenog poravnanja
    let currentX = x;
    if (originalniAlign === "right") {
        currentX = x - ukupnaSirina; // Pomijeramo početak ulijevo za cijelu širinu teksta
    } else if (originalniAlign === "center") {
        currentX = x - (ukupnaSirina / 2);
    }
    
    // VAŽNO: Prisilno prebacujemo na "left" da se pojedinačna slova ne bi izvitoperila tokom crtanja
    ctx.textAlign = "left";
    // --- KRAJ PRORAČUNA ŠIRINE ---


    // --- 2. CRTANJE TEKSTA (Originalna logika sa korigovanim currentX) ---
    let state = "normal"; // Moguća stanja: "normal", "sub", "super"

    for (let i = 0; i < text.length; i++) {
        let char = text[i];

        if (char === '_') {
            state = "sub";
            continue; 
        } else if (char === '^') {
            state = "super";
            continue; 
        } else if (char === ' ') {
            state = "normal"; 
        }

        let currentY = y;

        if (state === "normal") {
            ctx.font = `${baseSize}px ${fontFamily}`;
            currentY = y;
        } else if (state === "sub") {
            ctx.font = `${subSuperSize}px ${fontFamily}`;
            currentY = y + (baseSize * 0.25); 
        } else if (state === "super") {
            ctx.font = `${subSuperSize}px ${fontFamily}`;
            currentY = y - (baseSize * 0.4);  
        }

        ctx.fillText(char, currentX, currentY);
        currentX += ctx.measureText(char).width;
    }
    ctx.restore();
}