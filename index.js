const { Client, LocalAuth } = require("whatsapp-web.js");
const cron = require("node-cron");
const express = require("express");
const path = require("path");
const fs = require("fs");
const config = require("./config");

const app = express();
let targetChatId = null;
let hourlyIndex = 0;

// 📲 PHONE LINKING CONFIGURATION:
// Put your country code + full mobile number below (No spaces, no '+' sign)
// Example for India: "919876543210"
const MY_PHONE_NUMBER = "919368891933"; 

// ==========================================================
// DYNAMIC CHROME EXECUTABLE RESOLVER (FOR RENDER DEPLOYMENT)
// ==========================================================
let customExecutablePath = "";
try {
  const baseDir = path.join(__dirname, ".cache", "puppeteer", "chrome");
  if (fs.existsSync(baseDir)) {
    const versions = fs.readdirSync(baseDir);
    if (versions.length > 0) {
      customExecutablePath = path.join(baseDir, versions[0], "chrome-linux64", "chrome");
      console.log(`🎯 Located Chrome executable at: ${customExecutablePath}`);
    }
  }
} catch (e) {
  console.error("Error dynamically locating Chrome path:", e.message);
}

// Initialize WhatsApp Web Client with localized Puppeteer overrides
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: customExecutablePath || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  }
});

// -------- Link via Phone Number Pairing Code (No QR Needed) --------
let pairingCodeRequested = false;
client.on("qr", async (qr) => {
  if (!pairingCodeRequested && MY_PHONE_NUMBER !== "91XXXXXXXXXX") {
    console.log("\n=================================================================");
    console.log(`📲 GENERATING PAIRING CODE FOR: +${MY_PHONE_NUMBER}`);
    console.log("=================================================================\n");
    
    try {
      // Requests the 8-digit alphanumeric pairing code from WhatsApp
      const code = await client.requestPairingCode(MY_PHONE_NUMBER);
      
      console.log("\n=================================================================");
      console.log(`🎯 YOUR WHATSAPP PAIRING CODE IS: ${code}`);
      console.log("=================================================================\n");
      pairingCodeRequested = true;
    } catch (err) {
      console.error("Failed to generate pairing code:", err.message);
    }
  } else if (MY_PHONE_NUMBER === "91XXXXXXXXXX") {
    console.log("⚠️ Configuration Error: Please enter your real phone number on line 12 of index.js!");
  }
});

// -------- Once logged in, map target group identity --------
client.on("ready", async () => {
  console.log("✅ WhatsApp client is ready.");

  const chats = await client.getChats();
  const group = chats.find(
    (chat) => chat.isGroup && chat.name === config.groupName
  );

  if (!group) {
    console.error(
      `❌ Could not find a group named "${config.groupName}". ` +
      `Create it on your phone first or check spelling in config.js.`
    );
    return;
  }

  targetChatId = group.id._serialized;
  console.log(`✅ Found target group: ${config.groupName}`);
  
  // Fire up scheduling loops
  scheduleSpecificReminders();
  scheduleHourlyWaterReminders();
});

client.on("auth_failure", (msg) => console.error("Auth failure:", msg));
client.on("disconnected", (reason) => console.log("Client disconnected:", reason));

// -------- Stream A: Timed Routine Alerts --------
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

// -------- Stream B: Hourly Water Breaks (7 AM to 10 PM) --------
function scheduleHourlyWaterReminders() {
  cron.schedule(config.hourly.cron, async () => {
    if (!targetChatId) return;
    
    const hour = new Date().getHours();
    if (hour < config.hourly.activeStartHour || hour > config.hourly.activeEndHour) {
      return; 
    }
    
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
app.get("/", (req, res) => res.send("Text-Only Nutrition & Water Scheduler with Phone Pairing is Live!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`HTTP Listener successfully bound to port ${PORT}`));
