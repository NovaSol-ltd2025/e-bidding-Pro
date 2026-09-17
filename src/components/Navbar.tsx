import React, { useState } from 'react';
import { 
  BarChart3, 
  Table, 
  Calculator, 
  FileSpreadsheet, 
  PlusCircle, 
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Share2,
  Copy,
  Check,
  ExternalLink,
  X,
  Info
} from 'lucide-react';

export type NavTab = 'dashboard' | 'projects' | 'simulator' | 'sheets';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  onOpenNewProjectModal: () => void;
  totalProjects: number;
  isSheetsConnected: boolean;
  isLoadingFromSheet?: boolean;
  onRefreshFromSheet?: () => void;
  lastSyncedTime?: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewProjectModal,
  totalProjects,
  isSheetsConnected,
  isLoadingFromSheet = false,
  onRefreshFromSheet,
  lastSyncedTime,
}) => {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // The active live URL that is running right now
  const liveUrl = "https://ais-dev-amwycx5jdhg7xz6lo7d27j-667571402726.asia-east1.run.app";

  const handleCopyLink = (urlToCopy: string) => {
    navigator.clipboard.writeText(urlToCopy).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }).catch(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const tabs = [
    {
      id: 'dashboard' as NavTab,
      label: 'แดชบอร์ดสถิติ e-Bidding',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'projects' as NavTab,
      label: 'ฐานข้อมูลโครงการ',
      icon: Table,
      badge: totalProjects,
    },
    {
      id: 'simulator' as NavTab,
      label: 'คำนวณต้นทุน & จำลองราคาเสนอ',
      icon: Calculator,
      badge: 'สูตร e-Bidding',
    },
    {
      id: 'sheets' as NavTab,
      label: 'Google Sheets & Apps Script',
      icon: FileSpreadsheet,
      badge: isSheetsConnected ? 'ชีตหลัก 100%' : 'ต้องตั้งค่าชีต',
    },
  ];

  return (
    <header className="sticky top-0 z-40 shadow-sm">
      {/* Top Corporate Strip */}
      <div className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo & Brand Title */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white shadow-sm font-bold text-sm tracking-wider">
                EB
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">E-BIDDING PRO</span>
                <span className="hidden sm:inline-block text-[11px] text-blue-400 font-medium tracking-normal">
                  | ระบบฐานข้อมูล Google Sheet จัดซื้อจัดจ้างภาครัฐ
                </span>
              </div>
            </div>

            {/* Right Status & Actions */}
            <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
              {/* Google Sheets Live Status Pill */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 rounded border border-slate-800 text-[11px] font-mono">
                <span className="text-slate-400 hidden md:inline">DATA SOURCE:</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${isSheetsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <span className={isSheetsConnected ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-medium'}>
                    {isSheetsConnected ? 'GOOGLE SHEET (LIVE)' : 'SHEET UNCONFIGURED'}
                  </span>
                </div>
                {lastSyncedTime && (
                  <span className="text-slate-500 text-[10px] hidden lg:inline">
                    ({lastSyncedTime})
                  </span>
                )}
              </div>

              {/* Force Pull from Google Sheet button */}
              {onRefreshFromSheet && (
                <button
                  onClick={onRefreshFromSheet}
                  disabled={isLoadingFromSheet}
                  title="ดึงข้อมูลล่าสุดทั้งหมดจาก Google Sheet (Google Apps Script)"
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded border border-slate-700 text-[11px] transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 text-emerald-400 ${isLoadingFromSheet ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">
                    {isLoadingFromSheet ? 'กำลังดึงชีต...' : 'ดึงข้อมูลชีต'}
                  </span>
                </button>
              )}

              {/* Total records count */}
              <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded text-[11px] font-mono font-medium border border-slate-700 hidden sm:inline-block">
                {totalProjects} โครงการ
              </span>

              {/* Share / Copy Link Button */}
              <button
                onClick={() => setIsShareModalOpen(true)}
                title="ดูลิงก์และวิธีแชร์ระบบให้ทีมงานใช้งาน"
                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded text-xs font-semibold border transition active:scale-95 cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700"
              >
                <Share2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">แชร์ให้ทีม</span>
              </button>

              {/* Add Project Button */}
              <button
                onClick={onOpenNewProjectModal}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded shadow-sm transition active:scale-95 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ เพิ่มโครงการ</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal Dialog */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white text-slate-800 rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold">ลิงก์เข้าใช้งานสำหรับทีมงาน</h3>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Option 1: Live Working URL */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>1. ลิงก์ที่เข้าใช้งานได้ทันที 100% (แนะนำ)</span>
                  </span>
                  <span className="text-[10px] bg-emerald-200/60 text-emerald-800 px-1.5 py-0.5 rounded font-medium">
                    ออนไลน์พร้อมใช้
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={liveUrl}
                    className="flex-1 bg-white border border-emerald-300 rounded px-2.5 py-1.5 text-xs font-mono text-slate-800 outline-none select-all"
                  />
                  <button
                    onClick={() => handleCopyLink(liveUrl)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                  </button>
                  <a
                    href={liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded border border-slate-300 transition"
                    title="เปิดในแท็บใหม่"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <p className="text-[11px] text-emerald-800">
                  ทีมงานทุกคนสามารถเปิดลิงก์นี้ในเบราว์เซอร์เพื่อคำนวณราคาและซิงค์ข้อมูลกับ Google Sheet ได้ทันที
                </p>
              </div>

              {/* Option 2: Explaining Shared URL & How to activate */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Info className="w-3.5 h-3.5 text-blue-500" />
                  <span>2. เกี่ยวกับลิงก์แชร์หลัก (Shared URL) ที่ขึ้น "Page not found"</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  หากต้องการให้ลิงก์ <code className="bg-slate-200 px-1 rounded text-[11px] text-slate-800 font-mono">ais-pre-...</code> ใช้งานได้ คุณต้องกดปุ่ม <strong className="text-slate-800">"Share" (หรือ "แชร์")</strong> ที่มุมขวาบนสุดของหน้าต่าง Google AI Studio ก่อน 1 ครั้ง เพื่อให้ระบบของ Google Cloud ทำการเปิดสิทธิ์การเข้าถึงสาธารณะ
                </p>
                <div className="text-[11px] text-slate-500 bg-white border border-slate-200 rounded p-2 flex items-start gap-2">
                  <span className="font-bold text-blue-600 shrink-0">คำแนะนำ:</span>
                  <span>หากยังไม่ได้กดปุ่ม Share ที่หน้าต่าง AI Studio ให้ส่ง <strong>ลิงก์ที่ 1 ด้านบน</strong> ให้ทีมงานแทนได้เลยทันทีครับ</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Sub-header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto no-scrollbar py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md text-xs md:text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                  {tab.badge !== null && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive
                          ? 'bg-blue-800 text-white'
                          : tab.id === 'sheets' && !isSheetsConnected
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
