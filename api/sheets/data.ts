export default async function handler(req: any, res: any) {
  try {
    const webhookUrl = (req.query.url as string) || "";

    if (!webhookUrl) {
      return res.status(200).json({
        status: "unconfigured",
        message: "ยังไม่ได้ระบุ Google Apps Script Webhook URL",
        projects: [],
        simulations: [],
      });
    }

    const fetchUrl = webhookUrl.includes("?")
      ? `${webhookUrl}&action=get_all_data`
      : `${webhookUrl}?action=get_all_data`;

    const response = await fetch(fetchUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "follow",
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        status: "error",
        message: "Google Apps Script ส่งค่ากลับมาไม่ใช่ JSON (กรุณาตรวจสอบว่าเลือก Who has access: Anyone หรือไม่)",
        rawResponse: text.substring(0, 300),
      });
    }

    res.status(200).json(data);
  } catch (error: any) {
    console.error("Failed to fetch from Google Apps Script:", error);
    res.status(500).json({ status: "error", message: error.message || "Failed to fetch from Google Apps Script" });
  }
}
