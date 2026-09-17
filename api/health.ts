export default function handler(req: any, res: any) {
  res.status(200).json({
    status: "ok",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
}
