// require('dotenv').config();
// const TelegramBot = require('node-telegram-bot-api');
// const schedule = require('node-schedule');
// const mongoose = require('mongoose');
// const express = require('express');
// const bodyParser = require('body-parser');

// // Connect to MongoDB
// mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/telegram_bot', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
// });

// // User schema with array of alarms
// const userSchema = new mongoose.Schema({
//   chatId: { type: Number, required: true, unique: true },
//   alarms: [{
//     time: String, // HH:MM format
//     jobName: String,
//     pending: { type: Boolean, default: false },
//     sentAt: Date // Track when alarm was triggered
//   }],
//   streak: { type: Number, default: 0 },
//   lastActive: Date
// });

// const User = mongoose.model('User', userSchema);

// // Initialize bot and server
// const token = '';
// const bot = new TelegramBot(token);
// const app = express();
// app.use(bodyParser.json());

// // Store active jobs
// const activeJobs = {};

// // Webhook endpoint
// app.post('/webhook', (req, res) => {
//   bot.processUpdate(req.body);
//   res.sendStatus(200);
// });

// // Schedule all alarms for a user
// async function scheduleUserAlarms(chatId) {
//   const user = await User.findOne({ chatId });
//   if (!user) return;

//   // Cancel existing jobs
//   user.alarms.forEach(alarm => {
//     if (alarm.jobName && activeJobs[alarm.jobName]) {
//       activeJobs[alarm.jobName].cancel();
//       delete activeJobs[alarm.jobName];
//     }
//   });

//   // Schedule new jobs
//   user.alarms.forEach((alarm, index) => {
//     const [hour, minute] = alarm.time.split(':').map(Number);
//     const jobName = `alarm_${chatId}_${index}`;
    
//     try {
//       activeJobs[jobName] = schedule.scheduleJob(
//         { hour, minute, tz: 'Asia/Phnom_Penh' },
//         async () => {
//           await sendAlarmMessage(chatId, index);
//         }
//       );
//       alarm.jobName = jobName;
//     } catch (err) {
//       console.error(`Failed to schedule job ${jobName}:`, err);
//     }
//   });

//   await user.save();
// }

// // Send alarm message with 1-hour timeout
// async function sendAlarmMessage(chatId, alarmIndex) {
//   const user = await User.findOne({ chatId });
//   if (!user || alarmIndex >= user.alarms.length) return;

//   const alarm = user.alarms[alarmIndex];
//   const message = `🔔 Alarm at ${alarm.time}! Reply "OK" when done.`;

//   const options = {
//     reply_markup: {
//       inline_keyboard: [
//         [{ text: "I did it!", callback_data: `ack_${alarmIndex}` }],
//         [{ text: "Skip", callback_data: `skip_${alarmIndex}` }]
//       ]
//     }
//   };

//   try {
//     await bot.sendMessage(chatId, message, options);
//     alarm.pending = true;
//     alarm.sentAt = new Date();
//     await user.save();

//     // Calculate remaining time for timeout
//     const timeoutDuration = 60 * 60 * 1000; // 1 hour
//     const elapsed = Date.now() - alarm.sentAt.getTime();
//     const remainingTime = timeoutDuration - elapsed;

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
//     }, Math.max(remainingTime, 0));
//   } catch (err) {
//     console.error(`Failed to send alarm message to ${chatId}:`, err);
//   }
// }

// // Handle pending alarms on server start
// async function checkPendingAlarms() {
//   const users = await User.find({ 'alarms.pending': true });
  
//   for (const user of users) {
//     for (let i = 0; i < user.alarms.length; i++) {
//       const alarm = user.alarms[i];
//       if (alarm.pending && alarm.sentAt) {
//         const timeElapsed = Date.now() - alarm.sentAt.getTime();
        
//         if (timeElapsed > 60 * 60 * 1000) {
//           // Already missed
//           try {
//             await bot.sendMessage(user.chatId, `⚠️ You missed your alarm at ${alarm.time}. Streak reset!`);
//             user.streak = 0;
//             alarm.pending = false;
//             await user.save();
//           } catch (err) {
//             console.error(`Failed to send missed alarm message to ${user.chatId}:`, err);
//           }
//         } else {
//           // Reschedule timeout
//           const remainingTime = 60 * 60 * 1000 - timeElapsed;
//           setTimeout(async () => {
//             const updatedUser = await User.findOne({ chatId: user.chatId });
//             if (!updatedUser || i >= updatedUser.alarms.length) return;
            
//             const updatedAlarm = updatedUser.alarms[i];
//             if (updatedAlarm.pending) {
//               try {
//                 await bot.sendMessage(user.chatId, `⚠️ You missed your alarm at ${updatedAlarm.time}. Streak reset!`);
//                 updatedUser.streak = 0;
//                 updatedAlarm.pending = false;
//                 await updatedUser.save();
//               } catch (err) {
//                 console.error(`Failed to send missed alarm message to ${user.chatId}:`, err);
//               }
//             }
//           }, remainingTime);
//         }
//       }
//     }
//   }
// }

// // Schedule existing alarms on startup
// async function scheduleAllUsersAlarms() {
//   const users = await User.find({});
//   for (const user of users) {
//     await scheduleUserAlarms(user.chatId);
//   }
// }

// // Start server and set webhook
// const PORT = 3000;
// app.listen(PORT, async () => {
//   console.log(`Server running on port ${PORT}`);
//   const webhookUrl = 'https://alarmbot-mbkv.onrender.com';
  
//   try {
//     await bot.setWebHook(webhookUrl);
//     console.log('Webhook set successfully');
    
//     await scheduleAllUsersAlarms();
//     console.log('Rescheduled existing alarms');
    
//     await checkPendingAlarms();
//     console.log('Checked pending alarms');
//   } catch (err) {
//     console.error('Startup error:', err);
//   }
// });

// // Handle /start command
// bot.onText(/\/start/, async (msg) => {
//   const chatId = msg.chat.id;
//   let user = await User.findOne({ chatId });

//   if (!user) {
//     user = new User({ chatId, alarms: [] });
//     await user.save();
//   }

//   const options = {
//     reply_markup: {
//       keyboard: [
//         [{ text: "⏰ Add Alarm" }, { text: "📋 List Alarms" }],
//         [{ text: "📊 My Stats" }, { text: "❌ Unsubscribe" }]
//       ],
//       resize_keyboard: true
//     }
//   };

//   await bot.sendMessage(chatId, 
//     `Welcome! Use /addalarm HH:MM to set up to 10 alarms.\n` +
//     `Current alarms: ${user.alarms.length}/10`, 
//     options
//   );
// });

// // Handle /addalarm command with time validation and duplicate check
// bot.onText(/\/addalarm (\d{2}:\d{2})/, async (msg, match) => {
//   const chatId = msg.chat.id;
//   const time = match[1];
//   const user = await User.findOne({ chatId });

//   if (!user) {
//     await bot.sendMessage(chatId, "Please use /start first.");
//     return;
//   }

//   // Validate time format
//   const [hours, minutes] = time.split(':');
//   const hour = parseInt(hours, 10);
//   const minute = parseInt(minutes, 10);
  
//   if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
//     await bot.sendMessage(chatId, "❌ Invalid time! Please use HH:MM format with valid hours (00-23) and minutes (00-59).");
//     return;
//   }

//   if (user.alarms.length >= 10) {
//     await bot.sendMessage(chatId, "❌ You already have 10 alarms set!");
//     return;
//   }

//   // Check for duplicate alarm time
//   if (user.alarms.some(alarm => alarm.time === time)) {
//     await bot.sendMessage(chatId, `❌ You already have an alarm set for ${time}.`);
//     return;
//   }

//   user.alarms.push({ time, pending: false });
//   await user.save();
//   await scheduleUserAlarms(chatId);
  
//   await bot.sendMessage(chatId, 
//     `⏰ Alarm set for ${time}. You have ${user.alarms.length}/10 alarms set.`
//   );
// });

// // Handle "List Alarms" command with removal options
// bot.onText(/List Alarms/, async (msg) => {
//   const chatId = msg.chat.id;
//   const user = await User.findOne({ chatId });
  
//   if (!user || user.alarms.length === 0) {
//     await bot.sendMessage(chatId, "You have no alarms set.");
//     return;
//   }

//   const alarmList = user.alarms.map((alarm, index) => 
//     `${index + 1}. ${alarm.time} - /removealarm_${index + 1}`
//   ).join('\n');
//   await bot.sendMessage(chatId, `Your alarms:\n${alarmList}\n\nUse /removealarm_N to remove alarm number N.`);
// });

// // Handle /removealarm_N command
// bot.onText(/\/removealarm_(\d+)/, async (msg, match) => {
//   const chatId = msg.chat.id;
//   const alarmNumber = parseInt(match[1], 10);
//   const user = await User.findOne({ chatId });
  
//   if (!user || alarmNumber < 1 || alarmNumber > user.alarms.length) {
//     await bot.sendMessage(chatId, "Invalid alarm number.");
//     return;
//   }

//   const alarmIndex = alarmNumber - 1;
//   const removedAlarm = user.alarms[alarmIndex];
  
//   // Cancel the job if it exists
//   if (removedAlarm.jobName && activeJobs[removedAlarm.jobName]) {
//     activeJobs[removedAlarm.jobName].cancel();
//     delete activeJobs[removedAlarm.jobName];
//   }
  
//   user.alarms.splice(alarmIndex, 1);
//   await user.save();
//   await scheduleUserAlarms(chatId); // Reschedule remaining alarms
  
//   await bot.sendMessage(chatId, `🗑️ Removed alarm at ${removedAlarm.time}. You now have ${user.alarms.length}/10 alarms set.`);
// });

// // Handle callback queries
// bot.on('callback_query', async (callbackQuery) => {
//   const chatId = callbackQuery.message.chat.id;
//   const data = callbackQuery.data;
//   const user = await User.findOne({ chatId });
  
//   if (!user) return;
  
//   if (data.startsWith('ack_')) {
//     const alarmIndex = parseInt(data.split('_')[1]);
//     if (alarmIndex < user.alarms.length) {
//       user.alarms[alarmIndex].pending = false;
//       user.streak += 1;
//       user.lastActive = new Date();
//       await user.save();
      
//       await bot.answerCallbackQuery(callbackQuery.id, { 
//         text: `Great job! ${user.streak} day streak!` 
//       });
//       await bot.editMessageReplyMarkup(
//         { inline_keyboard: [] },
//         { chat_id: chatId, message_id: callbackQuery.message.message_id }
//       );
//     }
//   } else if (data.startsWith('skip_')) {
//     const alarmIndex = parseInt(data.split('_')[1]);
//     if (alarmIndex < user.alarms.length) {
//       user.alarms[alarmIndex].pending = false;
//       await user.save();
      
//       await bot.answerCallbackQuery(callbackQuery.id, { 
//         text: "Okay, skipped for today." 
//       });
//       await bot.editMessageReplyMarkup(
//         { inline_keyboard: [] },
//         { chat_id: chatId, message_id: callbackQuery.message.message_id }
//       );
//     }
//   }
// });

// // Handle "My Stats" command
// bot.onText(/My Stats/, async (msg) => {
//   const chatId = msg.chat.id;
//   const user = await User.findOne({ chatId });
  
//   if (!user) return;
  
//   const statsMessage = `
// 📊 Your Stats:
// - Current Streak: ${user.streak} days
// - Alarms Set: ${user.alarms.length}/10
// - Last Active: ${user.lastActive ? user.lastActive.toLocaleString() : 'Never'}
//   `;
  
//   await bot.sendMessage(chatId, statsMessage);
// });

// // Handle "Unsubscribe" command
// bot.onText(/Unsubscribe/, async (msg) => {
//   const chatId = msg.chat.id;
//   const user = await User.findOne({ chatId });
  
//   if (!user) return;
  
//   user.alarms.forEach(alarm => {
//     if (alarm.jobName && activeJobs[alarm.jobName]) {
//       activeJobs[alarm.jobName].cancel();
//       delete activeJobs[alarm.jobName];
//     }
//   });
  
//   await User.deleteOne({ chatId });
//   await bot.sendMessage(chatId, 
//     "You've been unsubscribed. Use /start to subscribe again."
//   );
// });

// console.log('Bot is running...');








// //it work
// require('dotenv').config();
// const { Telegraf, Markup } = require('telegraf');
// const express = require('express');
// const schedule = require('node-schedule');
// const mongoose = require('mongoose');

// const app = express();
// const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// // MongoDB Connection
// mongoose.connect(process.env.MONGODB_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// }).then(() => console.log('MongoDB connected'))
//   .catch((err) => console.error('MongoDB connection error:', err));

// // User Schema
// const userSchema = new mongoose.Schema({
//   chatId: { type: Number, required: true, unique: true },
//   morningTime: { type: String, default: '11:30' },
//   eveningTime: { type: String, default: '20:00' },
//   morningJobName: String,
//   eveningJobName: String,
//   pendingMorning: { type: Boolean, default: false },
//   pendingEvening: { type: Boolean, default: false },
//   streak: { type: Number, default: 0 },
//   lastActive: Date,
// });

// const User = mongoose.model('User', userSchema);
// const activeJobs = {};

// // Middleware
// bot.use(async (ctx, next) => {
//   console.log(`Received update from chat ${ctx.chat.id}:`, JSON.stringify(ctx.update, null, 2));
//   ctx.user = await User.findOneAndUpdate(
//     { chatId: ctx.chat.id },
//     { $set: { lastActive: new Date() } },
//     { upsert: true, new: true }
//   );
//   return next();
// });

// // Scheduled jobs handling
// async function scheduleUserJobs(chatId) {
//   const user = await User.findOne({ chatId });
//   if (!user) {
//     console.log(`No user found for chatId: ${chatId}`);
//     return;
//   }

//   // Cancel existing jobs
//   [user.morningJobName, user.eveningJobName].forEach((jobName) => {
//     if (jobName && activeJobs[jobName]) {
//       activeJobs[jobName].cancel();
//       delete activeJobs[jobName];
//     }
//   });

//   // Schedule morning message
//   const [mHour, mMin] = user.morningTime.split(':').map(Number);
//   const morningJob = schedule.scheduleJob(
//     { hour: mHour, minute: mMin, tz: 'Asia/Phnom_Penh' },
//     () => sendScheduledMessage(chatId, 'morning')
//   );

//   // Schedule evening message
//   const [eHour, eMin] = user.eveningTime.split(':').map(Number);
//   const eveningJob = schedule.scheduleJob(
//     { hour: eHour, minute: eMin, tz: 'Asia/Phnom_Penh' },
//     () => sendScheduledMessage(chatId, 'evening')
//   );

//   // Update user with job names
//   user.morningJobName = `morning_${chatId}`;
//   user.eveningJobName = `evening_${chatId}`;
//   activeJobs[user.morningJobName] = morningJob;
//   activeJobs[user.eveningJobName] = eveningJob;
//   await user.save();
//   console.log(`Scheduled jobs for chatId ${chatId}: morning at ${user.morningTime}, evening at ${user.eveningTime}`);
// }

// async function sendScheduledMessage(chatId, timeOfDay) {
//   const user = await User.findOne({ chatId });
//   if (!user) {
//     console.log(`No user found for scheduled message, chatId: ${chatId}`);
//     return;
//   }

//   const message =
//     timeOfDay === 'morning'
//       ? '🌞 Good morning! Time for your morning routine!'
//       : '🌙 Good evening! Time for your reflection.';

//   const keyboard = Markup.inlineKeyboard([
//     Markup.button.callback('I did it!', `ack_${timeOfDay}`),
//     Markup.button.callback('Skip today', `skip_${timeOfDay}`),
//   ]);

//   try {
//     await bot.telegram.sendMessage(chatId, message, keyboard);
//     console.log(`Sent ${timeOfDay} message to chatId ${chatId}`);
//     user[`pending${timeOfDay[0].toUpperCase() + timeOfDay.slice(1)}`] = true;
//     await user.save();
//   } catch (err) {
//     console.error(`Failed to send ${timeOfDay} message to chatId ${chatId}:`, err);
//   }

//   // Set timeout for missed activity
//   setTimeout(async () => {
//     const updatedUser = await User.findOne({ chatId });
//     if (updatedUser?.[`pending${timeOfDay[0].toUpperCase() + timeOfDay.slice(1)}`]) {
//       try {
//         await bot.telegram.sendMessage(
//           chatId,
//           `⚠️ Missed ${timeOfDay} activity! Streak reset.`
//         );
//         updatedUser.streak = 0;
//         updatedUser[`pending${timeOfDay[0].toUpperCase() + timeOfDay.slice(1)}`] = false;
//         await updatedUser.save();
//         console.log(`Reset streak for chatId ${chatId} due to missed ${timeOfDay} activity`);
//       } catch (err) {
//         console.error(`Failed to send missed activity message to chatId ${chatId}:`, err);
//       }
//     }
//   }, 6 * 60 * 60 * 1000);
// }

// // Commands
// bot.command('start', async (ctx) => {
//   console.log(`Received /start command from chatId ${ctx.chat.id}`);
//   await scheduleUserJobs(ctx.chat.id);
//   const keyboard = Markup.keyboard([
//     ['⏰ Set Morning Time', '🌙 Set Evening Time'],
//     ['📊 My Stats', '❌ Unsubscribe'],
//   ]).resize();

//   try {
//     await ctx.reply('Welcome! Manage your routines:', keyboard);
//     console.log(`Sent welcome message to chatId ${ctx.chat.id}`);
//   } catch (err) {
//     console.error(`Failed to send welcome message to chatId ${ctx.chat.id}:`, err);
//   }
// });

// bot.hears(/Set (Morning|Evening) Time/, async (ctx) => {
//   const timeOfDay = ctx.match[1].toLowerCase();
//   console.log(`Received set ${timeOfDay} time request from chatId ${ctx.chat.id}`);
//   try {
//     await ctx.reply(
//       `Enter ${timeOfDay} time in 24h format (HH:MM)\nExample: ${timeOfDay === 'morning' ? '07:30' : '20:00'}`
//     );
//   } catch (err) {
//     console.error(`Failed to send time prompt to chatId ${ctx.chat.id}:`, err);
//   }
// });

// bot.hears(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, async (ctx) => {
//   const time = ctx.message.text;
//   const isMorning = parseInt(time.split(':')[0]) < 12;
//   const field = isMorning ? 'morningTime' : 'eveningTime';
//   console.log(`Received time input ${time} for ${field} from chatId ${ctx.chat.id}`);

//   ctx.user[field] = time;
//   await ctx.user.save();
//   await scheduleUserJobs(ctx.chat.id);

//   try {
//     await ctx.reply(`${isMorning ? 'Morning' : 'Evening guerrilla bot'} time set to ${time}!`);
//     console.log(`Set ${field} to ${time} for chatId ${ctx.chat.id}`);
//   } catch (err) {
//     console.error(`Failed to confirm time setting for chatId ${ctx.chat.id}:`, err);
//   }
// });

// bot.hears('📊 My Stats', async (ctx) => {
//   console.log(`Received stats request from chatId ${ctx.chat.id}`);
//   const stats = `
// 📊 Your Stats:
// - Streak: ${ctx.user.streak} days
// - Morning: ${ctx.user.morningTime}
// - Evening: ${ctx.user.eveningTime}
// - Last Active: ${ctx.user.lastActive.toLocaleString()}
//   `;
//   try {
//     await ctx.reply(stats);
//     console.log(`Sent stats to chatId ${ctx.chat.id}`);
//   } catch (err) {
//     console.error(`Failed to send stats to chatId ${ctx.chat.id}:`, err);
//   }
// });

// bot.hears('❌ Unsubscribe', async (ctx) => {
//   console.log(`Received unsubscribe request from chatId ${ctx.chat.id}`);
//   [ctx.user.morningJobName, ctx.user.eveningJobName].forEach((jobName) => {
//     if (activeJobs[jobName]) {
//       activeJobs[jobName].cancel();
//       delete activeJobs[jobName];
//     }
//   });

//   try {
//     await User.deleteOne({ _id: ctx.user._id });
//     await ctx.reply('Unsubscribed! Use /start to resubscribe.');
//     console.log(`Unsubscribed chatId ${ctx.chat.id}`);
//   } catch (err) {
//     console.error(`Failed to unsubscribe chatId ${ctx.chat.id}:`, err);
//   }
// });

// // Callbacks
// bot.action(/ack_(morning|evening)/, async (ctx) => {
//   const timeOfDay = ctx.match[1];
//   console.log(`Received ${timeOfDay} acknowledgment from chatId ${ctx.chat.id}`);
//   ctx.user[`pending${timeOfDay[0].toUpperCase() + timeOfDay.slice(1)}`] = false;
//   ctx.user.streak += 1;
//   await ctx.user.save();

//   try {
//     await ctx.answerCbQuery(`Great job! ${ctx.user.streak} day streak!`);
//     await ctx.deleteMessage();
//     console.log(`Processed ${timeOfDay} acknowledgment for chatId ${ctx.chat.id}`);
//   } catch (err) {
//     console.error(`Failed to process ${timeOfDay} acknowledgment for chatId ${ctx.chat.id}:`, err);
//   }
// });

// bot.action(/skip_(morning|evening)/, async (ctx) => {
//   const timeOfDay = ctx.match[1];
//   console.log(`Received ${timeOfDay} skip request from chatId ${ctx.chat.id}`);
//   ctx.user[`pending${timeOfDay[0].toUpperCase() + timeOfDay.slice(1)}`] = false;
//   await ctx.user.save();

//   try {
//     await ctx.answerCbQuery('Okay, skipped for today.');
//     await ctx.deleteMessage();
//     console.log(`Processed ${timeOfDay} skip for chatId ${ctx.chat.id}`);
//   } catch (err) {
//     console.error(`Failed to process ${timeOfDay} skip for chatId ${ctx.chat.id}:`, err);
//   }
// });

// // Error handling
// bot.catch((err, ctx) => {
//   console.error(`Bot error for chatId ${ctx?.chat?.id || 'unknown'}:`, err);
// });

// // Webhook setup
// app.use(express.json());
// app.post('/webhook', bot.webhookCallback('/webhook'));
// app.get('/', (req, res) => res.send('Bot is running'));

// // Set webhook explicitly
// const webhookUrl = 'https://alarmbot-d1r4.onrender.com'
// async function setWebhook() {
//   const webhookUrl = `${webhookUrl}/webhook`;
//   try {
//     await bot.telegram.setWebhook(webhookUrl);
//     console.log(`Webhook set to ${webhookUrl}`);
//     const webhookInfo = await bot.telegram.getWebhookInfo();
//     console.log('Webhook info:', JSON.stringify(webhookInfo, null, 2));
//   } catch (err) {
//     console.error('Failed to set webhook:', err);
//   }
// }

// // Start server
// const PORT = 3007; // Use Render's PORT or fallback to 3000
// app.listen(PORT, async () => {
//   console.log(`Server running on port ${PORT}`);
//   await setWebhook();
//   bot.launch({ webhook: { domain: 'https://alarmbot-d1r4.onrender.com', path: '/webhook' } })
//     .then(() => console.log('Bot started via webhook'))
//     .catch((err) => console.error('Bot launch error:', err));
// });



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
  if (!ctx.chat) return next();
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
  if (!user) return;

  // Cancel existing jobs
  [user.morningJobName, user.eveningJobName].forEach((jobName) => {
    if (jobName && activeJobs[jobName]) {
      activeJobs[jobName].cancel();
      delete activeJobs[jobName];
    }
  });

  // Schedule morning message
  const [mHour, mMin] = user.morningTime.split(':').map(Number);
  const morningJobName = `morning_${chatId}`;
  const morningJob = schedule.scheduleJob(
    { hour: mHour, minute: mMin, tz: 'Asia/Phnom_Penh' },
    () => sendScheduledMessage(chatId, 'morning')
  );

  // Schedule evening message
  const [eHour, eMin] = user.eveningTime.split(':').map(Number);
  const eveningJobName = `evening_${chatId}`;
  const eveningJob = schedule.scheduleJob(
    { hour: eHour, minute: eMin, tz: 'Asia/Phnom_Penh' },
    () => sendScheduledMessage(chatId, 'evening')
  );

  // Update user with job names
  user.morningJobName = morningJobName;
  user.eveningJobName = eveningJobName;
  activeJobs[morningJobName] = morningJob;
  activeJobs[eveningJobName] = eveningJob;
  await user.save();
}

async function sendScheduledMessage(chatId, timeOfDay) {
  const user = await User.findOne({ chatId });
  if (!user) return;

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
    user[`pending${timeOfDay[0].toUpperCase() + timeOfDay.slice(1)}`] = true;
    await user.save();
  } catch (err) {
    console.error(`Failed to send ${timeOfDay} message to chatId ${chatId}:`, err);
  }

  // Set timeout for missed activity (6 hours)
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
      } catch (err) {
        console.error(`Failed to send missed activity message to chatId ${chatId}:`, err);
      }
    }
  }, 6 * 60 * 60 * 1000);
}

// Commands
bot.command('start', async (ctx) => {
  await scheduleUserJobs(ctx.chat.id);
  const keyboard = Markup.keyboard([
    ['⏰ Set Morning Time', '🌙 Set Evening Time'],
    ['📊 My Stats', '❌ Unsubscribe'],
  ]).resize();

  await ctx.reply('Welcome! Manage your routines:', keyboard);
});

bot.hears(/Set (Morning|Evening) Time/, async (ctx) => {
  const timeOfDay = ctx.match[1].toLowerCase();
  await ctx.reply(
    `Enter ${timeOfDay} time in 24h format (HH:MM)\nExample: ${timeOfDay === 'morning' ? '07:30' : '20:00'}`
  );
});

bot.hears(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, async (ctx) => {
  const time = ctx.message.text;
  const isMorning = parseInt(time.split(':')[0]) < 12;
  const field = isMorning ? 'morningTime' : 'eveningTime';

  ctx.user[field] = time;
  await ctx.user.save();
  await scheduleUserJobs(ctx.chat.id);

  await ctx.reply(`${isMorning ? 'Morning' : 'Evening'} time set to ${time}!`);
});

bot.hears('📊 My Stats', async (ctx) => {
  const stats = `
📊 Your Stats:
- Streak: ${ctx.user.streak} days
- Morning: ${ctx.user.morningTime}
- Evening: ${ctx.user.eveningTime}
- Last Active: ${ctx.user.lastActive ? ctx.user.lastActive.toLocaleString() : 'Never'}
  `;
  await ctx.reply(stats);
});

bot.hears('❌ Unsubscribe', async (ctx) => {
  [ctx.user.morningJobName, ctx.user.eveningJobName].forEach((jobName) => {
    if (activeJobs[jobName]) {
      activeJobs[jobName].cancel();
      delete activeJobs[jobName];
    }
  });

  await User.deleteOne({ _id: ctx.user._id });
  await ctx.reply('Unsubscribed! Use /start to resubscribe.');
});

// Callbacks
bot.action(/ack_(morning|evening)/, async (ctx) => {
  const timeOfDay = ctx.match[1];
  ctx.user[`pending${timeOfDay[0].toUpperCase() + timeOfDay.slice(1)}`] = false;
  ctx.user.streak += 1;
  await ctx.user.save();

  await ctx.answerCbQuery(`Great job! ${ctx.user.streak} day streak!`);
  await ctx.deleteMessage();
});

bot.action(/skip_(morning|evening)/, async (ctx) => {
  const timeOfDay = ctx.match[1];
  ctx.user[`pending${timeOfDay[0].toUpperCase() + timeOfDay.slice(1)}`] = false;
  await ctx.user.save();

  await ctx.answerCbQuery('Okay, skipped for today.');
  await ctx.deleteMessage();
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
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL; // Set this in Render.com as your public URL

async function setWebhook() {
  try {
    await bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`);
    console.log(`Webhook set to ${WEBHOOK_URL}/webhook`);
    const webhookInfo = await bot.telegram.getWebhookInfo();
    console.log('Webhook info:', JSON.stringify(webhookInfo, null, 2));
  } catch (err) {
    console.error('Failed to set webhook:', err);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await setWebhook();
});