import { AnimatePresence, motion } from "framer-motion";

interface CombatHUDProps {
  isCombat: boolean;
  corruptionLevel: number;
  isScanning?: boolean;
  scanningProjectName?: string;
  onDismiss?: () => void;
}

const CombatHUD = ({
  isCombat,
  corruptionLevel,
  isScanning,
  scanningProjectName,
  onDismiss,
}: CombatHUDProps) => {
  return (
    <AnimatePresence>
      {(isCombat || isScanning) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-4 right-4 z-[2147483647] flex flex-col items-end gap-2 pointer-events-auto"
        >
          <div className="relative border border-cyan-500/30 bg-black/85 p-4 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-md min-w-[230px]">
            <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-[10px] font-bold tracking-[3px] text-cyan-300 uppercase font-mono">
                  AST Scan Active
                </span>
              </div>
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-[9px] text-white/50 hover:text-white transition-colors uppercase font-mono px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
                  title="Close Mini-Game"
                >
                  ✕ Close
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[12px] font-black tracking-widest text-white uppercase font-mono">
                  Route Scanner
                </h3>
                <span className="text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  SCANNING
                </span>
              </div>

              {scanningProjectName && (
                <p className="text-[10px] font-mono text-cyan-300/90 truncate max-w-[190px]">
                  Target: {scanningProjectName}
                </p>
              )}

              <div className="flex flex-col gap-0.5 text-[10px] font-bold tracking-wide mt-1">
                <p className="text-white/40 font-mono">
                  ACTION: <span className="text-cyan-300">Click Ghosts to Exterminate</span>
                </p>
              </div>

              <div className="mt-1 flex justify-between gap-4 border-t border-white/10 pt-1.5 text-[9px] font-mono">
                <div className="flex flex-col">
                  <span className="text-white/30 uppercase">Corrupt</span>
                  <span className="font-bold text-rose-400">{corruptionLevel * 5}%</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-white/30 uppercase">Status</span>
                  <span className="font-bold text-emerald-400">Parsing AST...</span>
                </div>
              </div>
            </div>

            <div className="absolute top-0 left-0 h-2.5 w-2.5 border-t-2 border-l-2 border-cyan-400/50 rounded-tl-xl" />
            <div className="absolute right-0 bottom-0 h-2.5 w-2.5 border-r-2 border-b-2 border-cyan-400/50 rounded-br-xl" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CombatHUD;
