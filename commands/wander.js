module.exports = {
  name: 'wander',
  execute(bot) {
    const directions = ['forward', 'back', 'left', 'right'];
    let moving = false;
    bot.chat('🚶‍♂️ Wander mode ON');

    const interval = setInterval(() => {
      if (!bot.entity || !bot.controlState) return;
      if (moving) bot.clearControlStates();

      const move = directions[Math.floor(Math.random() * directions.length)];
      bot.setControlState(move, true);
      moving = true;

      setTimeout(() => {
        bot.setControlState(move, false);
        moving = false;
      }, 2000);
    }, 4000);

    bot.on('chat', (username, message) => {
      if (message.toLowerCase() === 'stop') {
        clearInterval(interval);
        bot.clearControlStates();
        bot.chat('🛑 Wander mode OFF');
      }
    });
  }
};
