
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(express.static('public'));
app.use(express.json());

console.log("API nøgle fundet:", process.env.OPENAI_API_KEY ? "✅ Ja" : "❌ Nej");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    const text = (pdfData.text || '').slice(0, 12000);
    const profile = req.body.profile || 'Ukendt profil';

    const prompt =
      'Du er en dansk pædagogisk vejleder. Brug uddannelsesprofilen: \"' + profile + '\" og uddraget af læreplanen nedenfor til at skrive PRÆCIS ét forslag til en konkret læringsaktivitet (6–10 linjer). ' +
      'Forslaget skal være handlingsanvisende (hvem gør hvad, hvor, hvornår), og afslut med 1–2 sætninger om relation til kompetencemål. Brug ikke overskrifter eller lister – skriv som et kort afsnit.\n\n' +
      '--- Uddrag af læreplan (kan være ufuldstændigt) ---\n' + text;

    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });

    fs.unlink(req.file.path, ()=>{});
    res.json({ suggestion: resp.choices?.[0]?.message?.content || '' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Kunne ikke generere forslag.' });
  }
});

app.post('/summary', upload.single('pdf'), async (req, res) => {
  try {
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    const text = (pdfData.text || '').slice(0, 12000);

    const prompt =
      'Opsummer denne læreplan på dansk i 2 korte sætninger efterfulgt af 4–6 punktopstillede hovedpointer. Hold det stramt og praksisnært:\n\n' + text;

    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4
    });

    fs.unlink(req.file.path, ()=>{});
    res.json({ summary: resp.choices?.[0]?.message?.content || '' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Kunne ikke opsummere.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('✅ Server kører på port ' + PORT));
