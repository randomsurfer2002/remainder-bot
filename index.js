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

  // Fetch the absolute newest connection settings dynamically to clear the 405 block
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`📡 Connecting using WA Web Version: ${version.join('.')}, Latest: ${isLatest}`);

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    version, // 👈 Explicitly pass the updated version matrix
    browser: ["Mac OS", "Desktop", "10.15.7"], // 👈 Pretends to be an official macOS standalone client
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
      
      // If a handshake conflict pops up, take a heavy breath before retrying
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
      setupSchedules();
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

// Helper function to locate your target group ID dynamically by name
async function findGroupId(name) {
  try {
    const chats = await sock.groupFetchAllParticipating();
    for (const id in chats) {
      if (chats[id].subject.trim() === name.trim()) {
        return id;
      }
    }
  } catch (e) {
    console.error("Error fetching groups:", e.message);
  }
  return null;
}

// -------- Scheduling Engines --------
function setupSchedules() {
  console.log("⏰ Scheduling engines armed and ready.");

  config.specificReminders.forEach((reminder, index) => {
    cron.schedule(reminder.cron, async () => {
      const targetId = await findGroupId(config.groupName);
      if (!targetId) {
        console.error(`⚠️ Could not find group: ${config.groupName}`);
        return;
      }
      try {
        await sock.sendMessage(targetId, { text: reminder.message });
        console.log(`Successfully dispatched daily scheduled alert #${index + 1}`);
      } catch (err) {
        console.error(`Alert #${index + 1} send failure:`, err.message);
      }
    });
  });

  cron.schedule(config.hourly.cron, async () => {
    const hour = new Date().getHours();
    if (hour < config.hourly.activeStartHour || hour > config.hourly.activeEndHour) return;

    const targetId = await findGroupId(config.groupName);
    if (!targetId) return;

    const message = config.hourly.messages[hourlyIndex % config.hourly.messages.length];
    hourlyIndex++;

    try {
      await sock.sendMessage(targetId, { text: message });
      console.log("Dispatched hourly water check text.");
    } catch (err) {
      console.error("Hydration send failure:", err.message);
    }
  });
}

startBot();

app.get("/", (req, res) => res.send("Browserless Health Bot Engine is Live!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`HTTP active on port ${PORT}`));