/**
 * RasporedArmature.js
 * 
 * Klasa vrši dinamičko, korak-po-korak slaganje i simetrično balansiranje 
 * podužne armature po Eurokodu 2 (EC2) koristeći Symmetrical Partitioning algoritam.
 */

class RasporedArmature {
    /**
     * @param {number} b - širina grede (cm)
     * @param {number} h - visina grede (cm)
     * @param {number} c - zaštitni sloj (cm)
     * @param {number} fiV - prečnik vilice (mm)
     * @param {Array} fiDonje - Niz unosa donje armature u formatu [[fi, kom], [fi, kom], ...]
     * @param {Array} fiGornje - Niz unosa gornje armature u formatu [[fi, kom], [fi, kom], ...]
     * @param {number} fck - karakteristična čvrstoća betona (MPa)
     */
    constructor(b, h, c, fiV, fiDonje, fiGornje, fck) {
        this.b = b;
        this.h = h;
        this.c = c;
        this.fiV = fiV;
        this.fck = fck;

        // Konverzija iz formata [prečnik, kom] u ravan niz pojedinačnih prečnika u mm
        this.donjeSve = this._pretvoriUListaSipki(fiDonje);
        this.gornjeSve = this._pretvoriUListaSipki(fiGornje);

        // Krajnji generisani redovi sa fizičkim koordinatama
        this.redoviDonje = [];
        this.redoviGornje = [];

        // Težišta armaturnih zona (d1 i d2)
        this.d1 = null;
        this.d2 = null;

        this.procesuiraj();
    }

    getTezista() {
        return {
            donjaZona: this.d1 ? { x: this.d1.x, y: this.d1.y } : null,
            gornjaZona: this.d2 ? { x: this.d2.x, y: this.d2.y } : null
        };
    }

    _pretvoriUListaSipki(listaEntrija) {
        let rezultat = [];
        if (!listaEntrija) return rezultat;
        for (let entri of listaEntrija) {
            const fi = entri[0];
            const kom = entri[1];
            for (let i = 0; i < kom; i++) {
                if (fi > 0) rezultat.push(fi);
            }
        }
        return rezultat;
    }

    _getMinSvijetliRazmak(fi1_mm, fi2_mm) {
        let phi1 = fi1_mm / 10;
        let phi2 = fi2_mm / 10;
        let maxPhi = Math.max(phi1, phi2);
        // EC2: max (d_max, d_g + 5mm [uzeto 2.1cm za agregat 16mm], 2.0cm)
        return Math.max(maxPhi, 2.1);
    }

    procesuiraj() {
        this.redoviDonje = this._sloziZonu(this.donjeSve, "donja");
        this.redoviGornje = this._sloziZonu(this.gornjeSve, "gornja");

        this.d1 = this._racunajTezisteZone(this.redoviDonje, "donja");
        this.d2 = this._racunajTezisteZone(this.redoviGornje, "gornja");
    }

    /**
     * Glavna logika simetričnog slaganja šipki.
     */
    _sloziZonu(listaSipki, zona) {
        let fizickiRedovi = [];
        if (listaSipki.length === 0) return fizickiRedovi;

        let cv = this.c + this.fiV / 10; // Zaštitni sloj do unutrašnjosti vilice (cm)
        let x_min_apsolutno = cv;
        let x_max_apsolutno = this.b - cv;
        let raspolozivaSirina = x_max_apsolutno - x_min_apsolutno;

        // 1. Grupisanje po prečnicima i ekstrakcija parova i singlova
        let counts = {};
        for (let fi of listaSipki) {
            counts[fi] = (counts[fi] || 0) + 1;
        }

        let jedinstveni = Object.keys(counts).map(Number).sort((a, b) => b - a);
        let pairs = [];   // Sadrži prečnike dostupnih parova, npr. [32, 24, 24...]
        let singles = []; // Sadrži prečnike dostupnih singlova (neparne šipke), npr. [32, 14]

        for (let fi of jedinstveni) {
            let c = counts[fi];
            if (c % 2 === 1) {
                singles.push(fi);
                c--;
            }
            let numPairs = c / 2;
            for (let i = 0; i < numPairs; i++) {
                pairs.push(fi);
            }
        }

        // Sortiramo silazno (od najvećih ka najmanjim)
        pairs.sort((a, b) => b - a);
        singles.sort((a, b) => b - a);

        let redoviSkice = [];

        // 2. Kreiranje redova odozdo ka gore dok ne potrošimo sve šipke
        while (pairs.length > 0 || singles.length > 0) {
            let bestLayout = null;
            let bestScore = -1;
            let bestUsedPairsIndices = [];
            let bestUsedSingleIndex = -1;

            // Opcije za centar (indeks singla, ili -1 ako nema singla u sredini)
            let singleOptions = [-1, ...singles.map((_, idx) => idx)];

            for (let sIdx of singleOptions) {
                let centerSingle = sIdx !== -1 ? singles[sIdx] : null;

                // Backtracking pretraga za nalaženje optimalnog podniza parova koji staju u red
                this._pretraziKombinacijeParova(
                    [], 
                    pairs, 
                    0, 
                    centerSingle, 
                    raspolozivaSirina, 
                    (candidateLayout, usedIndices) => {
                        // Funkcija bodovanja:
                        // Prioritet 1: Maksimalan broj šipki u redu (candidateLayout.length * 10000)
                        // Prioritet 2: Veći prečnici (sumu prečnika u redu) kako bi teže šipke išle niže
                        let score = candidateLayout.length * 10000 + candidateLayout.reduce((sum, fi) => sum + fi, 0);
                        
                        if (score > bestScore) {
                            bestScore = score;
                            bestLayout = candidateLayout;
                            bestUsedPairsIndices = usedIndices;
                            bestUsedSingleIndex = sIdx;
                        }
                    }
                );
            }

            // Fallback ako ništa fizički ne može stati (sprječavanje beskonačne petlje)
            if (bestLayout === null || bestLayout.length === 0) {
                if (singles.length > 0) {
                    bestLayout = [singles[0]];
                    bestUsedSingleIndex = 0;
                } else if (pairs.length > 0) {
                    let p = pairs[0];
                    bestLayout = [p];
                    pairs.splice(0, 1);
                    singles.push(p);
                    singles.sort((a, b) => b - a);
                    continue;
                } else {
                    break;
                }
            }

            // Uklanjanje iskorištenih parova i singlova iz bazena slobodnih šipki
            bestUsedPairsIndices.sort((a, b) => b - a);
            for (let idx of bestUsedPairsIndices) {
                pairs.splice(idx, 1);
            }
            if (bestUsedSingleIndex !== -1) {
                singles.splice(bestUsedSingleIndex, 1);
            }

            redoviSkice.push(bestLayout);
        }

        // 3. Pretvaranje skica u fizičke koordinatne sisteme
        for (let rIdx = 0; rIdx < redoviSkice.length; rIdx++) {
            let sipkeURedu = redoviSkice[rIdx];
            let xKoordinate = this._balansirajIBalansirajRed(sipkeURedu, raspolozivaSirina, x_min_apsolutno);

            fizickiRedovi.push({
                y: 0, 
                sipke: sipkeURedu.map((f, i) => ({ fi: f, x: xKoordinate[i] }))
            });
        }

        // 4. Tačan proračun Y visina za svaki red (isti kao prije)
        let y_akumulirano = 0;
        for (let j = 0; j < fizickiRedovi.length; j++) {
            let red = fizickiRedovi[j];
            let maxFiURedu = Math.max(...red.sipke.map(s => s.fi));
            let srFi = maxFiURedu / 10; 

            if (j === 0) {
                y_akumulirano = cv + srFi / 2;
            } else {
                let prethodniRed = fizickiRedovi[j - 1];
                let maxFiPrethodni = Math.max(...prethodniRed.sipke.map(s => s.fi));
                let phiMaxSusedni = Math.max(maxFiURedu, maxFiPrethodni) / 10;
                
                let cistiRazmakRedova = Math.max(phiMaxSusedni, 2.0); 
                y_akumulirano += cistiRazmakRedova + (maxFiPrethodni / 20) + (maxFiURedu / 20);
            }
            red.y = y_akumulirano;
        }

        return fizickiRedovi;
    }

    /**
     * Rekurzivna pretraga kombinacija parova koja osigurava savršenu simetriju.
     */
    _pretraziKombinacijeParova(chosenIndices, pairs, startIdx, centerSingle, raspolozivaSirina, callback) {
        let chosenDiameters = chosenIndices.map(idx => pairs[idx]);
        chosenDiameters.sort((a, b) => b - a); // Veći idu spolja!

        let left = [...chosenDiameters];
        let right = [...left].reverse();
        let layout = centerSingle !== null ? [...left, centerSingle, ...right] : [...left, ...right];

        if (layout.length > 0) {
            let coords = this._balansirajIBalansirajRed(layout, raspolozivaSirina, this.c + this.fiV / 10);
            if (coords !== null) {
                callback(layout, [...chosenIndices]);
            } else {
                // Ako trenutni raspored ne staje, ne staje ni bilo koji veći (pruning)
                return;
            }
        }

        for (let i = startIdx; i < pairs.length; i++) {
            if (i > startIdx && pairs[i] === pairs[i - 1]) continue; // Izbjegavanje duplih grana

            chosenIndices.push(i);
            this._pretraziKombinacijeParova(chosenIndices, pairs, i + 1, centerSingle, raspolozivaSirina, callback);
            chosenIndices.pop();
        }
    }

    _balansirajIBalansirajRed(nizSipki, sirinaKosa, x_pocetno) {
        const n = nizSipki.length;
        if (n === 0) return [];
        if (n === 1) {
            return [x_pocetno + sirinaKosa / 2];
        }

        let x_koordinate = new Array(n);
        let r_prva = (nizSipki[0] / 20); 
        let r_zadnja = (nizSipki[n - 1] / 20); 

        let x_lijeva_ivica = x_pocetno + r_prva;
        let x_desna_ivica = x_pocetno + sirinaKosa - r_zadnja;

        x_koordinate[0] = x_lijeva_ivica;
        x_koordinate[n - 1] = x_desna_ivica;

        if (n === 2) {
            let svijetli = (x_koordinate[1] - (nizSipki[1]/20)) - (x_koordinate[0] + (nizSipki[0]/20));
            let minSvijetli = this._getMinSvijetliRazmak(nizSipki[0], nizSipki[1]);
            return svijetli >= (minSvijetli - 0.01) ? x_koordinate : null;
        }

        let ukupnoRastojanje = x_desna_ivica - x_lijeva_ivica;
        let korak = ukupnoRastojanje / (n - 1);

        for (let i = 1; i < n - 1; i++) {
            x_koordinate[i] = x_lijeva_ivica + i * korak;
        }

        for (let i = 0; i < n - 1; i++) {
            let s_desna_ivica_lijeve = x_koordinate[i] + (nizSipki[i] / 20);
            let s_lijeva_ivica_desne = x_koordinate[i + 1] - (nizSipki[i + 1] / 20);
            let trenutniSvijetli = s_lijeva_ivica_desne - s_desna_ivica_lijeve;

            let minPotreban = this._getMinSvijetliRazmak(nizSipki[i], nizSipki[i + 1]);
            if (trenutniSvijetli < (minPotreban - 0.01)) {
                return null; 
            }
        }

        return x_koordinate;
    }

    _racunajTezisteZone(fizickiRedovi, zona) {
        if (!fizickiRedovi || fizickiRedovi.length === 0) return null;

        let ukupnaPovrsina = 0;
        let statickiMomentY = 0; // Za Y koordinatu (visinu)
        let statickiMomentX = 0; // Za X koordinatu (širinu)

        for (let red of fizickiRedovi) {
            let y_koordinata = red.y;
            for (let sipka of red.sipke) {
                let a_sipke = Math.PI * (sipka.fi / 10) ** 2 / 4; // Površina šipke u cm2
                ukupnaPovrsina += a_sipke;
                
                // Množimo površinu sa udaljenostima
                statickiMomentY += a_sipke * y_koordinata;
                statickiMomentX += a_sipke * sipka.x; 
            }
        }

        if (ukupnaPovrsina > 0) {
            return {
                x: statickiMomentX / ukupnaPovrsina,
                y: statickiMomentY / ukupnaPovrsina
            };
        }
        
        return null;
    }
}