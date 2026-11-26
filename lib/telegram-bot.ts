import TelegramBot from "node-telegram-bot-api";
import { analyzeImage, analyzeTextEntry, generateCoachReply, type ImageAnalysisResult } from "./claude";
import { prisma } from "./prisma";
import type { BotRuntimeConfig } from "./bot-config";
import { addDays, dateKey, hourIn, shortLabel } from "./dates";
import { parseWeight, weightChange } from "./weight";
import { latestWeighIn, recordWeight } from "./weight-store";
import { targetCalories } from "./nutrition";

/** Whose data a bot reads and writes, and which Anthropic key it uses. */
interface BotContext {
  userId: number;
  apiKey: string | null;
}

// One TelegramBot per token (each user can connect their own bot). The context
// object is updated in place on every webhook call, so handlers always see the
// current owner and key.
const bots = new Map<string, { bot: TelegramBot; ctx: BotContext }>();

// node-telegram-bot-api dispatches events synchronously and does not await async
// listeners. On a serverless platform the function suspends as soon as the
// response is sent, killing in-flight handler work. We track each handler's
// promise here so the webhook route can await them via awaitInFlight().
const inFlight = new Set<Promise<unknown>>();

function track<Args extends unknown[]>(
  fn: (...args: Args) => Promise<unknown>
): (...args: Args) => void {
  return (...args: Args) => {
    const p = fn(...args).catch((err) => {
      console.error("Telegram handler error:", err);
    });
    inFlight.add(p);
    p.finally(() => inFlight.delete(p));
  };
}

export async function awaitInFlight(): Promise<void> {
  while (inFlight.size > 0) {
    await Promise.allSettled([...inFlight]);
  }
}

/** Returns the (cached) bot for this config, bound to the config's user. */
export function getBot(config: Pick<BotRuntimeConfig, "token" | "anthropicKey" | "userId">): TelegramBot {
  let entry = bots.get(config.token);
  if (!entry) {
    // Webhook mode: no polling, no built-in HTTP server. Updates arrive via
    // the webhook routes, which call bot.processUpdate().
    const bot = new TelegramBot(config.token, { polling: false, webHook: false });
    const ctx: BotContext = { userId: config.userId, apiKey: config.anthropicKey };
    setupHandlers(bot, ctx);
    entry = { bot, ctx };
    bots.set(config.token, entry);
  }
  entry.ctx.userId = config.userId;
  entry.ctx.apiKey = config.anthropicKey;
  return entry.bot;
}

// "Today" and the hour come from lib/dates.ts, shared with the web app.
const getTodayString = (date = new Date()) => dateKey(date);
const getHourInAppTimeZone = (date = new Date()) => hourIn(date);

function getMealByHour(date = new Date()): string {
  const hour = getHourInAppTimeZone(date);
  if (hour >= 6 && hour < 10) return "breakfast";
  if (hour >= 10 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 17) return "snack";
  return "dinner";
}

function detectMealFromText(text: string): string | null {
  if (/早餐|早饭|早上吃/.test(text)) return "breakfast";
  if (/午餐|午饭|中饭|中午吃/.test(text)) return "lunch";
  if (/晚餐|晚饭|晚上吃/.test(text)) return "dinner";
  if (/小食|零食|下午茶|点心|宵夜/.test(text)) return "snack";
  return null;
}

function looksLikeCoachQuestion(text: string): boolean {
  return /[?？]|吗$|呢$|什么|怎么|如何|为什么|可不可以|能不能|要不要|应该|建议|推荐|适合|安排|计划|怎么办|还差|够不够/.test(text);
}

const MEAL_NAME: Record<string, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "小食",
};

type FoodImageResult = Extract<ImageAnalysisResult, { type: "food" }>;

function getDeleteFoodKeyboard(logId: number) {
  return {
    inline_keyboard: [
      [{ text: "↩️ 删除这条食物记录", callback_data: `df:${logId}` }],
    ],
  };
}

function getFoodConfidence(result: FoodImageResult): number {
  return typeof result.confidence === "number" && Number.isFinite(result.confidence)
    ? Math.min(Math.max(result.confidence, 0), 1)
    : 1;
}

function formatCalorieRange(result: FoodImageResult): string {
  const min = result.calorieRange?.min;
  const max = result.calorieRange?.max;
  if (typeof min !== "number" || typeof max !== "number") return "";
  return `\n📏 合理范围：${Math.round(min)}–${Math.round(max)} 卡`;
}

function formatFoodItems(result: FoodImageResult): string {
  const items = result.items?.filter((item) => item.name && item.calories > 0) || [];
  if (items.length === 0) return "";

  const rows = items.slice(0, 6).map((item) => {
    const grams = item.estimatedGrams > 0 ? ` ${Math.round(item.estimatedGrams)}g` : "";
    return `• ${item.name}${grams} — ${Math.round(item.calories)}卡`;
  });

  return `\n\n🔎 *拆分估算*\n${rows.join("\n")}`;
}

/** Daily target: the latest diet plan's calories, else the shared formula (same rule as the dashboard). */
function getCalorieTarget(
  user: { gender: string; weight: number; height: number; age: number; activityLevel: string; goal: string },
  dietPlanContent?: string | null
): number {
  if (dietPlanContent) {
    try {
      const parsed = JSON.parse(dietPlanContent);
      if (typeof parsed?.dailyCalories === "number" && parsed.dailyCalories > 0) {
        return Math.round(parsed.dailyCalories);
      }
    } catch {}
  }
  return targetCalories(user);
}

async function getCaloriesSummary(userId: number, today: string): Promise<string> {
  const [user, logs, dietPlan] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.foodLog.findMany({ where: { userId, date: today } }),
    prisma.plan.findFirst({ where: { userId, type: "diet" }, orderBy: { createdAt: "desc" } }),
  ]);
  const totalCal = Math.round(logs.reduce((sum: number, l) => sum + l.calories, 0));
  if (!user) return `📊 今日摄入：${totalCal} 卡`;

  const target = getCalorieTarget(user, dietPlan?.content);
  const remaining = target - totalCal;
  const bar = remaining > 0 ? "✅" : "⚠️";
  return remaining >= 0
    ? `📊 今日摄入：${totalCal} / ${target} 卡\n${bar} 还可摄入 *${remaining}* 卡`
    : `📊 今日摄入：${totalCal} / ${target} 卡\n${bar} 已超出 *${Math.abs(remaining)}* 卡`;
}

function getPlanExcerpt(content: string | null | undefined): string | null {
  if (!content) return null;
  try {
    return JSON.stringify(JSON.parse(content)).slice(0, 1200);
  } catch {
    return content.slice(0, 1200);
  }
}

function formatWorkoutForCoach(log: { exercise: string; duration: number; completed: boolean; notes: string | null }): string {
  const parts = [`${log.exercise} ${log.duration}分钟`, log.completed ? "已完成" : "未完成"];
  try {
    const notes = JSON.parse(log.notes || "{}");
    if (notes.distance) parts.push(String(notes.distance));
    if (notes.pace) parts.push(String(notes.pace));
    if (notes.caloriesBurned) parts.push(`${notes.caloriesBurned}卡`);
  } catch {}
  return parts.join("，");
}

async function getCoachContext(userId: number, today: string) {
  const [user, foodLogs, trainingLogs, latestDietPlan, latestTrainingPlan] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.foodLog.findMany({
      where: { userId, date: today },
      orderBy: { createdAt: "asc" },
      select: { foodName: true, calories: true, protein: true, carbs: true, fat: true, meal: true },
    }),
    prisma.trainingLog.findMany({
      where: { userId, date: today },
      orderBy: { createdAt: "asc" },
      select: { exercise: true, duration: true, completed: true, notes: true },
    }),
    prisma.plan.findFirst({ where: { userId, type: "diet" }, orderBy: { createdAt: "desc" } }),
    prisma.plan.findFirst({ where: { userId, type: "training" }, orderBy: { createdAt: "desc" } }),
  ]);

  const totals = foodLogs.reduce(
    (acc, log) => ({
      calories: acc.calories + log.calories,
      protein: acc.protein + log.protein,
      carbs: acc.carbs + log.carbs,
      fat: acc.fat + log.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return {
    profile: user
      ? {
          name: user.name,
          height: user.height,
          weight: user.weight,
          age: user.age,
          gender: user.gender,
          activityLevel: user.activityLevel,
          goal: user.goal,
          targetWeight: user.targetWeight,
        }
      : null,
    today: {
      date: today,
      ...totals,
      targetCalories: user ? getCalorieTarget(user, latestDietPlan?.content) : null,
      foods: foodLogs.slice(-10).map((log) => `${MEAL_NAME[log.meal] || log.meal} ${log.foodName} ${Math.round(log.calories)}卡`),
      workouts: trainingLogs.slice(-8).map(formatWorkoutForCoach),
    },
    latestDietPlan: getPlanExcerpt(latestDietPlan?.content),
    latestTrainingPlan: getPlanExcerpt(latestTrainingPlan?.content),
  };
}

async function sendCoachReply(
  bot: TelegramBot,
  ctx: BotContext,
  chatId: number,
  message: string,
  editMessageId?: number
): Promise<void> {
  await bot.sendChatAction(chatId, "typing");
  const today = getTodayString();
  const context = await getCoachContext(ctx.userId, today);
  const reply = await generateCoachReply(message, context, { apiKey: ctx.apiKey });

  if (editMessageId) {
    await bot.editMessageText(reply, { chat_id: chatId, message_id: editMessageId });
    return;
  }

  await bot.sendMessage(chatId, reply);
}

async function getQuickFoods(userId: number) {
  // Top 5 most frequently logged foods (by count, last 30 days)
  const sinceStr = addDays(dateKey(), -30);
  const logs = await prisma.foodLog.findMany({
    where: { userId, date: { gte: sinceStr } },
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

function setupHandlers(bot: TelegramBot, ctx: BotContext) {
  // 欢迎命令
  bot.onText(/\/start/, track(async (msg) => {
    try {
      const chatId = msg.chat.id;
      await bot.sendMessage(
        chatId,
        `👋 你好！我是你的 AI 健身教练助理！

📸 发送食物照片，我会拆分食材、估算份量和卡路里，并直接记录；不准可以点删除。
✏️ 照片加说明会更准，例如：「午餐，饭半碗，鸡胸约120g，少酱」。也可以直接输入你吃了什么。
🏃 或输入你完成的运动，例如：「跑步 30 分钟 5 公里」
💬 也可以直接聊天问我饮食、训练、减脂、增肌建议；如果怕被当成记录，用 /chat 开头。

📋 指令列表：
/today - 查看今日饮食记录
/summary - 查看今日营养总结
/weight 55.2 - 记录今天的体重
/chat - 和 AI 教练聊天
/help - 显示帮助`,
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error("Error in /start handler:", err);
    }
  }));

  bot.onText(/\/help/, track(async (msg) => {
    await bot.sendMessage(
      msg.chat.id,
      `📖 *使用说明*

📸 *拍照记录食物*
直接发送食物图片，AI 会自动：
• 识别食物种类
• 拆分食材组成
• 估算每个组成部分的份量
• 估算卡路里
• 计算蛋白质/碳水/脂肪
• 识别后直接记录；结果不准可以点删除撤回

照片加说明会更准：
• 「午餐，饭半碗，鸡胸约120g，少酱」
• 「早餐，两个蛋，一片吐司，无糖咖啡」

✏️ *文字记录食物*
描述你吃了什么，例如：
• 「早餐：一碗白粥，一个鸡蛋」
• 「午饭吃了鸡肉饭和青菜」

🏃 *文字记录运动*
描述你完成的训练，例如：
• 「跑步 30 分钟 5 公里」
• 「深蹲 4 组，每组 12 次」

💬 *AI 教练聊天*
直接问问题即可，例如：
• 「今晚吃什么比较适合？」
• 「我今天还要不要跑步？」
也可以用 /chat 明确进入聊天：
• /chat 帮我看一下今天还差什么营养

⚖️ *记录体重*
/weight 55.2 - 记录今天的体重（同一天再记一次会覆盖）
/weight - 查看最近一次体重

📋 *指令*
/today - 今日饮食记录
/summary - 今日营养摘要
/weight - 记录或查看体重
/chat - 和 AI 教练聊天
/start - 欢迎信息`,
      { parse_mode: "Markdown" }
    );
  }));

  // /weight 55.2 → record today's weigh-in; /weight alone → show the latest one.
  bot.onText(/^\/weight(?:@\w+)?(?:\s+(.+))?$/, track(async (msg, match) => {
    const chatId = msg.chat.id;
    try {
      const input = match?.[1]?.trim();
      if (!input) {
        const last = await latestWeighIn(ctx.userId);
        await bot.sendMessage(
          chatId,
          last
            ? `⚖️ 最近一次体重：${last.weight} kg（${shortLabel(last.date)}）\n记录新体重：/weight 55.2`
            : "⚖️ 还没有体重记录。发送 /weight 55.2 记录今天的体重。"
        );
        return;
      }
      const weight = parseWeight(input);
      if (weight === null) {
        await bot.sendMessage(chatId, "❌ 请输入 20–300 之间的体重（kg），例如：/weight 55.2");
        return;
      }
      const { previous } = await recordWeight(ctx.userId, weight, getTodayString());
      const diff = previous ? weightChange(previous.weight, weight) : null;
      const trend =
        diff === null ? "" : diff === 0 ? `\n与 ${shortLabel(previous!.date)} 持平` : `\n较 ${shortLabel(previous!.date)} ${diff > 0 ? "+" : ""}${diff} kg`;
      await bot.sendMessage(chatId, `✅ 已记录今天的体重：${weight} kg${trend}`);
    } catch (err) {
      console.error("Error in /weight handler:", err);
      await bot.sendMessage(chatId, "❌ 记录体重失败，请稍后再试");
    }
  }));

  bot.onText(/^\/(?:chat|ask)(?:@\w+)?(?:\s+([\s\S]+))?$/, track(async (msg, match) => {
    const chatId = msg.chat.id;
    const question = match?.[1]?.trim();

    if (!question) {
      await bot.sendMessage(chatId, "你可以这样问我：/chat 今天晚餐吃什么比较适合？");
      return;
    }

    const processingMsg = await bot.sendMessage(chatId, "💬 AI 教练思考中...");
    try {
      await sendCoachReply(bot, ctx, chatId, question, processingMsg.message_id);
    } catch (err) {
      const error = err as { status?: number; message?: string };
      console.error("AI chat failed:", error?.status, error?.message);
      await bot.editMessageText("❌ AI 教练暂时没回上来，请稍后再试。", {
        chat_id: chatId,
        message_id: processingMsg.message_id,
      });
    }
  }));

  // 快速记录常用食物
  bot.onText(/\/quick/, track(async (msg) => {
    const chatId = msg.chat.id;
    const foods = await getQuickFoods(ctx.userId);
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
  }));

  // Handle quick log and delete callbacks
  bot.on("callback_query", track(async (query) => {
    if (!query.data || !query.message) return;

    if (query.data.startsWith("df:")) {
      const chatId = query.message.chat.id;
      const logId = Number(query.data.slice(3));

      if (!Number.isInteger(logId)) {
        await bot.answerCallbackQuery(query.id, { text: "无法识别要删除的记录", show_alert: true });
        return;
      }

      // Scoped to this bot's user: a forged callback can't delete someone else's entry.
      const log = await prisma.foodLog.findFirst({ where: { id: logId, userId: ctx.userId } });
      if (!log) {
        await bot.answerCallbackQuery(query.id, { text: "这条记录已经删除过了" });
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: query.message.message_id }
        );
        return;
      }

      const deleted = await prisma.foodLog.deleteMany({ where: { id: logId, userId: ctx.userId } });
      if (deleted.count === 0) {
        await bot.answerCallbackQuery(query.id, { text: "这条记录已经删除过了" });
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: query.message.message_id }
        );
        return;
      }

      const calSummary = await getCaloriesSummary(ctx.userId, log.date);

      await bot.answerCallbackQuery(query.id, { text: "已删除" });
      await bot.editMessageText(
        `↩️ 已删除食物记录：*${log.foodName}*\n🔥 ${Math.round(log.calories)} 卡\n\n${calSummary}`,
        { chat_id: chatId, message_id: query.message.message_id, parse_mode: "Markdown" }
      );
      return;
    }

    if (!query.data.startsWith("ql:")) return;
    const [, name, cal, prot, carbs, fat] = query.data.split(":");
    const chatId = query.message.chat.id;
    const today = getTodayString();
    const meal = getMealByHour();
    const log = await prisma.foodLog.create({
      data: {
        userId: ctx.userId,
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
    const calSummary = await getCaloriesSummary(ctx.userId, today);
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(
      chatId,
      `✅ 已记录 *${name}* 到${MEAL_NAME[meal]}\n🔥 ${Math.round(parseFloat(cal))} 卡\n\n${calSummary}`,
      { parse_mode: "Markdown", reply_markup: getDeleteFoodKeyboard(log.id) }
    );
  }));

  // 今日记录
  bot.onText(/\/today/, track(async (msg) => {
    const chatId = msg.chat.id;
    try {
      const today = getTodayString();
      const logs = await prisma.foodLog.findMany({
        where: { userId: ctx.userId, date: today },
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
  }));

  // 今日摘要
  bot.onText(/\/summary/, track(async (msg) => {
    const chatId = msg.chat.id;
    try {
      const today = getTodayString();
      const logs = await prisma.foodLog.findMany({ where: { userId: ctx.userId, date: today } });

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

      const calSummary = await getCaloriesSummary(ctx.userId, today);

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
  }));

  // 处理照片
  bot.on("photo", track(async (msg) => {
    const chatId = msg.chat.id;

    const processingMsg = await bot.sendMessage(chatId, "🔍 正在拆分食材和估算份量，请稍候...");

    try {
      const photos = msg.photo!;
      const largestPhoto = photos[photos.length - 1];
      const fileId = largestPhoto.file_id;

      const fileLink = await bot.getFileLink(fileId);
      const response = await fetch(fileLink);
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      const caption = msg.caption?.trim() || undefined;
      const result = await analyzeImage(base64, "image/jpeg", caption, { apiKey: ctx.apiKey });
      const today = getTodayString();

      if (result.type === "workout") {
        await prisma.trainingLog.create({
          data: {
            userId: ctx.userId,
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
        const meal = detectMealFromText(caption || "") || getMealByHour();
        const confidence = getFoodConfidence(result);
        const confidenceText = `${Math.round(confidence * 100)}%`;
        const calorieRangeText = formatCalorieRange(result);
        const itemBreakdown = formatFoodItems(result);

        const log = await prisma.foodLog.create({
          data: {
            userId: ctx.userId,
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

        const calSummary = await getCaloriesSummary(ctx.userId, today);
        await bot.editMessageText(
          `✅ *已记录 ${MEAL_NAME[meal]}！*\n\n🍽 *${result.foodName}*\n${result.description}\n\n🔥 卡路里：*${result.calories}* 卡${calorieRangeText}\n🥩 蛋白质：${result.protein}g\n🍞 碳水：${result.carbs}g\n🧈 脂肪：${result.fat}g\n🎯 估算信心：${confidenceText}${itemBreakdown}\n\n${calSummary}`,
          {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            parse_mode: "Markdown",
            reply_markup: getDeleteFoodKeyboard(log.id),
          }
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
  }));

  // 处理文字（食物、运动描述、餐别关键字，或普通 AI 聊天）
  bot.on("message", track(async (msg) => {
    try {
      if (msg.photo || msg.text?.startsWith("/")) return;
      const text = (msg.text || "").trim();
      const chatId = msg.chat.id;

      if (text.length < 2) {
        await bot.sendMessage(chatId, "📸 请发送食物照片，或描述你吃了什么/做了什么运动，例如：「早餐吃了一碗燕麦粥」或「跑步30分钟」");
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
            where: { userId: ctx.userId, date: today },
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

      if (looksLikeCoachQuestion(text)) {
        const processingMsg = await bot.sendMessage(chatId, "💬 AI 教练思考中...");
        try {
          await sendCoachReply(bot, ctx, chatId, text, processingMsg.message_id);
        } catch (err) {
          const error = err as { status?: number; message?: string };
          console.error("AI chat failed:", error?.status, error?.message);
          await bot.editMessageText("❌ AI 教练暂时没回上来，请稍后再试。", {
            chat_id: chatId,
            message_id: processingMsg.message_id,
          });
        }
        return;
      }

      // Treat as a food/workout description first; unclear messages become chat.
      const processingMsg = await bot.sendMessage(chatId, "🔍 正在判断是记录还是聊天...");

      try {
        const result = await analyzeTextEntry(text, { apiKey: ctx.apiKey });

        if (result.type === "unknown") {
          await sendCoachReply(bot, ctx, chatId, text, processingMsg.message_id);
          return;
        }

        const today = getTodayString();

        if (result.type === "workout") {
          await prisma.trainingLog.create({
            data: {
              userId: ctx.userId,
              date: today,
              exercise: result.activity,
              duration: Math.max(0, Math.round(result.duration || 0)),
              completed: true,
              notes: JSON.stringify({
                distance: result.distance,
                pace: result.pace,
                heartRate: result.heartRate,
                caloriesBurned: result.caloriesBurned,
                details: result.details,
                suggestions: result.suggestions,
                source: "telegram_text",
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
            `✅ *已记录运动！*\n\n🏃 *${result.activity}*（${Math.round(result.duration || 0)} 分钟）\n${rows ? `${rows}\n\n` : ""}📊 *训练摘要*\n${result.details}\n\n💡 *AI 建议*\n${result.suggestions}`,
            { chat_id: chatId, message_id: processingMsg.message_id, parse_mode: "Markdown" }
          );
          return;
        }

        if (result.calories === 0) {
          await sendCoachReply(bot, ctx, chatId, text, processingMsg.message_id);
          return;
        }

        // Prefer meal keyword from text, then AI result, then time-based
        const meal = detectMealFromText(text) || result.meal || getMealByHour();

        const log = await prisma.foodLog.create({
          data: {
            userId: ctx.userId,
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

        const calSummary = await getCaloriesSummary(ctx.userId, today);

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
          reply_markup: getDeleteFoodKeyboard(log.id),
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
  }));
}
