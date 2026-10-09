const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');

let pairingCode = "";
const NAMBARI_YAKO_PURE = process.env.NAMBARI_YA_MTEJA || "255635860611"; 
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const JINA_LA_DUKA = process.env.JINA_LA_DUKA || "Shabani Juma Kamulika";
const MAELEZO_BIASHARA = process.env.MAELEZO_YA_BIASHARA || "Mtaalamu wa WhatsApp Bot wa Dar es Salaam";

let BOT_IKO_WAZI = true;
const kumbukumbu = new Map();

// 1. Web Server ya Render - lazima iwe na PORT
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    if (req.url === '/qr' || req.url === '/code') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        let contentHtml = pairingCode 
            ? `<h2 style="color:#00a884;">Kodi Yako Ya Kuunganisha Bot 🫡</h2>
               <div style="background:#202c33;padding:15px 25px;border-radius:12px;font-size:38px;font-weight:bold;letter-spacing:6px;color:#00a884;border:2px solid #00a884;margin:20px 0;display:inline-block;">${pairingCode}</div>
               <p style="color:#aaa;">Fungua WhatsApp &rarr; Linked Devices &rarr; Link a Device &rarr; <b>Link with phone number instead</b></p>
               <p style="color:#666;font-size:12px;margin-top:20px;">Biashara: ${JINA_LA_DUKA}</p>`
            : `<h3 style="color:#00a884;">Inaandaa Kodi ya Tarakimu 8... ⏳</h3><p style="color:#aaa;">Refresh ukurasa huu baada ya sekunde 5.</p>`;

        res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${JINA_LA_DUKA} Bot</title></head><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#111b21;color:#fff;font-family:sans-serif;text-align:center;margin:0;padding:20px;">${contentHtml}</body></html>`);
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`WhatsApp Bot ${JINA_LA_DUKA} is running! Fungua /code kupata kodi.\n`);
    }
}).listen(PORT, '0.0.0.0', () => console.log(`Web server listening on port ${PORT} for ${JINA_LA_DUKA}`));

// 2. Akili ya Gemini AI - Imefixiwa na kumbukumbu ya kweli
async function ulizaAI(senderId, jina, swali) {
    if (!GEMINI_API_KEY) {
        return "⚠️ Error: API Key ya Gemini haipatikani kwenye Render Environment Variables!";
    }

    if (!kumbukumbu.has(senderId)) kumbukumbu.set(senderId, []);
    let history = kumbukumbu.get(senderId);

    let systemPrompt = `Wewe ni ${JINA_LA_DUKA}.
    Taarifa za biashara: ${MAELEZO_BIASHARA}
    Mtu unayeongea naye anaitwa "${jina}".
    Sheria zako:
    1. Wewe ni binadamu halisi wa Kitanzania wa Dar es Salaam, sio roboti.
    2. Ongea Kiswahili cha mtaani cha kawaida, mcheshi na mtulivu.
    3. Majibu yawe mafupi sana (sentensi 1-3 tu).
    4. Tumia emoji 1-2 tu kwa jibu (😇 😂 😘 🥰 🥳 🙏 🫡).
    5. KUMBUKA mazungumzo yote ya nyuma na jibu kulingana nayo. Kama mtu alisema jina lake, mkumbuke.
    6. Kama ni mteja wa duka, muelekeze kununua.`;

    let contents = history.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
    }));
    contents.push({ role: "user", parts: [{ text: swali }] });

    const cleanKey = GEMINI_API_KEY.trim();
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${cleanKey}`;

    try {
        let res = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: contents,
                generationConfig: { 
                    temperature: 0.9, 
                    maxOutputTokens: 350,
                    topP: 0.9
                }
            })
        });
        let d = await res.json();
        
        if (d.error) {
            console.error("❌ Gemini API Error:", JSON.stringify(d.error));
            return "Pole Mkuu, akili yangu imepumzika kidogo, niulize tena 🫡";
        }

        let jibu = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jibu) {
            return "Sijakuelewa vizuri Mkuu, sema tena kidogo 😇";
        }

        history.push({ role: "user", text: swali }, { role: "model", text: jibu });
        if (history.length > 20) {
            kumbukumbu.set(senderId, history.slice(-12));
        }

        return jibu;
    } catch (e) {
        console.error("❌ Exception Error Kwenye Gemini Call:", e);
        return `Mtandao unaniangusha Mkuu, jaribu tena baadaye 🙏`;
    }
}

// 3. Main Bot Process (Baileys Engine)
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info_v3');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('Muunganisho umekatika, unajiunga tena...', shouldReconnect);
            if (shouldReconnect) {
                pairingCode = "";
                startBot();
            }
        } else if (connection === 'open') {
            pairingCode = "";
            console.log(`✅ BOT (${JINA_LA_DUKA}) IKO LIVE NA TAYARI 100% 🫡`);
        }

        if (!sock.authState.creds.registered && !pairingCode) {
            setTimeout(async () => {
                try {
                    if(sock.authState.creds.registered) return;
                    let code = await sock.requestPairingCode(NAMBARI_YAKO_PURE);
                    pairingCode = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log(`\n==========================================`);
                    console.log(`🔑 PAIRING CODE YAKO NI: ${pairingCode}`);
                    console.log(`==========================================\n`);
                } catch (err) {
                    console.error("Error requesting pairing code:", err.message);
                    pairingCode = "";
                }
            }, 5000);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        
        for (let msg of messages) {
            if (!msg.message || msg.key.remoteJid.includes('@g.us') || msg.key.remoteJid === 'status@broadcast') continue;

            let from = msg.key.remoteJid;
            let text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "";
            text = text.trim();
            if (!text) continue;

            let senderNum = from.replace('@s.whatsapp.net', '').replace('@c.us', '');
            let niWewe = msg.key.fromMe || senderNum.includes(NAMBARI_YAKO_PURE);
            let lowerText = text.toLowerCase();

            // Commands za Boss
            if (niWewe && ["zima", "lala", "off", "pause"].includes(lowerText)) {
                BOT_IKO_WAZI = false;
                await sock.sendMessage(from, { text: "Sawa Boss, bot nimeizima 🫡 nitakua kimya mpaka uniamshe." });
                continue;
            }
            if (niWewe && ["waka", "amka", "on", "anza"].includes(lowerText)) {
                BOT_IKO_WAZI = true;
                await sock.sendMessage(from, { text: "Nimeamka Boss, niko tayari kusaidia wateja 🫡🥳" });
                continue;
            }

            if (!BOT_IKO_WAZI) continue;
            if (msg.key.fromMe) continue;

            let jina = msg.pushName || "Mkuu";
            console.log(`📩 Ujumbe kutoka ${jina} (${senderNum}): ${text}`);

            await sock.sendPresenceUpdate('composing', from);
            let jibu = await ulizaAI(from, jina, text);
            await sock.sendPresenceUpdate('paused', from);

            await sock.sendMessage(from, { text: jibu }, { quoted: msg });
            console.log(`🤖 Jibu -> ${jibu}\n`);
        }
    });
}

startBot();
