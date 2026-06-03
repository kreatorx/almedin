export default async function handler(req, res) {
    // 1. Dozvoli samo POST metode
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metoda nije dozvoljena' });
    }

    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt je obavezan' });
    }

    try {
        // 2. Poziv prema OpenAI
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o", // Možeš promijeniti u "gpt-3.5-turbo" ako želiš jeftinije
                messages: [
                    { role: "system", content: "" },
                    { role: "user", content: prompt }
                ],
                temperature: 0.2
            })
        });

        const data = await response.json();
        
        // 3. Vrati odgovor nazad na frontend
        return res.status(200).json(data.choices[0].message.content);

    } catch (error) {
        return res.status(500).json({ error: "Greška pri komunikaciji sa OpenAI" });
    }
}
