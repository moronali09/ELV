const mineflayer = require('mineflayer');

function startBot() {
  const bot = mineflayer.createBot({
    host: 'server_ip', // যেমন: 'play.example.com'
    port: 25565,
    username: 'RenderBot'
  });

  bot.on('spawn', () => {
    console.log('✅ Bot spawned');
  });

  bot.on('end', () => {
    console.log('🔄 Reconnecting...');
    setTimeout(startBot, 5000);
  });

  bot.on('error', err => {
    console.log('❌ Bot error:', err);
  });
}

startBot();
