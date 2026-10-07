const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');

let pairingCode = "";
const NAMBARI_YAKO_PURE = "255635860611"; 
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

let BOT_IKO_WAZI = true;
const kumbukumbu = new Map();

// 1. Web Server ya Render kuonyesha Pairing Code
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    if (req.url === '/qr' || req.url === '/code') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        let contentHtml = pairingCode 
            ? `<h2 style="color:#00a884;">Kodi Yako Ya Kuunganisha Bot 🫡</h2>
               <div style="background:#202c33;padding:15px 25px;border-radius:12px;font-size:38px;font-weight:bold;letter-spacing:6px;color:#00a884;border:2px solid #00a884;margin:20px 0;display:inline-block;">${pairingCode}</div>
               <p style="color:#aaa;">Fungua WhatsApp &rarr; Linked Devices &rarr; Link a Device &rarr; <b>Link with phone number instead</b></p>`
            : `<h3 style="color:#00a884;">Inaandaa Kodi ya Tarakimu 8... ⏳</h3><p style="color:#aaa;">Refresh ukurasa huu baada ya sekunde 5.</p>`;

        res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#111b21;color:#fff;font-family:sans-serif;text-align:center;margin:0;padding:20px;">${contentHtml}</body></html>`);
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('WhatsApp Bot is running! Fungua /code kupata kodi.\n');
    }
}).listen(PORT, '0.0.0.0', () => console.log(`Web server listening on port ${PORT}`));

// 2. Akili ya Gemini AI
async function ulizaAI(senderId, jina, swali) {
    let systemInstruction = `Wewe ni Shabani Juma Kamulika (Shebby/SJ) wa Dar es Salaam. Unajibu kama binadamu halisi wa Kitanzania (mcheshi, mtulivu, mtaalamu).
    Mtu unayeongea naye anaitwa "${jina}".
    Sheria:
    1. Tumia Kiswahili cha kawaida/mtaani cha Tanzania.
    2. Majibu yawe mafupi mno (sentensi 1-3 tu).
    3. Tumia emoji 1-2 tu (😇 😂 😘 🥰 🥳 🙏 🫡).`;

    if (!kumbukumbu.has(senderId)) kumbukumbu.set(senderId, []);
    let chatHistory = kumbukumbu.get(senderId);

    let contents = chatHistory.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
    contents.push({ role: "user", parts: [{ text: `[System: ${systemInstruction}]\nSwali kutoka kwa ${jina}: "${swali}"` }] });

    try {
        let res = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents })
        });
        let d = await res.json();
        let jibu = d.candidates?.[0]?.content?.parts?.[0]?.text || "Sawa Mkuu 🫡";

        chatHistory.push({ role: "user", text: swali }, { role: "model", text: jibu });
        if (chatHistory.length > 40) kumbukumbu.set(senderId, chatHistory.slice(-20));

        return jibu;
    } catch (e) {
        return "Sawa Mkuu 🙏";
    }
}

// 3. Main Bot Process (Baileys Engine)
async function startBot() {
    // Tumebadilisha folder name hapa ili kufuta session zilizofeli zamani
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
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            pairingCode = "";
            console.log('✅ BOT (SHABANI JUMA KAMULIKA) IKO LIVE NA TAYARI 100% 🫡');
        }

        if (!sock.authState.creds.registered && !pairingCode) {
            setTimeout(async () => {
                try {
                    let code = await sock.requestPairingCode(NAMBARI_YAKO_PURE);
                    pairingCode = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log(`\n==========================================`);
                    console.log(`🔑 PAIRING CODE YAKO NI: ${pairingCode}`);
                    console.log(`==========================================\n`);
                } catch (err) {
                    console.error("Error requesting pairing code:", err);
                }
            }, 3000);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        
        for (let msg of messages) {
            if (!msg.message || msg.key.remoteJid.includes('@g.us') || msg.key.remoteJid === 'status@broadcast') continue;

            let from = msg.key.remoteJid;
            let text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            text = text.trim();
            if (!text) continue;

            let senderNum = from.replace('@s.whatsapp.net', '').replace('@c.us', '');
            let niWewe = msg.key.fromMe || senderNum.includes(NAMBARI_YAKO_PURE);
            let lowerText = text.toLowerCase();

            // Commands
            if (niWewe && ["zima", "lala", "off"].includes(lowerText)) {
                BOT_IKO_WAZI = false;
                await sock.sendMessage(from, { text: "Sawa Boss, bot nimeizima 🫡" });
                return;
            }
            if (niWewe && ["waka", "amka", "on"].includes(lowerText)) {
                BOT_IKO_WAZI = true;
                await sock.sendMessage(from, { text: "Nimeamka Boss, niko tayari 🫡🥳" });
                return;
            }

            if (!BOT_IKO_WAZI) return;
            if (msg.key.fromMe) continue; // Inazuia kujijibu mwenyewe

            let jina = msg.pushName || "Mrafiki";
            console.log(`📩 Ujumbe kutoka ${jina} (${senderNum}): ${text}`);

            // Typing Indicator
            await sock.sendPresenceUpdate('composing', from);
            let jibu = await ulizaAI(from, jina, text);
            await sock.sendPresenceUpdate('paused', from);

            await sock.sendMessage(from, { text: jibu }, { quoted: msg });
            console.log(`🤖 Jibu -> ${jibu}\n`);
        }
    });
}

startBot();
