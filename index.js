const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const cron = require("node-cron");
const path = require("path");
const express = require("express");
const config = require("./config");

// Initialize Express web wrapper for Render's mandatory health check ping
const app = express();

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  }
});

let targetChatId = null;
let hourlyIndex = 0;

// -------- Show QR code to log in (scan once with your phone) --------
client.on("qr", (qr) => {
  console.log("Scan this QR code with WhatsApp (Linked Devices):");
  qrcode.generate(qr, { small: true });
});

// -------- Once logged in, find the target group --------
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
  scheduleMealReminders();
  scheduleHourlyReminders();
});

client.on("auth_failure", (msg) => console.error("Auth failure:", msg));
client.on("disconnected", (reason) => console.log("Client disconnected:", reason));

// -------- Meal reminders (with images) --------
function scheduleMealReminders() {
  Object.entries(config.meals).forEach(([mealName, meal]) => {
    cron.schedule(meal.cron, async () => {
      try {
        const imagePath = path.join(__dirname, meal.image);
        const media = MessageMedia.fromFilePath(imagePath);
        await client.sendMessage(targetChatId, media, { caption: meal.message });
        console.log(`Sent ${mealName} reminder.`);
      } catch (err) {
        console.error(`Failed to send ${mealName} reminder:`, err.message);
        // Fallback: send text only if the image is missing/broken
        await client.sendMessage(targetChatId, meal.message).catch(() => {});
      }
    });
  });
}

// -------- Hourly water / shake reminders --------
function scheduleHourlyReminders() {
  cron.schedule(config.hourly.cron, async () => {
    const hour = new Date().getHours();
    if (hour < config.hourly.activeStartHour || hour > config.hourly.activeEndHour) {
      return; // outside active window, skip
    }
    const message = config.hourly.messages[hourlyIndex % config.hourly.messages.length];
    hourlyIndex++;
    try {
      await client.sendMessage(targetChatId, message);
      console.log("Sent hourly reminder:", message);
    } catch (err) {
      console.error("Failed to send hourly reminder:", err.message);
    }
  });
}

client.initialize();

// Simple endpoint so Render web service pings stay green
app.get("/", (req, res) => res.send("Meal Reminder Bot is Live"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web monitoring port bound on ${PORT}`));
