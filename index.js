const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const cron = require("node-cron");
const express = require("express");
const config = require("./config");

const app = express();
let targetChatId = null;
let hourlyIndex = 0;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] // Optimized memory configurations for cloud hosting
  }
});

// -------- Show QR code to log in (Scan via Render Logs dashboard) --------
client.on("qr", (qr) => {
  console.log("Scan this QR code with WhatsApp (Linked Devices):");
  qrcode.generate(qr, { small: true });
});

// -------- Once logged in, pin the target group identity --------
client.on("ready", async () => {
  console.log("✅ WhatsApp client is ready.");

  const chats = await client.getChats();
  const group = chats.find(
    (chat) => chat.isGroup && chat.name === config.groupName
  );

  if (!group) {
    console.error(
      `❌ Could not find a group named "${config.groupName}". ` +
      `Check config.js — the name must match exactly.`
    );
    return;
  }

  targetChatId = group.id._serialized;
  console.log(`✅ Found target group: ${config.groupName}`);
  
  // Launch both automation streams
  scheduleSpecificReminders();
  scheduleHourlyWaterReminders();
});

client.on("auth_failure", (msg) => console.error("Auth failure:", msg));
client.on("disconnected", (reason) => console.log("Client disconnected:", reason));

// -------- Stream A: Specific Plan Timestamps (6am, 8am, 9am, 11am, 1pm, 4pm, 8pm) --------
function scheduleSpecificReminders() {
  config.specificReminders.forEach((reminder, index) => {
    cron.schedule(reminder.cron, async () => {
      if (!targetChatId) return;
      try {
        await client.sendMessage(targetChatId, reminder.message);
        console.log(`Successfully dispatched daily scheduled alert #${index + 1}`);
      } catch (err) {
        console.error(`Failed to dispatch daily scheduled alert #${index + 1}:`, err.message);
      }
    });
  });
}

// -------- Stream B: Hourly Water Reminders (7 AM to 10 PM) --------
function scheduleHourlyWaterReminders() {
  cron.schedule(config.hourly.cron, async () => {
    if (!targetChatId) return;
    
    const hour = new Date().getHours();
    // Enforce the active operational window restriction
    if (hour < config.hourly.activeStartHour || hour > config.hourly.activeEndHour) {
      return; 
    }
    
    // Dynamically cycle through the message index list natively
    const message = config.hourly.messages[hourlyIndex % config.hourly.messages.length];
    hourlyIndex++;
    
    try {
      await client.sendMessage(targetChatId, message);
      console.log("Dispatched hourly water check text.");
    } catch (err) {
      console.error("Failed to send hourly hydration text:", err.message);
    }
  });
}

client.initialize();

// Express app instance listening on assigned environment ports to satisfy Render checks
app.get("/", (req, res) => res.send("Text-Only Nutrition & Water Scheduler is Live!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`HTTP Listener successfully bound to port ${PORT}`));
