const { Client, LocalAuth } = require('whatsapp-web.js');
const http = require('http');

let pairingCode = "";

// Web Server ya Render
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    if (req.url === '/qr' || req.url === '/code') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        
        let contentHtml = "";
        if (pairingCode) {
            contentHtml = `
                <h2 style="color:#00a884;">Kodi Yako Ya Kuunganisha Bot 🫡</h2>
                <p style="color:#aaa;">Ingiza kodi hii kwenye WhatsApp yako:</p>
                <div style="background:#202c33;padding:15px 25px;border-radius:12px;font-size:35px;font-weight:bold;letter-spacing:6px;color:#00a884;border:2px solid #00a884;margin:20px 0;display:inline-block;">
                    ${pairingCode}
                </div>
                <p style="color:#8696a0;max-width:400px;line-height:1.5;margin:0 auto;">
                    Fungua WhatsApp &rarr; <b>Linked Devices</b> &rarr; <b>Link a Device</b> &rarr; Chini kabisa bonyeza <b>"Link with phone number instead"</b> kisha weka kodi hii!
                </p>
            `;
        } else {
            contentHtml = `
                <h3 style="color:#00a884;">Inaandaa Kodi ya Tarakimu 8... ⏳</h3>
                <p style="color:#aaa;">Subiri sekunde 5-10 kisha u-refresh ukurasa huu.</p>
            `;
        }

        res.end(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>WhatsApp Bot Pairing Code</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#111b21;color:#fff;font-family:sans-serif;margin:0;padding:20px;box-sizing:border-box;text-align:center;">
                    ${contentHtml}
                </body>
            </html>
        `);
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('WhatsApp Bot is running! Fungua /qr au /code kuona Kodi.\n');
    }
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Web server listening on port ${PORT}`);
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Tumerahisisha namba yako hapa
const NAMBARI_YAKO_PURE = "255635860611"; 

let BOT_IKO_WAZI = true;

const client = new Client({
    // Tumebadilisha clientId kuwa v2 ili kufuta session zilizokufa
    authStrategy: new LocalAuth({ clientId: "sj-render-session-v2" }),
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

function getMudaWaSasa() {
    let saa = new Date().getHours() + 3; // EAT Time
    if (saa >= 24) saa -= 24;
    if (saa >= 5 && saa < 12) return "Asubuhi";
    if (saa >= 12 && saa < 16) return "Mchana";
    if (saa >= 16 && saa < 19) return "Jioni";
    return "Usiku";
}

async function ulizaAI(senderId, jina, niMgeni, swali, media=null){
    let muda = getMudaWaSasa();
    let taarifaMzungumzaji = niMgeni 
        ? `Mtu anayeongea nawe ni MGENI (namba yake haijasaviwa kwenye simu). Anatumia jina la profile kama "${jina}". Mkarobishe vizuri kwa heshima.`
        : `Mtu anayeongea nawe amesaviwa kwenye contacts kwa jina la "${jina}". Mjibu kwa kumweka karibu kama rafiki/jamaa wa karibu.`;

    let systemInstruction = `Wewe ni Shabani Juma Kamulika (unajulikana pia kama Shebby au SJ) wa Dar es Salaam. Unajibu kama binadamu halisi wa Kitanzania (mcheshi, serious kiasi, mtulivu, na una akili timamu sana).
Muda wa sasa ni: ${muda}.
${taarifaMzungumzaji}
Sheria za kujibu:
1. Tumia Kiswahili cha mtaani au cha kawaida cha Kitanzania.
2. Tumia emoji 1 hadi 2 pekee kutoka hapa: ${EMOJI_ZAKO}.
3. Majibu yako yawe mafupi, yaeleweke vizuri (sentensi 1-3 tu), kama binadamu anavyochat WhatsApp.
4. Kama ni mgeni, unaweza kumuuliza kwa heshima anaitwa nani au unamsaidia vipi.
5. Kumbuka mambo yote mliyoongea huko nyuma na ujibu kwa kuzingatia yaliyopita.`;

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

client.on('qr', async () => {
    setTimeout(async () => {
        try {
            const code = await client.requestPairingCode(NAMBARI_YAKO_PURE);
            pairingCode = code;
            console.log(`\n==========================================`);
            console.log(`🔑 PAIRING CODE YAKO NI: ${code}`);
            console.log(`==========================================\n`);
        } catch (err) {
            console.error("Error requesting pairing code:", err.message);
        }
    }, 4000);
});

client.on('ready', () => {
    pairingCode = "";
    console.log('✅ BOT (SHABANI JUMA KAMULIKA) IKO TAYARI KWENYE RENDER 🫡');
    console.log('ZIMA = tuma ZIMA | WAKA = tuma WAKA\n');
});

// Tumeilazimisha kutumia message_create badala ya message pekee
client.on('message_create', async msg => {
    if(msg.from.includes("@g.us") || msg.from.includes("status")) return;
    let text = msg.body.trim().toLowerCase();
    
    let contact = await msg.getContact();
    let jina = contact.name || contact.pushname || msg._data.notifyName || "Mgeni";
    let niMgeni = !contact.name;

    let senderNumber = msg.from.replace('@c.us', '').replace('@s.whatsapp.net', '');
    let niWewe = msg.fromMe || senderNumber.includes(NAMBARI_YAKO_PURE);

    // Amri za ZIMA na WAKA kutoka kwako
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
    
    // Kama umetuma wewe mwenyewe na si amri ya ZIMA/WAKA, acha bot isijibu chat zako za binafsi ili isijijibu loop
    if(msg.fromMe && !niMgeni) return;

    let mediaData = null;
    let swali = msg.body.trim();

    if(msg.hasMedia){
        try{
            const media = await msg.downloadMedia();
            if(media && (media.mimetype.startsWith("image/") || media.mimetype.startsWith("audio/") || msg.type === "ptt")){
                mediaData = {mimetype: media.mimetype, data: media.data};
                if(!swali) swali = media.mimetype.startsWith("image/")? "Ametuma picha" : "Ametuma sauti/voice note";
            }
        }catch(e){}
    }
    if(!swali && !mediaData) return;

    console.log(`📩 ${jina} (${niMgeni ? 'MGENI' : 'SAVED'}): ${swali.substring(0,40)} ${mediaData?'[MEDIA]':''}`);
    await client.sendSeen(msg.from);
    await new Promise(r=>setTimeout(r, 1000));
    await client.sendStateTyping(msg.from);
    await new Promise(r=>setTimeout(r, 1200));

    let jibu = await ulizaAI(msg.from, jina, niMgeni, rekebisha(swali), mediaData);
    await msg.reply(jibu);
    console.log(`🤖 -> ${jibu}\n`);
});

client.initialize();
