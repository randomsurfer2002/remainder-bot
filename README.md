# WhatsApp Meal & Reminder Bot

Sends automatic messages to a WhatsApp group:
- **Breakfast, Lunch, Dinner** reminders, each with a photo
- **Hourly** water and Afresh/Herbalife shake reminders

Built with [`whatsapp-web.js`](https://wwebjs.dev/) — this uses your own WhatsApp account
(like WhatsApp Web), so there's no Meta Business approval or templates needed.
It logs in by scanning a QR code, exactly like linking a new device.

## 1. Requirements
- [Node.js](https://nodejs.org) v18 or newer installed on a computer or server that can stay on
- A WhatsApp account (ideally a spare/dedicated number, not your primary one — see "Important notes" below)
- Google Chrome or Chromium installed (whatsapp-web.js drives a real browser under the hood)

## 2. Setup
```bash
cd whatsapp-reminder-bot
npm install
```

## 3. Add your images
Put three images in the `images/` folder, named exactly:
- `images/breakfast.jpg`
- `images/lunch.jpg`
- `images/dinner.jpg`

(Any image works — just keep those file names, or update the paths in `config.js`.)

## 4. Configure
Open `config.js` and edit:
- `groupName` — must match your WhatsApp group's name **exactly**
- Meal times (`cron` fields) and messages
- Hourly reminder active window and messages

Cron format reference: `minute hour day month weekday` — e.g. `0 8 * * *` = 8:00 AM every day.

## 5. Run it
```bash
npm start
```
A QR code will print in your terminal. Open WhatsApp on your phone →
**Settings → Linked Devices → Link a Device** → scan the code.

Once connected, leave this process running 24/7 (see below for how to keep it running).

## 6. Keep it running permanently
On a server, use a process manager so it survives restarts and crashes:
```bash
npm install -g pm2
pm2 start index.js --name whatsapp-bot
pm2 save
pm2 startup
```

## Important notes
- **This is an unofficial method.** `whatsapp-web.js` automates your WhatsApp account through
  a real browser session. It's widely used for personal/small-group bots, but it isn't an
  officially sanctioned integration, so there's a small risk WhatsApp could flag heavy automated
  use. Using a dedicated number (not your main personal number) and keeping the message volume
  reasonable (like this bot's schedule) is the safest way to run it.
- **Official alternative:** if you'd rather use Meta's official WhatsApp Business Cloud API
  instead (more setup: business verification + pre-approved message templates, but fully
  sanctioned), let me know and I can put together that version instead.
- The bot must already be a **member of the group** (i.e., your linked WhatsApp account needs
  to be in the group) to send messages to it.
- Keep the `.wwebjs_auth` folder (created automatically after first login) — it stores your
  session so you don't have to rescan the QR code every time you restart the bot.
