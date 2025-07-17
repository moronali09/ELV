module.exports = {
  name: 'rps',
  execute(bot, user, args) {
    const choices = ['rock', 'paper', 'scissors'];
    const userChoice = args[0];
    if (!choices.includes(userChoice)) return bot.chat('Use: /rps <rock|paper|scissors>');
    const botChoice = choices[Math.floor(Math.random() * 3)];
    const win = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    let outcome;
    if (userChoice === botChoice) outcome = 'Draw';
    else if (win[userChoice] === botChoice) outcome = 'You win';
    else outcome = 'You lose';
    bot.chat(`✊ You: ${userChoice} | 🤖 Bot: ${botChoice} => ${outcome}`);
  }
};
