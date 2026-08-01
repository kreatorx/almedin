export default async function handler(req, res) {
    // 1. Potpuna CORS konfiguracija
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // 2. Obrada Preflight (OPTIONS) zahtjeva iz preglednika
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
    Ti si stručni inženjerski AI asistent za čelične konstruktivne profile.
    Tvoj zadatak je da na osnovu korisničkog opisa ili naziva profila pronađeš ili definiraš tačne primarne dimenzije u milimetrima (mm).
    Vrati ISKLJUČIVO validan JSON objekat sa sljedećim poljima:
    {
      "oznaka": "str" (npr. "IPE 240", "HEA 300", "Custom I-profil 250"),
      "shape": "str" (striktno jedno od: "I", "RHS", "SHS", "CHS", "UPN", "L"),
      "h": number (visina u mm ili prečnik D za CHS),
      "b": number (širina u mm ili jednako h za CHS/SHS),
      "tw": number (debljina hrpta / zida u mm),
      "tf": number (debljina pojasnice / zida u mm),
      "r": number (radijus zaobljenja u mm ili 0 ako nema)
    }
    Pravila:
    1. Svi brojevi moraju biti brojevne vrijednosti u mm.
    2. Vrati samo čisti JSON bez markdown oznaka ili objašnjenja.
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
                contents: [
                    { parts: [{ text: prompt }] }
                ],
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