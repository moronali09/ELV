const express      = require('express');
const http         = require('http');
const socketIo     = require('socket.io');

const mineflayer   = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');
const logger       = require('./logger');

const app    = express();
const server = http.createServer(app);
const io     = socketIo(server);

app.use(express.static('public'));
server.listen(3000, () => {
  console.log('⚡ Dashboard: http://localhost:3000/web.html');
});

const HOST     = 'shadow_elites.ignorelist.com';
const PORT     = 25604;
const BOT_NAME = 'ELV';
const VERSION  = '1.21.1';
const OWNER    = 'moronali';
const PASSWORD = 'elvmoronby';

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
  bot.on('message', (jsonMsg) => {
  const msg = jsonMsg.toString();
  if (msg.toLowerCase().includes('ban')) {
    console.log(`[BAN MSG] ${msg}`);
  } else if (msg.toLowerCase().includes('kick')) {
    console.log(`[KICK MSG] ${msg}`);
  } else if (msg.toLowerCase().includes('banlist')) {
    console.log(`[BANLIST MSG] ${msg}`);
  }
});

  bot.on('end', () => {
    console.log('❌ Disconnected – retrying in 10s\n\n');
    setTimeout(createBot, 10000);
  });
  bot.on('error', err => console.log('⚠️ Error:', err.message));
}

createBot();
