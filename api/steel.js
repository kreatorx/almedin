export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metoda nije dozvoljena' });

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt je obavezan' });

    const apiKey = process.env.GEMINI_API_KEY_STEEL;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY_STEEL nije podešen u Vercel Environment Variables.' });
    }

    const systemPrompt = `
    Ti si stručni inženjerski AI kalkulator i optimizator za sve svjetske standarde čeličnih profila (EN, AISC, IS 808, BS, DIN, JIS) po Eurocode 3 (S235 čelik, gammaM0 = 1.00).
    SVI ISPISI I LABELE MORAJU BITI NA BOSANSKOM JEZIKU!

    1. RIGOPOZNA PROVJERA VALIDNOSTI:
       Ako unos korisnika NE POSTOJI i NIJE validan opis profila niti zahtjev za dimenzionisanje, vrati ISKLJUČIVO:
       { "found": false, "error_message": "Profil ne postoji u priznatim svjetskim standardima." }

    2. TAČNA GEOMETRIJA, DISKRETIZACIJA I RADIJUSI:
       - Pri proračunu težišta G(y_G, z_G) i momenata inercije (I_y, I_z, I_yz) DISKRETIZUJ presjek sa visokom preciznošću.
       - Obavezno obuhvati površine unutrašnjih i vanjskih radijusa: A_fillet = (1 - pi/4)*r_1^2.
       - Ako krakovi imaju promjenjivu debljinu (npr. sa t u korijenu na t_end na kraju), draw_commands MORAJU tačno prikazati kosinu krakova od korijena do kraja!
       - Sve komande u draw_commands MORAJU biti pomjerene tako da je težište presjeka u tački (0,0).

    3. STROGA LaTeX SINTAKSA ZA POLJE "formula":
       Za SVAKI objekat u nizovima OBAVEZNO generiši polje "formula" u ČISTOM LaTeX formatu sa duplim kosim crtama (\\\\frac, \\\\gamma, \\\\cdot, \\\\sqrt, \\\\alpha, \\\\sum).
       Pravilni primjeri:
       - "formula": "M_{el,Rd,y} = \\\\frac{W_{el,y} \\\\cdot f_y}{\\\\gamma_{M0}}"
       - "formula": "N_{pl,Rd} = \\\\frac{A \\\\cdot f_y}{\\\\gamma_{M0}}"
       - "formula": "i_y = \\\\sqrt{\\\\frac{I_y}{A}}"

    4. FORMATIRANJE JSON ARRAYS OBJEKATA (INLINE):
       Obavezno piši objekte unutar nizova u JEDNOM REDU (inline format).

    5. ROTACIJA GLAVNIH OSA INERCIJE (ZA NESIMETRIČNE PROFILE):
       Za L-profile i nesimetrične presjeke vrati "alpha_deg" (ugao rotacije u stepenima), "i_u" i "i_v".

    OBLIK JSON STRUKTURE AKO JE PRONAĐEN PROFIL:
    {
      "found": true,
      "is_selection": false,
      "oznaka": "L 50x20x5 (Konusni)",
      "standard": "Sopstveni opis",
      "shape": "L",
      "alpha_deg": -24.2,
      "i_u": 16.5,
      "i_v": 5.1,
      "dimensions": [
        {"label": "Visina dužeg kraka", "symbol": "h", "val": 50, "unit": "mm", "formula": "h"},
        {"label": "Širina kraćeg kraka", "symbol": "b", "val": 20, "unit": "mm", "formula": "b"},
        {"label": "Debljina u korijenu", "symbol": "t", "val": 5, "unit": "mm", "formula": "t"},
        {"label": "Debljina na krajevima", "symbol": "t_end", "val": 2, "unit": "mm", "formula": "t_{end}"},
        {"label": "Unutrašnji radijus", "symbol": "r_1", "val": 5, "unit": "mm", "formula": "r_1"}
      ],
      "area_properties": [
        {"label": "Masa po metru", "symbol": "m", "val": 1.84, "unit": "kg/m", "formula": "m = A \\\\cdot \\\\rho_{steel}"},
        {"label": "Površina poprečnog presjeka", "symbol": "A", "val": 235, "unit": "mm²", "formula": "A = \\\\int dA"},
        {"label": "Položaj težišta y_G", "symbol": "y_G", "val": 4.5, "unit": "mm", "formula": "y_G = \\\\frac{\\\\sum A_i \\\\cdot y_i}{A}"},
        {"label": "Položaj težišta z_G", "symbol": "z_G", "val": 19.5, "unit": "mm", "formula": "z_G = \\\\frac{\\\\sum A_i \\\\cdot z_i}{A}"}
      ],
      "major_y": [
        {"label": "Aksijalni moment inercije", "symbol": "I_y", "val": 0.060, "unit": "×10⁶ mm⁴", "formula": "I_y = \\\\sum (I_{y,i} + A_i \\\\cdot z_i^2)"},
        {"label": "Poluprečnik inercije", "symbol": "i_y", "val": 16.0, "unit": "mm", "formula": "i_y = \\\\sqrt{\\\\frac{I_y}{A}}"},
        {"label": "Elastični otporni moment", "symbol": "W_el,y", "val": 1.96, "unit": "×10³ mm³", "formula": "W_{el,y} = \\\\frac{I_y}{z_{max}}"},
        {"label": "Plastični otporni moment", "symbol": "W_pl,y", "val": 2.94, "unit": "×10³ mm³", "formula": "W_{pl,y} = \\\\sum A_i \\\\cdot |z_{G,i}|"}
      ],
      "minor_z": [
        {"label": "Aksijalni moment inercije", "symbol": "I_z", "val": 0.006, "unit": "×10⁶ mm⁴", "formula": "I_z = \\\\sum (I_{z,i} + A_i \\\\cdot y_i^2)"},
        {"label": "Poluprečnik inercije", "symbol": "i_z", "val": 5.0, "unit": "mm", "formula": "i_z = \\\\sqrt{\\\\frac{I_z}{A}}"},
        {"label": "Elastični otporni moment", "symbol": "W_el,z", "val": 0.38, "unit": "×10³ mm³", "formula": "W_{el,z} = \\\\frac{I_z}{y_{max}}"},
        {"label": "Plastični otporni moment", "symbol": "W_pl,z", "val": 0.57, "unit": "×10³ mm³", "formula": "W_{pl,z} = \\\\sum A_i \\\\cdot |y_{G,i}|"}
      ],
      "torsion_warping": [
        {"label": "Moment inercije pri uvijanju", "symbol": "I_T", "val": 0.95, "unit": "×10³ mm⁴", "formula": "I_T = \\\\frac{1}{3} \\\\sum b_i \\\\cdot t_i^3"},
        {"label": "Otporni moment pri uvijanju", "symbol": "W_T", "val": 0.19, "unit": "×10³ mm³", "formula": "W_T = \\\\frac{I_T}{t_{max}}"},
        {"label": "Centrifugalni moment inercije", "symbol": "I_yz", "val": -0.015, "unit": "×10⁶ mm⁴", "formula": "I_{yz} = \\\\sum A_i \\\\cdot y_i \\\\cdot z_i"},
        {"label": "Ugao rotacije glavnih osa", "symbol": "alpha", "val": -24.2, "unit": "°", "formula": "\\\\tan(2\\\\alpha) = \\\\frac{2 \\\\cdot I_{yz}}{I_z - I_y}"}
      ],
      "resistances_s235": [
        {"label": "Aksijalna nosivost", "symbol": "N_pl,Rd", "val": 55.22, "unit": "kN", "formula": "N_{pl,Rd} = \\\\frac{A \\\\cdot f_y}{\\\\gamma_{M0}}"},
        {"label": "Nosivost na smicanje z-z", "symbol": "V_pl,Rd,z", "val": 23.7, "unit": "kN", "formula": "V_{pl,Rd,z} = \\\\frac{A_{v,z} \\\\cdot \\\\frac{f_y}{\\\\sqrt{3}}}{\\\\gamma_{M0}}"},
        {"label": "Nosivost na smicanje y-y", "symbol": "V_pl,Rd,y", "val": 9.5, "unit": "kN", "formula": "V_{pl,Rd,y} = \\\\frac{A_{v,y} \\\\cdot \\\\frac{f_y}{\\\\sqrt{3}}}{\\\\gamma_{M0}}"},
        {"label": "Elastični moment savijanja y-y", "symbol": "M_el,Rd,y", "val": 0.46, "unit": "kNm", "formula": "M_{el,Rd,y} = \\\\frac{W_{el,y} \\\\cdot f_y}{\\\\gamma_{M0}}"},
        {"label": "Plastični moment savijanja y-y", "symbol": "M_pl,Rd,y", "val": 0.69, "unit": "kNm", "formula": "M_{pl,Rd,y} = \\\\frac{W_{pl,y} \\\\cdot f_y}{\\\\gamma_{M0}}"}
      ],
      "buckling_classification": [
        {"label": "Kriva izvijanja y-y", "symbol": "-", "val": "b", "unit": "", "formula": "\\\\text{EN 1993-1-1 Tabela 6.2}"},
        {"label": "Kriva izvijanja z-z", "symbol": "-", "val": "c", "unit": "", "formula": "\\\\text{EN 1993-1-1 Tabela 6.2}"},
        {"label": "Klasa kraka (pritisak)", "symbol": "-", "val": "Klasa 1", "unit": "", "formula": "\\\\frac{h}{t} \\\\le 15\\\\varepsilon"}
      ],
      "draw_commands": [
        ["moveTo", -4.5, 30.5],
        ["lineTo", -2.5, 30.5],
        ["lineTo", -0.5, -14.5],
        ["arcTo", 0.5, -17.5, 15.5, -15.5, 5],
        ["lineTo", 15.5, -17.5],
        ["lineTo", 15.5, -19.5],
        ["lineTo", -4.5, -19.5],
        ["closePath"]
      ]
    }
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Gemini API Greška:", data);
            return res.status(response.status).json({ error: data.error?.message || "Greška pri komunikaciji sa Gemini API." });
        }

        let jsonString = data.candidates[0].content.parts[0].text;
        jsonString = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();

        // DEKODIRANJE & SANITIZACIJA UNESENIH LaTeX KOSIH CRTA
        // Automatski popravlja ne-escapeovane LaTeX komande u JSON stringu
        jsonString = jsonString.replace(/(?<!\\)\\([a-zA-Z0-9_{}]+)/g, '\\\\$1');

        const profileData = JSON.parse(jsonString);
        return res.status(200).json(profileData);

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ error: `Proračun neuspješan: ${error.message}` });
    }
}