import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RollOutcome } from '@/rules/types';
import { X, RotateCcw, Skull } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent } from '@/components/ui/drawer';

interface DiceTrayProps {
  rollOutcome: RollOutcome | null;
  visible: boolean;
  onClose: () => void;
  luck?: number;
  focus?: number;
  focusSpent?: boolean;
  canUseTrait?: { key: string; name: string } | null;
  onSpendLuck?: (indices: number[]) => void;
  onSpendFocus?: () => void;
  onUseDeathsJest?: () => void;
}

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

const DiceTrayContent: React.FC<{
  rollOutcome: RollOutcome;
  luck: number;
  onClose: () => void;
  onSpendLuck?: (indices: number[]) => void;
  canUseTrait?: { key: string; name: string } | null;
  onUseDeathsJest?: () => void;
  isMobile: boolean;
}> = ({ rollOutcome, luck, onClose, onSpendLuck, canUseTrait, onUseDeathsJest, isMobile }) => {
  const [selectedDice, setSelectedDice] = useState<Set<number>>(new Set());
  const [rerolled, setRerolled] = useState(false);

  const toggleDie = (idx: number) => {
    if (rerolled) return;
    const next = new Set(selectedDice);
    if (next.has(idx)) next.delete(idx);
    else if (next.size < 2) next.add(idx);
    setSelectedDice(next);
  };

  const handleReroll = () => {
    if (selectedDice.size === 0 || rerolled) return;
    onSpendLuck?.(Array.from(selectedDice));
    setRerolled(true);
    setSelectedDice(new Set());
  };

  const handleClose = () => {
    setSelectedDice(new Set());
    setRerolled(false);
    onClose();
  };

  const diceSize = isMobile ? 'w-12 h-12 text-xl' : 'w-10 h-10 text-lg';

  return (
    <div className="relative">
      {!isMobile && (
        <button onClick={handleClose} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      )}

      <h3 className="font-display text-sm text-gold mb-3 tracking-widest uppercase">Dice Roll</h3>

      {rollOutcome.stat_used && (
        <p className="text-xs text-muted-foreground mb-2">
          {rollOutcome.stat_used} test{rollOutcome.roll_context ? ` (${rollOutcome.roll_context})` : ''}
        </p>
      )}

      <div className="flex gap-2 mb-3 flex-wrap">
        {rollOutcome.playerRoll.dice.map((d, i) => {
          const isSuccess = d >= rollOutcome.playerRoll.targetNumber;
          const isSelected = selectedDice.has(i);
          return (
            <motion.div
              key={i}
              initial={{ rotate: 0, scale: 0 }}
              animate={{ rotate: 360, scale: 1 }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              onClick={() => !rerolled && luck > 0 && toggleDie(i)}
              className={`${diceSize} rounded border flex items-center justify-center font-display font-bold cursor-pointer transition-all ${
                isSelected
                  ? 'border-gold bg-gold/30 text-gold ring-2 ring-gold/50'
                  : isSuccess
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-border bg-muted text-muted-foreground'
              }`}
            >
              {d}
            </motion.div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mb-1">
        Target Number: {rollOutcome.playerRoll.targetNumber} · Successes: {rollOutcome.playerRoll.successes}
      </p>

      {rollOutcome.opposingRoll && (
        <p className="text-xs text-muted-foreground mt-1 mb-1">
          Opposing: {rollOutcome.opposingRoll.dice.join(', ')} ({rollOutcome.opposingRoll.successes} successes)
        </p>
      )}

      <div className={`mt-3 font-display text-lg tracking-wider ${outcomeColors[rollOutcome.outcome]}`}>
        {outcomeLabels[rollOutcome.outcome]}
      </div>
      <p className="text-xs text-muted-foreground">Margin: {rollOutcome.margin > 0 ? '+' : ''}{rollOutcome.margin}</p>

      {/* Action buttons */}
      <div className="mt-4 space-y-2 border-t border-border pt-3">
        {luck > 0 && !rerolled && onSpendLuck && (
          <div className={`flex items-center gap-2 ${isMobile ? 'flex-col items-stretch' : ''}`}>
            <button
              onClick={handleReroll}
              disabled={selectedDice.size === 0}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded border border-gold/50 text-gold text-xs font-display hover:bg-gold/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              <RotateCcw size={12} /> Spend 1 Luck to reroll ({selectedDice.size}/2 selected)
            </button>
            <span className="text-xs text-muted-foreground text-center">Luck: {luck}</span>
          </div>
        )}

        {canUseTrait?.key === 'deaths_jest' && onUseDeathsJest && (
          <button
            onClick={onUseDeathsJest}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded border border-accent/50 text-accent text-xs font-display hover:bg-accent/10 transition-colors w-full touch-manipulation"
          >
            <Skull size={12} /> Death's Jest: Turn a 1 into a 10
          </button>
        )}
      </div>
    </div>
  );
};

const DiceTray: React.FC<DiceTrayProps> = ({
  rollOutcome, visible, onClose,
  luck = 0, focus = 0, focusSpent = false,
  canUseTrait, onSpendLuck, onSpendFocus, onUseDeathsJest,
}) => {
  const isMobile = useIsMobile();

  if (!rollOutcome) return null;

  if (isMobile) {
    return (
      <Drawer open={visible} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="px-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <DiceTrayContent
            rollOutcome={rollOutcome}
            luck={luck}
            onClose={onClose}
            onSpendLuck={onSpendLuck}
            canUseTrait={canUseTrait}
            onUseDeathsJest={onUseDeathsJest}
            isMobile
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-lg p-6 shadow-2xl min-w-[340px] max-w-[420px]"
        >
          <DiceTrayContent
            rollOutcome={rollOutcome}
            luck={luck}
            onClose={onClose}
            onSpendLuck={onSpendLuck}
            canUseTrait={canUseTrait}
            onUseDeathsJest={onUseDeathsJest}
            isMobile={false}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DiceTray;
