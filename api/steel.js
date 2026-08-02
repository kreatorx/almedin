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

    // DINAMIČKE UPUTE ZAVISNO OD CHECKBOX-A ZA PROŠIRENU ANALIZU
    let extendedPromptInstructions = "";
    if (extended) {
        extendedPromptInstructions = `
    KORISNIK JE ODABRAO PROŠIRENU ANALIZU (ALL SECTION PROPERTIES):
    U JSON odgovor OBAVEZNO dodaj i sljedeće napredne nizove objekata:

    1. "shear_properties":
       - Posmična površina A_y (cm²)
       - Posmična površina A_z ili A_v (cm²)
       - Koordinate centra smicanja y_sc, z_sc u odnosu na težište (mm)

    2. "torsion_warping_extended":
       - St. Venant torzijska konstanta I_t (cm⁴)
       - Torzijski otporni moment W_t (cm³)
       - Sektorski moment inercije / konstanta vitoperenja I_w (cm⁶)
       - Max sektorska koordinata max_omega (cm²)
       - Sektorski otporni moment W_w (cm⁴)

    3. "stability_asymmetry":
       - Wagnerov parametar asimetrije r_v (mm)
       - Wagnerov parametar asimetrije u odnosu na centar smicanja r_u,SC (mm)

    4. "plasticity_extended":
       - Plastične neutralne ose: y_pl, z_pl, u_pl, v_pl (mm od težišta)
       - Plastični faktor oblika alpha_pl,y = W_pl,y / W_el,y
       - Plastični faktor oblika alpha_pl,u = W_pl,u / W_el,u
       - Plastični faktor oblika alpha_pl,v = W_pl,v / W_el,v

    5. "other_properties":
       - Faktor presjeka A_m/V (1/m) za požarni proračun
       - Obim izložen bojenju A_m (m²/m)
       - Zapremina po metru V (cm³/m)
        `;
    }

    const systemPrompt = `
    Ti si stručni inženjerski AI kalkulator i optimizator za sve svjetske standarde čeličnih profila (EN, AISC, IS 808, BS, DIN, JIS) po Eurocode 3 (S235 čelik, gammaM0 = 1.00, gammaM1 = 1.00, E = 210 GPa).
    SVI ISPISI I LABELE MORAJU BITI NA BOSANSKOM JEZIKU!

    1. RIGOPOZNA PROVJERA VALIDNOSTI:
       Ako unos korisnika NE POSTOJI i NIJE validan opis profila niti zahtjev za dimenzionisanje, vrati ISKLJUČIVO:
       { "found": false, "error_message": "Profil ne postoji u priznatim svjetskim standardima." }

    2. PRAVILA ZA TAČNO GEOMETRIJSKO ISCRTAVANJE (draw_commands):
       Sve koordinate u draw_commands MORAJU biti pomjerene tako da je težište G u tački (0,0).
       Neka je x0 = -y_G i y0 = -z_G (donji lijevi ugao u težišnom sistemu).
       
       A) ZA L-PROFILE (h, b, t, r1, y_G, z_G):
          - ["moveTo", x0, y0 + h]
          - ["lineTo", x0 + t, y0 + h]
          - ["lineTo", x0 + t, y0 + t + r1]
          - ["arcTo", x0 + t, y0 + t, x0 + t + r1, y0 + t, r1]
          - ["lineTo", x0 + b, y0 + t]
          - ["lineTo", x0 + b, y0]
          - ["lineTo", x0, y0]
          - ["closePath"]

    3. DETALJNA ANALIZA IZVIJANJA PO EC3 (AKO JE UNESENA DUŽINA IZVIJANJA ILI SILA):
       Ako korisnik spomene dužinu izvijanja L_cr ili silu pritiska N_Ed, popuni niz "buckling_analysis" sa tačnim međurezultatima (L_cr, N_cr, lambda_bar, alpha, Phi, chi, N_b_Rd, eta_buckling).

    ${extendedPromptInstructions}

    4. STROGA LaTeX SINTAKSA ZA POLJE "formula":
       Za SVAKI objekat u nizovima OBAVEZNO generiši polje "formula" u ČISTOM LaTeX formatu sa duplim kosim crtama (\\\\frac, \\\\gamma, \\\\cdot, \\\\sqrt, \\\\alpha, \\\\sum).

    5. FORMATIRANJE JSON ARRAYS OBJEKATA (INLINE):
       Obavezno piši objekte unutar nizova u JEDNOM REDU (inline format).

    6. ROTACIJA GLAVNIH OSA INERCIJE (ZA NESIMETRIČNE PROFILE):
       Za L-profile i nesimetrične presjeke vrati "alpha_deg", "i_u" i "i_v".

    OBLIK OSNOVNE JSON STRUKTURE:
    {
      "found": true,
      "is_selection": false,
      "oznaka": "L 180x180x16",
      "standard": "EN 10056-1",
      "shape": "L",
      "alpha_deg": -45.0,
      "i_u": 69.4,
      "i_v": 35.4,
      "dimensions": [
        {"label": "Visina kraka", "symbol": "h", "val": 180, "unit": "mm", "formula": "h"},
        {"label": "Širina kraka", "symbol": "b", "val": 180, "unit": "mm", "formula": "b"},
        {"label": "Debljina kraka", "symbol": "t", "val": 16, "unit": "mm", "formula": "t"},
        {"label": "Unutrašnji radijus", "symbol": "r_1", "val": 15, "unit": "mm", "formula": "r_1"}
      ],
      "area_properties": [
        {"label": "Masa po metru", "symbol": "m", "val": 43.5, "unit": "kg/m", "formula": "m = A \\\\cdot \\\\rho"},
        {"label": "Površina poprečnog presjeka", "symbol": "A", "val": 55.4, "unit": "cm²", "formula": "A"},
        {"label": "Položaj težišta y_G", "symbol": "y_G", "val": 51.4, "unit": "mm", "formula": "y_G"},
        {"label": "Položaj težišta z_G", "symbol": "z_G", "val": 51.4, "unit": "mm", "formula": "z_G"}
      ],
      "major_y": [
        {"label": "Aksijalni moment inercije", "symbol": "I_y", "val": 1680, "unit": "cm⁴", "formula": "I_y"},
        {"label": "Poluprečnik inercije", "symbol": "i_y", "val": 55.2, "unit": "mm", "formula": "i_y = \\\\sqrt{\\\\frac{I_y}{A}}"},
        {"label": "Elastični otporni moment", "symbol": "W_el,y", "val": 131.0, "unit": "cm³", "formula": "W_{el,y}"},
        {"label": "Plastični otporni moment", "symbol": "W_pl,y", "val": 235.0, "unit": "cm³", "formula": "W_{pl,y}"}
      ],
      "minor_z": [
        {"label": "Aksijalni moment inercije", "symbol": "I_z", "val": 1680, "unit": "cm⁴", "formula": "I_z"},
        {"label": "Poluprečnik inercije", "symbol": "i_z", "val": 55.2, "unit": "mm", "formula": "i_z = \\\\sqrt{\\\\frac{I_z}{A}}"},
        {"label": "Elastični otporni moment", "symbol": "W_el,z", "val": 131.0, "unit": "cm³", "formula": "W_{el,z}"},
        {"label": "Plastični otporni moment", "symbol": "W_pl,z", "val": 235.0, "unit": "cm³", "formula": "W_{pl,z}"}
      ],
      "torsion_warping": [
        {"label": "Moment inercije pri uvijanju", "symbol": "I_T", "val": 49.15, "unit": "cm⁴", "formula": "I_T"},
        {"label": "Otporni moment pri uvijanju", "symbol": "W_T", "val": 30.7, "unit": "cm³", "formula": "W_T"}
      ],
      "resistances_s235": [
        {"label": "Aksijalna nosivost presjeka", "symbol": "N_pl,Rd", "val": 1301.9, "unit": "kN", "formula": "N_{pl,Rd} = \\\\frac{A \\\\cdot f_y}{\\\\gamma_{M0}}"}
      ],
      "buckling_classification": [
        {"label": "Kriva izvijanja", "symbol": "-", "val": "c", "unit": "", "formula": "Tabela 6.2 EN 1993-1-1"},
        {"label": "Klasa kraka (pritisak)", "symbol": "-", "val": "Klasa 1", "unit": "", "formula": "\\\\frac{h}{t} \\\\le 15\\\\varepsilon"}
      ],
      "draw_commands": [
        ["moveTo", -51.4, 128.6],
        ["lineTo", -35.4, 128.6],
        ["lineTo", -35.4, -20.4],
        ["arcTo", -35.4, -35.4, -20.4, -35.4, 15],
        ["lineTo", 128.6, -35.4],
        ["lineTo", 128.6, -51.4],
        ["lineTo", -51.4, -51.4],
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

            // Sanitizacija LaTeX kosih crta
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