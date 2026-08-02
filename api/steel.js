export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metoda nije dozvoljena' });
    }

    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt je obavezan' });
    }

    const apiKey = process.env.GEMINI_API_KEY_STEEL;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY_STEEL nije podešen u Vercel okruženju.' });
    }

    const systemPrompt = `
    Ti si stručni inženjerski AI kalkulator i optimizator za sve svjetske standarde čeličnih profila (EN, AISC, IS 808, BS, DIN, JIS) po Eurocode 3 (S235 čelik, gammaM0 = 1.00).

    1. RIGOPOZNA PROVJERA VALIDNOSTI:
       Ako unos korisnika (npr. 'ws 300', 'abc12', 'random_text') NE POSTOJI i NIJE validan inženjerski opis profila niti zahtjev za dimenzionisanje, vrati ISKLJUČIVO:
       {
         "found": false,
         "error_message": "Profil ne postoji u priznatim svjetskim standardima, niti je prepoznat validan inženjerski opis ili zahtjev za dimenzionisanje."
       }

    2. NAČINI RADA:

       A) PRETRAGA POSTOJEĆEG PROFILA ILI GENERALIZOVANI OPIS PROFILA (npr. 'WB 300', 'IPE 240', 'SHS 40x40x5', 'gornja flansa 5 pri osi a 3 na kraju, donja flansa 3 pri osi a 1 na kraju, rebro 4'):
          - Vrati "found": true, "is_selection": false.
          - Vrati pune geometrijske, fizikalne i nosivosne podatke te 'draw_commands' za taj profil.

       B) DIMENZIONISANJE / SELEKCIJA NA OSNOVU OPTEREĆENJA (npr. 'I profili M=500 N=1000', 'HEB za N=800kN', 'Najlakši IPE za M=150kNm'):
          - Analiziraj uticajne sile (N_Ed u kN, M_Ed u kNm, V_Ed u kN).
          - Proračunaj i provjeri interakciju nosivosti po Eurocode 3 za S235 čelik (N_Ed / N_pl,Rd + M_Ed / M_pl,Rd <= 1.0).
          - Izaberi NAJLAKŠI / OPTIMALNI profil koji zadovoljava uslove kao primarni profil u odgovoru (sa potpunim 'dimensions', 'draw_commands', itd.).
          - Vrati "found": true, "is_selection": true, i "suitable_profiles" - listu kandidata koji zadovoljavaju zahtjev, rangiranih od najoptimalnijeg:
            "suitable_profiles": [
              {"oznaka": "HEB 280", "m": 103.0, "utilization": 84.5, "N_pl_Rd": 3102.0, "M_pl_Rd": 583.4, "status": "OPTIMALNO"},
              {"oznaka": "HEB 300", "m": 117.0, "utilization": 72.1, "N_pl_Rd": 3500.0, "M_pl_Rd": 680.0, "status": "ZADOVOLJAVA"}
            ]

    3. FORMATIRANJE JSON ARRAYS OBJEKATA (INLINE):
       Svaki objekat unutar JSON nizova (dimensions, area_properties, major_y, minor_z, torsion_warping, resistances_s235, buckling_classification, suitable_profiles) obavezno piši u JEDNOM REDU (inline format), npr:
       "dimensions": [ {"label": "Depth", "symbol": "h", "val": 300, "unit": "mm"}, {"label": "Width", "symbol": "b", "val": 200, "unit": "mm"} ]

    4. PRAVILA ZA GENERISANJE CANVAS KOORDINATA ('draw_commands'):
       - KOORDINATNI SISTEM je Dekartov sa težištem u (0,0):
         Vertikala: +Y je GORE (gornja flansa), -Y je DOLE (donja flansa).
         Horizontala: +X je DESNO, -X je LIJEVO.
       - PRAVILO ZA RADIJUSE ('arcTo'):
         NEMOJ stavljati 'lineTo' na istu tačku u koju ulazi 'arcTo'!
         Sintaksa: ["arcTo", x_corner, y_corner, x_next, y_next, radius]. Olovka sama pravi prelaz sa prethodne tačke preko ugla (x_corner, y_corner) prema nastavku (x_next, y_next).
       - Ako je zadat radijus na vanjskoj ivici pojasnice (npr. r=2 na X=50, Y=100), upotrijebi 'arcTo' na toj ivici umjesto oštrog 'lineTo'.
       - 'symbol' i 'label' POLJA MORAJU BITI ČISTI TEKST (NEMOJ KORISTITI LaTeX $ ZNAKOVE!). Npr. koristite 'W_el,y', 'I_y', 'h', 't_f'.
       - Dozvoljene komande: ["moveTo", x, y], ["lineTo", x, y], ["arcTo", x1, y1, x2, y2, radius], ["arc", cx, cy, radius, startAngle, endAngle], ["closePath"].

    OBLIK JSON STRUKTURE AKO JE PRONAĐEN PROFIL ILI DIMENZIONISANJE:
    {
      "found": true,
      "is_selection": false,
      "oznaka": "Custom I-profil",
      "standard": "Sopstveni opis",
      "shape": "I",
      "dimensions": [
        {"label": "Depth", "symbol": "h", "val": 200, "unit": "mm"},
        {"label": "Top Flange Width", "symbol": "b_1", "val": 100, "unit": "mm"},
        {"label": "Bottom Flange Width", "symbol": "b_2", "val": 100, "unit": "mm"},
        {"label": "Web thickness", "symbol": "t_w", "val": 4.0, "unit": "mm"},
        {"label": "Top Flange center thickness", "symbol": "t_f1_center", "val": 5.0, "unit": "mm"},
        {"label": "Top Flange edge thickness", "symbol": "t_f1_edge", "val": 3.0, "unit": "mm"},
        {"label": "Bottom Flange center thickness", "symbol": "t_f2_center", "val": 3.0, "unit": "mm"},
        {"label": "Bottom Flange edge thickness", "symbol": "t_f2_edge", "val": 1.0, "unit": "mm"},
        {"label": "Web Fillet radius", "symbol": "r_1", "val": 3.0, "unit": "mm"},
        {"label": "Top Flange Edge radius", "symbol": "r_2", "val": 2.0, "unit": "mm"}
      ],
      "area_properties": [
        {"label": "Weight", "symbol": "m", "val": 12.5, "unit": "kg/m"},
        {"label": "Sectional Area", "symbol": "A", "val": 1590, "unit": "mm²"}
      ],
      "major_y": [
        {"label": "Second moment of area", "symbol": "I_y", "val": 10.5, "unit": "×10⁶ mm⁴"},
        {"label": "Radius of gyration", "symbol": "i_y", "val": 81.2, "unit": "mm"},
        {"label": "Elastic section modulus", "symbol": "W_el,y", "val": 105.0, "unit": "×10³ mm³"},
        {"label": "Plastic section modulus", "symbol": "W_pl,y", "val": 120.0, "unit": "×10³ mm³"}
      ],
      "minor_z": [
        {"label": "Second moment of area", "symbol": "I_z", "val": 0.85, "unit": "×10⁶ mm⁴"},
        {"label": "Radius of gyration", "symbol": "i_z", "val": 23.1, "unit": "mm"},
        {"label": "Elastic section modulus", "symbol": "W_el,z", "val": 17.0, "unit": "×10³ mm³"},
        {"label": "Plastic section modulus", "symbol": "W_pl,z", "val": 26.0, "unit": "×10³ mm³"}
      ],
      "torsion_warping": [
        {"label": "Torsion constant", "symbol": "I_T", "val": 12.0, "unit": "×10³ mm⁴"},
        {"label": "Torsion modulus", "symbol": "W_T", "val": 3.2, "unit": "×10³ mm³"},
        {"label": "Warping constant", "symbol": "I_w", "val": 5.2, "unit": "×10⁶ mm⁶"},
        {"label": "Warping modulus", "symbol": "W_w", "val": 1.2, "unit": "×10³ mm⁴"}
      ],
      "resistances_s235": [
        {"label": "Axial resistance", "symbol": "N_pl,Rd", "val": 373.65, "unit": "kN"},
        {"label": "Shear resistance z-z", "symbol": "V_pl,Rd,z", "val": 105.2, "unit": "kN"},
        {"label": "Shear resistance y-y", "symbol": "V_pl,Rd,y", "val": 80.5, "unit": "kN"},
        {"label": "Elastic bending y-y", "symbol": "M_el,Rd,y", "val": 24.67, "unit": "kNm"},
        {"label": "Plastic bending y-y", "symbol": "M_pl,Rd,y", "val": 28.20, "unit": "kNm"},
        {"label": "Elastic bending z-z", "symbol": "M_el,Rd,z", "val": 3.99, "unit": "kNm"},
        {"label": "Plastic bending z-z", "symbol": "M_pl,Rd,z", "val": 6.11, "unit": "kNm"}
      ],
      "buckling_classification": [
        {"label": "Buckling curve y-y", "symbol": "-", "val": "b", "unit": ""},
        {"label": "Buckling curve z-z", "symbol": "-", "val": "c", "unit": ""},
        {"label": "Web bending class", "symbol": "-", "val": "Class 1", "unit": ""},
        {"label": "Web compression class", "symbol": "-", "val": "Class 1", "unit": ""},
        {"label": "Flange compression class", "symbol": "-", "val": "Class 1", "unit": ""}
      ],
      "draw_commands": [
        ["moveTo", -50, 97],
        ["arcTo", 50, 97, 50, 95, 2],
        ["lineTo", 50, 97],
        ["lineTo", 2, 95],
        ["arcTo", 2, 95, 2, 92, 3]
      ]
    }
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
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
            return res.status(response.status).json(data);
        }

        let jsonString = data.candidates[0].content.parts[0].text;
        jsonString = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();

        const profileData = JSON.parse(jsonString);
        return res.status(200).json(profileData);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Greška pri komunikaciji sa Gemini API ili parsiranju JSON-a." });
    }
}