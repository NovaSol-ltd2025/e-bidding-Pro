import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { projectData } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({ error: "GEMINI_API_KEY is not configured." });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `จากข้อมูลโครงการที่กำลังจะเข้าประมูลดังนี้:
- ประเภทงาน: ${projectData.jobType}
- หน่วยงาน: ${projectData.agencyName}
- ราคากลาง: ${Number(projectData.medianPrice).toLocaleString()} บาท
- ราคางบประมาณ: ${Number(projectData.budgetPrice).toLocaleString()} บาท
- จำนวนคนงาน: ${projectData.totalWorkers} คน (หัวหน้างาน: ${projectData.supervisors} คน)
- ระยะเวลาสัญญา: ${projectData.durationMonths || 12} เดือน
- พื้นที่/จังหวัด: ${projectData.location || "กรุงเทพฯ และปริมณฑล"}

ช่วยคำนวณและประเมิน:
1. โครงสร้างต้นทุนที่เหมาะสม (Cost Breakdown):
   - ค่าแรงงานรวมสวัสดิการ (Labor & Welfare Cost)
   - ค่าวัสดุสิ้นเปลือง/เคมีภัณฑ์/ฟุ่มเฟือย (Consumables)
   - ค่าเครื่องมือ อุปกรณ์ และค่าเสื่อม (Machinery & Tools)
   - ค่าบริหารจัดการสำนักงาน (Overhead)
   - กำไรสุทธิคาดการณ์ (Net Profit)
2. กลยุทธ์การตั้งราคาเสนอประมูล (3 ระดับ):
   - ราคาปลอดภัย (Safe Margin): ได้กำไรดี ชนะได้หากคู่แข่งไม่ตัดราคาดุเดือด
   - ราคากลยุทธ์แข่งขันสูง (Competitive Price): โอกาสชนะสูงมาก ยังมีกำไร
   - ราคาเส้นตายจุดคุ้มทุน (Break-even Floor): ต่ำกว่านี้จะขาดทุน ไม่ควรรับงาน
3. ข้อควรระวังในการประมูลงานนี้และเทคนิคการยื่นเอกสาร`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction:
          "คุณเป็นผู้เชี่ยวชาญการถอดแบบราคางานบริการและจัดทำใบเสนอราคา e-Bidding ภาครัฐ ตอบเป็นภาษาไทย มีตัวเลขคำนวณที่ชัดเจนและเป็นไปได้จริงตามมาตรฐานจัดซื้อจัดจ้างภาครัฐ (เงินเดือน + ประกันสังคม 5% + ค่าบริหารจัดการ + ค่าวัสดุอุปกรณ์ + VAT 7%)",
        temperature: 0.2,
      },
    });

    res.status(200).json({ recommendation: response.text });
  } catch (error: any) {
    console.error("AI Estimation Error:", error);
    res.status(500).json({ error: error.message || "Failed to estimate cost" });
  }
}
