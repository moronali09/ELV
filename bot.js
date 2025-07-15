const { createBot } = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const Vec3 = require('vec3');

const config = {host:'tensionlage.aternos.me',port:63085,username:'ELV',version:'1.21.1',password:'elvmoronby'};

const missions = [
  { type: 'goto', position: Vec3(10,65,-5) },
  { type: 'collect', item: 'oak_log', count: 5 },
  { type: 'fight', mob: 'zombie', count: 3 }
];

function getRandomMission() {
  return missions[Math.floor(Math.random()*missions.length)];
}

async function moveTo(bot, position, timeout=30000) {
  bot.pathfinder.setMovements(new Movements(bot));
  const goal = new goals.GoalBlock(position.x,position.y,position.z);
  return new Promise(resolve=>{
    let done=false;
    const timer=setTimeout(()=>{
      if(!done){bot.pathfinder.stop();done=true;resolve(false)}
    },timeout);
    bot.pathfinder.goto(goal,(err)=>{
      if(done) return;
      clearTimeout(timer);
      done=true;
      resolve(!err);
    });
  });
}

async function collectItems(bot,item,count) {
  let gathered=0;
  while(gathered<count) {
    const block=bot.findBlock({matching:b=>b.name.includes(item),maxDistance:64});
    if(!block) {await moveTo(bot,bot.entity.position.offset(5,0,5));continue}
    const ok=await moveTo(bot,block.position);
    if(!ok) continue;
    await bot.dig(block);
    gathered++;
  }
}

async function fightMob(bot,mobName,count) {
  let defeated=0;
  while(defeated<count) {
    const mob=bot.nearestEntity(e=>e.name===mobName);
    if(!mob){await moveTo(bot,bot.entity.position.offset(5,0,5));continue}
    await bot.pvp.attack(mob);
    defeated++;
  }
}

async function executeMission(bot,mission) {
  if(mission.type==='goto') await moveTo(bot,mission.position);
  else if(mission.type==='collect') await collectItems(bot,mission.item,mission.count);
  else if(mission.type==='fight') await fightMob(bot,mission.mob,mission.count);
}

function startBot() {
  const bot=createBot(config);
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);
  bot.on('login',()=>console.log('Logged in'));
  bot.on('spawn',async()=>{
    if(config.password) bot.chat(`/login ${config.password}`);
    bot.on('chat',(u,m)=>console.log(`[CHAT] <${u}> ${m}`));
    bot.on('whisper',(u,m)=>console.log(`[WHISPER] <${u}> ${m}`));
    while(true) {
      const mission=getRandomMission();
      console.log(`New mission: ${mission.type}`);
      bot.chat(`Mission: ${mission.type}`);
      await executeMission(bot,mission);
    }
  });
  bot.on('error',err=>console.log('Error:',err.message));
  bot.on('end',()=>setTimeout(startBot,5000));
}

startBot();
                          
