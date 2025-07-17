module.exports = {
  name: '',
  execute(bot) {
    const time = bot.time.timeOfDay; // 0-24000
    let dayTime = 'Day';
    if (time > 13000) dayTime = 'Night';
    bot.chat(`🕒 ${dayTime} (${Math.floor(time)})`);
  }
};
