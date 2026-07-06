const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const cron = require("node-cron");
const express = require("express");
const config = require("./config");

const app = express();
let sock = null;
let hourlyIndex = 0;
let isGeneratingCode = false; // Prevents spamming multiple code requests

// 📲 PHONE LINKING CONFIGURATION:
const MY_PHONE_NUMBER = "919368891933"; 

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("whatsapp_session");

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    connectTimeoutMs: 60000, // Give it a full minute to negotiate handshake stable
    keepAliveIntervalMs: 30000
  });

  // Request pairing code safely without spamming loops
  if (!sock.authState.creds.registered && !isGeneratingCode) {
    isGeneratingCode = true;
    
    // 10-second delay on boot to let the socket establish its initial ground connection
    setTimeout(async () => {
      try {
        console.log("⏳ Fetching a stable pairing code from WhatsApp...");
        let code = await sock.requestPairingCode(MY_PHONE_NUMBER);
        
        if (code && !code.includes("-")) {
          code = code.substring(0, 4) + "-" + code.substring(4);
        }
        console.log("\n=================================================================");
        console.log(`🎯 ENTER THIS STABLE CODE ON YOUR PHONE NOW: ${code}`);
        console.log("=================================================================\n");
      } catch (err) {
        console.error("Pairing code error:", err.message);
      } finally {
        // Allow generation again only after a long window if this one fails
        setTimeout(() => { isGeneratingCode = false; }, 30000);
      }
    }, 10000); 
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    
    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`Socket status: Closed. Reason Code: ${statusCode || "Unknown"}. Reconnecting: ${shouldReconnect}`);
      
      // Only restart core engine if it wasn't a deliberate logout or a collision crash
      if (shouldReconnect) {
        setTimeout(() => { startBot(); }, 5000); // 5s back-off delay before reconnecting to prevent loops
      }
    } else if (connection === "open") {
      console.log("✅ SUCCESS! WhatsApp client is officially linked and ready.");
      isGeneratingCode = false;
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

  // Stream A: Fixed Daily Nutrition Reminders
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

  // Stream B: Hourly Water Breaks
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
