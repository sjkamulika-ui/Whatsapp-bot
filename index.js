require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');
const fs = require('fs');
const path = require('path');

let pairingCode = "";
let lastCodeTime = 0;
let sockInstance = null;

const NAMBARI_YAKO = (process.env.NAMBARI_YA_MTEJA || "255635860611").replace(/[^0-9]/g, '');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const JINA_LA_DUKA = process.env.JINA_LA_DUKA || "Shabani Juma Kamulika";
const MAELEZO_BIASHARA = process.env.MAELEZO_YA_BIASHARA || "Mtaalamu wa WhatsApp Bot wa Dar es Salaam";

const AUTH_PATH = process.env.AUTH_PATH || '/data/baileys_auth';
try {
    if (!fs.existsSync(AUTH_PATH)) {
        fs.mkdirSync(AUTH_PATH, { recursive: true });
        console.log(`📂 Folder ya auth imetengenezwa: ${AUTH_PATH}`);
    }
} catch (e) {
    console.log("⚠️ /data haipo, natumia ./baileys_auth");
    const localPath = path.join(__dirname, 'baileys_auth');
    if (!fs.existsSync(localPath)) fs.mkdirSync(localPath, { recursive: true });
}

console.log(`📂 Auth Path Inatumika: ${AUTH_PATH}`);
console.log(`📱 Namba ya ku-link: ${NAMBARI_YAKO}`);

let BOT_IKO_WAZI = true;
const kumbukumbu = new Map();
const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
    if (req.url === '/qr' || req.url === '/code' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const isConnected = sockInstance && sockInstance.authState.creds.registered;
        let contentHtml = isConnected
          ? `<h1 style="color:#25D366;">✅ BOT IKO LIVE 🫡</h1><h3>${JINA_LA_DUKA}</h3><p>Linked kwa ${NAMBARI_YAKO}</p><p style="color:#25D366;">Bot hailali - Inafanya kazi 24/7</p>`
            : pairingCode
          ? `<h2 style="color:#00a884;">KODI YAKO: ${pairingCode}</h2><p>WhatsApp > Linked Devices > Link with phone number</p><p style="color:orange;">Inabadilika kila sek 30</p><script>setTimeout(()=>location.reload(),25000);</script>`
            : `<h3>⏳ Inaandaa kodi...</h3><p>Namba: ${NAMBARI_YAKO}</p><script>setTimeout(()=>location.reload(),4000);</script>`;
        res.end(`<html><body style="background:#111b21;color:#fff;font-family:sans-serif;text-align:center;padding:30px;display:flex;flex-direction:column;justify-content:center;min-height:80vh;">${contentHtml}</body></html>`);
    } else if (req.url === '/ping' || req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Bot is alive - ' + new Date().toISOString());
    } else {
        res.writeHead(200); res.end('OK');
    }
});
server.listen(PORT, '0.0.0.0', () => console.log(`🌐 Server LIVE port ${PORT}`));

setInterval(() => {
    let domain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RENDER_EXTERNAL_URL;
    if (domain) {
        if (!domain.startsWith('http')) domain = `https://${domain}`;
        fetch(`${domain}/ping`).then(()=> console.log("🏓 Self-ping OK")).catch(()=>{});
    }
}, 4 * 60 * 1000);

async function ulizaAI(senderId, jina, swali) {
    if (!GEMINI_API_KEY) return "⚠️ API Key ya Gemini bado haijawekwa kwenye env!";
    if (!kumbukumbu.has(senderId)) kumbukumbu.set(senderId, []);
    let history = kumbukumbu.get(senderId);
    let systemPrompt = `Wewe ni ${JINA_LA_DUKA}. ${MAELEZO_BIASHARA}. Unazungumza na ${jina}. Kuwa binadamu wa Dar, mcheshi, Kiswahili cha mtaani, jibu fupi 1-3 sentensi, emoji 1-2. Usijibu kama robot.`;
    let contents = history.map(m => ({ role: m.role==='user'?'user':'model', parts: [{text:m.text}] }));
    contents.push({ role:"user", parts:[{text:swali}] });
    
    // FIX KUBWA HAPA - v1 na gemini-2.0-flash BURE
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY.trim()}`;
    
    try {
        let r = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ system_instruction:{parts:[{text:systemPrompt}]}, contents, generationConfig:{temperature:0.9, maxOutputTokens:500}}) });
        let d = await r.json();
        if (d.error) { 
            console.error("Gemini Error:", JSON.stringify(d.error)); 
            if(d.error.code === 404) return "Pole Mkuu, model ya AI imebadilika - niko naifanyia update 🛠️";
            return "Pole Mkuu, akili imepumzika kidogo 🫡 jaribu tena"; 
        }
        let jibu = d.candidates?.[0]?.content?.parts?.[0]?.text || "Sijakuelewa vizuri 😇";
        history.push({role:"user",text:swali},{role:"model",text:jibu});
        if(history.length>20) kumbukumbu.set(senderId,history.slice(-12));
        else kumbukumbu.set(senderId, history);
        return jibu;
    } catch(e){ console.error(e); return "Mtandao umezorota kidogo 🙏 jaribu tena"; }
}

async function startBot() {
    try {
        const { version } = await fetchLatestBaileysVersion();
        const effectiveAuthPath = fs.existsSync(AUTH_PATH)? AUTH_PATH : path.join(__dirname, 'baileys_auth');
        const { state, saveCreds } = await useMultiFileAuthState(effectiveAuthPath);
        const sock = makeWASocket({
            version,
            logger: pino({level:'silent'}),
            printQRInTerminal:false,
            auth: state,
            browser: ["Ubuntu","Chrome","20.0.04"],
            markOnlineOnConnect: false,
            keepAliveIntervalMs: 25000,
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            retryRequestDelayMs: 2000
        });
        sockInstance = sock;
        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', async (u) => {
            const {connection, lastDisconnect} = u;
            if(connection==='close'){
                let code = lastDisconnect?.error?.output?.statusCode;
                console.log(`❌ Closed code: ${code}`);
                if(code!== DisconnectReason.loggedOut){
                    pairingCode="";
                    setTimeout(startBot,5000);
                } else {
                    pairingCode = "LOGGED OUT - Futa auth na uanze upya";
                }
            } else if(connection==='open'){
                pairingCode="";
                console.log(`✅ BOT ${JINA_LA_DUKA} LIVE 24/7 🫡`);
            }
            if(connection!== 'open' &&!sock.authState.creds.registered){
                const genCode = async()=>{
                    try{
                        if(sock.authState.creds.registered || pairingCode && Date.now() - lastCodeTime < 30000) return;
                        let c = await sock.requestPairingCode(NAMBARI_YAKO);
                        pairingCode = c?.match(/.{1,4}/g)?.join("-") || c;
                        lastCodeTime=Date.now();
                        console.log(`🔑 CODE: ${pairingCode}`);
                    }catch(e){ console.log("Pairing error:", e.message); }
                };
                if(!pairingCode) setTimeout(genCode,3000);
                const interval = setInterval(()=>{
                    if(sock.authState.creds.registered) clearInterval(interval);
                    else if(Date.now()-lastCodeTime>35000) genCode();
                }, 35000);
            }
        });
        sock.ev.on('messages.upsert', async ({messages,type})=>{
            if(type!=='notify') return;
            for(let msg of messages){
                try {
                    if(!msg.message || msg.key.remoteJid.includes('@g.us') || msg.key.remoteJid==='status@broadcast' || msg.key.remoteJid.includes('@newsletter')) continue;
                    let from=msg.key.remoteJid;
                    let text=msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";
                    text=text.trim();
                    if(!text) continue;
                    let senderNum=from.replace(/@.*/,'');
                    let isOwner=msg.key.fromMe || senderNum===NAMBARI_YAKO;
                    if(isOwner && ["zima","lala","off","pause"].includes(text.toLowerCase())){
                        BOT_IKO_WAZI=false;
                        await sock.sendMessage(from,{text:"Sawa Boss, bot nimelaza 😴 Andika 'waka' kuniwasha"});
                        continue;
                    }
                    if(isOwner && ["waka","amka","on","anza"].includes(text.toLowerCase())){
                        BOT_IKO_WAZI=true;
                        await sock.sendMessage(from,{text:"Nimeamka Boss 🫡 Niko tayari!"});
                        continue;
                    }
                    if(!BOT_IKO_WAZI || msg.key.fromMe) continue;
                    let jina=msg.pushName||"Mkuu";
                    console.log(`📩 ${jina}: ${text.substring(0,50)}`);
                    await sock.sendPresenceUpdate('composing',from);
                    let jibu=await ulizaAI(from,jina,text);
                    await sock.sendPresenceUpdate('paused',from);
                    await sock.sendMessage(from,{text:jibu},{quoted:msg});
                } catch (err) { console.error("Message handler error:", err); }
            }
        });
    } catch (err) {
        console.error("startBot crash:", err);
        setTimeout(startBot, 10000);
    }
}
process.on('uncaughtException', (err) => console.error("Uncaught:", err));
process.on('unhandledRejection', (err) => console.error("Unhandled:", err));
startBot();
