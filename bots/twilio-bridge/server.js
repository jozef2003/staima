const express = require('express');
const twilio = require('twilio');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Config — set via environment variables (see .env.example)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || '+4915888635585';
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://myty.agency/twilio';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || '').split(',').filter(Boolean);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Active call sessions
const sessions = new Map();

// Send Telegram message
async function sendTelegram(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error('Telegram error:', err.message);
  }
}

// Send call report to Telegram
async function sendCallReport(session, callStatus) {
  const chatIds = session.reportTo || TELEGRAM_CHAT_IDS;
  const statusEmoji = { completed: '✅', failed: '❌', busy: '📵', 'no-answer': '📵', canceled: '🚫' };
  const emoji = statusEmoji[callStatus] || '📞';

  const transcript = session.history.map(m =>
    m.role === 'assistant' ? `🤖 David: ${m.text}` : `👤 Person: ${m.text}`
  ).join('\n');

  const text = [
    `${emoji} <b>Anruf abgeschlossen</b>`,
    ``,
    `📞 Nummer: ${session.to}`,
    `🎯 Ziel: ${session.goal}`,
    `📊 Status: ${callStatus}`,
    session.result ? `\n📝 Ergebnis: ${session.result}` : '',
    transcript ? `\n<b>Gesprächsverlauf:</b>\n${transcript}` : '',
  ].filter(Boolean).join('\n');

  for (const chatId of chatIds) {
    await sendTelegram(chatId, text);
  }
}

// Ask Claude directly via Anthropic API (fast — no OpenClaw overhead)
async function askBot(session, message) {
  try {
    const systemPrompt = `Du bist David, ein professioneller KI-Assistent. Du führst gerade einen Telefonanruf auf Deutsch. 
Antworte immer kurz und natürlich — so wie man am Telefon spricht. Keine langen Sätze.
Wenn das Gesprächsziel erreicht wurde oder das Gespräch beendet ist, antworte mit genau: [CALL_DONE] gefolgt von einer kurzen Zusammenfassung.`;

    const messages = [];
    
    // Add conversation history
    for (const h of session.history) {
      messages.push({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.text,
      });
    }
    
    // Add current message
    messages.push({ role: 'user', content: message });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: systemPrompt,
      messages,
    });

    return response.content[0]?.text || 'Einen Moment bitte.';
  } catch (err) {
    console.error('askBot error:', err.message);
    return 'Einen Moment bitte.';
  }
}

// Initiate outbound call
app.post('/call', async (req, res) => {
  const { to, goal, sessionKey, reportTo, mode } = req.body;
  if (!to || !goal) return res.status(400).json({ error: 'to and goal required' });

  try {
    const call = await client.calls.create({
      to,
      from: TWILIO_FROM_NUMBER,
      url: `${PUBLIC_URL}/twiml/start`,
      statusCallback: `${PUBLIC_URL}/status`,
      statusCallbackMethod: 'POST',
    });

    sessions.set(call.sid, {
      goal,
      sessionKey: sessionKey || 'agent:main:main',
      history: [],
      to,
      reportTo: reportTo || TELEGRAM_CHAT_IDS,
      mode: mode || 'announce',
    });

    res.json({ success: true, callSid: call.sid, status: call.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TwiML: call starts
app.post('/twiml/start', async (req, res) => {
  const callSid = req.body.CallSid;
  const session = sessions.get(callSid);

  if (!session) {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ language: 'de-DE' }, 'Ein Fehler ist aufgetreten.');
    twiml.hangup();
    return res.type('text/xml').send(twiml.toString());
  }

  const twiml = new twilio.twiml.VoiceResponse();

  if (session.mode === 'announce') {
    twiml.say({ language: 'de-DE', voice: 'Google.de-DE-Neural2-F' }, session.goal);
    twiml.hangup();
    session.result = session.goal;
    session.done = true;
  } else {
    const botMessage = await askBot(session, `Du führst jetzt einen Telefonanruf. Dein Ziel: "${session.goal}". Die Person hat gerade abgenommen. Sage jetzt deinen Eröffnungssatz (kurz, natürlich, wie am Telefon).`);
    session.history.push({ role: 'assistant', text: botMessage });
    const gather = twiml.gather({
      input: 'speech',
      language: 'de-DE',
      speechTimeout: 'auto',
      action: `${PUBLIC_URL}/twiml/respond`,
      method: 'POST',
    });
    gather.say({ language: 'de-DE', voice: 'Google.de-DE-Neural2-F' }, botMessage);
    twiml.redirect({ method: 'POST' }, `${PUBLIC_URL}/twiml/respond`);
  }

  res.type('text/xml').send(twiml.toString());
});

// TwiML: handle speech input
app.post('/twiml/respond', async (req, res) => {
  const callSid = req.body.CallSid;
  const speechResult = req.body.SpeechResult || '';
  const session = sessions.get(callSid);

  if (!session) {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.hangup();
    return res.type('text/xml').send(twiml.toString());
  }

  // Handle empty speech (Gather timeout fallback)
  if (!speechResult) {
    const twiml = new twilio.twiml.VoiceResponse();
    const gather = twiml.gather({
      input: 'speech',
      language: 'de-DE',
      speechTimeout: 'auto',
      action: `${PUBLIC_URL}/twiml/respond`,
      method: 'POST',
    });
    gather.say({ language: 'de-DE', voice: 'Google.de-DE-Neural2-F' }, 'Entschuldigung, ich habe Sie nicht verstanden. Bitte sprechen Sie.');
    twiml.redirect({ method: 'POST' }, `${PUBLIC_URL}/twiml/respond`);
    return res.type('text/xml').send(twiml.toString());
  }

  session.history.push({ role: 'human', text: speechResult });

  const prompt = `Die andere Person hat gesagt: "${speechResult}"\n\nZiel des Anrufs: "${session.goal}"\n\nAntworte kurz und natürlich. Wenn das Ziel erreicht ist oder das Gespräch beendet ist, antworte mit: [CALL_DONE] kurze Zusammenfassung.`;

  const botReply = await askBot(session, prompt);
  session.history.push({ role: 'assistant', text: botReply });

  const twiml = new twilio.twiml.VoiceResponse();

  if (botReply.startsWith('[CALL_DONE]')) {
    const summary = botReply.replace('[CALL_DONE]', '').trim();
    twiml.say({ language: 'de-DE', voice: 'Google.de-DE-Neural2-F' }, 'Auf Wiederhören!');
    twiml.hangup();
    session.result = summary;
    session.done = true;
  } else {
    const gather = twiml.gather({
      input: 'speech',
      language: 'de-DE',
      speechTimeout: 'auto',
      action: `${PUBLIC_URL}/twiml/respond`,
      method: 'POST',
    });
    gather.say({ language: 'de-DE', voice: 'Google.de-DE-Neural2-F' }, botReply);
    twiml.redirect({ method: 'POST' }, `${PUBLIC_URL}/twiml/respond`);
  }

  res.type('text/xml').send(twiml.toString());
});

// Call status updates
app.post('/status', async (req, res) => {
  const { CallSid, CallStatus } = req.body;
  const session = sessions.get(CallSid);
  if (session) {
    session.status = CallStatus;
    if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(CallStatus)) {
      console.log(`[${CallSid}] Call ended: ${CallStatus}`);
      await sendCallReport(session, CallStatus);
    }
  }
  res.sendStatus(200);
});

// Check call result
app.get('/call/:callSid', (req, res) => {
  const session = sessions.get(req.params.callSid);
  if (!session) return res.status(404).json({ error: 'not found' });
  res.json({ done: session.done || false, result: session.result, status: session.status, history: session.history });
});

// Server Stats
const { execSync } = require('child_process');
app.get('/stats', (req, res) => {
  try {
    const memRaw = execSync('free -b').toString().split('\n')[1].trim().split(/\s+/);
    const diskRaw = execSync('df -B1 /').toString().split('\n')[1].trim().split(/\s+/);
    const cpuRaw = execSync("top -bn1 | grep 'Cpu(s)'").toString();
    const cpuIdle = parseFloat(cpuRaw.match(/([\d.]+)\s*id/)?.[1] || '100');
    res.json({
      ram: { total: +memRaw[1], used: +memRaw[2], free: +memRaw[3] },
      disk: { total: +diskRaw[1], used: +diskRaw[2], free: +diskRaw[3] },
      cpu: { used: Math.round((100 - cpuIdle) * 10) / 10 },
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

const PORT = 3001;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Twilio Bridge läuft auf Port ${PORT} (Haiku direkt)`);
});
