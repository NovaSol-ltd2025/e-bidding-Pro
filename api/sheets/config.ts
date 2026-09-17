// Note: Vercel serverless functions have no persistent local disk,
// so this endpoint intentionally does not store state server-side.
// The webhook URL is kept in the browser's localStorage (see
// src/components/GoogleSheetsSync.tsx) and sent explicitly with every
// sync/save/delete request, so the app still works correctly without
// server-side persistence here.
export default function handler(req: any, res: any) {
  if (req.method === "POST") {
    return res.status(200).json({ status: "success", config: req.body || {} });
  }
  return res.status(200).json({});
}
