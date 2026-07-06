const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const cron = require("node-cron");
const express = require("express");
const config = require("./config");

const app = express();
let sock = null;
let hourlyIndex = 0;

// 📲 PHONE LINKING CONFIGURATION:
const MY_PHONE_NUMBER = "919368891933"; 

async function startBot() {
  // Sets up low-memory session storage in a local folder
  const { state, saveCreds } = await useMultiFileAuthState("whatsapp_session");

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }), // Keeps logs dead silent to save memory
    printQRInTerminal: false
  });

  // Request the 8-digit pairing code if not authenticated
  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        let code = await sock.requestPairingCode(MY_PHONE_NUMBER);
        // Format the code nicely with a hyphen if it doesn't have one
        if (code && !code.includes("-")) {
          code = code.substring(0, 4) + "-" + code.substring(4);
        }
        console.log("\n=================================================================");
        console.log(`🎯 YOUR WHATSAPP PAIRING CODE IS: ${code}`);
        console.log("=================================================================\n");
      } catch (err) {
        console.error("Pairing code request timed out, retrying on next boot...", err.message);
      }
    }, 3000);
  }

  // Monitor connection states
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    
    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`Connection closed due to error. Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) startBot(); // Auto-restart on network drops
    } else if (connection === "open") {
      console.log("✅ WhatsApp client is successfully connected!");
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

// Start the core engine
startBot();

// Keep Render happy with a live web page endpoint
app.get("/", (req, res) => res.send("Browserless Health Bot Engine is Live!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`HTTP active on port ${PORT}`));
