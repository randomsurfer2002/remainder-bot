// index.js
const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const cron = require("node-cron");
const express = require("express");
const qrcode = require("qrcode-terminal");
const config = require("./config");

const app = express();
let sock = null;
let hourlyIndex = 0;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("whatsapp_session");
  const { version, isLatest } = await fetchLatestBaileysVersion();
  
  console.log(`📡 Initializing WA Connection Web Version: ${version.join('.')}`);

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: "error" }), // Changed from silent to capture protocol failures
    version, 
    browser: ["Mac OS", "Desktop", "10.15.7"], 
    connectTimeoutMs: 90000,         // Increased timeout for stable cloud processing
    keepAliveIntervalMs: 30000,
    shouldSyncHistoryMessage: () => false // 👈 PATCH 1: Drops history processing to stop freezing
  });

  // Handle incoming credentials update
  sock.ev.on("creds.update", saveCreds);

  // PATCH 2: Block history data injection from hanging the event loop
  sock.ev.on("messaging-history.set", () => {
    console.log("📥 Background message history stream bypassed successfully.");
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.clear();
      console.log("\n✨ SCAN THIS CLEANED QR CODE WITH WHATSAPP:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log(`🔄 Connection dropped. Status Code: ${statusCode}. Re-establishing link...`);
      
      if (statusCode === 405 || statusCode === DisconnectReason.connectionReplaced) {
        setTimeout(() => { startBot(); }, 15000);
        return;
      }

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        setTimeout(() => { startBot(); }, 10000);
      }
    } else if (connection === "open") {
      console.log("\n=======================================================");
      console.log("✅ SUCCESS! WhatsApp client link is fully operational.");
      console.log("=======================================================\n");
      
      setupSchedules();
    }
  });
}

// Dynamic real-time helper function to locate your target group ID safely by name
async function findGroupId(name) {
  try {
    const chats = await sock.groupFetchAllParticipating();
    for (const id in chats) {
      if (chats[id].subject.trim().toLowerCase() === name.trim().toLowerCase()) {
        return id;
      }
    }
  } catch (e) {
    console.error("❌ Error performing real-time group lookup:", e.message);
  }
  return null;
}

// -------- Scheduling Engines --------
function setupSchedules() {
  console.log("⏰ Scheduling engines armed and ready.");

  // 1. Daily routine reminders array loop
  config.specificReminders.forEach((reminder, index) => {
    cron.schedule(reminder.cron, async () => {
      console.log(`⏱️ Daily routine schedule slot #${index + 1} activated.`);
      const targetId = await findGroupId(config.groupName);
      
      if (!targetId) {
        console.error(`⚠️ Dispatch dropped: Could not find group "${config.groupName}".`);
        return;
      }

      try {
        await sock.sendMessage(targetId, { text: reminder.message });
        console.log(`✅ Successfully dispatched daily scheduled alert #${index + 1}`);
      } catch (err) {
        console.error(`❌ Alert #${index + 1} send failure:`, err.message);
      }
    });
  });

  // 2. Rolling hourly matrix loop
  cron.schedule(config.hourly.cron, async () => {
    const hour = new Date().getHours();
    if (hour < config.hourly.activeStartHour || hour > config.hourly.activeEndHour) {
      return;
    }

    console.log("💧 Hourly hydration alert triggered.");
    const targetId = await findGroupId(config.groupName);
    if (!targetId) return;

    const message = config.hourly.messages[hourlyIndex % config.hourly.messages.length];
    hourlyIndex++;

    try {
      await sock.sendMessage(targetId, { text: message });
      console.log("✅ Dispatched hourly water check text.");
    } catch (err) {
      console.error("❌ Hydration send failure:", err.message);
    }
  });
}

startBot();

// Keep-alive Express server implementation
app.get("/", (req, res) => res.send("Browserless Health Bot Engine is Live!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`HTTP active on port ${PORT}`));