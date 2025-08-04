const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');

const bot = mineflayer.createBot({
  host: 'FriendlySMP-mg0G.aternos.me',     // ✏️ তোমার Aternos IP দাও (port ছাড়াও দিলে চলবে)
  port: 37678,            // দরকার হলে port দাও
  username: 'ELV'  // change if needed
});

bot.loadPlugin(pathfinder);

bot.once('spawn', () => {
  const mcData = mcDataLoader(bot.version);
  const defaultMove = new Movements(bot, mcData);
  bot.pathfinder.setMovements(defaultMove);

  console.log('✅ Bot spawned!');

  // 🔄 Random movement to avoid AFK/bot detection
  setInterval(() => {
    if (Math.random() < 0.5) {
      bot.setControlState('forward', Math.random() < 0.5);
      bot.setControlState('left', Math.random() < 0.5);
    } else {
      bot.clearControlStates();
    }
  }, 4000);
});

// 🛡️ Login/Register detector
bot.on('message', (jsonMsg) => {
  const msg = jsonMsg.toString().toLowerCase();
  if (msg.includes('/register')) {
    bot.chat('/register elvmoronby elvmoronby); // ✏️ পাসওয়ার্ড তুমি চাইলেই বদলাতে পারো
  } else if (msg.includes('/login')) {
    bot.chat('/login elvmoronby');
  }
});

// 💬 Chat commands
bot.on('chat', (username, message) => {
  if (username === bot.username) return;
  const target = bot.players[username]?.entity;

  if (message === 'follow me') {
    if (!target) return bot.chat("❌ I can't see you.");
    bot.chat("👣 Following you...");
    bot.pathfinder.setGoal(new goals.GoalFollow(target, 1));
  }

  if (message === 'stop') {
    bot.chat("🛑 Stopped.");
    bot.pathfinder.setGoal(null);
    bot.clearControlStates();
  }

  if (message === 'ping') {
    bot.chat(`🏓 Pong! Ping is ${bot.ping}ms`);
  }
});

// 🛡️ Prevent timeout in Render
setInterval(() => {
  bot.chat('...'); // fake keep-alive chat
}, 600000); // 10 min

// 🔁 Reconnect on disconnect
bot.on('end', () => {
  console.log("🔁 Bot disconnected. Reconnecting...");
  setTimeout(() => require('child_process').fork(__filename), 5000);
});

bot.on('error', err => {
  console.log("❌ Error:", err.message);
});
