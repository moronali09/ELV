const mineflayer   = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');
const logger       = require('./logger');

const HOST     = 'shadow_elites.ignorelist.com';
const PORT     = 25604;
const BOT_NAME = 'ELV';
const VERSION  = '1.21.1';
const OWNER    = 'moronali';
const PASSWORD = 'elvmoronby';

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const PACK_DIR = path.join(__dirname, 'packs');
const PACK_INDEX = path.join(__dirname, 'packs.json');

if (!fs.existsSync(PACK_DIR)) fs.mkdirSync(PACK_DIR);
let packIndex = {};
if (fs.existsSync(PACK_INDEX)) {
  packIndex = JSON.parse(fs.readFileSync(PACK_INDEX));
}



let bot;
let activePlayers = new Set();
let welcomedPlayers = new Set();

function stripFormatting(text) {
  return text.replace(/§[0-9a-fk-or]/gi, '');
}

function createBot() {
  console.log('⏸ Creating bot.');
  bot = mineflayer.createBot({ host: HOST, port: PORT, username: BOT_NAME, version: VERSION });
  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log('✅ Bot spawned and connected!\n\n');
    activePlayers.clear();
    Object.keys(bot.players).forEach(name => activePlayers.add(stripFormatting(name)));

    const mcData = mcDataLoader(bot.version);
    bot.pathfinder.setMovements(new Movements(bot, mcData));

    bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
    setTimeout(() => bot.chat(`/login ${PASSWORD}`), 1000);
  });

  bot.on('message', msg => {
    const text = stripFormatting(msg.toString());
    console.log('[Chat]', text);
    const low = text.toLowerCase();
    if (low.includes('please register using')) {
      bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
      console.log('↗️ Auto-register sent');
    } else if (low.includes('please log in using')) {
      bot.chat(`/login ${PASSWORD}`);
      console.log('↗️ Auto-login sent');
    }
  });

  bot.on('playerJoined', player => {
    if (!player.username || player.username === BOT_NAME) return;
    const name = stripFormatting(player.username);
    if (!activePlayers.has(name)) {
      logger.logJoin(name);
      if (!welcomedPlayers.has(name)) {
        bot.chat(`👋 Welcome ${name}!`);
        welcomedPlayers.add(name);
      }
    }
    activePlayers.add(name);
    const target = bot.players[player.username]?.entity;
    if (target) bot.pathfinder.setGoal(new goals.GoalFollow(target, 1), true);
  });

  bot.on('playerLeft', player => {
    if (!player.username || player.username === BOT_NAME) return;
    const name = stripFormatting(player.username);
    if (activePlayers.has(name)) {
      logger.logLeave(name);
      bot.chat(`${name} left the server.`);
      activePlayers.delete(name);
    }
  });

  bot.on('chat', (username, message) => {
    if (username !== OWNER) return;
    const msg = message.toLowerCase();
    if (msg === 'ping') {
      const ping = bot._client?.ping ?? 'N/A';
      bot.chat(`🏓 Ping: ${ping}ms`);
    }
    if (msg === 'players') {
      const list = Array.from(activePlayers).filter(n => n !== BOT_NAME);
      bot.chat(`👥 Players (${list.length}): ${list.join(', ') || 'None'}`);
    }
    if (msg === 'stop') {
      bot.pathfinder.setGoal(null);
      bot.clearControlStates();
      bot.chat('Stopped following.');
    }
  });
  bot.on('playerJoined', player => {
  if (player.username === 'TANVIR110') {
    const target = bot.players[player.username]?.entity;
    if (target) {
      const mcData = require('minecraft-data')(bot.version);
      bot.pathfinder.setMovements(new Movements(bot, mcData));
      const { GoalFollow } = goals;
      bot.pathfinder.setGoal(new GoalFollow(target, 1), true);
      bot.chat(`👣 Following ${player.username}`);
    }
  }
});
  bot.on('resourcePackSend', async (url, hash) => {
  console.log(`🔄 Resource pack requested: hash=${hash}\n    URL=${url}`);

  const outFile = path.join(PACK_DIR, `${hash}.zip`);
  if (!fs.existsSync(outFile)) {
    console.log('⬇️ Downloading pack...');
    const res = await fetch(url);
    if (!res.ok) {
      console.error('❌ Download failed:', res.statusText);
      bot._client.write('resource_pack_status', { hash, result: 1 });
      return;
    }
    const fileStream = fs.createWriteStream(outFile);
    await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on('error', reject);
      fileStream.on('finish', resolve);
    });
    console.log('✅ Pack saved to', outFile);
  } else {
    console.log('✅ Pack already exists, skipping download.');
  }

  packIndex[bot._client.socket.server] = { url, hash };
  fs.writeFileSync(PACK_INDEX, JSON.stringify(packIndex, null, 2));

  bot._client.write('resource_pack_status', { hash, result: 0 });
});

  bot.on('end', () => {
    console.log('❌ Disconnected – retrying in 10s\n\n');
    setTimeout(createBot, 10000);
  });
  bot.on('error', err => console.log('⚠️ Error:', err.message));
}

createBot();
