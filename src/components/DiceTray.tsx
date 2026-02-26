import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RollOutcome } from '@/rules/types';
import { X } from 'lucide-react';

interface DiceTrayProps {
  rollOutcome: RollOutcome | null;
  visible: boolean;
  onClose: () => void;
}

const DiceTray: React.FC<DiceTrayProps> = ({ rollOutcome, visible, onClose }) => {
  if (!rollOutcome) return null;

  const outcomeColors: Record<string, string> = {
    critical_success: 'text-gold',
    success: 'text-accent',
    partial: 'text-muted-foreground',
    failure: 'text-destructive',
    critical_failure: 'text-destructive',
  };

  const outcomeLabels: Record<string, string> = {
    critical_success: 'CRITICAL SUCCESS',
    success: 'SUCCESS',
    partial: 'DRAW',
    failure: 'FAILURE',
    critical_failure: 'CRITICAL FAILURE',
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-lg p-6 shadow-2xl min-w-[320px]"
        >
          <button onClick={onClose} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>

          <h3 className="font-display text-sm text-gold mb-3 tracking-widest uppercase">Dice Roll</h3>

          <div className="flex gap-2 mb-3 flex-wrap">
            {rollOutcome.playerRoll.dice.map((d, i) => (
              <motion.div
                key={i}
                initial={{ rotate: 0, scale: 0 }}
                animate={{ rotate: 360, scale: 1 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className={`w-10 h-10 rounded border flex items-center justify-center font-display text-lg font-bold ${
                  d >= rollOutcome.playerRoll.targetNumber ? 'border-gold bg-gold/10 text-gold' : 'border-border bg-muted text-muted-foreground'
                }`}
              >
                {d}
              </motion.div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mb-1">
            Target Number: {rollOutcome.playerRoll.targetNumber} · Successes: {rollOutcome.playerRoll.successes}
          </p>

          {rollOutcome.opposingRoll && (
            <>
              <p className="text-xs text-muted-foreground mt-2 mb-1">Opposing: {rollOutcome.opposingRoll.dice.join(', ')} ({rollOutcome.opposingRoll.successes} successes)</p>
            </>
          )}

          <div className={`mt-3 font-display text-lg tracking-wider ${outcomeColors[rollOutcome.outcome]}`}>
            {outcomeLabels[rollOutcome.outcome]}
          </div>
          <p className="text-xs text-muted-foreground">Margin: {rollOutcome.margin > 0 ? '+' : ''}{rollOutcome.margin}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DiceTray;
