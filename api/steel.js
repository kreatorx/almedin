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
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY_STEEL nije podešen u Vercel okruženju.' });

    const systemPrompt = `
    Ti si stručni inženjerski AI kalkulator i optimizator za sve svjetske standarde čeličnih profila (EN, AISC, IS 808, BS, DIN, JIS) po Eurocode 3 (S235 čelik, gammaM0 = 1.00).
    SVI ISPISI I LABELE MORAJU BITI NA BOSANSKOM JEZIKU!

    1. RIGOPOZNA PROVJERA VALIDNOSTI:
       Ako unos korisnika NE POSTOJI i NIJE validan opis profila niti zahtjev za dimenzionisanje, vrati:
       { "found": false, "error_message": "Profil ne postoji u priznatim svjetskim standardima." }

    2. ROTACIJA GLAVNIH OSA INERCIJE (ZA L I NESIMETRIČNE PROFILE):
       Za L-profile i sve nesimetrične presjeke izračunaj ugao rotacije glavnih osa inercije u stepenima:
       - "alpha_deg": Ugao rotacije u stepenima u odnosu na y-y osu (npr. -22.5 ili 45.0, za simetrične presjeke je 0).
       - "i_u": Glavni maksimalni poluprečnik inercije (mm).
       - "i_v": Glavni minimalni poluprečnik inercije (mm).

    3. OBAVEZNO POLJE "formula" ZA SVAKU VRIJEDNOST:
       Za SVAKI objekat u nizovima dodaj polje "formula" sa matematičkim/inženjerskim obrascem po EC3.

    4. FORMATIRANJE JSON ARRAYS OBJEKATA (INLINE):
       Obavezno piši objekte unutar nizova u JEDNOM REDU (inline format).

    5. PRAVILA ZA SIMBOLE I CANVAS:
       - 'symbol' i 'label' POLJA MORAJU BITI ČISTI TEKST (BEZ LaTeX $ ZNAKOVA!).
       - CANVAS KOORDINATE: Dekartov sistem sa težištem u (0,0) (+Y gore, -Y dole, +X desno, -X lijevo).
       - Dozvoljene komande: ["moveTo", x, y], ["lineTo", x, y], ["arcTo", x1, y1, x2, y2, radius], ["arc", cx, cy, radius, startAngle, endAngle], ["closePath"].

    OBLIK JSON STRUKTURE AKO JE PRONAĐEN PROFIL:
    {
      "found": true,
      "is_selection": false,
      "oznaka": "L 50x20x5 (Tapered)",
      "standard": "Sopstveni opis",
      "shape": "L",
      "alpha_deg": -24.2,
      "i_u": 16.5,
      "i_v": 5.1,
      "dimensions": [
        {"label": "Visina dužeg kraka", "symbol": "h", "val": 50, "unit": "mm", "formula": "Geometrijski zadano h"},
        {"label": "Širina kraćeg kraka", "symbol": "b", "val": 20, "unit": "mm", "formula": "Geometrijski zadano b"},
        {"label": "Debljina u korijenu", "symbol": "t", "val": 5, "unit": "mm", "formula": "Geometrijski zadano t"},
        {"label": "Debljina na krajevima", "symbol": "t_end", "val": 2, "unit": "mm", "formula": "Geometrijski zadano t_end"},
        {"label": "Unutrašnji radijus", "symbol": "r_1", "val": 2, "unit": "mm", "formula": "Geometrijski zadano r_1"}
      ],
      "area_properties": [
        {"label": "Masa po metru", "symbol": "m", "val": 1.84, "unit": "kg/m", "formula": "m = A * rho_steel"},
        {"label": "Površina poprečnog presjeka", "symbol": "A", "val": 235, "unit": "mm²", "formula": "A = integral(dA)"},
        {"label": "Položaj težišta y_G", "symbol": "y_G", "val": 4.5, "unit": "mm", "formula": "y_G = sum(A_i * y_i) / A"},
        {"label": "Položaj težišta z_G", "symbol": "z_G", "val": 19.5, "unit": "mm", "formula": "z_G = sum(A_i * z_i) / A"}
      ],
      "major_y": [
        {"label": "Aksijalni moment inercije", "symbol": "I_y", "val": 0.060, "unit": "×10⁶ mm⁴", "formula": "I_y = sum(I_y,i + A_i * z_i^2)"},
        {"label": "Poluprečnik inercije", "symbol": "i_y", "val": 16.0, "unit": "mm", "formula": "i_y = sqrt(I_y / A)"},
        {"label": "Elastični otporni moment", "symbol": "W_el,y", "val": 1.96, "unit": "×10³ mm³", "formula": "W_el,y = I_y / z_max"},
        {"label": "Plastični otporni moment", "symbol": "W_pl,y", "val": 2.94, "unit": "×10³ mm³", "formula": "W_pl,y = sum(A_i * |z_G,i|)"}
      ],
      "minor_z": [
        {"label": "Aksijalni moment inercije", "symbol": "I_z", "val": 0.006, "unit": "×10⁶ mm⁴", "formula": "I_z = sum(I_z,i + A_i * y_i^2)"},
        {"label": "Poluprečnik inercije", "symbol": "i_z", "val": 5.0, "unit": "mm", "formula": "i_z = sqrt(I_z / A)"},
        {"label": "Elastični otporni moment", "symbol": "W_el,z", "val": 0.38, "unit": "×10³ mm³", "formula": "W_el,z = I_z / y_max"},
        {"label": "Plastični otporni moment", "symbol": "W_pl,z", "val": 0.57, "unit": "×10³ mm³", "formula": "W_pl,z = sum(A_i * |y_G,i|)"}
      ],
      "torsion_warping": [
        {"label": "Moment inercije pri uvijanju", "symbol": "I_T", "val": 0.95, "unit": "×10³ mm⁴", "formula": "I_T = (1/3) * sum(b_i * t_i^3)"},
        {"label": "Otporni moment pri uvijanju", "symbol": "W_T", "val": 0.19, "unit": "×10³ mm³", "formula": "W_T = I_T / t_max"},
        {"label": "Centrifugalni moment inercije", "symbol": "I_yz", "val": -0.015, "unit": "×10⁶ mm⁴", "formula": "I_yz = sum(A_i * y_i * z_i)"},
        {"label": "Ugao rotacije glavnih osa", "symbol": "alpha", "val": -24.2, "unit": "°", "formula": "tan(2*alpha) = (2 * I_yz) / (I_z - I_y)"}
      ],
      "resistances_s235": [
        {"label": "Aksijalna nosivost", "symbol": "N_pl,Rd", "val": 55.22, "unit": "kN", "formula": "N_pl,Rd = (A * f_y) / gamma_M0"},
        {"label": "Nosivost na smicanje z-z", "symbol": "V_pl,Rd,z", "val": 23.7, "unit": "kN", "formula": "V_pl,Rd,z = (A_v,z * (f_y / sqrt(3))) / gamma_M0"},
        {"label": "Nosivost na smicanje y-y", "symbol": "V_pl,Rd,y", "val": 9.5, "unit": "kN", "formula": "V_pl,Rd,y = (A_v,y * (f_y / sqrt(3))) / gamma_M0"},
        {"label": "Elastični moment savijanja y-y", "symbol": "M_el,Rd,y", "val": 0.46, "unit": "kNm", "formula": "M_el,Rd,y = (W_el,y * f_y) / gamma_M0"},
        {"label": "Plastični moment savijanja y-y", "symbol": "M_pl,Rd,y", "val": 0.69, "unit": "kNm", "formula": "M_pl,Rd,y = (W_pl,y * f_y) / gamma_M0"}
      ],
      "buckling_classification": [
        {"label": "Kriva izvijanja y-y", "symbol": "-", "val": "b", "unit": "", "formula": "Tabela 6.2 EN 1993-1-1"},
        {"label": "Kriva izvijanja z-z", "symbol": "-", "val": "c", "unit": "", "formula": "Tabela 6.2 EN 1993-1-1"},
        {"label": "Klasa kraka (pritisak)", "symbol": "-", "val": "Klasa 1", "unit": "", "formula": "h/t <= 15*epsilon za Klasu 1"}
      ],
      "draw_commands": [
        ["moveTo", -4.5, 30.5],
        ["lineTo", -2.5, 30.5],
        ["lineTo", -2.5, -14.5],
        ["arcTo", 0.5, -17.5, 15.5, -17.5, 2],
        ["lineTo", 15.5, -17.5],
        ["lineTo", 15.5, -19.5],
        ["lineTo", -4.5, -19.5],
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
        if (!response.ok) return res.status(response.status).json(data);

        let jsonString = data.candidates[0].content.parts[0].text;
        jsonString = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();

        const profileData = JSON.parse(jsonString);
        return res.status(200).json(profileData);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Greška pri komunikaciji sa Gemini API ili parsiranju JSON-a." });
    }
}