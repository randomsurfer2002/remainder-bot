// ==========================================================
// CREATIVE TEXT-ONLY PLAN CONFIGURATION FILE
// ==========================================================

module.exports = {
  // Must match your WhatsApp group's name EXACTLY (case-sensitive)
  groupName: "Family Health Group",

  // ⏰ Targeted Daily Routine Timeline (Afresh, Shakes, & Main Meals)
  // Cron format: "minute hour * * *" (24-hour clock)
  specificReminders: [
    {
      cron: "0 6 * * *", // 6:00 AM
      message: "🌅 *6:00 AM | METABOLISM IGNITION* 🌅\nWake up, team! It's time to boil some water and brew your first hot cup of *Afresh*. Let's clear out the morning fog, activate our fat-burning engine, and kick off the day with maximum focus! ☕🔥"
    },
    {
      cron: "0 8 * * *", // 8:00 AM
      message: "🥤 *8:00 AM | MORNING FUEL* 🥤\nTime to feed your muscles the premium stuff! Get your shakers ready for your morning *Herbalife Nutrition Shake*. Pack it clean, mix it smooth, and drink up your core macros to power your day! 💪✨"
    },
    {
      cron: "0 9 * * *", // 9:00 AM
      message: "🍳 *9:00 AM | BREAKFAST TIME* 🍳\nBreakfast is officially served! Keep it clean, nutritious, and perfectly aligned with your goals. Fuel your body right so you dominate the rest of your morning tasks! 🌞 Plate up!"
    },
    {
      cron: "0 11 * * *", // 11:00 AM
      message: "☀️ *11:00 AM | MID-DAY RECHARGE* ☀️\nMid-day slump? Not on our watch. Keep your cognitive drive high and your body burning clean energy. Time for your second cup of *Afresh*! Let's stay alert and crush our targets! ☕🔋"
    },
    {
      cron: "0 13 * * *", // 1:00 PM
      message: "🍛 *1:00 PM | LUNCH POWER HOUR* 🍛\nThe clock hits 1! Time to pause, step away, and smash a healthy, high-protein *Lunch*. Log your macros, track your portions, and don't skip out on your clean fuel! 🥗👊"
    },
    {
      cron: "0 16 * * *", // 4:00 PM
      message: "🌆 *4:00 PM | EVENING ENERGY CHECK* 🌆\nKeep the momentum rolling into the evening! Re-energize your system and torch unwanted cravings with your third and final cup of *Afresh*. Pour a warm cup and lock back in! ☕🎯"
    },
    {
      cron: "0 20 * * *", // 8:00 PM
      message: "🍽️ *8:00 PM | THE FINAL RECOVERY LAYER* 🍽️\nTime to wrap up the day's intake right. Let's hit our evening *Herbalife Shake or a crisp, light Dinner*. Keep it clean, low-calorie, and let your body recover cleanly overnight. Dinner is served! 🍲🥛"
    }
  ],

  // 💧 Hourly Hydration Matrix
  hourly: {
    cron: "0 * * * *",     // Runs every hour, on the hour
    activeStartHour: 7,    // 7 AM
    activeEndHour: 22,     // 10 PM
    // The bot cycles through these high-energy phrases hourly so the chat stays fresh
    messages: [
      "💧 *HOURLY HYDRATION ALERT!* Stop scrolling and slam a full glass of water right now. Clear skin, high performance, and heavy lifting depend on it! 🚰",
      "💧 *WATER CHECK!* Keep your cellular hydration up and your metabolism firing. Put down your phone, grab a glass, and chug! 🌊⚡",
      "💧 *DRINK WATER REMINDER!* Don't wait until you're thirsty—that means you're already dry. Go drink 250ml of clean water immediately! 🧊👀",
      "💧 *HYDRATION EMPOWERMENT!* Flush out toxins and keep your energy levels peaking. Take a quick water break right now! 🚰🏆"
    ]
  }
};
