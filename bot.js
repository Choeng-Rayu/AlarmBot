
//it work
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
  bot.launch({ webhook: { domain: 'https://alarmbot-mbkv.onrender.com', path: '/webhook' } })
    .then(() => console.log('Bot started via webhook'))
    .catch((err) => console.error('Bot launch error:', err));
});


