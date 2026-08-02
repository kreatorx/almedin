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
    SVI ISPISI I LABELE MORAJU BITI NA BOSANSKOM JEZIKU!

    1. RIGOPOZNA PROVJERA VALIDNOSTI:
       Ako unos korisnika NE POSTOJI i NIJE validan inženjerski opis profila niti zahtjev za dimenzionisanje, vrati ISKLJUČIVO:
       {
         "found": false,
         "error_message": "Profil ne postoji u priznatim svjetskim standardima, niti je prepoznat validan inženjerski opis ili zahtjev za dimenzionisanje."
       }

    2. NAČINI RADA (JEZIK ISKLJUČIVO BOSANSKI):
       
       A) PRETRAGA ILI GENERALIZOVANI OPIS PROFILA:
          - Vrati "found": true, "is_selection": false.
          - Vrati geometrijske, fizikalne i nosivosne podatke na bosanskom jeziku.

       B) DIMENZIONISANJE NA OSNOVU OPTEREĆENJA:
          - Analiziraj uticajne sile (N_Ed u kN, M_Ed u kNm, V_Ed u kN).
          - Vrati "found": true, "is_selection": true, i "suitable_profiles" sa tabelom na bosanskom.

    3. FORMATIRANJE JSON ARRAYS OBJEKATA (INLINE):
       Svaki objekat unutar JSON nizova (dimensions, area_properties, major_y, minor_z, torsion_warping, resistances_s235, buckling_classification, suitable_profiles) obavezno piši u JEDNOM REDU (inline format).

    4. PRAVILA ZA LABELE I SIMBOLE:
       - SVE LABELE MORAJU BITI NA BOSANSKOM JEZIKU (npr. 'Visina presjeka', 'Širina pojasnice', 'Debljina hrpta', 'Aksijalni moment inercije', 'Poluprečnik inercije', 'Elastični otporni moment', 'Plastični otporni moment', 'Aksijalna nosivost', 'Nosivost na smicanje').
       - Za male vrijednosti momenata inercije koristi 3 decimalna mjesta (npr. 0.500 ili 0.501).
       - 'symbol' i 'label' POLJA MORAJU BITI ČISTI TEKST (NEMOJ KORISTITI LaTeX $ ZNAKOVE!). Npr. 'W_el,y', 'I_y', 'h', 't_f'.
       - KOORDINATNI SISTEM CANVAS: Dekartov sa težištem u (0,0) (+Y gore, -Y dole, +X desno, -X lijevo).
       - Dozvoljene komande: ["moveTo", x, y], ["lineTo", x, y], ["arcTo", x1, y1, x2, y2, radius], ["arc", cx, cy, radius, startAngle, endAngle], ["closePath"].

    OBLIK JSON STRUKTURE AKO JE PRONAĐEN PROFIL:
    {
      "found": true,
      "is_selection": false,
      "oznaka": "Proizvoljni I-profil",
      "standard": "Sopstveni opis",
      "shape": "I",
      "dimensions": [
        {"label": "Visina presjeka", "symbol": "h", "val": 200, "unit": "mm"},
        {"label": "Širina gornje pojasnice", "symbol": "b_1", "val": 100, "unit": "mm"},
        {"label": "Širina donje pojasnice", "symbol": "b_2", "val": 100, "unit": "mm"},
        {"label": "Debljina hrpta", "symbol": "t_w", "val": 4.0, "unit": "mm"},
        {"label": "Debljina gornje pojasnice u osi", "symbol": "t_f1_osa", "val": 5.0, "unit": "mm"},
        {"label": "Debljina gornje pojasnice na kraju", "symbol": "t_f1_kraj", "val": 3.0, "unit": "mm"},
        {"label": "Debljina donje pojasnice u osi", "symbol": "t_f2_osa", "val": 3.0, "unit": "mm"},
        {"label": "Debljina donje pojasnice na kraju", "symbol": "t_f2_kraj", "val": 1.0, "unit": "mm"},
        {"label": "Radijus uz hrbat", "symbol": "r_1", "val": 3.0, "unit": "mm"},
        {"label": "Radijus ivice gornje pojasnice", "symbol": "r_2", "val": 2.0, "unit": "mm"}
      ],
      "area_properties": [
        {"label": "Masa po metru", "symbol": "m", "val": 10.8, "unit": "kg/m"},
        {"label": "Površina poprečnog presjeka", "symbol": "A", "val": 1376, "unit": "mm²"}
        {"label": "Položaj težišta y_G", "symbol": "y_G", "val": 0, "unit": "mm"},
        {"label": "Položaj težišta z_G", "symbol": "z_G", "val": 0, "unit": "mm"}
        ],
      "major_y": [
        {"label": "Aksijalni moment inercije", "symbol": "I_y", "val": 7.87, "unit": "×10⁶ mm⁴"},
        {"label": "Poluprečnik inercije", "symbol": "i_y", "val": 75.6, "unit": "mm"},
        {"label": "Elastični otporni moment", "symbol": "W_el,y", "val": 69.8, "unit": "×10³ mm³"},
        {"label": "Plastični otporni moment", "symbol": "W_pl,y", "val": 85.0, "unit": "×10³ mm³"}
      ],
      "minor_z": [
        {"label": "Aksijalni moment inercije", "symbol": "I_z", "val": 0.500, "unit": "×10⁶ mm⁴"},
        {"label": "Poluprečnik inercije", "symbol": "i_z", "val": 19.1, "unit": "mm"},
        {"label": "Elastični otporni moment", "symbol": "W_el,z", "val": 10.0, "unit": "×10³ mm³"},
        {"label": "Plastični otporni moment", "symbol": "W_pl,z", "val": 15.0, "unit": "×10³ mm³"}
      ],
      "torsion_warping": [
        {"label": "Moment inercije pri uvijanju", "symbol": "I_T", "val": 4.80, "unit": "×10³ mm⁴"},
        {"label": "Otporni moment pri uvijanju", "symbol": "W_T", "val": 1.50, "unit": "×10³ mm³"},
        {"label": "Sektorski moment inercije", "symbol": "I_w", "val": 2.10, "unit": "×10⁶ mm⁶"},
        {"label": "Sektorski otporni moment", "symbol": "W_w", "val": 0.50, "unit": "×10³ mm⁴"}
      ],
      "resistances_s235": [
        {"label": "Aksijalna nosivost", "symbol": "N_pl,Rd", "val": 323.36, "unit": "kN"},
        {"label": "Nosivost na smicanje z-z", "symbol": "V_pl,Rd,z", "val": 104.2, "unit": "kN"},
        {"label": "Nosivost na smicanje y-y", "symbol": "V_pl,Rd,y", "val": 81.4, "unit": "kN"},
        {"label": "Elastični moment savijanja y-y", "symbol": "M_el,Rd,y", "val": 16.40, "unit": "kNm"},
        {"label": "Plastični moment savijanja y-y", "symbol": "M_pl,Rd,y", "val": 19.98, "unit": "kNm"}
      ],
      "buckling_classification": [
        {"label": "Kriva izvijanja y-y", "symbol": "-", "val": "b", "unit": ""},
        {"label": "Kriva izvijanja z-z", "symbol": "-", "val": "c", "unit": ""},
        {"label": "Klasa hrpta (savijanje)", "symbol": "-", "val": "Klasa 1", "unit": ""},
        {"label": "Klasa hrpta (pritisak)", "symbol": "-", "val": "Klasa 1", "unit": ""},
        {"label": "Klasa pojasnice (pritisak)", "symbol": "-", "val": "Klasa 1", "unit": ""}
      ],
      "draw_commands": [
        ["moveTo", -50, 97],
        ["arcTo", 50, 97, 50, 95, 2],
        ["lineTo", 50, 95],
        ["lineTo", 2, 97.5],
        ["arcTo", 2, 97.5, 2, 90, 3],
        ["lineTo", 2, -97.5],
        ["arcTo", 2, -97.5, 50, -98.5, 3],
        ["lineTo", 50, -98.5],
        ["lineTo", 50, -99.5],
        ["lineTo", -50, -99.5],
        ["lineTo", -50, -98.5],
        ["arcTo", -2, -97.5, -2, -90, 3],
        ["lineTo", -2, 90],
        ["arcTo", -2, 97.5, -50, 95, 3],
        ["lineTo", -50, 95],
        ["lineTo", -50, 97],
        ["closePath"]
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