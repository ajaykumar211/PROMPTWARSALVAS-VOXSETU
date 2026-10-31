import React from 'react';
import { SupportedLang } from '../types/index.ts';
import { t } from '../utils/i18n.ts';
import { X, ShieldAlert, CheckCircle2, AlertTriangle, Cpu, HelpCircle } from 'lucide-react';

interface LimitationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: SupportedLang;
}

export const LimitationsModal: React.FC<LimitationsModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="limitations-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[#FFFFFF] p-6 shadow-2xl sm:p-8">
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full text-[#5A6279] hover:bg-[#F7F5F0] hover:text-[#14213D] focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-[#E1E4EE] pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h2 id="limitations-title" className="text-xl font-bold text-[#14213D]">
              {t(lang, 'limitations')}
            </h2>
            <p className="text-xs font-semibold text-[#5A6279]">
              Independent Hackathon Prototype • System Disclosures
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-6 text-sm text-[#14213D] leading-relaxed">
          {/* Institutional Independence */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <h3 className="font-bold text-amber-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Independence Notice
            </h3>
            <p className="mt-1 text-amber-950 text-xs sm:text-sm">
              <strong>VoxSetu is an independent prototype</strong> designed to explore how large language models and deterministic civic rules can bridge citizen complaints and municipal action. It is <strong>not affiliated with, endorsed by, or integrated into any official government portal or municipal corporation.</strong>
            </p>
          </div>

          {/* What is Real */}
          <div>
            <h3 className="font-bold text-[#1F7A8C] flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              What is Real (Production Logic)
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs sm:text-sm text-[#5A6279]">
              <li><strong className="text-[#14213D]">Server-side Gemini AI pipeline:</strong> Live inference extracting category, bilingual summaries (English and citizen language), 5-factor risk scoring (0–5), and spam detection.</li>
              <li><strong className="text-[#14213D]">Deterministic priority calculation:</strong> Transparent weighted mathematical formula calculated in code (not hallucinable by AI) with safety risk overrides.</li>
              <li><strong className="text-[#14213D]">AI duplicate comparison:</strong> 150m geographic radius candidate filtering in code, followed by Gemini similarity judgment with confidence thresholding (≥0.7).</li>
              <li><strong className="text-[#14213D]">Rule-based hotspot detection:</strong> Union-Find connected component clustering (300m threshold, ≥3 reports), center and radius calculation, and dynamic scoring.</li>
              <li><strong className="text-[#14213D]">Live updates:</strong> Real-time Server-Sent Events (SSE) broadcasting status transitions instantly to citizen trackers.</li>
            </ul>
          </div>

          {/* What is Mocked or Simulated */}
          <div>
            <h3 className="font-bold text-[#14213D] flex items-center gap-2 text-base">
              <Cpu className="h-5 w-5 text-blue-600" />
              What is Mocked or Simulated
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs sm:text-sm text-[#5A6279]">
              <li><strong className="text-[#14213D]">User authentication:</strong> No citizen or officer login credentials required for rapid testability.</li>
              <li><strong className="text-[#14213D]">Municipal dispatch:</strong> Assigning a department (Roads, Drainage, Electrical, Sanitation) simulates dispatch within the app.</li>
              <li><strong className="text-[#14213D]">Target resolution times:</strong> Durations (4h, 24h, 72h, 7d) are labeled sample targets for prioritization benchmarking.</li>
              <li><strong className="text-[#14213D]">Notifications:</strong> In-app live stream and bell counter; no SMS or email gateways are connected.</li>
              <li><strong className="text-[#14213D]">Synthetic Zones:</strong> The ward boundaries ("Zones A-E") are sample rectangles for this demo. Real deployment would load official ward shapefiles.</li>
              <li><strong className="text-[#14213D]">Locality names:</strong> Reverse-geocoded addresses can be missing or approximate based on available map providers.</li>
              <li><strong className="text-[#14213D]">Storage reset:</strong> Reports are saved locally; server restarts may reset back to seed data.</li>
            </ul>
          </div>

          {/* Where the AI Can Be Wrong */}
          <div>
            <h3 className="font-bold text-[#D9480F] flex items-center gap-2 text-base">
              <HelpCircle className="h-5 w-5 text-[#D9480F]" />
              Where AI Can Be Wrong & Human Oversight
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs sm:text-sm text-[#5A6279]">
              <li><strong className="text-[#14213D]">Priority & duplicate misjudgment:</strong> AI can misinterpret ambiguous text or photos. Therefore, municipal officers retain full manual control to confirm or unlink duplicates and reassign teams.</li>
              <li><strong className="text-[#14213D]">Classification Overrides:</strong> Officers can manually change the AI-detected category (e.g., from 'Garbage' to 'Drainage') with a recorded reason. The system preserves the original AI suggestion for audit trails.</li>
              <li><strong className="text-[#14213D]">Machine translation nuance:</strong> Translations between English, Hindi, Kannada, and Telugu are machine-generated and may lack local slang nuance. The authority panel always displays the citizen's original verbatim text alongside English.</li>
              <li><strong className="text-[#14213D]">Reporting bias vs true problems:</strong> Hotspots highlight where active smartphone citizens report, which may overlook underrepresented neighborhoods with fewer submissions.</li>
              <li><strong className="text-[#14213D]">Hotspot parameters:</strong> The 300-meter neighbor threshold and minimum 3 reports are chosen design parameters; wide clusters exceeding 700m are flagged for human review.</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex justify-end border-t border-[#E1E4EE] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 items-center justify-center rounded-xl bg-[#14213D] px-6 text-sm font-semibold text-white shadow-xs hover:bg-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
