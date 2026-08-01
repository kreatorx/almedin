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
    Ti si stručni inženjerski AI kalkulator za sve svjetske standarde čeličnih profila (EN, AISC, IS 808, BS, DIN, JIS).

    1. RIGOPOZNA PROVJERA VALIDNOSTI:
       Ako unos korisnika (npr. 'ws 300', 'abc12', 'random_text') NE POSTOJI u priznatim standardima, vrati ISKLJUČIVO:
       {
         "found": false,
         "error_message": "Profil ne postoji u priznatim svjetskim standardima."
       }

    2. AKO PROFIL POSTOJI (npr. 'WB 300', 'IPE 240', 'W12x26', 'UPN 200', 'L 100x100x10', 'CHS 114.3x4.5'):
       Vrati "found": true i sljedeću JSON strukturu:
       - 'symbol' i 'label' POLJA MORAJU BITI ČISTI TEKST (NEMOJ KORISTITI LaTeX $ ZNAKOVE!). Npr. koristite 'W_el,y', 'I_y', 'h', 't_f'.
       - 'draw_commands': Niz naredbi u MILIMETRIMA (mm) centriranih oko (0,0) koje HTML5 Canvas crta u milimetar!
         Dozvoljene komande:
         - ["moveTo", x, y]
         - ["lineTo", x, y]
         - ["arcTo", x1, y1, x2, y2, radius] (KLJUČNO ZA UNUTRAŠNJE RADIJUSE r1 i r2!)
         - ["arc", cx, cy, radius, startAngle, endAngle] (ZA CHS OKRUGLE CIJEVI)
         - ["closePath"]

    OBLIK ZAHVTANOG JSON-A AKO JE PRONAĐEN:
    {
      "found": true,
      "oznaka": "WB 300",
      "standard": "IS 808:1989",
      "shape": "I",
      "dimensions": [
        {"label": "Depth", "symbol": "h", "val": 300, "unit": "mm"},
        {"label": "Width", "symbol": "b", "val": 200, "unit": "mm"},
        {"label": "Web thickness", "symbol": "t_w", "val": 7.4, "unit": "mm"},
        {"label": "Flange thickness", "symbol": "t_f", "val": 10.0, "unit": "mm"},
        {"label": "Inner depth", "symbol": "h_i", "val": 280.0, "unit": "mm"},
        {"label": "Root fillet radius", "symbol": "r_1", "val": 11.0, "unit": "mm"},
        {"label": "Toe radius", "symbol": "r_2", "val": 5.5, "unit": "mm"},
        {"label": "Flange slope", "symbol": "S_f", "val": 10.51, "unit": "%"}
      ],
      "area_properties": [
        {"label": "Weight", "symbol": "m", "val": 48.1, "unit": "kg/m"},
        {"label": "Perimeter", "symbol": "P", "val": 1.36, "unit": "m"},
        {"label": "Sectional Area", "symbol": "A", "val": 6130, "unit": "mm²"},
        {"label": "Shear area z-z", "symbol": "A_v,z", "val": 2680, "unit": "mm²"},
        {"label": "Shear area y-y", "symbol": "A_v,y", "val": 4000, "unit": "mm²"}
      ],
      "major_y": [
        {"label": "Second moment of area", "symbol": "I_y", "val": 98.2, "unit": "×10⁶ mm⁴"},
        {"label": "Radius of gyration", "symbol": "i_y", "val": 127.0, "unit": "mm"},
        {"label": "Elastic section modulus", "symbol": "W_el,y", "val": 654.6, "unit": "×10³ mm³"},
        {"label": "Plastic section modulus", "symbol": "W_pl,y", "val": 742.0, "unit": "×10³ mm³"}
      ],
      "minor_z": [
        {"label": "Second moment of area", "symbol": "I_z", "val": 9.90, "unit": "×10⁶ mm⁴"},
        {"label": "Radius of gyration", "symbol": "i_z", "val": 40.2, "unit": "mm"},
        {"label": "Elastic section modulus", "symbol": "W_el,z", "val": 99.0, "unit": "×10³ mm³"},
        {"label": "Plastic section modulus", "symbol": "W_pl,z", "val": 155.0, "unit": "×10³ mm³"}
      ],
      "torsion_warping": [
        {"label": "Torsion constant", "symbol": "I_T", "val": 182.0, "unit": "×10³ mm⁴"},
        {"label": "Torsion modulus", "symbol": "W_T", "val": 18.2, "unit": "×10³ mm³"},
        {"label": "Warping constant", "symbol": "I_w", "val": 215.0, "unit": "×10⁶ mm⁶"},
        {"label": "Warping modulus", "symbol": "W_w", "val": 14.3, "unit": "×10³ mm⁴"}
      ],
      "resistances_s235": [
        {"label": "Axial resistance", "symbol": "N_pl,Rd", "val": 1440.5, "unit": "kN"},
        {"label": "Shear resistance z-z", "symbol": "V_pl,Rd,z", "val": 363.8, "unit": "kN"},
        {"label": "Shear resistance y-y", "symbol": "V_pl,Rd,y", "val": 542.7, "unit": "kN"},
        {"label": "Elastic bending y-y", "symbol": "M_el,Rd,y", "val": 153.8, "unit": "kNm"},
        {"label": "Plastic bending y-y", "symbol": "M_pl,Rd,y", "val": 174.3, "unit": "kNm"},
        {"label": "Elastic bending z-z", "symbol": "M_el,Rd,z", "val": 23.2, "unit": "kNm"},
        {"label": "Plastic bending z-z", "symbol": "M_pl,Rd,z", "val": 36.4, "unit": "kNm"}
      ],
      "buckling_classification": [
        {"label": "Buckling curve y-y", "symbol": "-", "val": "a", "unit": ""},
        {"label": "Buckling curve z-z", "symbol": "-", "val": "b", "unit": ""},
        {"label": "Web bending class", "symbol": "-", "val": "Class 1", "unit": ""},
        {"label": "Web compression class", "symbol": "-", "val": "Class 1", "unit": ""},
        {"label": "Flange compression class", "symbol": "-", "val": "Class 1", "unit": ""}
      ],
      "draw_commands": [
        ["moveTo", -100, -150],
        ["lineTo", 100, -150],
        ["lineTo", 100, -130],
        ["arcTo", 3.7, -130, 3.7, 0, 11],
        ["lineTo", 3.7, 130],
        ["arcTo", 3.7, 130, 100, 130, 11],
        ["lineTo", 100, 150],
        ["lineTo", -100, 150],
        ["lineTo", -100, 130],
        ["arcTo", -3.7, 130, -3.7, 0, 11],
        ["lineTo", -3.7, -130],
        ["arcTo", -3.7, -130, -100, -130, 11],
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