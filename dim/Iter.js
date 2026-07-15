class Solveri {
    /**
     * Rješava linearni sistem jednačina Ax = b pomoću Gausove eliminacije sa parcijalnim pivotiranjem.
     * Koristi se za pronalaženje vektora pomaka u linearnoj analizi.
     * 
     * @param {Array<Array<number>>} A - Matrica krutosti sistema (n x n)
     * @param {Array<number>} b - Vektor vanjskog opterećenja (n)
     * @returns {Array<number>} Vektor rješenja x (n)
     */
    static gausovaEliminacija(A, b) {
        let n = b.length;
        
        // Duboka kopija matrice i vektora kako se ne bi mijenjali originalni ulazni podaci
        let M = A.map((row, i) => [...row, b[i]]);

        for (let i = 0; i < n; i++) {
            // 1. Parcijalno pivotiranje (traženje najvećeg elementa u koloni radi stabilnosti)
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
                    maxRow = k;
                }
            }

            // Zamjena redova ako je potrebno
            if (maxRow !== i) {
                let temp = M[i];
                M[i] = M[maxRow];
                M[maxRow] = temp;
            }

            // Provjera singularnosti matrice
            if (Math.abs(M[i][i]) < 1e-12) {
                throw new Error("Matrica je singularna ili blizu singularnosti. Sistem nema jedinstveno rješenje.");
            }

            // 2. Eliminacija unaprijed (svođenje na gornju trougaonu matricu)
            for (let k = i + 1; k < n; k++) {
                let c = -M[k][i] / M[i][i];
                for (let j = i; j <= n; j++) {
                    if (i === j) {
                        M[k][j] = 0;
                    } else {
                        M[k][j] += c * M[i][j];
                    }
                }
            }
        }

        // 3. Supstitucija unazad (izračunavanje vektora x)
        let x = new Array(n).fill(0);
        for (let i = n - 1; i >= 0; i--) {
            x[i] = M[i][n];
            for (let j = i + 1; j < n; j++) {
                x[i] -= M[i][j] * x[j];
            }
            x[i] /= M[i][i];
        }

        return x;
    }

    /**
     * Pronalazi korijen nelinearne funkcije f(x) = 0 unutar zadanog intervala [a, b].
     * Metoda je spora ali garantovano konvergira ako funkcija mijenja znak na krajevima.
     * 
     * @param {Function} f - Nelinearna funkcija
     * @param {number} a - Početak intervala
     * @param {number} b - Kraj intervala
     * @param {number} tol - Tolerancija greške (default 1e-6)
     * @param {number} maxIter - Maksimalan broj iteracija
     * @returns {number} Približan korijen funkcije
     */
    static bisekcija(f, a, b, tol = 1e-6, maxIter = 100) {
        if (f(a) * f(b) >= 0) {
            throw new Error("Funkcija mora imati različite znakove na krajevima intervala [a, b].");
        }

        let c = a;
        let iter = 0;

        while ((b - a) / 2 > tol && iter < maxIter) {
            c = (a + b) / 2;

            // Ako je c tačan korijen
            if (Math.abs(f(c)) < 1e-15) {
                break;
            }

            // Određivanje novog podintervala
            if (f(c) * f(a) < 0) {
                b = c;
            } else {
                a = c;
            }
            iter++;
        }

        return c;
    }

    /**
     * Pronalazi korijen nelinearne funkcije f(x) = 0 pomoću tangentne metode.
     * Izuzetno brza konvergencija (kvadratna), često se koristi na nivou integracionih tačaka (npr. plastičnost).
     * 
     * @param {Function} f - Nelinearna funkcija
     * @param {Function} df - Prva derivacija funkcije (f')
     * @param {number} x0 - Početna pretpostavka
     * @param {number} tol - Tolerancija konvergencije (default 1e-6)
     * @param {number} maxIter - Maksimalan broj iteracija
     * @returns {number} Približan korijen funkcije
     */
    static newtonRaphson(f, df, x0, tol = 1e-6, maxIter = 100) {
        let x = x0;
        let iter = 0;

        while (iter < maxIter) {
            let fx = f(x);
            let dfx = df(x);

            // Spriječavanje dijeljenja s nulom (lokalni ekstrem)
            if (Math.abs(dfx) < 1e-12) {
                throw new Error("Derivacija je preblizu nuli. Metoda Newton-Raphson ne može nastaviti.");
            }

            let xNext = x - fx / dfx;

            // Provjera konvergencije (razlika između dvije iteracije)
            if (Math.abs(xNext - x) < tol) {
                return xNext;
            }

            x = xNext;
            iter++;
        }

        throw new Error(`Metoda nije konvergirala u maksimalnom broju iteracija (${maxIter}).`);
    }
}