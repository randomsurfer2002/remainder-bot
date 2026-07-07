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
let cachedGroupId = null; // 👈 Saves your group ID in memory so we don't spam handshakes

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("whatsapp_session");

  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`📡 Connecting using WA Web Version: ${version.join('.')}, Latest: ${isLatest}`);

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    version, 
    browser: ["Mac OS", "Desktop", "10.15.7"], 
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000
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
      
      if (statusCode === 405 || statusCode === DisconnectReason.connectionReplaced) {
        console.log("⏳ Balancing protocol version mismatch... cooling down 15s.");
        setTimeout(() => { startBot(); }, 15000);
        return;
      }

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        setTimeout(() => { startBot(); }, 10000);
      }
    } else if (connection === "open") {
      console.log("\n=======================================================");
      console.log("✅ SUCCESS! WhatsApp client is officially linked and ready.");
      console.log("=======================================================\n");
      
      // Cache the group ID immediately upon login to avoid runtime handshake congestion
      await cacheTargetGroup();
      setupSchedules();
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

// Fetches all groups once on startup and matches your target
async function cacheTargetGroup() {
  try {
    console.log("🔍 Resolving target group connection ID...");
    const chats = await sock.groupFetchAllParticipating();
    
    for (const id in chats) {
      if (chats[id].subject.trim().toLowerCase() === config.groupName.trim().toLowerCase()) {
        cachedGroupId = id;
        console.log(`📌 Target Group Locked: "${config.groupName}" -> ID: ${cachedGroupId}`);
        return;
      }
    }
    console.log(`⚠️ Warning: Could not find any group named "${config.groupName}" on this account.`);
  } catch (e) {
    console.error("❌ Pre-login group sync failed:", e.message);
  }
}

// -------- Scheduling Engines --------
function setupSchedules() {
  console.log("⏰ Scheduling engines armed and ready.");

  // 1. Daily routine reminders array loop
  config.specificReminders.forEach((reminder, index) => {
    cron.schedule(reminder.cron, async () => {
      console.log(`⏱️ Daily cron slot #${index + 1} activated.`);
      
      // If cache dropped, try a quick hot-reload
      if (!cachedGroupId) await cacheTargetGroup();

      if (!cachedGroupId) {
        console.error(`⚠️ Dispatch dropped: ID for "${config.groupName}" is missing.`);
        return;
      }

      try {
        await sock.sendMessage(cachedGroupId, { text: reminder.message });
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
    if (!cachedGroupId) await cacheTargetGroup();
    if (!cachedGroupId) return;

    const message = config.hourly.messages[hourlyIndex % config.hourly.messages.length];
    hourlyIndex++;

    try {
      await sock.sendMessage(cachedGroupId, { text: message });
      console.log("✅ Dispatched hourly water check text.");
    } catch (err) {
      console.error("❌ Hydration send failure:", err.message);
    }
  });
}

startBot();

app.get("/", (req, res) => res.send("Browserless Health Bot Engine is Live!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`HTTP active on port ${PORT}`));