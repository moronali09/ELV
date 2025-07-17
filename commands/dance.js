module.exports = {
  name: 'dance',
  execute(bot) {
    bot.chat('💃 Let's dance!');
    let step = 0;
    const actions = ['forward', 'back', 'left', 'right'];
    const interval = setInterval(() => {
      const act = actions[step % actions.length];
      bot.setControlState(act, true);
      setTimeout(() => bot.setControlState(act, false), 300);
      step++;
      if (step > 16) {
        clearInterval(interval);
        bot.chat('🕺 Done dancing!');
      }
    }, 400);
  }
};
