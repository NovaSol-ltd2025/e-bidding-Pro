export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  try {
    const webhookUrl = req.body.webhookUrl;
    if (!webhookUrl) {
      return res.status(400).json({ status: "error", message: "ยังไม่ได้ตั้งค่า Webhook URL" });
    }

    const payload = {
      action: "save_project",
      data: req.body.project || req.body,
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });

    const result = await response.json().catch(async () => {
      const txt = await response.text().catch(() => "");
      return { status: response.ok ? "success" : "error", message: txt };
    });

    res.status(200).json(result);
  } catch (error: any) {
    console.error("Save project error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
}
