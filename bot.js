// // modify this code:
// // - let user can set alarm for ten times(less then time not just two for morning and evening as you see in this code)
// // - user can set by their own alarm but no less then 10 alarm
// // - when the alarm activate set time for user response if the did not response for 1 hour which mean alarm cancel 
// // - when the alarm activate let user cl
// // - want to convert this from using pulling request to using webhook and tell host in railway 
// // - convert this using telegraf


// require('dotenv').config();
// const TelegramBot = require('node-telegram-bot-api');
// const schedule = require('node-schedule');
// const mongoose = require('mongoose');

// // Connect to MongoDB (replace with your connection string)
// mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/telegram_bot', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
// });

// // User schema
// const userSchema = new mongoose.Schema({
//   chatId: { type: Number, required: true, unique: true },
//   morningTime: { type: String, default: '11:30' },
//   eveningTime: { type: String, default: '20:00' },
//   morningJobName: String,
//   eveningJobName: String,
//   pendingMorning: { type: Boolean, default: false },
//   pendingEvening: { type: Boolean, default: false },
//   streak: { type: Number, default: 0 },
//   lastActive: Date
// });

// const User = mongoose.model('User', userSchema);

// // Load token from .env file
// const token = process.env.TELEGRAM_BOT_TOKEN;
// const bot = new TelegramBot(token, { polling: true });

// // Store active jobs
// const activeJobs = {};

// // Log bot info
// bot.getMe().then((me) => {
//   console.log(`Bot ${me.username} is running...`);
// });

// // Cancel and reschedule jobs for a user
// async function scheduleUserJobs(chatId) {
//   const user = await User.findOne({ chatId });
//   if (!user) return;

//   // Cancel existing jobs
//   if (user.morningJobName && activeJobs[user.morningJobName]) {
//     activeJobs[user.morningJobName].cancel();
//     delete activeJobs[user.morningJobName];
//   }
//   if (user.eveningJobName && activeJobs[user.eveningJobName]) {
//     activeJobs[user.eveningJobName].cancel();
//     delete activeJobs[user.eveningJobName];
//   }

//   // Schedule morning message
//   const [morningHour, morningMinute] = user.morningTime.split(':').map(Number);
//   const morningJobName = `morning_${chatId}`;
//   activeJobs[morningJobName] = schedule.scheduleJob(
//     { hour: morningHour, minute: morningMinute, tz: 'Asia/Phnom_Penh' },
//     async () => {
//       await sendScheduledMessage(chatId, 'morning');
//     }
//   );

//   // Schedule evening message
//   const [eveningHour, eveningMinute] = user.eveningTime.split(':').map(Number);
//   const eveningJobName = `evening_${chatId}`;
//   activeJobs[eveningJobName] = schedule.scheduleJob(
//     { hour: eveningHour, minute: eveningMinute, tz: 'Asia/Phnom_Penh' },
//     async () => {
//       await sendScheduledMessage(chatId, 'evening');
//     }
//   );

//   // Update user with job names
//   user.morningJobName = morningJobName;
//   user.eveningJobName = eveningJobName;
//   await user.save();
// }

// async function sendScheduledMessage(chatId, timeOfDay) {
//   const user = await User.findOne({ chatId });
//   if (!user) return;

//   const message = timeOfDay === 'morning' 
//     ? `🌞 Good morning! It's time for your morning routine! Reply "OK" when done.` 
//     : `🌙 Good evening! Time for your evening reflection. Reply "OK" when done.`;

//   const options = {
//     reply_markup: {
//       inline_keyboard: [
//         [{ text: "I did it!", callback_data: `ack_${timeOfDay}` }],
//         [{ text: "Skip today", callback_data: `skip_${timeOfDay}` }]
//       ]
//     }
//   };

//   await bot.sendMessage(chatId, message, options);
  
//   // Mark as pending
//   if (timeOfDay === 'morning') {
//     user.pendingMorning = true;
//   } else {
//     user.pendingEvening = true;
//   }
//   await user.save();

//   // Set timeout to check if user responded (e.g., 6 hours)
//   setTimeout(async () => {
//     const updatedUser = await User.findOne({ chatId });
//     if (!updatedUser) return;

//     if ((timeOfDay === 'morning' && updatedUser.pendingMorning) || 
//         (timeOfDay === 'evening' && updatedUser.pendingEvening)) {
//       await bot.sendMessage(chatId, `⚠️ You missed your ${timeOfDay} activity. Your streak has been reset.`);
//       updatedUser.streak = 0;
//       if (timeOfDay === 'morning') {
//         updatedUser.pendingMorning = false;
//       } else {
//         updatedUser.pendingEvening = false;
//       }
//       await updatedUser.save();
//     }
//   }, 6 * 60 * 60 * 1000); // 6 hours
// }

// // Handle /start command
// bot.onText(/\/start/, async (msg) => {
//   const chatId = msg.chat.id;
//   let user = await User.findOne({ chatId });

//   if (!user) {
//     user = new User({ chatId });
//     await user.save();
//     await scheduleUserJobs(chatId);
//   }

//   const options = {
//     reply_markup: {
//       keyboard: [
//         [{ text: "⏰ Set Morning Time" }, { text: "🌙 Set Evening Time" }],
//         [{ text: "📊 My Stats" }, { text: "❌ Unsubscribe" }]
//       ],
//       resize_keyboard: true
//     }
//   };

//   await bot.sendMessage(chatId, `Welcome back! Here are your options:`, options);
// });

// // Handle time setting
// bot.onText(/Set (Morning|Evening) Time/, async (msg, match) => {
//   const chatId = msg.chat.id;
//   const timeOfDay = match[1].toLowerCase();
  
//   await bot.sendMessage(chatId, `Please enter your ${timeOfDay} time in 24-hour format (HH:MM), Cambodia timezone.\nExample: ${timeOfDay === 'morning' ? '07:30' : '20:00'}`);
  
//   // Store that we're expecting a time input
//   // In a real implementation, you'd use conversation handlers or state management
// });

// // Handle time input
// bot.on('message', async (msg) => {
//   if (!msg.text) return;
  
//   const chatId = msg.chat.id;
//   const text = msg.text;
  
//   // Check if it's a time input (HH:MM format)
//   if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(text)) {
//     const user = await User.findOne({ chatId });
//     if (!user) return;
    
//     // Determine if we're setting morning or evening time based on previous message
//     // In a real app, you'd track this state properly
//     const isMorning = text.split(':')[0] < 12;
    
//     if (isMorning) {
//       user.morningTime = text;
//     } else {
//       user.eveningTime = text;
//     }
    
//     await user.save();
//     await scheduleUserJobs(chatId);
//     await bot.sendMessage(chatId, `${isMorning ? 'Morning' : 'Evening'} time set to ${text}!`);
//   }
// });

// // Handle callback queries (button presses)
// bot.on('callback_query', async (callbackQuery) => {
//   const chatId = callbackQuery.message.chat.id;
//   const data = callbackQuery.data;
//   const user = await User.findOne({ chatId });
  
//   if (!user) return;
  
//   if (data.startsWith('ack_')) {
//     const timeOfDay = data.split('_')[1];
    
//     if (timeOfDay === 'morning') {
//       user.pendingMorning = false;
//     } else {
//       user.pendingEvening = false;
//     }
    
//     user.streak += 1;
//     user.lastActive = new Date();
//     await user.save();
    
//     await bot.answerCallbackQuery(callbackQuery.id, { text: `Great job! ${user.streak} day streak!` });
//     await bot.editMessageReplyMarkup(
//       { inline_keyboard: [] },
//       { chat_id: chatId, message_id: callbackQuery.message.message_id }
//     );
//   } else if (data.startsWith('skip_')) {
//     const timeOfDay = data.split('_')[1];
    
//     if (timeOfDay === 'morning') {
//       user.pendingMorning = false;
//     } else {
//       user.pendingEvening = false;
//     }
    
//     await user.save();
    
//     await bot.answerCallbackQuery(callbackQuery.id, { text: "Okay, skipped for today." });
//     await bot.editMessageReplyMarkup(
//       { inline_keyboard: [] },
//       { chat_id: chatId, message_id: callbackQuery.message.message_id }
//     );
//   }
// });

// // Handle stats command
// bot.onText(/My Stats/, async (msg) => {
//   const chatId = msg.chat.id;
//   const user = await User.findOne({ chatId });
  
//   if (!user) return;
  
//   const statsMessage = `
// 📊 Your Stats:
// - Current Streak: ${user.streak} days
// - Morning Time: ${user.morningTime}
// - Evening Time: ${user.eveningTime}
// - Last Active: ${user.lastActive ? user.lastActive.toLocaleString() : 'Never'}
//   `;
  
//   await bot.sendMessage(chatId, statsMessage);
// });

// // Handle unsubscribe
// bot.onText(/Unsubscribe/, async (msg) => {
//   const chatId = msg.chat.id;
//   const user = await User.findOne({ chatId });
  
//   if (!user) return;
  
//   // Cancel jobs
//   if (user.morningJobName && activeJobs[user.morningJobName]) {
//     activeJobs[user.morningJobName].cancel();
//     delete activeJobs[user.morningJobName];
//   }
//   if (user.eveningJobName && activeJobs[user.eveningJobName]) {
//     activeJobs[user.eveningJobName].cancel();
//     delete activeJobs[user.eveningJobName];
//   }
  
//   await User.deleteOne({ chatId });
//   await bot.sendMessage(chatId, "You've been unsubscribed from all messages. Use /start to subscribe again.");
// });

// // Error handling
// bot.on('polling_error', (error) => {
//   console.log(error);
// });

// console.log('Bot is running...');








require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const schedule = require('node-schedule');
const mongoose = require('mongoose');

const app = express();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  morningTime: { type: String, default: '11:30' },
  eveningTime: { type: String, default: '20:00' },
  morningJobName: String,
  eveningJobName: String,
  pendingMorning: { type: Boolean, default: false },
  pendingEvening: { type: Boolean, default: false },
  streak: { type: Number, default: 0 },
  lastActive: Date,
});

const User = mongoose.model('User', userSchema);
const activeJobs = {};

// Middleware
bot.use(async (ctx, next) => {
  console.log(`Received update from chat ${ctx.chat.id}:`, JSON.stringify(ctx.update, null, 2));
  ctx.user = await User.findOneAndUpdate(
    { chatId: ctx.chat.id },
    { $set: { lastActive: new Date() } },
    { upsert: true, new: true }
  );
  return next();
});

// Scheduled jobs handling
async function scheduleUserJobs(chatId) {
  const user = await User.findOne({ chatId });
  if (!user) {
    console.log(`No user found for chatId: ${chatId}`);
    return;
  }

  // Cancel existing jobs
  [user.morningJobName, user.eveningJobName].forEach((jobName) => {
    if (jobName && activeJobs[jobName]) {
      activeJobs[jobName].cancel();
      delete activeJobs[jobName];
    }
  });

  // Schedule morning message
  const [mHour, mMin] = user.morningTime.split(':').map(Number);
  const morningJob = schedule.scheduleJob(
    { hour: mHour, minute: mMin, tz: 'Asia/Phnom_Penh' },
    () => sendScheduledMessage(chatId, 'morning')
  );

  // Schedule evening message
  const [eHour, eMin] = user.eveningTime.split(':').map(Number);
  const eveningJob = schedule.scheduleJob(
    { hour: eHour, minute: eMin, tz: 'Asia/Phnom_Penh' },
    () => sendScheduledMessage(chatId, 'evening')
  );

  // Update user with job names
  user.morningJobName = `morning_${chatId}`;
  user.eveningJobName = `evening_${chatId}`;
  activeJobs[user.morningJobName] = morningJob;
  activeJobs[user.eveningJobName] = eveningJob;
  await user.save();
  console.log(`Scheduled jobs for chatId ${chatId}: morning at ${user.morningTime}, evening at ${user.eveningTime}`);
}

async function sendScheduledMessage(chatId, timeOfDay) {
  const user = await User.findOne({ chatId });
  if (!user) {
    console.log(`No user found for scheduled message, chatId: ${chatId}`);
    return;
  }

  const message =
    timeOfDay === 'morning'
      ? '🌞 Good morning! Time for your morning routine!'
      : '🌙 Good evening! Time for your reflection.';

  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback('I did it!', `ack_${timeOfDay}`),
    Markup.button.callback('Skip today', `skip_${timeOfDay}`),
  ]);

  try {
    await bot.telegram.sendMessage(chatId, message, keyboard);
    console.log(`Sent ${timeOfDay} message to chatId ${chatId}`);
    user[`pending${timeOfDay[0].toUpperCase() + timeOfDay.slice(1)}`] = true;
    await user.save();
  } catch (err) {
    console.error(`Failed to send ${timeOfDay} message to chatId ${chatId}:`, err);
  }

  // Set timeout for missed activity
  setTimeout(async () => {
    const updatedUser = await User.findOne({ chatId });
    if (updatedUser?.[`pending${timeOfDay[0].toUpperCase() + timeOfDay.slice(1)}`]) {
      try {
        await bot.telegram.sendMessage(
          chatId,
          `⚠️ Missed ${timeOfDay} activity! Streak reset.`
        );
        updatedUser.streak = 0;
        updatedUser[`pending${timeOfDay[0].toUpperCase() + timeOfDay.slice(1)}`] = false;
        await updatedUser.save();
        console.log(`Reset streak for chatId ${chatId} due to missed ${timeOfDay} activity`);
      } catch (err) {
        console.error(`Failed to send missed activity message to chatId ${chatId}:`, err);
      }
    }
  }, 6 * 60 * 60 * 1000);
}

// Commands
bot.command('start', async (ctx) => {
  console.log(`Received /start command from chatId ${ctx.chat.id}`);
  await scheduleUserJobs(ctx.chat.id);
  const keyboard = Markup.keyboard([
    ['⏰ Set Morning Time', '🌙 Set Evening Time'],
    ['📊 My Stats', '❌ Unsubscribe'],
  ]).resize();

  try {
    await ctx.reply('Welcome! Manage your routines:', keyboard);
    console.log(`Sent welcome message to chatId ${ctx.chat.id}`);
  } catch (err) {
    console.error(`Failed to send welcome message to chatId ${ctx.chat.id}:`, err);
  }
});

bot.hears(/Set (Morning|Evening) Time/, async (ctx) => {
  const timeOfDay = ctx.match[1].toLowerCase();
  console.log(`Received set ${timeOfDay} time request from chatId ${ctx.chat.id}`);
  try {
    await ctx.reply(
      `Enter ${timeOfDay} time in 24h format (HH:MM)\nExample: ${timeOfDay === 'morning' ? '07:30' : '20:00'}`
    );
  } catch (err) {
    console.error(`Failed to send time prompt to chatId ${ctx.chat.id}:`, err);
  }
});

bot.hears(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, async (ctx) => {
  const time = ctx.message.text;
  const isMorning = parseInt(time.split(':')[0]) < 12;
  const field = isMorning ? 'morningTime' : 'eveningTime';
  console.log(`Received time input ${time} for ${field} from chatId ${ctx.chat.id}`);

  ctx.user[field] = time;
  await ctx.user.save();
  await scheduleUserJobs(ctx.chat.id);

  try {
    await ctx.reply(`${isMorning ? 'Morning' : 'Evening guerrilla bot'} time set to ${time}!`);
    console.log(`Set ${field} to ${time} for chatId ${ctx.chat.id}`);
  } catch (err) {
    console.error(`Failed to confirm time setting for chatId ${ctx.chat.id}:`, err);
  }
});

bot.hears('📊 My Stats', async (ctx) => {
  console.log(`Received stats request from chatId ${ctx.chat.id}`);
  const stats = `
📊 Your Stats:
- Streak: ${ctx.user.streak} days
- Morning: ${ctx.user.morningTime}
- Evening: ${ctx.user.eveningTime}
- Last Active: ${ctx.user.lastActive.toLocaleString()}
  `;
  try {
    await ctx.reply(stats);
    console.log(`Sent stats to chatId ${ctx.chat.id}`);
  } catch (err) {
    console.error(`Failed to send stats to chatId ${ctx.chat.id}:`, err);
  }
});

bot.hears('❌ Unsubscribe', async (ctx) => {
  console.log(`Received unsubscribe request from chatId ${ctx.chat.id}`);
  [ctx.user.morningJobName, ctx.user.eveningJobName].forEach((jobName) => {
    if (activeJobs[jobName]) {
      activeJobs[jobName].cancel();
      delete activeJobs[jobName];
    }
  });

  try {
    await User.deleteOne({ _id: ctx.user._id });
    await ctx.reply('Unsubscribed! Use /start to resubscribe.');
    console.log(`Unsubscribed chatId ${ctx.chat.id}`);
  } catch (err) {
    console.error(`Failed to unsubscribe chatId ${ctx.chat.id}:`, err);
  }
});

// Callbacks
bot.action(/ack_(morning|evening)/, async (ctx) => {
  const timeOfDay = ctx.match[1];
  console.log(`Received ${timeOfDay} acknowledgment from chatId ${ctx.chat.id}`);
  ctx.user[`pending${timeOfDay[0].toUpperCase() + timeOfDay.slice(1)}`] = false;
  ctx.user.streak += 1;
  await ctx.user.save();

  try {
    await ctx.answerCbQuery(`Great job! ${ctx.user.streak} day streak!`);
    await ctx.deleteMessage();
    console.log(`Processed ${timeOfDay} acknowledgment for chatId ${ctx.chat.id}`);
  } catch (err) {
    console.error(`Failed to process ${timeOfDay} acknowledgment for chatId ${ctx.chat.id}:`, err);
  }
});

bot.action(/skip_(morning|evening)/, async (ctx) => {
  const timeOfDay = ctx.match[1];
  console.log(`Received ${timeOfDay} skip request from chatId ${ctx.chat.id}`);
  ctx.user[`pending${timeOfDay[0].toUpperCase() + timeOfDay.slice(1)}`] = false;
  await ctx.user.save();

  try {
    await ctx.answerCbQuery('Okay, skipped for today.');
    await ctx.deleteMessage();
    console.log(`Processed ${timeOfDay} skip for chatId ${ctx.chat.id}`);
  } catch (err) {
    console.error(`Failed to process ${timeOfDay} skip for chatId ${ctx.chat.id}:`, err);
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error(`Bot error for chatId ${ctx?.chat?.id || 'unknown'}:`, err);
});

// Webhook setup
app.use(express.json());
app.post('/webhook', bot.webhookCallback('/webhook'));
app.get('/', (req, res) => res.send('Bot is running'));

// Set webhook explicitly
async function setWebhook() {
  const webhookUrl = `${process.env.WEBHOOK_URL}/webhook`;
  try {
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`Webhook set to ${webhookUrl}`);
    const webhookInfo = await bot.telegram.getWebhookInfo();
    console.log('Webhook info:', JSON.stringify(webhookInfo, null, 2));
  } catch (err) {
    console.error('Failed to set webhook:', err);
  }
}

// Start server
const PORT = 3007; // Use Render's PORT or fallback to 3000
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await setWebhook();
  bot.launch({ webhook: { domain: process.env.WEBHOOK_URL, path: '/webhook' } })
    .then(() => console.log('Bot started via webhook'))
    .catch((err) => console.error('Bot launch error:', err));
});








// // require('dotenv').config();
// // const TelegramBot = require('node-telegram-bot-api');
// // const schedule = require('node-schedule');
// // const mongoose = require('mongoose');
// // const express = require('express');
// // const bodyParser = require('body-parser');

// // // Initialize Express app
// // const app = express();
// // app.use(bodyParser.json());

// // // Connect to MongoDB with error handling
// // mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://ChoengRayu:C9r6nhxOVLCUkkGd@cluster0.2ott03t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
// //   useNewUrlParser: true,
// //   useUnifiedTopology: true,
// // }).then(() => {
// //   console.log('MongoDB connected successfully');
// // }).catch(err => {
// //   console.error('MongoDB connection error:', err);
// //   process.exit(1);
// // });

// // // User schema
// // const userSchema = new mongoose.Schema({
// //   chatId: { type: Number, required: true, unique: true },
// //   alarms: [{
// //     time: String,
// //     jobName: String,
// //     pending: { type: Boolean, default: false }
// //   }],
// //   streak: { type: Number, default: 0 },
// //   lastActive: Date
// // });
// // const User = mongoose.model('User', userSchema);

// // // Initialize bot with webhook mode
// // const token = process.env.TELEGRAM_BOT_TOKEN;
// // if (!token) {
// //   console.error('TELEGRAM_BOT_TOKEN is not set');
// //   process.exit(1);
// // }
// // const bot = new TelegramBot(token, { polling: false });

// // // Webhook endpoint
// // app.post('/webhook', (req, res) => {
// //   bot.processUpdate(req.body);
// //   res.sendStatus(200);
// // });

// // // Store active jobs
// // const activeJobs = {};

// // // Start server and set webhook
// // const PORT = process.env.PORT;
// // app.listen(PORT, async () => {
// //   console.log(`Server running on port ${PORT}`);
  
// //   const webhookUrl = `${process.env.WEBHOOK_URL || 'https://alarmbot-1h93.onrender.com'}/webhook`;
// //   try {
// //     await bot.setWebHook(webhookUrl);
// //     console.log('Webhook set successfully to', webhookUrl);
// //   } catch (err) {
// //     console.error('Error setting webhook:', err);
// //   }
// // });

// // // Schedule all alarms for a user
// // async function scheduleUserAlarms(chatId) {
// //   try {
// //     const user = await User.findOne({ chatId });
// //     if (!user) return;

// //     user.alarms.forEach(alarm => {
// //       if (alarm.jobName && activeJobs[alarm.jobName]) {
// //         activeJobs[alarm.jobName].cancel();
// //         delete activeJobs[alarm.jobName];
// //       }
// //     });

// //     user.alarms.forEach((alarm, index) => {
// //       const [hour, minute] = alarm.time.split(':').map(Number);
// //       const jobName = `alarm_${chatId}_${index}`;
// //       activeJobs[jobName] = schedule.scheduleJob(
// //         { hour, minute, tz: 'Asia/Phnom_Penh' },
// //         async () => await sendAlarmMessage(chatId, index)
// //       );
// //       alarm.jobName = jobName;
// //     });

// //     await user.save();
// //   } catch (err) {
// //     console.error('Error scheduling alarms:', err);
// //   }
// // }

// // // Send alarm message with 1-hour timeout
// // async function sendAlarmMessage(chatId, alarmIndex) {
// //   try {
// //     const user = await User.findOne({ chatId });
// //     if (!user || alarmIndex >= user.alarms.length) return;

// //     const alarm = user.alarms[alarmIndex];
// //     const message = `🔔 Alarm at ${alarm.time}! Reply "OK" when done.`;
// //     const options = {
// //       reply_markup: {
// //         inline_keyboard: [
// //           [{ text: "I did it!", callback_data: `ack_${alarmIndex}` }],
// //           [{ text: "Skip", callback_data: `skip_${alarmIndex}` }]
// //         ]
// //       }
// //     };

// //     await bot.sendMessage(chatId, message, options);
// //     alarm.pending = true;
// //     await user.save();

// //     setTimeout(async () => {
// //       const updatedUser = await User.findOne({ chatId });
// //       if (!updatedUser || alarmIndex >= updatedUser.alarms.length) return;
// //       const updatedAlarm = updatedUser.alarms[alarmIndex];
// //       if (updatedAlarm.pending) {
// //         await bot.sendMessage(chatId, `⚠️ You missed your alarm at ${updatedAlarm.time}. Streak reset!`);
// //         updatedUser.streak = 0;
// //         updatedAlarm.pending = false;
// //         await updatedUser.save();
// //       }
// //     }, 60 * 60 * 1000); // 1 hour
// //   } catch (err) {
// //     console.error('Error sending alarm message:', err);
// //   }
// // }

// // // Handle /start command
// // bot.onText(/\/start/, async (msg) => {
// //   const chatId = msg.chat.id;
// //   try {
// //     let user = await User.findOne({ chatId });
// //     if (!user) {
// //       user = new User({ chatId, alarms: [] });
// //       await user.save();
// //     }

// //     const options = {
// //       reply_markup: {
// //         keyboard: [
// //           [{ text: "⏰ Add Alarm" }, { text: "📋 List Alarms" }],
// //           [{ text: "📊 My Stats" }, { text: "❌ Unsubscribe" }]
// //         ],
// //         resize_keyboard: true
// //       }
// //     };

// //     await bot.sendMessage(chatId,
// //       `Welcome! Use /addalarm HH:MM to set exactly 10 alarms.\n` +
// //       `Current alarms: ${user.alarms.length}/10`,
// //       options
// //     );
// //   } catch (err) {
// //     console.error('Error handling /start:', err);
// //     await bot.sendMessage(chatId, 'Something went wrong. Please try again later.');
// //   }
// // });

// // // Handle /addalarm command
// // bot.onText(/\/addalarm (\d{2}:\d{2})/, async (msg, match) => {
// //   const chatId = msg.chat.id;
// //   const time = match[1];
// //   try {
// //     const user = await User.findOne({ chatId });
// //     if (!user) {
// //       await bot.sendMessage(chatId, "Please use /start first.");
// //       return;
// //     }

// //     if (user.alarms.length >= 10) {
// //       await bot.sendMessage(chatId, "You already have 10 alarms set!");
// //       return;
// //     }

// //     user.alarms.push({ time, pending: false });
// //     await user.save();
// //     await scheduleUserAlarms(chatId);

// //     const remaining = 10 - user.alarms.length;
// //     await bot.sendMessage(chatId,
// //       `Alarm set for ${time}. ${remaining} more alarms needed to reach 10.`
// //     );
// //   } catch (err) {
// //     console.error('Error handling /addalarm:', err);
// //   }
// // });

// // // Handle callback queries
// // bot.on('callback_query', async (callbackQuery) => {
// //   const chatId = callbackQuery.message.chat.id;
// //   const data = callbackQuery.data;
// //   try {
// //     const user = await User.findOne({ chatId });
// //     if (!user) return;

// //     if (data.startsWith('ack_')) {
// //       const alarmIndex = parseInt(data.split('_')[1]);
// //       if (alarmIndex < user.alarms.length) {
// //         user.alarms[alarmIndex].pending = false;
// //         user.streak += 1;
// //         user.lastActive = new Date();
// //         await user.save();

// //         await bot.answerCallbackQuery(callbackQuery.id, {
// //           text: `Great job! ${user.streak} day streak!`
// //         });
// //         await bot.editMessageReplyMarkup(
// //           { inline_keyboard: [] },
// //           { chat_id: chatId, message_id: callbackQuery.message.message_id }
// //         );
// //       }
// //     } else if (data.startsWith('skip_')) {
// //       const alarmIndex = parseInt(data.split('_')[1]);
// //       if (alarmIndex < user.alarms.length) {
// //         user.alarms[alarmIndex].pending = false;
// //         await user.save();

// //         await bot.answerCallbackQuery(callbackQuery.id, {
// //           text: "Okay, skipped for today."
// //         });
// //         await bot.editMessageReplyMarkup(
// //           { inline_keyboard: [] },
// //           { chat_id: chatId, message_id: callbackQuery.message.message_id }
// //         );
// //       }
// //     }
// //   } catch (err) {
// //     console.error('Error handling callback query:', err);
// //   }
// // });

// // // Handle "List Alarms" command
// // bot.onText(/List Alarms/, async (msg) => {
// //   const chatId = msg.chat.id;
// //   try {
// //     const user = await User.findOne({ chatId });
// //     if (!user || user.alarms.length === 0) {
// //       await bot.sendMessage(chatId, "You have no alarms set.");
// //       return;
// //     }

// //     const alarmList = user.alarms.map((alarm, index) =>
// //       `${index + 1}. ${alarm.time}`
// //     ).join('\n');
// //     await bot.sendMessage(chatId, `Your alarms:\n${alarmList}`);
// //   } catch (err) {
// //     console.error('Error listing alarms:', err);
// //   }
// // });

// // // Handle "My Stats" command
// // bot.onText(/My Stats/, async (msg) => {
// //   const chatId = msg.chat.id;
// //   try {
// //     const user = await User.findOne({ chatId });
// //     if (!user) return;

// //     const statsMessage = `
// // 📊 Your Stats:
// // - Current Streak: ${user.streak} days
// // - Alarms Set: ${user.alarms.length}/10
// // - Last Active: ${user.lastActive ? user.lastActive.toLocaleString() : 'Never'}
// //     `;
// //     await bot.sendMessage(chatId, statsMessage);
// //   } catch (err) {
// //     console.error('Error showing stats:', err);
// //   }
// // });

// // // Handle "Unsubscribe" command
// // bot.onText(/Unsubscribe/, async (msg) => {
// //   const chatId = msg.chat.id;
// //   try {
// //     const user = await User.findOne({ chatId });
// //     if (!user) return;

// //     user.alarms.forEach(alarm => {
// //       if (alarm.jobName && activeJobs[alarm.jobName]) {
// //         activeJobs[alarm.jobName].cancel();
// //         delete activeJobs[alarm.jobName];
// //       }
// //     });

// //     await User.deleteOne({ chatId });
// //     await bot.sendMessage(chatId,
// //       "You've been unsubscribed. Use /start to subscribe again."
// //     );
// //   } catch (err) {
// //     console.error('Error unsubscribing:', err);
// //   }
// // });

// // // Log bot status
// // bot.getMe().then((me) => {
// //   console.log(`Bot ${me.username} is running`);
// // }).catch(err => {
// //   console.error('Error getting bot info:', err);
// // });
























// require('dotenv').config();
// const TelegramBot = require('node-telegram-bot-api');
// const schedule = require('node-schedule');
// const mongoose = require('mongoose');
// const express = require('express');
// const bodyParser = require('body-parser');

// // Initialize Express app
// const app = express();
// app.use(bodyParser.json());

// // Database connection
// mongoose.connect('mongodb+srv://ChoengRayu:C9r6nhxOVLCUkkGd@cluster0.2ott03t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
// .then(() => console.log('MongoDB connected successfully'))
// .catch(err => {
//   console.error('MongoDB connection error:', err);
//   process.exit(1);
// });

// // User schema and model
// const userSchema = new mongoose.Schema({
//   chatId: { type: Number, required: true, unique: true },
//   alarms: [{
//     time: String,
//     jobName: String,
//     pending: { type: Boolean, default: false }
//   }],
//   streak: { type: Number, default: 0 },
//   lastActive: Date
// });
// const User = mongoose.model('User', userSchema);

// // Initialize Telegram Bot
// const token = process.env.TELEGRAM_BOT_TOKEN;
// if (!token) {
//   console.error('TELEGRAM_BOT_TOKEN is not set');
//   process.exit(1);
// }
// const bot = new TelegramBot(token, { polling: false });

// // Webhook endpoint
// app.post('/webhook', (req, res) => {
//   bot.processUpdate(req.body);
//   res.sendStatus(200);
// });

// // Job storage and scheduling
// const activeJobs = {};

// // Server initialization
// // const PORT = process.env.PORT || 3000;
// // app.listen(PORT, async () => {
// //   console.log(`Server running on port ${PORT}`);
// //   try {
// //     const webhookUrl = `${process.env.WEBHOOK_URL}/webhook`;
// //     await bot.setWebHook(webhookUrl);
// //     console.log('Webhook set successfully to', webhookUrl);
// //   } catch (err) {
// //     console.error('Error setting webhook:', err);
// //   }
// // });
// const PORT = process.env.PORT || 3002;
// app.listen(PORT, async () => {
//   console.log(`Server running on port ${PORT}`);
  
//   // Add delay for Render initialization
//   setTimeout(async () => {
//     try {
//       const webhookUrl = `${process.env.WEBHOOK_URL}/webhook`;
//       console.log('Attempting to set webhook at:', webhookUrl);
      
//       await bot.setWebHook(webhookUrl);
//       console.log('Webhook set successfully');
      
//       // Verify webhook was set
//       const webhookInfo = await bot.getWebHookInfo();
//       console.log('Webhook Info:', webhookInfo);
//     } catch (err) {
//       console.error('Webhook setup error:', err.message);
//     }
//   }, 10000); // 10-second delay for Render to fully initialize
// });

// // Alarm scheduling functions
// async function scheduleUserAlarms(chatId) {
//   try {
//     const user = await User.findOne({ chatId });
//     if (!user) return;

//     // Clear existing jobs
//     user.alarms.forEach(alarm => {
//       if (alarm.jobName && activeJobs[alarm.jobName]) {
//         activeJobs[alarm.jobName].cancel();
//         delete activeJobs[alarm.jobName];
//       }
//     });

//     // Schedule new jobs
//     user.alarms.forEach((alarm, index) => {
//       const [hour, minute] = alarm.time.split(':').map(Number);
//       const jobName = `alarm_${chatId}_${index}`;
      
//       activeJobs[jobName] = schedule.scheduleJob(
//         { hour, minute, tz: 'Asia/Phnom_Penh' },
//         async () => await sendAlarmMessage(chatId, index)
//       );
      
//       alarm.jobName = jobName;
//     });

//     await user.save();
//   } catch (err) {
//     console.error('Error scheduling alarms:', err);
//   }
// }

// async function sendAlarmMessage(chatId, alarmIndex) {
//   try {
//     const user = await User.findOne({ chatId });
//     if (!user || alarmIndex >= user.alarms.length) return;

//     const alarm = user.alarms[alarmIndex];
//     const message = `🔔 Alarm at ${alarm.time}! Reply "OK" when done.`;
//     const options = {
//       reply_markup: {
//         inline_keyboard: [
//           [{ text: "I did it!", callback_data: `ack_${alarmIndex}` }],
//           [{ text: "Skip", callback_data: `skip_${alarmIndex}` }]
//         ]
//       }
//     };

//     await bot.sendMessage(chatId, message, options);
//     alarm.pending = true;
//     await user.save();

//     // 1-hour timeout handler
//     setTimeout(async () => {
//       const updatedUser = await User.findOne({ chatId });
//       if (!updatedUser || alarmIndex >= updatedUser.alarms.length) return;
      
//       const updatedAlarm = updatedUser.alarms[alarmIndex];
//       if (updatedAlarm.pending) {
//         await bot.sendMessage(chatId, `⚠️ You missed your alarm at ${updatedAlarm.time}. Streak reset!`);
//         updatedUser.streak = 0;
//         updatedAlarm.pending = false;
//         await updatedUser.save();
//       }
//     }, 3600000); // 1 hour
//   } catch (err) {
//     console.error('Error sending alarm message:', err);
//   }
// }

// // Helper function to get next alarm time
// function getNextAlarmTime(alarms) {
//   if (alarms.length === 0) return "No upcoming alarms";
  
//   const now = new Date();
//   const currentTime = now.getHours() * 60 + now.getMinutes();
  
//   const nextAlarm = alarms
//     .map(a => {
//       const [h, m] = a.time.split(':').map(Number);
//       return { time: a.time, minutes: h * 60 + m };
//     })
//     .sort((a, b) => a.minutes - b.minutes)
//     .find(a => a.minutes > currentTime);

//   return nextAlarm ? nextAlarm.time : `Tomorrow at ${alarms[0].time}`;
// }

// // Bot command handlers
// bot.onText(/\/start/, async (msg) => {
//   const chatId = msg.chat.id;
//   try {
//     let user = await User.findOne({ chatId }) || new User({ chatId, alarms: [] });
//     await user.save();

//     const options = {
//       reply_markup: {
//         keyboard: [
//           [{ text: "⏰ Add Alarm" }, { text: "📋 List Alarms" }],
//           [{ text: "📊 My Stats" }, { text: "❌ Unsubscribe" }]
//         ],
//         resize_keyboard: true
//       }
//     };

//     await bot.sendMessage(
//       chatId,
//       `Welcome! Use /addalarm HH:MM to set exactly 10 alarms.\nCurrent alarms: ${user.alarms.length}/10`,
//       options
//     );
//   } catch (err) {
//     console.error('Error handling /start:', err);
//     await bot.sendMessage(chatId, 'Something went wrong. Please try again later.');
//   }
// });

// bot.onText(/\/addalarm (\d{2}:\d{2})/, async (msg, match) => {
//   const chatId = msg.chat.id;
//   const time = match[1];
  
//   // Validate time format
//   const [hours, minutes] = time.split(':').map(Number);
//   if (hours > 23 || minutes > 59) {
//     return await bot.sendMessage(chatId, "⛔ Invalid time format! Please use HH:MM (24-hour format)");
//   }

//   try {
//     const user = await User.findOne({ chatId });
//     if (!user) return await bot.sendMessage(chatId, "⚠️ Please use /start first");
    
//     if (user.alarms.length >= 10) {
//       return await bot.sendMessage(chatId, 
//         "⛔ Maximum limit reached! You can only set 10 alarms\n" +
//         "Use 'List Alarms' to see your current alarms"
//       );
//     }

//     // Check for duplicate alarm time
//     if (user.alarms.some(alarm => alarm.time === time)) {
//       return await bot.sendMessage(chatId, `⏰ Alarm at ${time} already exists!`);
//     }

//     user.alarms.push({ time });
//     await user.save();
//     await scheduleUserAlarms(chatId);

//     // Enhanced confirmation message
//     await bot.sendMessage(chatId,
//       `✅ Successfully added alarm at ${time}\n\n` +
//       `📊 Current status:\n` +
//       `- Total alarms: ${user.alarms.length}/10\n` +
//       `- Next alarm: ${getNextAlarmTime(user.alarms)}\n` +
//       `- Current streak: ${user.streak} days`
//     );

//   } catch (err) {
//     console.error('Error handling /addalarm:', err);
//     await bot.sendMessage(chatId, "⚠️ Failed to add alarm. Please try again");
//   }
// });

// // Callback handlers
// bot.on('callback_query', async (callbackQuery) => {
//   const chatId = callbackQuery.message.chat.id;
//   const data = callbackQuery.data;

//   try {
//     const user = await User.findOne({ chatId });
//     if (!user) return;

//     if (data.startsWith('ack_')) {
//       const alarmIndex = parseInt(data.split('_')[1]);
//       if (alarmIndex < user.alarms.length) {
//         user.alarms[alarmIndex].pending = false;
//         user.streak += 1;
//         user.lastActive = new Date();
//         await user.save();

//         await bot.answerCallbackQuery(callbackQuery.id, {
//           text: `Great job! ${user.streak} day streak!`
//         });
//       }
//     } else if (data.startsWith('skip_')) {
//       const alarmIndex = parseInt(data.split('_')[1]);
//       if (alarmIndex < user.alarms.length) {
//         user.alarms[alarmIndex].pending = false;
//         await user.save();
//         await bot.answerCallbackQuery(callbackQuery.id, { text: "Okay, skipped for today." });
//       }
//     }

//     // Clear inline keyboard
//     await bot.editMessageReplyMarkup(
//       { inline_keyboard: [] },
//       { chat_id: chatId, message_id: callbackQuery.message.message_id }
//     );
//   } catch (err) {
//     console.error('Error handling callback query:', err);
//   }
// });

// // Improved List Alarms handler
// bot.onText(/List Alarms/, async (msg) => {
//   const chatId = msg.chat.id;
//   try {
//     const user = await User.findOne({ chatId });
    
//     if (!user) {
//       return await bot.sendMessage(chatId, 
//         "⚠️ No alarms found!\n" +
//         "Use /start to initialize your profile\n" +
//         "Then use /addalarm HH:MM to set alarms"
//       );
//     }

//     if (user.alarms.length === 0) {
//       return await bot.sendMessage(chatId,
//         "⏰ You don't have any alarms set!\n\n" +
//         "Use /addalarm HH:MM to create new alarms\n" +
//         "Example: /addalarm 08:30"
//       );
//     }

//     // Format alarm list with numbers and emojis
//     const alarmList = user.alarms
//       .map((alarm, index) => `${index + 1}. ⏰ ${alarm.time}`)
//       .join('\n');

//     // Add header and status information
//     const message = 
//       `📋 Your Alarms (${user.alarms.length}/10):\n\n${alarmList}\n\n` +
//       `Next alarm: ${getNextAlarmTime(user.alarms)}\n` +
//       `Current streak: ${user.streak} days`;

//     await bot.sendMessage(chatId, message);

//   } catch (err) {
//     console.error('Error listing alarms:', err);
//     await bot.sendMessage(chatId, "⚠️ Failed to retrieve alarms. Please try again");
//   }
// });

// bot.onText(/My Stats/, async (msg) => {
//   const chatId = msg.chat.id;
//   try {
//     const user = await User.findOne({ chatId });
//     if (!user) return;

//     const stats = `
// 📊 Your Stats:
// - Streak: ${user.streak} days
// - Alarms: ${user.alarms.length}/10
// - Last Active: ${user.lastActive?.toLocaleDateString() || 'Never'}
//     `.trim();
    
//     await bot.sendMessage(chatId, stats);
//   } catch (err) {
//     console.error('Error showing stats:', err);
//   }
// });

// bot.onText(/Unsubscribe/, async (msg) => {
//   const chatId = msg.chat.id;
//   try {
//     const user = await User.findOne({ chatId });
//     if (!user) return;

//     // Clear all jobs
//     user.alarms.forEach(alarm => {
//       if (alarm.jobName && activeJobs[alarm.jobName]) {
//         activeJobs[alarm.jobName].cancel();
//         delete activeJobs[alarm.jobName];
//       }
//     });

//     await User.deleteOne({ chatId });
//     await bot.sendMessage(chatId, "You've been unsubscribed. Use /start to begin again.");
//   } catch (err) {
//     console.error('Error unsubscribing:', err);
//   }
// });

// // Bot status check
// bot.getMe().then(me => console.log(`Bot @${me.username} operational`))
//   .catch(err => console.error('Bot initialization error:', err));