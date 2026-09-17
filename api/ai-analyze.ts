import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { projects, prompt, context } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error: "GEMINI_API_KEY is not configured in server environment.",
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `คุณเป็นผู้เชี่ยวชาญด้านการวิเคราะห์ข้อมูลจัดซื้อจัดจ้างภาครัฐ (e-Bidding Specialist & Procurement Strategist) ประจำประเทศไทย
มีความเชี่ยวชาญสูงในการวิเคราะห์โครงสร้างราคาและต้นทุนงานบริการภาครัฐ เช่น งานจ้างเหมาบริการทำความสะอาดอาคาร, งานรักษาความปลอดภัย (รปภ.), งานจ้างเหมาบริการคนสวนและดูแลภูมิทัศน์, งานช่างและบำรุงรักษาอาคาร

ข้อมูลที่คุณต้องคำนึงถึง:
1. กฎหมายแรงงานไทย: ค่าแรงขั้นต่ำตามประกาศกระทรวงแรงงาน (330-400 บาท/วัน หรือประมาณ 10,000 - 12,000+ บาท/เดือน/คน), เงินสมทบประกันสังคม 5% (สูงสุด 750 บ./ด.), กองทุนเงินทดแทน, ค่าล่วงเวลา/วันหยุดตาม พรบ.คุ้มครองแรงงาน, สวัสดิการและชุดยูนิฟอร์ม
2. ค่าวัสดุสิ้นเปลือง / เคมีภัณฑ์ / ถุงขยะ / น้ำยาทำความสะอาด (Consumable materials): ปกติเฉลี่ยประมาณ 5-15% ของมูลค่างาน หรือ 500-1,500 บาท/คน/เดือน
3. ค่าเครื่องมือและเครื่องจักร (Scrubber, High pressure washer, Vacuum ฯลฯ): ค่าเสื่อมราคาและซ่อมบำรุง 3-8%
4. ค่าใช้จ่ายในการบริหารจัดการและกำไร (Overhead & Profit): ปกติ 8-15%, หักภาษี ณ ที่จ่าย 1%, VAT 7%
5. พฤติกรรมการตัดราคา (Price Cut Ratio): วิเคราะห์ว่างานประเภทนี้มักมีการเคาะราคาต่ำกว่าราคากลางกี่ % และต่ำกว่างบประมาณกี่ % คู่แข่งหลักชอบเคาะตัดราคาเท่าไหร่เพื่อชนะโดยไม่ขาดทุน

ให้ตอบเป็นภาษาไทยอย่างกระชับ ชัดเจน มีตัวเลขและเปอร์เซ็นต์ประกอบเพื่อการตัดสินใจที่แม่นยำ`;

    const userMessage = `นี่คือชุดข้อมูลโครงการ e-Bidding ที่บันทึกไว้:\n${JSON.stringify(
      projects,
      null,
      2
    )}\n\nคำถาม / เป้าหมายการวิเคราะห์: ${
      prompt ||
      "ช่วยวิเคราะห์ภาพรวมแนวโน้มราคาที่ชนะ สัดส่วนการลดราคาจากราคากลางและงบประมาณ พร้อมคำแนะนำการตั้งราคาเพื่อเข้าร่วมประมูลงานต่อไป"
    }\nบริบทเพิ่มเติม: ${context || "ไม่มี"}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: userMessage,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    res.status(200).json({ analysis: response.text });
  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI analysis" });
  }
}
