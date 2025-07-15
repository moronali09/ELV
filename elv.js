const { createBot } = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const pvp = require('mineflayer-pvp').plugin
const Vec3 = require('vec3')

const config = {host:'tensionlage.aternos.me',port:63085,username:'ELV',version:'1.21.1',password:'elvmoronby'}

const missions = [
  { type:'goto',position:Vec3(10,65,-5) },
  { type:'collect',item:'oak_log',count:5 },
  { type:'fight',mob:'zombie',count:3 }
]

function getMission() {return missions[Math.floor(Math.random()*missions.length)]}

async function moveTo(bot,pos,timeout=30000){
  bot.pathfinder.setMovements(new Movements(bot))
  const goal=new goals.GoalBlock(pos.x,pos.y,pos.z)
  return new Promise(resolve=>{
    let done=false
    const t=setTimeout(()=>{if(!done){bot.pathfinder.stop();done=true;resolve(false)}},timeout)
    bot.pathfinder.goto(goal,(err)=>{if(done)return;clearTimeout(t);done=true;resolve(!err)})
  })
}

async function collect(bot,item,count){
  let got=0
  while(got<count){
    const b=bot.findBlock({matching:b=>b.name.includes(item),maxDistance:64})
    if(!b){await moveTo(bot,bot.entity.position.offset(5,0,5));continue}
    if(!await moveTo(bot,b.position))break
    await bot.dig(b)
    got++
  }
}

async function fight(bot,mob,count){
  let k=0
  while(k<count){
    const m=bot.nearestEntity(e=>e.name===mob)
    if(!m){await moveTo(bot,bot.entity.position.offset(5,0,5));continue}
    await bot.pvp.attack(m)
    k++
  }
}

async function execute(bot,mission){
  try{
    if(mission.type==='goto')await moveTo(bot,mission.position)
    else if(mission.type==='collect')await collect(bot,mission.item,mission.count)
    else if(mission.type==='fight')await fight(bot,mission.mob,mission.count)
  }catch(e){}
}

function start(){
  const bot=createBot(config)
  bot.loadPlugin(pathfinder);bot.loadPlugin(pvp)
  bot.on('login',()=>console.log('Logged in'))
  bot.on('spawn',async()=>{
    if(config.password)bot.chat(`/login ${config.password}`)
    bot.chat('I am a 24/7 bot, server 24/7 online রাখতে help করতে আসি. Ask me anything.')
    bot.on('chat',(u,m)=>console.log(`[CHAT]<${u}> ${m}`))
    bot.on('death',()=>console.log('Died, respawning'))
    while(true){
      const m=getMission()
      console.log('Mission',m.type)
      bot.chat(`Mission:${m.type}`)
      await execute(bot,m)
    }
  })
  bot.on('error',e=>console.log('Error',e.message))
  bot.on('end',()=>{console.log('Reconnect');setTimeout(start,5000)})
}

start()
