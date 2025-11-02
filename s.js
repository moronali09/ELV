const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const collectBlock = require('mineflayer-collectblock').plugin;
const autoeat = require('mineflayer-auto-eat').plugin;

let bot;

function createBot() {
    bot = mineflayer.createBot({
        host: 'localhost', // আপনার সার্ভার আইপি দিন
        port: 25565, // আপনার সার্ভার পোর্ট দিন
        username: 'cleanerbot', // বটের ইউজারনেম
        // password: 'password', // যদি প্রয়োজন হয়
        auth: 'offline' // offline/online/mojang
    });

    // প্লাগিন লোড করুন
    bot.loadPlugin(pathfinder);
    bot.loadPlugin(collectBlock);
    bot.loadPlugin(autoeat);

    // ইভেন্ট হ্যান্ডলার
    bot.on('login', () => {
        console.log('বট সার্ভারে লগইন করেছে!');
        
        // রেজিস্টার এবং লগইন কমান্ড
        setTimeout(() => {
            bot.chat('/register cleanerbot cleanerbot');
            console.log('রেজিস্টার কমান্ড দেয়া হয়েছে');
        }, 1000);

        setTimeout(() => {
            bot.chat('/login cleanerbot');
            console.log('লগইন কমান্ড দেয়া হয়েছে');
        }, 3000);
    });

    bot.on('spawn', () => {
        console.log('বট স্পন হয়েছে!');
        
        // অটো ইটিং সেটআপ
        bot.autoEat.options = {
            priority: 'foodPoints',
            startAt: 14,
            bannedFood: []
        };

        // আইটেম কালেকশন শুরু করুন
        startItemCollection();
    });

    bot.on('playerCollect', (collector, itemDrop) => {
        if (collector !== bot.entity) return;
        console.log(`আইটেম কালেক্ট করা হয়েছে: ${itemDrop.name}`);
    });

    // প্লেয়ার ডিটেক্ট করলে
    bot.on('entitySpawn', (entity) => {
        if (entity.type === 'player' && entity.username !== bot.username) {
            console.log(`প্লেয়ার ডিটেক্ট হয়েছে: ${entity.username}`);
            handlePlayerDetection(entity);
        }
    });

    // ক্ষুধা কমলে অটোমেটিক খাবে
    bot.on('health', () => {
        if (bot.food < 18) {
            console.log('ক্ষুধা কম, খাবার খাওয়া হচ্ছে...');
        }
    });

    // ডিসকানেক্ট ইভেন্ট
    bot.on('end', (reason) => {
        console.log(`ডিসকানেক্ট হয়েছে: ${reason}`);
        console.log('5 সেকেন্ড পরে আবার কানেক্ট করার চেষ্টা করছে...');
        setTimeout(createBot, 5000);
    });

    bot.on('error', (err) => {
        console.log('এরর:', err.message);
    });

    // চ্যাট মেসেজ লগ করবে না
    bot.on('message', (message) => {
        // কোনো চ্যাট দেখাবে না
    });

    // অটো ইটিং ইভেন্ট
    bot.on('autoeat_started', () => {
        console.log('খাবার খাওয়া শুরু...');
    });

    bot.on('autoeat_finished', () => {
        console.log('খাবার খাওয়া শেষ!');
    });
}

function startItemCollection() {
    // প্রতি 2 সেকেন্ডে নিকটবর্তী আইটেম খুঁজবে
    setInterval(() => {
        if (bot.pathfinder.isMoving()) return;

        const item = bot.nearestEntity(entity => 
            entity.type === 'item' && 
            bot.entity.position.distanceTo(entity.position) < 10
        );

        if (item) {
            collectItem(item);
        }
    }, 2000);
}

function collectItem(item) {
    const mcData = require('minecraft-data')(bot.version);
    const movements = new require('mineflayer-pathfinder').Movements(bot, mcData);
    
    bot.pathfinder.setMovements(movements);
    bot.pathfinder.setGoal(new require('mineflayer-pathfinder').goals.GoalNear(
        item.position.x, 
        item.position.y, 
        item.position.z, 
        1
    ));
}

function handlePlayerDetection(player) {
    if (bot.pathfinder.isMoving()) return;

    const mcData = require('minecraft-data')(bot.version);
    const movements = new require('mineflayer-pathfinder').Movements(bot, mcData);
    
    // প্লেয়ারের কাছে যাওয়া
    bot.pathfinder.setMovements(movements);
    bot.pathfinder.setGoal(new require('mineflayer-pathfinder').goals.GoalNear(
        player.position.x, 
        player.position.y, 
        player.position.z, 
        2
    ));

    // যখন প্লেয়ারের কাছাকাছি পৌঁছাবে
    const checkDistance = setInterval(() => {
        const distance = bot.entity.position.distanceTo(player.position);
        
        if (distance <= 3) {
            clearInterval(checkDistance);
            dropAllItems();
        }
        
        if (distance > 15) {
            clearInterval(checkDistance);
        }
    }, 1000);
}

function dropAllItems() {
    console.log('সব আইটেম ফেলা হচ্ছে...');
    
    const inventory = bot.inventory;
    let itemsDropped = 0;

    for (let slot = 0; slot < inventory.inventory.length; slot++) {
        const item = inventory.inventory[slot];
        
        if (item && item.name !== 'air') {
            // হাতের আইটেম না ফেলতে চাইলে (যেমন: খাবার, টুলস)
            if (shouldKeepItem(item)) continue;
            
            bot.tossStack(item, (err) => {
                if (err) {
                    console.log('আইটেম ফেলতে সমস্যা:', err.message);
                } else {
                    itemsDropped++;
                    console.log(`ফেলা হয়েছে: ${item.name} x${item.count}`);
                }
            });
        }
    }
    
    setTimeout(() => {
        console.log(`মোট ${itemsDropped} টি আইটেম ফেলা হয়েছে`);
    }, 2000);
}

function shouldKeepItem(item) {
    // কিছু আইটেম রাখতে চাইলে (যেমন: খাবার, জরুরি টুলস)
    const keepItems = [
        'bread', 'apple', 'cooked_beef', 'cooked_chicken', 
        'cooked_porkchop', 'golden_apple', 'cake'
    ];
    
    return keepItems.includes(item.name);
}

// বট শুরু করুন
createBot();
