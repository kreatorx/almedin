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

    const { prompt, extended } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt je obavezan' });

    const apiKey = process.env.GEMINI_API_KEY_STEEL;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY_STEEL nije podešen u Vercel Environment Variables.' });
    }

    let extendedPromptInstructions = "";
    if (extended) {
        extendedPromptInstructions = `
    KORISNIK JE ODABRAO PROŠIRENU ANALIZU (ALL SECTION PROPERTIES):
    U JSON odgovor OBAVEZNO dodaj i sljedeće napredne nizove objekata:
    1. "shear_properties": A_y, A_z/A_v, y_sc, z_sc
    2. "torsion_warping_extended": I_t, W_t, I_w, max_omega, W_w
    3. "stability_asymmetry": r_v, r_u,SC
    4. "plasticity_extended": y_pl, z_pl, u_pl, v_pl, alpha_pl,y, alpha_pl,u, alpha_pl,v
    5. "other_properties": A_m/V, A_m, V
        `;
    }

    const systemPrompt = `
    Ti si stručni inženjerski AI kalkulator, geometar i optimizator za sve čelične profile (standardne, custom, kombinovane i složene poprečne presjeke) po Eurocode 3 (S235 čelik, gammaM0 = 1.00, gammaM1 = 1.00, E = 210 GPa).
    SVI ISPISI I LABELE MORAJU BITI NA BOSANSKOM JEZIKU!

    1. STROGO PRAVILO ZA SLOŽENE / KOMBINIRANE PRESJEKE (COMPOUND SECTIONS):
       Kada korisnik zatraži složeni presjek (npr. "dupli L u + formaciji unutar CHS 50x3", "2x UPN 200 sa limovima", "I profil sa pojačanjima"):
       - Proračunaj ukupnu površinu A_tot = sum(A_i) i ukupnu masu m_tot = sum(m_i).
       - Primijeni Štajnerovo pravilo (Parallel Axis Theorem) za momente inercije: I_tot = sum(I_i + A_i * d_i^2).
       - OBAVEZNO u "draw_commands" NISU DOVOLJNI SAMO VANJSKI KONTURNI LUKOVI! MORAŠ GENERISATI PUTANJE ZA SVAKI POJEDINAČNI ELEMENT U PRESJEKU!
         Na primjer, za CHS cijev sa L-profilima unutra:
         - Generiši ["arc", 0, 0, R_out, 0, 6.283] i ["arc", 0, 0, R_in, 0, 6.283] za cijev.
         - Generiši poseban poligon sa ["moveTo", ...], ["lineTo", ...], ["closePath"] ZA SVAKI L-PROFIL POJEDAČNO!

    2. OBAVEZAN NIZ "principal_uv" (GLAVNE OSE INERCIJE I UGAO alpha):
       U SVAKOM ODGOVORU VRATI NIZ "principal_uv" SA OBJEKTIMA:
       - Ugao rotacije glavnih osa alpha (u stepenima °)
       - Centrifugalni moment inercije I_yz (cm⁴)
       - Moment inercije oko u-ose I_u (cm⁴)
       - Moment inercije oko v-ose I_v (cm⁴)
       - Poluprečnik inercije oko u-ose i_u (mm)
       - Poluprečnik inercije oko v-ose i_v (mm)
       - Otporni moment oko u-ose W_u (cm³)
       - Otporni moment oko v-ose W_v (cm³)

    3. COORDINATE SYSTEM FOR CANVAS DRAWING (draw_commands):
       Sve koordinate u draw_commands MORAJU biti u odnosu na zajedničko težište G(0,0).

    ${extendedPromptInstructions}

    4. STROGA LaTeX SINTAKSA ZA POLJE "formula":
       Za SVAKI objekat u nizovima OBAVEZNO generiši polje "formula" u ČISTOM LaTeX formatu sa duplim kosim crtama (\\\\frac, \\\\sqrt, itd.).

    5. FORMATIRANJE JSON ARRAYS OBJEKATA (INLINE):
       Obavezno piši objekte unutar nizova u JEDNOM REDU (inline format).

    OGLEDNI OBLIK JSON STRUKTURE ZA SLOŽENI PRESJEK:
    {
      "found": true,
      "is_selection": false,
      "oznaka": "Kombinovani presjek CHS 50x3 + Dupli L 20x20x3 (+ formacija)",
      "standard": "Custom AI Presjek",
      "shape": "COMPOUND",
      "alpha_deg": 0.0,
      "i_u": 14.5,
      "i_v": 14.5,
      "dimensions": [
        {"label": "Spoljašnji prečnik CHS", "symbol": "d", "val": 50, "unit": "mm", "formula": "d"},
        {"label": "Debljina zida CHS", "symbol": "t", "val": 3, "unit": "mm", "formula": "t"},
        {"label": "Širina krakova L profila", "symbol": "b_L", "val": 20, "unit": "mm", "formula": "b_L"},
        {"label": "Debljina krakova L profila", "symbol": "t_L", "val": 3, "unit": "mm", "formula": "t_L"}
      ],
      "area_properties": [
        {"label": "Masa po metru", "symbol": "m", "val": 5.22, "unit": "kg/m", "formula": "m = A \\\\cdot \\\\rho"},
        {"label": "Površina poprečnog presjeka", "symbol": "A", "val": 6.65, "unit": "cm²", "formula": "A = A_{CHS} + 2 \\\\cdot A_L"},
        {"label": "Položaj težišta y_G", "symbol": "y_G", "val": 0, "unit": "mm", "formula": "y_G"},
        {"label": "Položaj težišta z_G", "symbol": "z_G", "val": 0, "unit": "mm", "formula": "z_G"}
      ],
      "major_y": [
        {"label": "Aksijalni moment inercije", "symbol": "I_y", "val": 14.08, "unit": "cm⁴", "formula": "I_y = \\\\sum (I_{yi} + A_i z_i^2)"},
        {"label": "Statički moment površine", "symbol": "S_y", "val": 4.12, "unit": "cm³", "formula": "S_y"},
        {"label": "Poluprečnik inercije", "symbol": "i_y", "val": 14.5, "unit": "mm", "formula": "i_y = \\\\sqrt{\\\\frac{I_y}{A}}"},
        {"label": "Elastični otporni moment", "symbol": "W_el,y", "val": 5.63, "unit": "cm³", "formula": "W_{el,y} = \\\\frac{I_y}{z_{max}}"},
        {"label": "Plastični otporni moment", "symbol": "W_pl,y", "val": 7.42, "unit": "cm³", "formula": "W_{pl,y}"}
      ],
      "minor_z": [
        {"label": "Aksijalni moment inercije", "symbol": "I_z", "val": 14.08, "unit": "cm⁴", "formula": "I_z = \\\\sum (I_{zi} + A_i y_i^2)"},
        {"label": "Statički moment površine", "symbol": "S_z", "val": 4.12, "unit": "cm³", "formula": "S_z"},
        {"label": "Poluprečnik inercije", "symbol": "i_z", "val": 14.5, "unit": "mm", "formula": "i_z = \\\\sqrt{\\\\frac{I_z}{A}}"},
        {"label": "Elastični otporni moment", "symbol": "W_el,z", "val": 5.63, "unit": "cm³", "formula": "W_{el,z} = \\\\frac{I_z}{y_{max}}"},
        {"label": "Plastični otporni moment", "symbol": "W_pl,z", "val": 7.42, "unit": "cm³", "formula": "W_{pl,z}"}
      ],
      "principal_uv": [
        {"label": "Ugao rotacije glavnih osa", "symbol": "\\\\alpha", "val": 0.0, "unit": "°", "formula": "\\\\alpha"},
        {"label": "Centrifugalni moment inercije", "symbol": "I_yz", "val": 0.0, "unit": "cm⁴", "formula": "I_{yz}"},
        {"label": "Glavni moment inercije I_u", "symbol": "I_u", "val": 14.08, "unit": "cm⁴", "formula": "I_u"},
        {"label": "Glavni moment inercije I_v", "symbol": "I_v", "val": 14.08, "unit": "cm⁴", "formula": "I_v"},
        {"label": "Poluprečnik inercije u-ose", "symbol": "i_u", "val": 14.5, "unit": "mm", "formula": "i_u"},
        {"label": "Poluprečnik inercije v-ose", "symbol": "i_v", "val": 14.5, "unit": "mm", "formula": "i_v"},
        {"label": "Elastični otporni moment W_u", "symbol": "W_u", "val": 5.63, "unit": "cm³", "formula": "W_u"},
        {"label": "Elastični otporni moment W_v", "symbol": "W_v", "val": 5.63, "unit": "cm³", "formula": "W_v"}
      ],
      "torsion_warping": [
        {"label": "Moment inercije pri uvijanju", "symbol": "I_T", "val": 8.5, "unit": "cm⁴", "formula": "I_T"},
        {"label": "Otporni moment pri uvijanju", "symbol": "W_T", "val": 3.4, "unit": "cm³", "formula": "W_T"}
      ],
      "resistances_s235": [
        {"label": "Aksijalna nosivost presjeka", "symbol": "N_pl,Rd", "val": 156.2, "unit": "kN", "formula": "N_{pl,Rd} = \\\\frac{A \\\\cdot f_y}{\\\\gamma_{M0}}"}
      ],
      "buckling_classification": [
        {"label": "Kriva izvijanja", "symbol": "-", "val": "c", "unit": "", "formula": "EN 1993-1-1"},
        {"label": "Klasifikacija", "symbol": "-", "val": "Klasa 1", "unit": "", "formula": "EC3"}
      ],
      "draw_commands": [
        ["arc", 0, 0, 25, 0, 6.283],
        ["arc", 0, 0, 22, 0, 6.283],
        ["moveTo", -1.5, -22],
        ["lineTo", 1.5, -22],
        ["lineTo", 1.5, 22],
        ["lineTo", -1.5, 22],
        ["closePath"],
        ["moveTo", -22, -1.5],
        ["lineTo", 22, -1.5],
        ["lineTo", 22, 1.5],
        ["lineTo", -22, 1.5],
        ["closePath"]
      ]
    }
    `;

    const modelsToTry = [
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-2.5-flash"
    ];

    let lastError = null;

    for (const modelName of modelsToTry) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
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

            if (response.status === 429) {
                console.warn(`Model ${modelName} prešao rate limit (429). Pokušavam sljedeći model sa liste...`);
                lastError = "Dostignut je besplatni limit API zahtjeva (429). Sačekajte oko 30 sekundi.";
                continue;
            }

            if (!response.ok) {
                console.error(`Gemini API Greška (${modelName}):`, data);
                return res.status(response.status).json({ error: data.error?.message || "Greška pri komunikaciji sa Gemini API." });
            }

            let jsonString = data.candidates[0].content.parts[0].text;
            jsonString = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();
            jsonString = jsonString.replace(/(?<!\\)\\([a-zA-Z0-9_{}]+)/g, '\\\\$1');

            const profileData = JSON.parse(jsonString);
            return res.status(200).json(profileData);

        } catch (error) {
            console.error(`Error sa modelom ${modelName}:`, error);
            lastError = error.message;
        }
    }

    return res.status(429).json({ error: lastError || "Svi AI modeli su trenutno zauzeti. Sačekajte 30 sekundi." });
}