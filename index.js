const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// API Key inatoka moja kwa moja kwenye Environment Variable ya Render
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Nambari yako ya WhatsApp (Jumuisha kodi ya nchi)
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
            '--single-process',
            '--no-zygote'
        ]
    }
});

const EMOJI_ZAKO = "😇 😂 😘 🥰 🥳 🙏 🥲 🫡 🥱 ✌️ 😪 😓 ☹️";

// Kumbukumbu inayoshika mada za nyuma hadi jumbe 100 kwa kila mtu (Memory ya muda mrefu)
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

    if (!kumbukumbu.has(senderId)) {
        kumbukumbu.set(senderId, []);
    }
    let chatHistory = kumbukumbu.get(senderId);

    // Kuandaa muundo wa contents kwa ajili ya Gemini API (Chat Context)
    let contents = [];

    // Ongeza kumbukumbu zilizopita kwenye request
    for (let msg of chatHistory) {
        contents.push({
            role: msg.role,
            parts: [{ text: msg.text }]
        });
    }

    // Ongeza ujumbe mpya wa sasa
    let currentPart = [{ text: `[System Instruction: ${systemInstruction}]\nUjumbe mpya kutoka kwa ${jina}: "${swali}"` }];
    if(media) {
        currentPart.push({ inlineData: { mimeType: media.mimetype, data: media.data } });
    }

    contents.push({
        role: "user",
        parts: currentPart
    });

    try {
        let res = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents })
        });
        
        let d = await res.json();
        let jibu = d.candidates?.[0]?.content?.parts?.[0]?.text || "Sawa Mkuu 🫡";

        // Hifadhi kwenye kumbukumbu
        chatHistory.push({ role: "user", text: swali });
        chatHistory.push({ role: "model", text: jibu });

        // Zuia kumbukumbu isizidi jumbe 100 per contact ili kuzuia memory overflow
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

client.on('qr', qr => {
    console.log("\n=== SCAN HII QR KWA WHATSAPP ===\n");
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
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
