module.exports = {
  name: 'time',
  execute(bot) {
    const time = bot.time.timeOfDay;
    let dayTime = 'Day';
    if (time > 13000) dayTime = 'Night';
    bot.chat(`🕒 ${dayTime} (${Math.floor(time)})`);
  }
};
