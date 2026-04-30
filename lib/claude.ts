import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// 使用 Haiku（最省钱，适合测试）
const FAST_MODEL = "claude-haiku-4-5";
const IMAGE_MODEL = process.env.ANTHROPIC_IMAGE_MODEL || FAST_MODEL;

export interface UserProfile {
  name: string;
  height: number;
  weight: number;
  age: number;
  gender: string;
  activityLevel: string;
  goal: string;
  targetWeight?: number | null;
}

const GOAL_MAP: Record<string, string> = {
  lose_fat: "减脂",
  run_speed: "提升跑步速度",
  heart_rate: "改善心率与心肺功能",
  build_muscle: "增肌",
};

const ACTIVITY_MAP: Record<string, string> = {
  sedentary: "久坐（几乎不运动）",
  light: "轻度活跃（每周1-3天运动）",
  moderate: "中度活跃（每周3-5天运动）",
  active: "高度活跃（每周6-7天运动）",
  very_active: "极度活跃（每天高强度运动）",
};

function calcBMR(profile: UserProfile): number {
  if (profile.gender === "male") {
    return 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
  }
  return 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
}

function calcTDEE(profile: UserProfile): number {
  const multipliers: Record<string, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
  };
  return calcBMR(profile) * (multipliers[profile.activityLevel] || 1.55);
}

export async function generateDietPlan(profile: UserProfile): Promise<string> {
  const tdee = Math.round(calcTDEE(profile));
  const bmi = profile.weight / ((profile.height / 100) ** 2);

  const response = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 4000,
    system: "你是一位专业营养师，请用中文回复，只输出 JSON 不要其他文字。",
    messages: [{
      role: "user",
      content: `为以下用户制定一周饮食计划：
性别：${profile.gender === "male" ? "男" : "女"}，年龄：${profile.age}岁
身高：${profile.height}cm，体重：${profile.weight}kg，BMI：${bmi.toFixed(1)}
活动量：${ACTIVITY_MAP[profile.activityLevel]}
目标：${GOAL_MAP[profile.goal]}${profile.targetWeight ? `，目标体重：${profile.targetWeight}kg` : ""}
TDEE：${tdee}卡

输出 JSON：
{
  "dailyCalories": 数字,
  "macros": {"protein": 数字, "carbs": 数字, "fat": 数字},
  "weeklyPlan": {
    "monday": {"breakfast": {"name":"食物","calories":数字,"description":"描述"}, "lunch": {...}, "dinner": {...}, "snack": {...}},
    "tuesday": {...}, "wednesday": {...}, "thursday": {...}, "friday": {...}, "saturday": {...}, "sunday": {...}
  },
  "tips": ["建议1","建议2","建议3"],
  "forbidden": ["食物1","食物2"]
}`,
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

export async function generateTrainingPlan(profile: UserProfile): Promise<string> {
  const response = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 4000,
    system: "你是一位专业健身教练，请用中文回复，只输出 JSON 不要其他文字。",
    messages: [{
      role: "user",
      content: `为以下用户制定一周训练计划：
性别：${profile.gender === "male" ? "男" : "女"}，年龄：${profile.age}岁，体重：${profile.weight}kg
活动量：${ACTIVITY_MAP[profile.activityLevel]}
目标：${GOAL_MAP[profile.goal]}

输出 JSON：
{
  "weeklyPlan": {
    "monday": [{"exercise":"名称","sets":数字或null,"reps":"次数/时间","duration":分钟数字,"intensity":"低/中/高","notes":"注意"}],
    "tuesday": [], "wednesday": [...], "thursday": [...], "friday": [...], "saturday": [...], "sunday": []
  },
  "tips": ["建议1","建议2"],
  "warmup": "热身描述",
  "cooldown": "冷身描述",
  "weeklyGoal": "目标描述"
}`,
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

export type ImageAnalysisResult =
  | {
      type: "food";
      foodName: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      description: string;
      confidence?: number;
      calorieRange?: { min: number; max: number };
      needsClarification?: boolean;
      clarificationQuestion?: string;
      items?: Array<{
        name: string;
        estimatedGrams: number;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        confidence: number;
      }>;
    }
  | {
      type: "workout";
      activity: string;
      duration: number;
      distance?: string;
      pace?: string;
      heartRate?: string;
      caloriesBurned?: number;
      details: string;
      suggestions: string;
    }
  | { type: "unknown" };

export type TextAnalysisResult =
  | {
      type: "food";
      foodName: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      meal: string;
      description: string;
    }
  | {
      type: "workout";
      activity: string;
      duration: number;
      distance?: string;
      pace?: string;
      heartRate?: string;
      caloriesBurned?: number;
      details: string;
      suggestions: string;
    }
  | { type: "unknown" };

export async function analyzeImage(
  imageBase64: string,
  mimeType: string = "image/jpeg",
  caption?: string
): Promise<ImageAnalysisResult> {
  const trimmedCaption = caption?.trim();
  const hintBlock = trimmedCaption
    ? `

用户附带的描述（可作为识别提示，例如食物名称、份量、品牌、烹调方式等）：
"""${trimmedCaption}"""

请优先采信描述中明确提到的食物名称与份量，并据此估算营养。如果描述与图片明显不符，以图片为准但在 description 中说明。`
    : "";

  const response = await anthropic.messages.create({
    model: IMAGE_MODEL,
    max_tokens: 900,
    system: "你是一位营养师兼健身教练，请用中文回复，只输出 JSON 不要其他文字。",
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: imageBase64 },
        },
        {
          type: "text",
          text: `判断这张图片是食物照片还是运动/健身截图（如跑步、游泳、骑行的App截图），然后按对应格式输出JSON：

如果是食物，请先拆分可见食材/组成部分，再估算总营养。重点规则：
- 必须按组成部分估算，例如米饭、鸡肉、鸡蛋、酱汁、油、蔬菜分别估算。
- estimatedGrams 是熟重或可食部重量，无法确定时给保守中间值。
- 油、酱汁、糖、奶油、炸粉如果可能存在，要作为单独 item 或在 description 说明。
- confidence 是 0 到 1，表示你对食物识别与份量估算的整体信心。
- calorieRange 表示合理热量范围；份量不清楚时范围要变宽。
- 如果 confidence < 0.62，或份量/容器大小/隐藏酱汁很不确定，needsClarification 必须为 true，并给出一个最有帮助的问题。

如果是食物：{
  "type":"food",
  "foodName":"总名称",
  "calories":总热量数字,
  "protein":总蛋白质数字,
  "carbs":总碳水数字,
  "fat":总脂肪数字,
  "description":"份量与估算依据，说明哪些地方不确定",
  "confidence":0到1数字,
  "calorieRange":{"min":数字,"max":数字},
  "needsClarification":布尔值,
  "clarificationQuestion":"如果需要确认，问用户一个具体问题；否则空字符串",
  "items":[
    {"name":"食材名称","estimatedGrams":数字,"calories":数字,"protein":数字,"carbs":数字,"fat":数字,"confidence":0到1数字}
  ]
}

如果是运动截图：{"type":"workout","activity":"活动名称","duration":分钟数字,"distance":"距离如5.2km","pace":"配速如5:30/km","heartRate":"平均心率如148bpm","caloriesBurned":数字,"details":"详细数据摘要","suggestions":"根据数据给出1-2句专业建议"}

如果无法判断：{"type":"unknown"}${hintBlock}`,
        },
      ],
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : text);
  } catch {
    return { type: "unknown" };
  }
}

export async function analyzeTextEntry(description: string): Promise<TextAnalysisResult> {
  const response = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 500,
    system: "你是一位营养师兼健身教练，请用中文回复，只输出 JSON 不要其他文字。",
    messages: [{
      role: "user",
      content: `判断以下文字是在记录食物、运动/训练，还是无法判断，然后按对应格式输出 JSON：
描述：${description}

如果是食物：{"type":"food","foodName":"食物名称","calories":数字,"protein":数字克,"carbs":数字克,"fat":数字克,"meal":"breakfast或lunch或dinner或snack","description":"份量与食材简述"}

如果是运动/训练：{"type":"workout","activity":"运动名称","duration":分钟数字，如果未知填0,"distance":"距离如5.2km，可省略","pace":"配速如5:30/km，可省略","heartRate":"平均心率如148bpm，可省略","caloriesBurned":数字，可省略,"details":"训练内容摘要","suggestions":"根据训练给出1-2句专业建议"}

如果文字同时包含食物和运动，优先判断用户主要想记录的内容；如果无法判断：{"type":"unknown"}`,
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : text);
  } catch {
    return { type: "unknown" };
  }
}

export async function analyzeTextFood(description: string): Promise<{
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal: string;
  description: string;
}> {
  const response = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 300,
    system: "你是一位营养师，请用中文回复，只输出 JSON 不要其他文字。",
    messages: [{
      role: "user",
      content: `根据以下食物描述估算营养信息，只输出 JSON：
描述：${description}
{"foodName":"食物名称","calories":数字,"protein":数字克,"carbs":数字克,"fat":数字克,"meal":"breakfast或lunch或dinner或snack","description":"份量与食材简述"}`,
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : text);
  } catch {
    return { foodName: description, calories: 0, protein: 0, carbs: 0, fat: 0, meal: "snack", description: "无法解析" };
  }
}

export async function analyzeFoodImage(
  imageBase64: string,
  mimeType: string = "image/jpeg"
): Promise<{
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  description: string;
}> {
  const response = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 500,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: imageBase64,
          },
        },
        {
          type: "text",
          text: `分析这张食物图片，只输出 JSON 不要其他文字：
{"foodName":"食物名称","calories":数字,"protein":数字,"carbs":数字,"fat":数字,"description":"份量和食材描述"}`,
        },
      ],
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : text);
  } catch {
    return { foodName: "未知食物", calories: 0, protein: 0, carbs: 0, fat: 0, description: "无法识别" };
  }
}
