export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metoda nije dozvoljena' });
    }

    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt je obavezan' });
    }

    // Ovdje definišemo STROGA inženjerska pravila za AI
    const systemPrompt = `
    Ti si stručni građevinski asistent koji prevodi tekstualne zahtjeve u JSON format za 2D FEM aplikaciju.
    Tvoj zadatak je ISKLJUČIVO vraćanje validnog JSON objekta, bez markdown formata, bez \`\`\`json i bez objašnjenja.
    
    Format JSON-a mora biti tačno ovakav:
    {
      "nodes": [
        {"x": 0, "y": 0, "res": "fixed", "fx": 0, "fy": 0, "m": 0},
        {"x": 0, "y": 3, "res": "none", "fx": 0, "fy": 0, "m": 0}
      ],
      "elements": [
        {"n1": 0, "n2": 1, "loads": [{"q": 5, "x1": 0, "x2": 0, "type": "gravity"}]}
      ]
    }
    
    Pravila za generisanje rama:
    1. Koordinate (x, y) su u metrima. Početak rama stavljaj na donji lijevi ugao (x=0, y=0). Zidaj po spratovima (Y+) i rasponima/bay-ovima (X+).
    2. Čvorovi koji su na tlu (y=0) MORAJU imati oslonac ("res": "fixed"). Svi ostali čvorovi moraju biti "none".
    3. Elementi spajaju čvorove: 'n1' i 'n2' su integer indeksi čvorova (0-based) iz "nodes" niza. Stubovi spajaju donji i gornji čvor. Grede spajaju lijevi i desni čvor na istom spratu.
    4. Tip opterećenja: q je kontinuirano (pozitivna vrijednost 5 znači 5 kN/m prema dole, type je "gravity").
    Pazi da povežeš SVE čvorove u ispravan okvirni sistem (stubovi i grede).
    `;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1 // Vrlo niska temperatura za deterministički i tačan kod
            })
        });

        const data = await response.json();
        let jsonString = data.choices[0].message.content;

        // Čišćenje potencijalnog markdowna (npr. ```json ... ```)
        jsonString = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();

        return res.status(200).json(JSON.parse(jsonString));

    } catch (error) {
        return res.status(500).json({ error: "Greška pri komunikaciji sa OpenAI ili parsiranju JSON-a." });
    }
}