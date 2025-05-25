require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');
const mongoose = require('mongoose');
const express = require('express');
const bodyParser = require('body-parser');

// Initialize Express app
const app = express();
app.use(bodyParser.json());

// Connect to MongoDB with error handling
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://ChoengRayu:C9r6nhxOVLCUkkGd@cluster0.2ott03t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB connected successfully');
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// User schema
const userSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  alarms: [{
    time: String,
    jobName: String,
    pending: { type: Boolean, default: false }
  }],
  streak: { type: Number, default: 0 },
  lastActive: Date
});
const User = mongoose.model('User', userSchema);

// Initialize bot with webhook mode
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not set');
  process.exit(1);
}
const bot = new TelegramBot(token, { polling: false });

// Webhook endpoint
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Store active jobs
const activeJobs = {};

// Start server and set webhook
const PORT = process.env.PORT;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  const webhookUrl = `${process.env.WEBHOOK_URL || 'https://alarmbot-1h93.onrender.com'}/webhook`;
  try {
    await bot.setWebHook(webhookUrl);
    console.log('Webhook set successfully to', webhookUrl);
  } catch (err) {
    console.error('Error setting webhook:', err);
  }
});

// Schedule all alarms for a user
async function scheduleUserAlarms(chatId) {
  try {
    const user = await User.findOne({ chatId });
    if (!user) return;

    user.alarms.forEach(alarm => {
      if (alarm.jobName && activeJobs[alarm.jobName]) {
        activeJobs[alarm.jobName].cancel();
        delete activeJobs[alarm.jobName];
      }
    });

    user.alarms.forEach((alarm, index) => {
      const [hour, minute] = alarm.time.split(':').map(Number);
      const jobName = `alarm_${chatId}_${index}`;
      activeJobs[jobName] = schedule.scheduleJob(
        { hour, minute, tz: 'Asia/Phnom_Penh' },
        async () => await sendAlarmMessage(chatId, index)
      );
      alarm.jobName = jobName;
    });

    await user.save();
  } catch (err) {
    console.error('Error scheduling alarms:', err);
  }
}

// Send alarm message with 1-hour timeout
async function sendAlarmMessage(chatId, alarmIndex) {
  try {
    const user = await User.findOne({ chatId });
    if (!user || alarmIndex >= user.alarms.length) return;

    const alarm = user.alarms[alarmIndex];
    const message = `🔔 Alarm at ${alarm.time}! Reply "OK" when done.`;
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "I did it!", callback_data: `ack_${alarmIndex}` }],
          [{ text: "Skip", callback_data: `skip_${alarmIndex}` }]
        ]
      }
    };

    await bot.sendMessage(chatId, message, options);
    alarm.pending = true;
    await user.save();

    setTimeout(async () => {
      const updatedUser = await User.findOne({ chatId });
      if (!updatedUser || alarmIndex >= updatedUser.alarms.length) return;
      const updatedAlarm = updatedUser.alarms[alarmIndex];
      if (updatedAlarm.pending) {
        await bot.sendMessage(chatId, `⚠️ You missed your alarm at ${updatedAlarm.time}. Streak reset!`);
        updatedUser.streak = 0;
        updatedAlarm.pending = false;
        await updatedUser.save();
      }
    }, 60 * 60 * 1000); // 1 hour
  } catch (err) {
    console.error('Error sending alarm message:', err);
  }
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    let user = await User.findOne({ chatId });
    if (!user) {
      user = new User({ chatId, alarms: [] });
      await user.save();
    }

    const options = {
      reply_markup: {
        keyboard: [
          [{ text: "⏰ Add Alarm" }, { text: "📋 List Alarms" }],
          [{ text: "📊 My Stats" }, { text: "❌ Unsubscribe" }]
        ],
        resize_keyboard: true
      }
    };

    await bot.sendMessage(chatId,
      `Welcome! Use /addalarm HH:MM to set exactly 10 alarms.\n` +
      `Current alarms: ${user.alarms.length}/10`,
      options
    );
  } catch (err) {
    console.error('Error handling /start:', err);
    await bot.sendMessage(chatId, 'Something went wrong. Please try again later.');
  }
});

// // Handle /addalarm command
// bot.onText(/\/addalarm (\d{2}:\d{2})/, async (msg, match) => {
//   const chatId = msg.chat.id;
//   const time = match[1];
//   try {
//     const user = await User.findOne({ chatId });
//     if (!user) {
//       await bot.sendMessage(chatId, "Please use /start first.");
//       return;
//     }

//     if (user.alarms.length >= 10) {
//       await bot.sendMessage(chatId, "You already have 10 alarms set!");
//       return;
//     }

//     user.alarms.push({ time, pending: false });
//     await user.save();
//     await scheduleUserAlarms(chatId);

//     const remaining = 10 - user.alarms.length;
//     await bot.sendMessage(chatId,
//       `Alarm set for ${time}. ${remaining} more alarms needed to reach 10.`
//     );
//   } catch (err) {
//     console.error('Error handling /addalarm:', err);
//   }
// });

// // Handle callback queries
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
//         await bot.editMessageReplyMarkup(
//           { inline_keyboard: [] },
//           { chat_id: chatId, message_id: callbackQuery.message.message_id }
//         );
//       }
//     } else if (data.startsWith('skip_')) {
//       const alarmIndex = parseInt(data.split('_')[1]);
//       if (alarmIndex < user.alarms.length) {
//         user.alarms[alarmIndex].pending = false;
//         await user.save();

//         await bot.answerCallbackQuery(callbackQuery.id, {
//           text: "Okay, skipped for today."
//         });
//         await bot.editMessageReplyMarkup(
//           { inline_keyboard: [] },
//           { chat_id: chatId, message_id: callbackQuery.message.message_id }
//         );
//       }
//     }
//   } catch (err) {
//     console.error('Error handling callback query:', err);
//   }
// });

// // Handle "List Alarms" command
// bot.onText(/List Alarms/, async (msg) => {
//   const chatId = msg.chat.id;
//   try {
//     const user = await User.findOne({ chatId });
//     if (!user || user.alarms.length === 0) {
//       await bot.sendMessage(chatId, "You have no alarms set.");
//       return;
//     }

//     const alarmList = user.alarms.map((alarm, index) =>
//       `${index + 1}. ${alarm.time}`
//     ).join('\n');
//     await bot.sendMessage(chatId, `Your alarms:\n${alarmList}`);
//   } catch (err) {
//     console.error('Error listing alarms:', err);
//   }
// });


// ... (keep the initial setup code the same until bot command handlers)

// Improved /addalarm handler with confirmation
bot.onText(/\/addalarm (\d{2}:\d{2})/, async (msg, match) => {
  const chatId = msg.chat.id;
  const time = match[1];
  
  // Validate time format
  const [hours, minutes] = time.split(':').map(Number);
  if (hours > 23 || minutes > 59) {
    return await bot.sendMessage(chatId, "⛔ Invalid time format! Please use HH:MM (24-hour format)");
  }

  try {
    const user = await User.findOne({ chatId });
    if (!user) return await bot.sendMessage(chatId, "⚠️ Please use /start first");
    
    if (user.alarms.length >= 10) {
      return await bot.sendMessage(chatId, 
        "⛔ Maximum limit reached! You can only set 10 alarms\n" +
        "Use 'List Alarms' to see your current alarms"
      );
    }

    // Check for duplicate alarm time
    if (user.alarms.some(alarm => alarm.time === time)) {
      return await bot.sendMessage(chatId, `⏰ Alarm at ${time} already exists!`);
    }

    user.alarms.push({ time });
    await user.save();
    await scheduleUserAlarms(chatId);

    // Enhanced confirmation message
    await bot.sendMessage(chatId,
      `✅ Successfully added alarm at ${time}\n\n` +
      `📊 Current status:\n` +
      `- Total alarms: ${user.alarms.length}/10\n` +
      `- Next alarm: ${getNextAlarmTime(user.alarms)}`
    );

  } catch (err) {
    console.error('Error handling /addalarm:', err);
    await bot.sendMessage(chatId, "⚠️ Failed to add alarm. Please try again");
  }
});

// New helper function to get next alarm time
function getNextAlarmTime(alarms) {
  if (alarms.length === 0) return "No upcoming alarms";
  
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const nextAlarm = alarms
    .map(a => {
      const [h, m] = a.time.split(':').map(Number);
      return { time: a.time, minutes: h * 60 + m };
    })
    .sort((a, b) => a.minutes - b.minutes)
    .find(a => a.minutes > currentTime);

  return nextAlarm ? nextAlarm.time : `Tomorrow at ${alarms[0].time}`;
}

// Improved List Alarms handler
bot.onText(/List Alarms/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const user = await User.findOne({ chatId });
    
    if (!user) {
      return await bot.sendMessage(chatId, 
        "⚠️ No alarms found!\n" +
        "Use /start to initialize your profile\n" +
        "Then use /addalarm HH:MM to set alarms"
      );
    }

    if (user.alarms.length === 0) {
      return await bot.sendMessage(chatId,
        "⏰ You don't have any alarms set!\n\n" +
        "Use /addalarm HH:MM to create new alarms\n" +
        "Example: /addalarm 08:30"
      );
    }

    // Format alarm list with numbers and emojis
    const alarmList = user.alarms
      .map((alarm, index) => `${index + 1}. ⏰ ${alarm.time}`)
      .join('\n');

    // Add header and status information
    const message = 
      `📋 Your Alarms (${user.alarms.length}/10):\n\n${alarmList}\n\n` +
      `Next alarm: ${getNextAlarmTime(user.alarms)}\n` +
      `Current streak: ${user.streak} days`;

    await bot.sendMessage(chatId, message);

  } catch (err) {
    console.error('Error listing alarms:', err);
    await bot.sendMessage(chatId, "⚠️ Failed to retrieve alarms. Please try again");
  }
});

// ... (rest of the code remains the same)

// Handle "My Stats" command
bot.onText(/My Stats/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const user = await User.findOne({ chatId });
    if (!user) return;

    const statsMessage = `
📊 Your Stats:
- Current Streak: ${user.streak} days
- Alarms Set: ${user.alarms.length}/10
- Last Active: ${user.lastActive ? user.lastActive.toLocaleString() : 'Never'}
    `;
    await bot.sendMessage(chatId, statsMessage);
  } catch (err) {
    console.error('Error showing stats:', err);
  }
});

// Handle "Unsubscribe" command
bot.onText(/Unsubscribe/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const user = await User.findOne({ chatId });
    if (!user) return;

    user.alarms.forEach(alarm => {
      if (alarm.jobName && activeJobs[alarm.jobName]) {
        activeJobs[alarm.jobName].cancel();
        delete activeJobs[alarm.jobName];
      }
    });

    await User.deleteOne({ chatId });
    await bot.sendMessage(chatId,
      "You've been unsubscribed. Use /start to subscribe again."
    );
  } catch (err) {
    console.error('Error unsubscribing:', err);
  }
});

// Log bot status
bot.getMe().then((me) => {
  console.log(`Bot ${me.username} is running`);
}).catch(err => {
  console.error('Error getting bot info:', err);
});

