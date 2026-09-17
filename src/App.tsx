import React, { useState, useEffect } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { ProjectTable } from './components/ProjectTable';
import { PriceSimulator } from './components/PriceSimulator';
import { GoogleSheetsSync } from './components/GoogleSheetsSync';
import { ProjectModal } from './components/ProjectModal';
import { EBiddingProject } from './types';
import { initialProjects } from './data/mockProjects';
import { 
  projectToSheetRow, 
  appendSheetRows, 
  readSheetRows, 
  parseSheetRowToProject,
  fetchAllDataFromGAS,
  apiSaveProject,
  apiDeleteProject,
  apiSyncAllProjects
} from './utils/googleSheets';
import { 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  FileSpreadsheet, 
  ExternalLink, 
  X, 
  Zap, 
  ArrowRight,
  Database,
  CloudUpload
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  
  // Enforce empty state initially - data must come from Google Sheets!
  const [projects, setProjects] = useState<EBiddingProject[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<EBiddingProject | null>(null);

  // Google Sheets integration states
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [isTokenActive, setIsTokenActive] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [isLoadingFromSheet, setIsLoadingFromSheet] = useState<boolean>(true);
  const [isSavingToSheet, setIsSavingToSheet] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [quickWebhookInput, setQuickWebhookInput] = useState<string>('');
  const [syncNotification, setSyncNotification] = useState<{
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  } | null>(null);

  // Auto connect and pull data from Google Sheet via Google Apps Script on mount
  useEffect(() => {
    async function initSheetSync() {
      setIsLoadingFromSheet(true);
      let targetWebhook = '';

      // 1. Check server-side sheet config (/api/sheets/config)
      try {
        const cfgRes = await fetch('/api/sheets/config');
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          if (cfg.webhookUrl) {
            targetWebhook = cfg.webhookUrl;
            setWebhookUrl(cfg.webhookUrl);
            setQuickWebhookInput(cfg.webhookUrl);
          }
          if (cfg.spreadsheetId) setSpreadsheetId(cfg.spreadsheetId);
          if (cfg.spreadsheetUrl) setSpreadsheetUrl(cfg.spreadsheetUrl);
        }
      } catch (e) {
        console.warn('Could not read server sheet config:', e);
      }

      // 2. Fallback to localStorage if server had no webhook saved
      if (!targetWebhook) {
        const localWebhook = localStorage.getItem('ebidding_apps_script_url');
        if (localWebhook) {
          targetWebhook = localWebhook;
          setWebhookUrl(localWebhook);
          setQuickWebhookInput(localWebhook);
        }
      }

      // 3. Fallback for OAuth credentials
      const savedToken = sessionStorage.getItem('google_sheets_token');
      const savedSheetId = localStorage.getItem('ebidding_sheet_id');
      const savedSheetUrl = localStorage.getItem('ebidding_sheet_url');
      if (savedToken) setIsTokenActive(true);
      if (savedSheetId) setSpreadsheetId(savedSheetId);
      if (savedSheetUrl) setSpreadsheetUrl(savedSheetUrl);

      // 4. Force pull from Google Sheet via GAS Webhook
      if (targetWebhook) {
        setSyncNotification({
          type: 'info',
          message: 'กำลังเชื่อมต่อ Google Apps Script เพื่อดึงข้อมูลโครงการจาก Google Sheet...',
        });
        const res = await fetchAllDataFromGAS(targetWebhook);
        if (res.projects) {
          setProjects(res.projects);
          setIsTokenActive(true);
          const timeStr = new Date().toLocaleTimeString('th-TH');
          setLastSyncedTime(timeStr);
          setSyncNotification({
            type: 'success',
            message: `ดึงข้อมูลจาก Google Sheet สำเร็จ: พบ ${res.projects.length} โครงการ (เวลา ${timeStr})`,
          });
        } else {
          setSyncNotification({
            type: 'warning',
            message: `ไม่สามารถดึงข้อมูลจาก Google Apps Script ได้: ${res.error || 'กรุณาตรวจสอบการตั้งค่าชีต'}`,
          });
        }
      } else if (savedToken && savedSheetId) {
        // Fallback: Google Sheets OAuth API
        try {
          const rawRows = await readSheetRows(savedToken, savedSheetId, 'eBidding_Data!A2:V1000');
          const sheetProjects: EBiddingProject[] = [];
          rawRows.forEach((row, i) => {
            const p = parseSheetRowToProject(row, i);
            if (p) sheetProjects.push(p);
          });
          setProjects(sheetProjects);
          const timeStr = new Date().toLocaleTimeString('th-TH');
          setLastSyncedTime(timeStr);
          setSyncNotification({
            type: 'success',
            message: `ดึงข้อมูลจาก Google Sheets สำเร็จ (${sheetProjects.length} โครงการ)`,
          });
        } catch (err: any) {
          setSyncNotification({
            type: 'warning',
            message: `ดึงข้อมูลผ่าน OAuth ไม่สำเร็จ: ${err.message}`,
          });
        }
      } else {
        // No Google Sheet configured yet
        setSyncNotification({
          type: 'warning',
          message: 'ระบบพร้อมเชื่อมต่อ Google Sheet: กรุณาระบุ Google Apps Script Webhook URL เพื่อเริ่มดึงและบันทึกข้อมูลเข้าชีตถาวร',
        });
      }

      setIsLoadingFromSheet(false);
    }

    initSheetSync();
  }, []);

  // Refresh from Google Sheet (Pull latest)
  const handleRefreshFromSheet = async () => {
    const effectiveWebhook = webhookUrl || localStorage.getItem('ebidding_apps_script_url');
    if (!effectiveWebhook) {
      setActiveTab('sheets');
      setSyncNotification({
        type: 'warning',
        message: 'กรุณาระบุ Google Apps Script Webhook URL ก่อนเพื่อดึงข้อมูลจาก Google Sheet',
      });
      return;
    }

    setIsLoadingFromSheet(true);
    setSyncNotification({
      type: 'info',
      message: 'กำลังดึงข้อมูลล่าสุดจาก Google Sheet ผ่าน Google Apps Script...',
    });

    const res = await fetchAllDataFromGAS(effectiveWebhook);
    if (res.projects) {
      setProjects(res.projects);
      setIsTokenActive(true);
      const timeStr = new Date().toLocaleTimeString('th-TH');
      setLastSyncedTime(timeStr);
      setSyncNotification({
        type: 'success',
        message: `ดึงข้อมูลล่าสุดจาก Google Sheet สำเร็จ: พบ ${res.projects.length} โครงการ (เวลา ${timeStr})`,
      });
    } else {
      setSyncNotification({
        type: 'error',
        message: `ดึงข้อมูลล้มเหลว: ${res.error || 'กรุณาตรวจสอบการเชื่อมต่อ'}`,
      });
    }
    setIsLoadingFromSheet(false);
  };

  // Quick connect handler for top banner
  const handleQuickConnectSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = quickWebhookInput.trim();
    if (!url) return;

    setIsLoadingFromSheet(true);
    setSyncNotification({
      type: 'info',
      message: 'กำลังเชื่อมต่อและดึงข้อมูลจาก Google Apps Script...',
    });

    try {
      await fetch('/api/sheets/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: url }),
      }).catch(() => null);

      localStorage.setItem('ebidding_apps_script_url', url);
      setWebhookUrl(url);

      const res = await fetchAllDataFromGAS(url);
      if (res.projects) {
        setProjects(res.projects);
        setIsTokenActive(true);
        const timeStr = new Date().toLocaleTimeString('th-TH');
        setLastSyncedTime(timeStr);
        setSyncNotification({
          type: 'success',
          message: `🎉 เชื่อมต่อ Google Sheet สำเร็จ! ดึงข้อมูลได้ ${res.projects.length} โครงการ ข้อมูลทุกอย่างจะถูกบันทึกลงชีตนี้เสมอ`,
        });
      } else {
        setSyncNotification({
          type: 'warning',
          message: `บันทึก Webhook URL แล้ว แต่ยังดึงข้อมูลไม่ได้: ${res.error || 'ตรวจสอบสิทธิ์ Everyone/Anyone ใน Apps Script'}`,
        });
      }
    } catch (err: any) {
      setSyncNotification({
        type: 'error',
        message: `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err.message}`,
      });
    } finally {
      setIsLoadingFromSheet(false);
    }
  };

  // Handlers for project CRUD with 100% Google Sheets Persistence
  const handleSaveProject = async (savedProject: EBiddingProject) => {
    setIsSavingToSheet(true);
    setSyncNotification({
      type: 'info',
      message: `กำลังส่งข้อมูลโครงการ "${savedProject.projectNo}" เข้า Google Sheet...`,
    });

    const effectiveWebhook = webhookUrl || localStorage.getItem('ebidding_apps_script_url');

    if (effectiveWebhook) {
      // 1. Direct 2-way sync via Google Apps Script (Primary & Most Stable)
      const result = await apiSaveProject(savedProject, effectiveWebhook);
      if (result.success) {
        setProjects((prev) => {
          const index = prev.findIndex((p) => p.id === savedProject.id || p.projectNo === savedProject.projectNo);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = savedProject;
            return updated;
          }
          return [savedProject, ...prev];
        });

        const timeStr = new Date().toLocaleTimeString('th-TH');
        setLastSyncedTime(timeStr);
        setSyncNotification({
          type: 'success',
          message: `✓ บันทึกโครงการ "${savedProject.projectNo}" ลงใน Google Sheet เรียบร้อยแล้ว (เวลา ${timeStr})`,
        });
      } else {
        setSyncNotification({
          type: 'error',
          message: `บันทึกลง Google Sheet ไม่สำเร็จ: ${result.message} (กรุณาตรวจสอบสิทธิ์ Google Apps Script)`,
        });
        // Still update local UI so user does not lose input
        setProjects((prev) => [savedProject, ...prev.filter((p) => p.id !== savedProject.id)]);
      }
    } else {
      // Fallback: OAuth
      const savedToken = sessionStorage.getItem('google_sheets_token');
      const targetSheetId = spreadsheetId || localStorage.getItem('ebidding_sheet_id');
      if (savedToken && targetSheetId) {
        try {
          const row = projectToSheetRow(savedProject);
          await appendSheetRows(savedToken, targetSheetId, 'eBidding_Data!A:V', [row]);
          setProjects((prev) => [savedProject, ...prev]);
          setSyncNotification({
            type: 'success',
            message: `✓ บันทึกลง Google Sheet สำเร็จ (${savedProject.projectNo})`,
          });
        } catch (err: any) {
          setSyncNotification({
            type: 'error',
            message: `บันทึกลง Google Sheet ล้มเหลว: ${err.message}`,
          });
        }
      } else {
        // No sheet connected - alert user clearly
        setProjects((prev) => [savedProject, ...prev]);
        setSyncNotification({
          type: 'warning',
          message: `⚠️ บันทึกในหน้าจอแล้ว แต่ยังไม่ได้ระบุ Google Apps Script Webhook URL ข้อมูลนี้จึงยังไม่ถูกส่งเข้า Google Sheet — กรุณาระบุ Webhook URL เพื่อบันทึกถาวร`,
        });
      }
    }

    setIsSavingToSheet(false);
  };

  const handleDeleteProject = async (id: string) => {
    const target = projects.find((p) => p.id === id);
    const projectNo = target?.projectNo || id;

    const effectiveWebhook = webhookUrl || localStorage.getItem('ebidding_apps_script_url');
    if (effectiveWebhook && target) {
      setSyncNotification({
        type: 'info',
        message: `กำลังลบโครงการ "${projectNo}" ออกจาก Google Sheet...`,
      });
      const result = await apiDeleteProject(projectNo, effectiveWebhook);
      if (result.success) {
        setProjects((prev) => prev.filter((p) => p.id !== id && p.projectNo !== projectNo));
        setSyncNotification({
          type: 'success',
          message: `✓ ลบโครงการ "${projectNo}" ออกจาก Google Sheet เรียบร้อยแล้ว`,
        });
        return;
      }
    }

    // Local remove
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleEditProject = (project: EBiddingProject) => {
    setEditingProject(project);
    setIsModalOpen(true);
  };

  const handleAddNewProject = () => {
    setEditingProject(null);
    setIsModalOpen(true);
  };

  const handleImportCsv = async (newProjects: EBiddingProject[]) => {
    setProjects((prev) => [...newProjects, ...prev]);
    const effectiveWebhook = webhookUrl || localStorage.getItem('ebidding_apps_script_url');
    if (effectiveWebhook && newProjects.length > 0) {
      setSyncNotification({
        type: 'info',
        message: `กำลังส่ง ${newProjects.length} โครงการที่นำเข้าขึ้น Google Sheet...`,
      });
      const res = await apiSyncAllProjects([...newProjects, ...projects], effectiveWebhook);
      if (res.success) {
        setSyncNotification({
          type: 'success',
          message: `✓ ส่งข้อมูลนำเข้า ${newProjects.length} รายการขึ้น Google Sheet สำเร็จแล้ว`,
        });
      }
    }
  };

  const handleSyncProjectsFromSheet = (sheetProjects: EBiddingProject[]) => {
    setProjects(sheetProjects);
    setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
  };

  // Optional: load sample data for preview if user wishes
  const handleLoadSampleDemoData = () => {
    setProjects(initialProjects);
    setSyncNotification({
      type: 'info',
      message: 'โหลดข้อมูลตัวอย่างสำหรับทดลองดูสถิติ (หากต้องการบันทึกลง Google Sheet ของคุณ ให้กดปุ่ม "ซิงค์โครงการขึ้นชีต" ในแท็บ Google Sheets)',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewProjectModal={handleAddNewProject}
        totalProjects={projects.length}
        isSheetsConnected={Boolean(webhookUrl || isTokenActive)}
        isLoadingFromSheet={isLoadingFromSheet}
        onRefreshFromSheet={handleRefreshFromSheet}
        lastSyncedTime={lastSyncedTime}
      />

      {/* Sub-header Breadcrumb Bar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span className="text-slate-400">ระบบ e-Bidding</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-800">
              {activeTab === 'dashboard' && 'Bidding Analytics (Thailand) • สรุปภาพรวมสถิติ'}
              {activeTab === 'projects' && 'Project Database • ฐานข้อมูลโครงการ 22 คอลัมน์'}
              {activeTab === 'simulator' && 'Labor & Cost Estimator • จำลองราคาเสนอและวิเคราะห์ต้นทุน'}
              {activeTab === 'sheets' && 'Google Sheets & GAS Sync • การเชื่อมต่อฐานข้อมูลชีต'}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {spreadsheetUrl && (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium"
              >
                <FileSpreadsheet className="w-3 h-3" />
                <span>เปิดชีต</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-medium text-[11px] border border-slate-200">
              ฐานข้อมูล Google Sheet
            </span>
          </div>
        </div>
      </div>

      {/* Persistent Sync Status & Prompt Banner */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        {/* Banner 1: Unconfigured Google Sheet Alert with Quick Setup */}
        {!webhookUrl && !isTokenActive && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 shadow-xs mb-3 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900">
                  ระบบถูกตั้งค่าให้บันทึกและดึงข้อมูลจาก Google Sheet เสมอ (ไม่ใช้ Local Storage เพื่อความเสถียร 100%)
                </p>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  วาง Google Apps Script Webhook URL ด้านขวาเพื่อเริ่มดึงและบันทึกข้อมูลเข้าชีตของคุณโดยตรง หรือคลิก "วิธีติดตั้ง Apps Script"
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <form onSubmit={handleQuickConnectSheet} className="flex gap-1.5 w-full sm:w-auto">
                <input
                  type="url"
                  placeholder="วาง Webhook URL (exec)..."
                  value={quickWebhookInput}
                  onChange={(e) => setQuickWebhookInput(e.target.value)}
                  className="bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-mono w-48 sm:w-64 outline-none focus:border-blue-500 shadow-xs"
                />
                <button
                  type="submit"
                  disabled={isLoadingFromSheet || !quickWebhookInput}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-xs whitespace-nowrap"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>เชื่อมต่อชีต</span>
                </button>
              </form>

              <button
                onClick={() => setActiveTab('sheets')}
                className="px-3 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold cursor-pointer shadow-xs whitespace-nowrap"
              >
                ดูโค้ด Apps Script
              </button>

              {projects.length === 0 && (
                <button
                  onClick={handleLoadSampleDemoData}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium cursor-pointer whitespace-nowrap"
                >
                  ลองดูตัวอย่าง (Demo)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Banner 2: Active Connection Indicator */}
        {webhookUrl && (
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl px-4 py-2.5 shadow-xs mb-3 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-emerald-900">
                เชื่อมต่อ Google Sheet (Apps Script 2-Way Sync)
              </span>
              <span className="text-slate-400 hidden sm:inline">•</span>
              <span className="text-slate-600 text-[11px]">
                {projects.length} โครงการในระบบ
              </span>
              {lastSyncedTime && (
                <span className="text-slate-500 text-[11px] font-mono">
                  (ซิงค์ล่าสุด: {lastSyncedTime})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRefreshFromSheet}
                disabled={isLoadingFromSheet}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium cursor-pointer shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 text-emerald-600 ${isLoadingFromSheet ? 'animate-spin' : ''}`} />
                <span>ดึงข้อมูลล่าสุด (Pull)</span>
              </button>

              <button
                onClick={() => setActiveTab('sheets')}
                className="text-xs text-emerald-700 hover:text-emerald-900 font-medium underline"
              >
                จัดการชีต
              </button>
            </div>
          </div>
        )}

        {/* Banner 3: Sync Notification Toast */}
        {syncNotification && (
          <div className={`p-3 rounded-xl border mb-3 text-xs flex items-center justify-between gap-2 transition-all shadow-xs ${
            syncNotification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
            syncNotification.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-900' :
            syncNotification.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-900' :
            'bg-blue-50 border-blue-200 text-blue-900'
          }`}>
            <div className="flex items-center gap-2">
              {syncNotification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {syncNotification.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              {syncNotification.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />}
              {syncNotification.type === 'info' && <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />}
              <span className="font-medium">{syncNotification.message}</span>
            </div>
            <button
              onClick={() => setSyncNotification(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {isLoadingFromSheet && projects.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs my-6 space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">กำลังเชื่อมต่อและดึงข้อมูลจาก Google Sheet...</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              ระบบกำลังเชื่อมต่อผ่าน Google Apps Script เพื่อนำเข้าข้อมูลโครงการล่าสุดจาก Google Sheet ของคุณ
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <AnalyticsDashboard
                projects={projects}
                onNavigateToSimulator={() => setActiveTab('simulator')}
                onNavigateToProjects={() => setActiveTab('projects')}
              />
            )}

            {activeTab === 'projects' && (
              <ProjectTable
                projects={projects}
                onAddNew={handleAddNewProject}
                onEdit={handleEditProject}
                onDelete={handleDeleteProject}
                onImportCsv={handleImportCsv}
                onNavigateToSheets={() => setActiveTab('sheets')}
                onOpenSimulator={() => setActiveTab('simulator')}
              />
            )}

            {activeTab === 'simulator' && (
              <PriceSimulator
                historicalProjects={projects}
                spreadsheetId={spreadsheetId}
                spreadsheetUrl={spreadsheetUrl}
                isTokenActive={Boolean(webhookUrl || isTokenActive)}
                onSaveAsProject={(p) => {
                  setEditingProject(p as EBiddingProject);
                  setIsModalOpen(true);
                }}
              />
            )}

            {activeTab === 'sheets' && (
              <GoogleSheetsSync
                projects={projects}
                onSyncProjectsFromSheet={handleSyncProjectsFromSheet}
                spreadsheetId={spreadsheetId}
                setSpreadsheetId={setSpreadsheetId}
                spreadsheetUrl={spreadsheetUrl}
                setSpreadsheetUrl={setSpreadsheetUrl}
                isTokenActive={Boolean(webhookUrl || isTokenActive)}
                setIsTokenActive={setIsTokenActive}
                webhookUrl={webhookUrl}
                setWebhookUrl={setWebhookUrl}
                onRefreshFromSheet={handleRefreshFromSheet}
                isLoadingFromSheet={isLoadingFromSheet}
                lastSyncedTime={lastSyncedTime}
              />
            )}
          </>
        )}
      </main>

      {/* Project Add/Edit Modal */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProject(null);
        }}
        onSave={handleSaveProject}
        editingProject={editingProject}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
            <span className="font-semibold text-slate-700">E-BIDDING PRO</span>
            <span>• ระบบวิเคราะห์และจำลองราคาจัดซื้อจัดจ้างภาครัฐ</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Direct 2-Way Google Sheets Persistence (GAS Webhook & 22-Col Schema)
          </div>
        </div>
      </footer>
    </div>
  );
}
