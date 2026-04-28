import TelegramBot from "node-telegram-bot-api";
import { analyzeImage, analyzeTextFood } from "./claude";
import { prisma } from "./prisma";

let bot: TelegramBot | null = null;

export function getBot(): TelegramBot {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.error("❌ TELEGRAM_BOT_TOKEN is not set");
      throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    // Webhook mode: no polling, no built-in HTTP server. Updates are delivered
    // via the /api/telegram/webhook route, which calls bot.processUpdate().
    bot = new TelegramBot(token, { polling: false, webHook: false });

    setupHandlers(bot);
    console.log("🤖 Telegram Bot 已启动（Webhook 模式）");
  }
  return bot;
}

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

function getMealByHour(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 10) return "breakfast";
  if (hour >= 10 && hour < 14) return "lunch";
  if (hour >= 14 && hour < 17) return "snack";
  return "dinner";
}

function detectMealFromText(text: string): string | null {
  if (/早餐|早饭|早上吃/.test(text)) return "breakfast";
  if (/午餐|午饭|中饭|中午吃/.test(text)) return "lunch";
  if (/晚餐|晚饭|晚上吃/.test(text)) return "dinner";
  if (/小食|零食|下午茶|点心|宵夜/.test(text)) return "snack";
  return null;
}

const MEAL_NAME: Record<string, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "小食",
};

async function getCaloriesSummary(today: string): Promise<string> {
  const user = await prisma.user.findFirst();
  const logs = await prisma.foodLog.findMany({ where: { date: today } });
  const totalCal = Math.round(logs.reduce((sum: number, l) => sum + l.calories, 0));

  if (!user) return `📊 今日摄入：${totalCal} 卡`;

  const bmr =
    user.gender === "male"
      ? 10 * user.weight + 6.25 * user.height - 5 * user.age + 5
      : 10 * user.weight + 6.25 * user.height - 5 * user.age - 161;
  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const tdee = Math.round(bmr * (multipliers[user.activityLevel] || 1.55));

  let target = tdee;
  if (user.goal === "lose_fat") target = tdee - 500;
  else if (user.goal === "build_muscle") target = tdee + 300;

  const remaining = target - totalCal;
  const bar = remaining > 0 ? "✅" : "⚠️";
  return remaining >= 0
    ? `📊 今日摄入：${totalCal} / ${target} 卡\n${bar} 还可摄入 *${remaining}* 卡`
    : `📊 今日摄入：${totalCal} / ${target} 卡\n${bar} 已超出 *${Math.abs(remaining)}* 卡`;
}

async function getQuickFoods() {
  // Top 5 most frequently logged foods (by count, last 30 days)
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().split("T")[0];
  const logs = await prisma.foodLog.findMany({
    where: { date: { gte: sinceStr } },
    select: { foodName: true, calories: true, protein: true, carbs: true, fat: true },
  });
  const freq: Record<string, { count: number; calories: number; protein: number; carbs: number; fat: number }> = {};
  for (const l of logs) {
    if (!freq[l.foodName])
      freq[l.foodName] = { count: 0, calories: l.calories, protein: l.protein, carbs: l.carbs, fat: l.fat };
    freq[l.foodName].count++;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([name, data]) => ({ name, ...data }));
}

function setupHandlers(bot: TelegramBot) {
  // 欢迎命令
  bot.onText(/\/start/, async (msg) => {
    try {
      const chatId = msg.chat.id;
      await bot.sendMessage(
        chatId,
        `👋 你好！我是你的 AI 健身教练助理！

📸 发送食物照片，我会自动识别并记录卡路里。
✏️ 也可以直接输入你吃了什么，例如：「早餐吃了一碗燕麦粥和两颗鸡蛋」

📋 指令列表：
/today - 查看今日饮食记录
/summary - 查看今日营养总结
/help - 显示帮助`,
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error("Error in /start handler:", err);
    }
  });

  bot.onText(/\/help/, async (msg) => {
    await bot.sendMessage(
      msg.chat.id,
      `📖 *使用说明*

📸 *拍照记录食物*
直接发送食物图片，AI 会自动：
• 识别食物种类
• 估算卡路里
• 计算蛋白质/碳水/脂肪
• 自动记录到今日日志

✏️ *文字记录食物*
描述你吃了什么，例如：
• 「早餐：一碗白粥，一个鸡蛋」
• 「午饭吃了鸡肉饭和青菜」

📋 *指令*
/today - 今日饮食记录
/summary - 今日营养摘要
/start - 欢迎信息`,
      { parse_mode: "Markdown" }
    );
  });

  // 快速记录常用食物
  bot.onText(/\/quick/, async (msg) => {
    const chatId = msg.chat.id;
    const foods = await getQuickFoods();
    if (foods.length === 0) {
      await bot.sendMessage(chatId, "还没有足够的记录。先发送食物照片或描述来建立你的常用食物库！");
      return;
    }
    const keyboard = foods.map((f) => [
      {
        text: `${f.name} (${Math.round(f.calories)}卡)`,
        callback_data: `ql:${f.name}:${f.calories}:${f.protein}:${f.carbs}:${f.fat}`,
      },
    ]);
    await bot.sendMessage(chatId, "⚡️ *快速记录常用食物*\n选择要记录的食物：", {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
  });

  // Handle quick log callback
  bot.on("callback_query", async (query) => {
    if (!query.data?.startsWith("ql:") || !query.message) return;
    const [, name, cal, prot, carbs, fat] = query.data.split(":");
    const chatId = query.message.chat.id;
    const today = getTodayString();
    const meal = getMealByHour();
    await prisma.foodLog.create({
      data: {
        userId: 1,
        date: today,
        meal,
        foodName: name,
        calories: parseFloat(cal),
        protein: parseFloat(prot),
        carbs: parseFloat(carbs),
        fat: parseFloat(fat),
        source: "telegram_quick",
      },
    });
    const calSummary = await getCaloriesSummary(today);
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(
      chatId,
      `✅ 已记录 *${name}* 到${MEAL_NAME[meal]}\n🔥 ${Math.round(parseFloat(cal))} 卡\n\n${calSummary}`,
      { parse_mode: "Markdown" }
    );
  });

  // 今日记录
  bot.onText(/\/today/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const today = getTodayString();
      const logs = await prisma.foodLog.findMany({
        where: { date: today },
        orderBy: { createdAt: "asc" },
      });

      if (logs.length === 0) {
        await bot.sendMessage(chatId, "📭 今天还没有饮食记录。发送食物照片或描述开始记录！");
        return;
      }

      const byMeal: Record<string, typeof logs> = {};
      for (const log of logs) {
        if (!byMeal[log.meal]) byMeal[log.meal] = [];
        byMeal[log.meal].push(log);
      }

      let text = `📅 *${today} 饮食记录*\n\n`;
      let totalCal = 0;

      for (const [meal, items] of Object.entries(byMeal)) {
        text += `*${MEAL_NAME[meal] || meal}*\n`;
        for (const item of items) {
          text += `• ${item.foodName} — ${Math.round(item.calories)}卡\n`;
          totalCal += item.calories;
        }
        text += "\n";
      }

      text += `📊 *今日合计：${Math.round(totalCal)} 卡路里*`;
      await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
    } catch (err) {
      console.error(err);
      await bot.sendMessage(chatId, "❌ 获取记录失败，请稍后重试。");
    }
  });

  // 今日摘要
  bot.onText(/\/summary/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const today = getTodayString();
      const logs = await prisma.foodLog.findMany({ where: { date: today } });

      const totals = logs.reduce(
        (
          acc: { calories: number; protein: number; carbs: number; fat: number },
          log: { calories: number; protein: number; carbs: number; fat: number }
        ) => ({
          calories: acc.calories + log.calories,
          protein: acc.protein + log.protein,
          carbs: acc.carbs + log.carbs,
          fat: acc.fat + log.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      const calSummary = await getCaloriesSummary(today);

      const text = `📊 *今日营养摘要*

🔥 卡路里：${Math.round(totals.calories)} 卡
🥩 蛋白质：${Math.round(totals.protein)}g
🍞 碳水化合物：${Math.round(totals.carbs)}g
🧈 脂肪：${Math.round(totals.fat)}g

${calSummary}

${logs.length === 0 ? "还没有记录，发送食物照片或描述开始追踪！" : `共记录 ${logs.length} 次进食`}`;

      await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
    } catch (err) {
      console.error(err);
      await bot.sendMessage(chatId, "❌ 获取摘要失败");
    }
  });

  // 处理照片
  bot.on("photo", async (msg) => {
    const chatId = msg.chat.id;

    const processingMsg = await bot.sendMessage(chatId, "🔍 正在分析食物图片，请稍候...");

    try {
      const photos = msg.photo!;
      const largestPhoto = photos[photos.length - 1];
      const fileId = largestPhoto.file_id;

      const fileLink = await bot.getFileLink(fileId);
      const response = await fetch(fileLink);
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      const result = await analyzeImage(base64, "image/jpeg");
      const today = getTodayString();

      if (result.type === "workout") {
        await prisma.trainingLog.create({
          data: {
            userId: 1,
            date: today,
            exercise: result.activity,
            duration: result.duration,
            completed: true,
            notes: JSON.stringify({
              distance: result.distance,
              pace: result.pace,
              heartRate: result.heartRate,
              caloriesBurned: result.caloriesBurned,
              details: result.details,
            }),
          },
        });

        const rows = [
          result.distance && `📍 距离：${result.distance}`,
          result.pace && `⚡️ 配速：${result.pace}`,
          result.heartRate && `❤️ 心率：${result.heartRate}`,
          result.caloriesBurned && `🔥 消耗：${result.caloriesBurned} 卡`,
        ]
          .filter(Boolean)
          .join("\n");

        await bot.editMessageText(
          `✅ *已记录运动！*\n\n🏃 *${result.activity}*（${result.duration} 分钟）\n${rows}\n\n📊 *数据摘要*\n${result.details}\n\n💡 *AI 建议*\n${result.suggestions}`,
          { chat_id: chatId, message_id: processingMsg.message_id, parse_mode: "Markdown" }
        );
      } else if (result.type === "food") {
        const caption = msg.caption || "";
        const meal = detectMealFromText(caption) || getMealByHour();

        await prisma.foodLog.create({
          data: {
            userId: 1,
            date: today,
            meal,
            foodName: result.foodName,
            calories: result.calories,
            protein: result.protein,
            carbs: result.carbs,
            fat: result.fat,
            source: "telegram",
          },
        });

        const calSummary = await getCaloriesSummary(today);
        await bot.editMessageText(
          `✅ *已记录 ${MEAL_NAME[meal]}！*\n\n🍽 *${result.foodName}*\n${result.description}\n\n🔥 卡路里：*${result.calories}* 卡\n🥩 蛋白质：${result.protein}g\n🍞 碳水：${result.carbs}g\n🧈 脂肪：${result.fat}g\n\n${calSummary}`,
          { chat_id: chatId, message_id: processingMsg.message_id, parse_mode: "Markdown" }
        );
      } else {
        await bot.editMessageText("❓ 无法识别图片，请发送食物照片或运动App截图（如跑步、游泳记录）。", {
          chat_id: chatId,
          message_id: processingMsg.message_id,
        });
      }
    } catch (err) {
      const error = err as { status?: number; message?: string };
      console.error("分析图片失败:", error?.status, error?.message);
      const errMsg =
        error?.status === 401
          ? "❌ API Key 无效，请联系管理员更新 Anthropic API Key。"
          : "❌ 分析失败，请重新发送图片或检查图片是否清晰。";
      await bot.editMessageText(errMsg, {
        chat_id: chatId,
        message_id: processingMsg.message_id,
      });
    }
  });

  // 处理文字（食物描述或餐别关键字）
  bot.on("message", async (msg) => {
    try {
      if (msg.photo || msg.text?.startsWith("/")) return;
      const text = (msg.text || "").trim();
      const chatId = msg.chat.id;

      if (text.length < 2) {
        await bot.sendMessage(chatId, "📸 请发送食物照片，或描述你吃了什么，例如：「早餐吃了一碗燕麦粥」");
        return;
      }

      // Check if it's a standalone meal keyword update (for updating last entry)
      const standaloneKeyword = detectMealFromText(text);
      const isShortKeyword = text.length <= 6 && standaloneKeyword;

      if (isShortKeyword) {
        try {
          // Update the most recent food log today to correct meal type
          const today = getTodayString();
          const last = await prisma.foodLog.findFirst({
            where: { date: today },
            orderBy: { createdAt: "desc" },
          });
          if (last) {
            await prisma.foodLog.update({
              where: { id: last.id },
              data: { meal: standaloneKeyword },
            });
            await bot.sendMessage(chatId, `✅ 已将「${last.foodName}」更新为 *${MEAL_NAME[standaloneKeyword]}*`, {
              parse_mode: "Markdown",
            });
          } else {
            await bot.sendMessage(chatId, `好的，下次记录将归入 *${MEAL_NAME[standaloneKeyword]}*`, {
              parse_mode: "Markdown",
            });
          }
        } catch (err) {
          console.error("Error updating meal:", err);
          await bot.sendMessage(chatId, "❌ 更新失败，请重试");
        }
        return;
      }

      // Treat as food description
      const processingMsg = await bot.sendMessage(chatId, "🔍 正在分析食物描述...");

      try {
        const result = await analyzeTextFood(text);

      if (result.calories === 0) {
        await bot.editMessageText("❓ 无法识别食物内容，请描述具体食物，例如：「午餐吃了鸡肉饭和青菜」", {
          chat_id: chatId,
          message_id: processingMsg.message_id,
        });
        return;
      }

      const today = getTodayString();
      // Prefer meal keyword from text, then AI result, then time-based
      const meal = detectMealFromText(text) || result.meal || getMealByHour();

      await prisma.foodLog.create({
        data: {
          userId: 1,
          date: today,
          meal,
          foodName: result.foodName,
          calories: result.calories,
          protein: result.protein,
          carbs: result.carbs,
          fat: result.fat,
          source: "telegram_text",
        },
      });

      const calSummary = await getCaloriesSummary(today);

      const replyText = `✅ *已记录 ${MEAL_NAME[meal] || meal}！*

🍽 *${result.foodName}*
${result.description}

🔥 卡路里：*${result.calories}* 卡
🥩 蛋白质：${result.protein}g
🍞 碳水：${result.carbs}g
🧈 脂肪：${result.fat}g

${calSummary}`;

      await bot.editMessageText(replyText, {
        chat_id: chatId,
        message_id: processingMsg.message_id,
        parse_mode: "Markdown",
      });
      } catch (err) {
        const error = err as { message?: string };
        console.error("分析文字失败:", error?.message);
        await bot.editMessageText("❌ 分析失败，请重试或发送食物照片", {
          chat_id: chatId,
          message_id: processingMsg.message_id,
        });
      }
    } catch (err) {
      console.error("Error in text message handler:", err);
    }
  });
}
