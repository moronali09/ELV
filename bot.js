const mineflayer = require('mineflayer');
const {
  pathfinder,
  Movements,
  goals: { GoalFollow, GoalBlock }
} = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');

const HOST     = 'EXTRA_ZONE345.aternos.me';
const PORT     = 14137;
const BOT_NAME = 'ELV';
const VERSION  = '1.21.1';
const OWNER    = ['moronali', 'THINZOO'];

let bot;

function createBot() {
  bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: BOT_NAME,
    version: VERSION
  });
  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log(`✅ ${BOT_NAME} joined ${HOST}:${PORT}`);
    const mcData = mcDataLoader(bot.version);
    bot.pathfinder.setMovements(new Movements(bot, mcData));

    startWalking();
    setupSignatures();
    startFoodRoutine();
    startSleepRoutine();
  });

  bot.on('playerJoined', p =>
    p.username !== BOT_NAME && console.log(`🟢 Join: ${p.username}`)
  );
  bot.on('playerLeft', p =>
    p.username !== BOT_NAME && console.log(`🔴 Leave: ${p.username}`)
  );

  bot.on('death', () => {
    bot.chat('✖ I died! Respawning...');
    setTimeout(() => bot.spawn(), 2000);
  });

  bot.on('end', ()   => setTimeout(createBot, 10000));
  bot.on('error', () => setTimeout(createBot, 10000));
}

//
// Random walk
//
function startWalking() {
  const dirs = ['forward','back','left','right'];
  let cur = null;
  setInterval(() => {
    if (!bot.entity) return;
    if (cur) bot.setControlState(cur, false);
    cur = dirs[Math.floor(Math.random()*dirs.length)];
    bot.setControlState(cur, true);
    setTimeout(() => bot.setControlState(cur, false), 2000);
  }, 4000);
}

//
// Signature messages
//
function setupSignatures() {
  setInterval(() => bot.chat('🤖 does a little robot dance 🤖'), 5*60*1000);
  setInterval(() => {
    const p = bot.entity.position;
    bot.chat(`Status ▶️ HP:${bot.health.toFixed(1)} ‣ X:${p.x.toFixed(0)} Y:${p.y.toFixed(0)} Z:${p.z.toFixed(0)}`);
  }, 10*60*1000);
  setInterval(() => bot.chat('⚙️ Reminder: I am a bot, not a player!'), 60*60*1000);
  const emojis = ['🤖','🛠️','💬','⚙️','🔧'];
  bot.on('chat', (u,msg) => {
    if (msg.includes(BOT_NAME)) {
      bot.chat(emojis.sort(()=>0.5-Math.random()).slice(0,3).join(''));
    }
  });
}

//
// Food routine: every 2m
//
function startFoodRoutine() {
  const FOOD = ['cooked_beef','cooked_porkchop','bread','apple'];
  async function run() {
    if (!bot.entity) return;
    const stack = bot.inventory.items().find(i => FOOD.includes(i.name));
    if (!stack) return;
    const me = bot.entity.position;
    for (const owner of OWNER) {
      const e = bot.players[owner]?.entity;
      if (e && me.distanceTo(e.position) <= 5) {
        await bot.equip(stack, 'hand');
        bot.chat('🍗 Here you go!');
        bot.tossStack(stack);
        return;
      }
    }
    const chest = bot.findBlock(b => b.name.includes('chest'), { maxDistance:20 });
    if (!chest) return bot.chat('🔍 No chest to store food.');
    try {
      const c = await bot.openChest(chest);
      await c.deposit(stack.type, null, stack.count);
      c.close();
      bot.chat('📦 Stored food.');
    } catch(e) {
      bot.chat('❌ Store failed: '+e.message);
    }
  }
  run();
  setInterval(run, 2*60*1000);
}

//
// Sleep routine: every 5m
//
function startSleepRoutine() {
  const { goals } = require('mineflayer-pathfinder');
  async function run() {
    if (!bot.entity) return;
    const hour = (new Date().getUTCHours()+6)%24;
    if (!(hour>=19||hour<6)) return;
    let bed = bot.inventory.items().find(i=>i.name.endsWith('_bed'));
    if (!bed) {
      const chest = bot.findBlock(b=>b.name.includes('chest'), { maxDistance:20 });
      if (chest) {
        const c = await bot.openChest(chest);
        const slot = c.containerItems().find(i=>i.name.endsWith('_bed'));
        if (slot) {
          await c.withdraw(slot.type,null,1);
          bed = bot.inventory.items().find(i=>i.name.endsWith('_bed'));
        }
        c.close();
      }
    }
    if (bed) {
      bot.chat('🛏️ Placing bed to sleep...');
      try {
        await bot.placeBlock(bed, bot.entity.position.floored().offset(1,0,0));
        bot.chat('😴 Goodnight!');
      } catch(e) {
        bot.chat('❌ Bed place error: '+e.message);
      }
    } else {
      bot.chat('🔍 No bed—going home.');
      try {
        bot.clearControlStates();
        bot.pathfinder.setGoal(null);
        await bot.pathfinder.goto(
          new goals.GoalBlock(bot.spawnPoint.x, bot.spawnPoint.y, bot.spawnPoint.z)
        );
        bot.chat('🏡 At home, but no bed.');
      } catch {}
    }
  }
  run();
  setInterval(run, 5*60*1000);
}

createBot();
