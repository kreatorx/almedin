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

    1. PRAVILO GENERISANJA PROFILA (NE SMJEŠ ODBITI ZAHTJEV):
       Za BILO KOJI opis profila (standardni npr. IPE 300, nestandardni npr. I 435x170x8, ili složeni/kombinovani npr. "dupli L u + formaciji unutar CHS 50x3", "2x UPN 200 sa limovima"):
       - UVIJEK postavi "found": true
       - Proračunaj ili precizno procijeni težište G(y_G, z_G), površinu A, masu po metru m.
       - Proračunaj momente inercije I_y, I_z, I_u, I_v, centrifugalni moment I_yz i ugao rotacije glavnih osa alpha_deg.
       - Proračunaj statičke momente S_y, S_z, elastične otporne momente W_el,y, W_el,z, W_u, W_v i plastične otporne momente W_pl,y, W_pl,z.
       - Proračunaj torzijski moment inercije I_T i otporni moment W_T.
       - Generiši tačne komande za crtanje "draw_commands" u težišnom sistemu G(0,0) tako da Canvas crtač može vjerno prikazati presjek na ekranu.

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

    3. PRAVILA ZA TAČNO GEOMETRIJSKO ISCRTAVANJE (draw_commands):
       Sve koordinate u draw_commands MORAJU biti pomjerene tako da je težište G u tački (0,0).

    ${extendedPromptInstructions}

    4. STROGA LaTeX SINTAKSA ZA POLJE "formula":
       Za SVAKI objekat u nizovima OBAVEZNO generiši polje "formula" u ČISTOM LaTeX formatu sa duplim kosim crtama.

    5. FORMATIRANJE JSON ARRAYS OBJEKATA (INLINE):
       Obavezno piši objekte unutar nizova u JEDNOM REDU (inline format).

    OBLIK JSON STRUKTURE:
    {
      "found": true,
      "is_selection": false,
      "oznaka": "Kombinovani presjek (Dupli L + CHS 50x3)",
      "standard": "Custom AI Presjek",
      "shape": "COMPOUND",
      "alpha_deg": 0.0,
      "i_u": 25.4,
      "i_v": 25.4,
      "dimensions": [
        {"label": "Spoljašnji prečnik CHS", "symbol": "d", "val": 50, "unit": "mm", "formula": "d"},
        {"label": "Debljina zida CHS", "symbol": "t", "val": 3, "unit": "mm", "formula": "t"}
      ],
      "area_properties": [
        {"label": "Masa po metru", "symbol": "m", "val": 8.5, "unit": "kg/m", "formula": "m = A \\\\cdot \\\\rho"},
        {"label": "Površina poprečnog presjeka", "symbol": "A", "val": 10.8, "unit": "cm²", "formula": "A"},
        {"label": "Položaj težišta y_G", "symbol": "y_G", "val": 0, "unit": "mm", "formula": "y_G"},
        {"label": "Položaj težišta z_G", "symbol": "z_G", "val": 0, "unit": "mm", "formula": "z_G"}
      ],
      "major_y": [
        {"label": "Aksijalni moment inercije", "symbol": "I_y", "val": 45.2, "unit": "cm⁴", "formula": "I_y"},
        {"label": "Statički moment površine", "symbol": "S_y", "val": 12.4, "unit": "cm³", "formula": "S_y"},
        {"label": "Poluprečnik inercije", "symbol": "i_y", "val": 20.4, "unit": "mm", "formula": "i_y = \\\\sqrt{\\\\frac{I_y}{A}}"},
        {"label": "Elastični otporni moment", "symbol": "W_el,y", "val": 18.1, "unit": "cm³", "formula": "W_{el,y}"},
        {"label": "Plastični otporni moment", "symbol": "W_pl,y", "val": 24.8, "unit": "cm³", "formula": "W_{pl,y}"}
      ],
      "minor_z": [
        {"label": "Aksijalni moment inercije", "symbol": "I_z", "val": 45.2, "unit": "cm⁴", "formula": "I_z"},
        {"label": "Statički moment površine", "symbol": "S_z", "val": 12.4, "unit": "cm³", "formula": "S_z"},
        {"label": "Poluprečnik inercije", "symbol": "i_z", "val": 20.4, "unit": "mm", "formula": "i_z = \\\\sqrt{\\\\frac{I_z}{A}}"},
        {"label": "Elastični otporni moment", "symbol": "W_el,z", "val": 18.1, "unit": "cm³", "formula": "W_{el,z}"},
        {"label": "Plastični otporni moment", "symbol": "W_pl,z", "val": 24.8, "unit": "cm³", "formula": "W_{pl,z}"}
      ],
      "principal_uv": [
        {"label": "Ugao rotacije glavnih osa", "symbol": "\\\\alpha", "val": 0.0, "unit": "°", "formula": "\\\\tan(2\\\\alpha) = \\\\frac{2 I_{yz}}{I_z - I_y}"},
        {"label": "Centrifugalni moment inercije", "symbol": "I_yz", "val": 0.0, "unit": "cm⁴", "formula": "I_{yz} = \\\\int y z dA"},
        {"label": "Glavni moment inercije I_u", "symbol": "I_u", "val": 45.2, "unit": "cm⁴", "formula": "I_u"},
        {"label": "Glavni moment inercije I_v", "symbol": "I_v", "val": 45.2, "unit": "cm⁴", "formula": "I_v"},
        {"label": "Poluprečnik inercije u-ose", "symbol": "i_u", "val": 20.4, "unit": "mm", "formula": "i_u"},
        {"label": "Poluprečnik inercije v-ose", "symbol": "i_v", "val": 20.4, "unit": "mm", "formula": "i_v"},
        {"label": "Elastični otporni moment W_u", "symbol": "W_u", "val": 18.1, "unit": "cm³", "formula": "W_u"},
        {"label": "Elastični otporni moment W_v", "symbol": "W_v", "val": 18.1, "unit": "cm³", "formula": "W_v"}
      ],
      "torsion_warping": [
        {"label": "Moment inercije pri uvijanju", "symbol": "I_T", "val": 8.5, "unit": "cm⁴", "formula": "I_T"},
        {"label": "Otporni moment pri uvijanju", "symbol": "W_T", "val": 3.4, "unit": "cm³", "formula": "W_T"}
      ],
      "resistances_s235": [
        {"label": "Aksijalna nosivost presjeka", "symbol": "N_pl,Rd", "val": 253.8, "unit": "kN", "formula": "N_{pl,Rd} = \\\\frac{A \\\\cdot f_y}{\\\\gamma_{M0}}"}
      ],
      "buckling_classification": [
        {"label": "Kriva izvijanja", "symbol": "-", "val": "c", "unit": "", "formula": "Tabela 6.2 EN 1993-1-1"},
        {"label": "Klasification", "symbol": "-", "val": "Klasa 1", "unit": "", "formula": "EC3"}
      ],
      "draw_commands": [
        ["arc", 0, 0, 25, 0, 6.283],
        ["arc", 0, 0, 22, 0, 6.283]
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
                console.warn(`Model ${modelName} prešao rate limit (429). Pokušavam sljedeći model...`);
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