module.exports = {
  name: 'deo',
  execute(bot, username) {
    const player = bot.players[username]?.entity;
    if (!player) return bot.chat("Can't see you!");
    bot.chat(`🎒 Giving all items to ${username}...`);

    const items = bot.inventory.items();
    let index = 0;

    function tossNext() {
      if (index >= items.length) {
        bot.chat('✅ All items given.');
        return;
      }

      const item = items[index++];
      bot.tossStack(item, err => {
        if (err) bot.chat(`❌ Couldn't give ${item.name}`);
        setTimeout(tossNext, 300);
      });
    }

    tossNext();
  }
};
