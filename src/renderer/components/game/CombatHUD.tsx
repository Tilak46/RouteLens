import { AnimatePresence, motion } from "framer-motion";
import { FolderCode, Zap, X, Crosshair } from "lucide-react";

interface CombatHUDProps {
  isCombat: boolean;
  corruptionLevel?: number;
  ghostsKilled?: number;
  isScanning?: boolean;
  scanningProjectName?: string;
  onDismiss?: () => void;
}

const CombatHUD = ({
  isCombat,
  ghostsKilled = 0,
  isScanning,
  scanningProjectName,
  onDismiss,
}: CombatHUDProps) => {
  return (
    <AnimatePresence>
      {(isCombat || isScanning) && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="absolute top-5 right-5 z-[2147483647] flex flex-col items-end pointer-events-auto select-none"
        >
          {/* Futuristic Cyber-Glass Card */}
          <div className="relative w-[280px] rounded-2xl bg-[hsl(240,6%,7%)]/92 border border-cyan-500/25 p-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.7)] backdrop-blur-xl overflow-hidden">
            {/* Ambient cyan glow */}
            <div className="absolute -top-10 -right-10 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Header: Status Pill & Skip Button */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></span>
                </span>
                <span className="text-[11px] font-bold tracking-wider text-cyan-300 uppercase font-mono">
                  Scanning Backend
                </span>
              </div>
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-[10px] font-medium text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Skip Mini-Game"
                >
                  <X size={11} />
                  <span>Skip</span>
                </button>
              )}
            </div>

            {/* Target Project Info */}
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                <FolderCode size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-bold text-foreground truncate">
                  {scanningProjectName || "Target Backend"}
                </div>
                <div className="text-[10px] text-cyan-400/80 font-mono">
                  Parsing AST routes...
                </div>
              </div>
            </div>

            {/* High-Tech Animated Scanner Bar */}
            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden mb-2.5 relative border border-white/5">
              <motion.div
                className="h-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-full shadow-[0_0_12px_#22d3ee]"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                style={{ width: "50%" }}
              />
            </div>

            {/* Interactive Mini-Game HUD / Counter */}
            <div className="flex items-center justify-between pt-1 text-[10px] font-mono border-t border-white/5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Crosshair size={12} className="text-cyan-400 animate-pulse" />
                <span>Ghost Hunter:</span>
              </div>
              <div className="flex items-center gap-1 font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                <Zap size={10} className="text-amber-400 fill-amber-400" />
                <span>{ghostsKilled > 0 ? `${ghostsKilled} Zapped` : "Click to zap"}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CombatHUD;
