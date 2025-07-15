const { createBot } = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const Vec3 = require('vec3')

const config={host:'tensionlage.aternos.me',port:63085,username:'ELV',version:'1.21.1',password:'elvmoronby'}

function randomPos(pos,r=20){return Vec3(pos.x+(Math.random()-0.5)*r, pos.y, pos.z+(Math.random()-0.5)*r)}

async function moveTo(bot,pos){
  bot.pathfinder.setMovements(new Movements(bot))
  return new Promise(r=>bot.pathfinder.goto(new goals.GoalBlock(pos.x,pos.y,pos.z),e=>r(!e)))
}

function start(){
  const bot=createBot(config)
  bot.loadPlugin(pathfinder)
  let following=false

  bot.on('spawn',()=>{
    if(config.password)bot.chat(`/login ${config.password}`)
    bot.chat('I am 24/7 bot to keep server online. Ask me anything.')
    bot.on('chat',(u,m)=>{
      if(m==='follow me'){following=true;bot.chat('Following')} 
      if(m==='stop'){following=false;bot.chat('Stopped')}
    })
    setInterval(()=>{
      if(!following) moveTo(bot, randomPos(bot.entity.position))
    },30000)
    bot.on('physicsTick',()=>{
      const mob=bot.nearestEntity(e=>e.type==='mob')
      if(mob && bot.entity.position.distanceTo(mob.position)<10){
        const away=bot.entity.position.minus(mob.position)
        moveTo(bot, bot.entity.position.plus(away.normalize().scaled(10)))
      } else if(following){
        const p=bot.players[bot.username]?.entity
        if(p)moveTo(bot,p.position.offset(0,0,0))
      }
    })
  })
  bot.on('error',()=>{})
  bot.on('end',()=>setTimeout(start,5000))
}
start()
