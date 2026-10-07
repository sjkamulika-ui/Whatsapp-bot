const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const http = require('http');

let pairingCode = "";
let latestQrUrl = "";

// Web Server ya Render
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    if (req.url === '/qr' || req.url === '/code') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        
        let contentHtml = "";
        if (pairingCode) {
            contentHtml = `
                <h2 style="color:#00a884;">Kodi Yako Ya Kuunganisha Bot 🫡</h2>
                <p style="color:#aaa;">Ingiza kodi hii kwenye WhatsApp yako (Simu Moja):</p>
                <div style="background:#202c33;padding:15px 25px;border-radius:12px;font-size:32px;font-weight:bold;letter-spacing:5px;color:#00a884;border:2px solid #00a884;margin:20px 0;display:inline-block;">
                    ${pairingCode}
                </div>
                <p style="color:#8696a0;max-width:400px;line-height:1.5;margin:0 auto;">
                    Fungua WhatsApp &rarr; <b>Linked Devices</b> &rarr; <b>Link a Device</b> &rarr; Chini kabisa bonyeza <b>"Link with phone number instead"</b> kisha weka kodi hii!
                </p>
            `;
        } else if (latestQrUrl) {
            contentHtml = `
                <h2 style="color:#00a884;">Scan QR Code Hapa Kuwasha Bot 🫡</h2>
                <div style="background:white;padding:15px;border-radius:15px;box-shadow:0 10px 25px rgba(0,0,0,0.5);display:inline-block;">
                    <img src="${latestQrUrl}" alt="QR Code" style="width:260px;height:260px;display:block;"/>
                </div>
            `;
        } else {
            contentHtml = `<h3>Inatengeneza Kodi mpya... Subiri sekunde chache u-refresh...</h3>`;
        }

        res.end(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>WhatsApp Bot Link</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#111b21;color:#fff;font-family:sans-serif;margin:0;padding:20px;box-sizing:border-box;text-align:center;">
                    ${contentHtml}
                </body>
            </html>
        `);
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('WhatsApp Bot is running! Fungua /qr au /code kuona Kodi au QR.\n');
    }
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Web server listening on port ${PORT}`);
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const NAMBARI_YAKO = "255635860611@c.us"; 

let BOT_IKO_WAZI = true;

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "sj-render-session" }),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
});

const EMOJI_ZAKO = "😇 😂 😘 🥰 🥳 🙏 🥲 🫡 🥱 ✌️ 😪 😓 ☹️";
const kumbukumbu = new Map();

function rekebisha(text){
    let t = text.toLowerCase();
    const m = {"habry":"habari","mbo":"mambo","nakupeda":"nakupenda","bby":"baby","mm":"mimi"};
    for(let k in m){ if(t.includes(k)) t=t.replace(k,m[k]); }
    return t;
}

async function ulizaAI(senderId, jina, swali, media=null){
    let systemInstruction = `Wewe ni SJ wa Dar es Salaam. Unajibu kama binadamu halisi wa Kitanzania (mcheshi, serious kiasi, mtulivu, na una akili timamu sana).
Jina la mzungumzaji: ${jina}.
Sheria za kujibu:
1. Tumia Kiswahili cha mtaani au cha kawaida cha Kitanzania.
2. Tumia emoji 1 hadi 2 pekee kutoka hapa: ${EMOJI_ZAKO}.
3. Majibu yako yawe mafupi, yaeleweke vizuri (sentensi 1-3 tu), kama binadamu anavyochat WhatsApp.
4. Kumbuka mambo yote mliyoongea huko nyuma na ujibu kwa kuzingatia yaliyopita.`;

    if (!kumbukumbu.has(senderId)) kumbukumbu.set(senderId, []);
    let chatHistory = kumbukumbu.get(senderId);

    let contents = [];
    for (let msg of chatHistory) {
        contents.push({ role: msg.role, parts: [{ text: msg.text }] });
    }

    let currentPart = [{ text: `[System Instruction: ${systemInstruction}]\nUjumbe mpya kutoka kwa ${jina}: "${swali}"` }];
    if(media) {
        currentPart.push({ inlineData: { mimeType: media.mimetype, data: media.data } });
    }

    contents.push({ role: "user", parts: currentPart });

    try {
        let res = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents })
        });
        
        let d = await res.json();
        let jibu = d.candidates?.[0]?.content?.parts?.[0]?.text || "Sawa Mkuu 🫡";

        chatHistory.push({ role: "user", text: swali });
        chatHistory.push({ role: "model", text: jibu });

        if (chatHistory.length > 100) {
            chatHistory = chatHistory.slice(-80);
            kumbukumbu.set(senderId, chatHistory);
        }

        return jibu;
    } catch(e) { 
        console.error("Gemini API Error:", e);
        return "Sawa Mkuu 🙏"; 
    }
}

client.on('qr', async (qr) => {
    latestQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
    qrcode.generate(qr, {small: true});

    // Subiri sekunde 5 ukurasa u-load vizuri kabla ya kuomba pairing code
    setTimeout(async () => {
        try {
            const code = await client.requestPairingCode('255635860611');
            pairingCode = code;
            console.log(`\n==========================================`);
            console.log(`🔑 PAIRING CODE YAKO NI: ${code}`);
            console.log(`==========================================\n`);
        } catch (err) {
            console.error("Error requesting pairing code:", err.message);
        }
    }, 5000);
});

client.on('ready', () => {
    pairingCode = "";
    latestQrUrl = "";
    console.log('✅ BOT IKO TAYARI KWENYE RENDER 🫡');
    console.log('ZIMA = tuma ZIMA | WAKA = tuma WAKA\n');
});

client.on('message', async msg => {
    if(msg.from.includes("@g.us") || msg.from.includes("status")) return;
    let text = msg.body.trim().toLowerCase();
    let jina = msg._data.notifyName || "Mkuu";
    
    let niWewe = msg.fromMe || msg.from === NAMBARI_YAKO;

    if(niWewe && ["zima","lala","off","simama"].includes(text)){
        BOT_IKO_WAZI = false;
        await msg.reply("Sawa Afande, bot nimeizima 🫡😪 Nikiitaka tena niambie WAKA");
        console.log("🛑 BOT IMEZIMWA NA BOSS");
        return;
    }
    if(niWewe && ["waka","amka","on","anza"].includes(text)){
        BOT_IKO_WAZI = true;
        await msg.reply("Nimeamka Afande, niko tayari tena 🫡🥳");
        console.log("✅ BOT IMEWASHWA NA BOSS");
        return;
    }

    if(!BOT_IKO_WAZI) return;
    if(msg.fromMe) return;

    let mediaData = null;
    let swali = msg.body.trim();

    if(msg.hasMedia){
        try{
            const media = await msg.downloadMedia();
            if(media && (media.mimetype.startsWith("image/") || media.mimetype.startsWith("audio/") || msg.type === "ptt")){
                mediaData = {mimetype: media.mimetype, data: media.data};
                if(!swali) swali = media.mimetype.startsWith("image/")? "Ametuma picha" : "Ametuma voice";
            }
        }catch(e){}
    }
    if(!swali && !mediaData) return;

    console.log(`📩 ${jina}: ${swali.substring(0,40)} ${mediaData?'[MEDIA]':''}`);
    await client.sendSeen(msg.from);
    await new Promise(r=>setTimeout(r, 1200));
    await client.sendStateTyping(msg.from);
    await new Promise(r=>setTimeout(r, 800));

    let jibu = await ulizaAI(msg.from, jina, rekebisha(swali), mediaData);
    await msg.reply(jibu);
    console.log(`🤖 -> ${jibu}\n`);
});

client.initialize();
