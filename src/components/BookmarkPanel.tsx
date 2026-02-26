import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { X, Search, Lock, Unlock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BookmarkPanelProps {
  type: 'codex' | 'rumors';
  visible: boolean;
  onClose: () => void;
}

const BookmarkPanel: React.FC<BookmarkPanelProps> = ({ type, visible, onClose }) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    if (!visible || !user) return;
    loadData();
  }, [visible, user]);

  const loadData = async () => {
    if (type === 'codex') {
      const { data: allEntries } = await supabase.from('codex_entries').select('*');
      const { data: userUnlocks } = await supabase.from('codex_unlocks').select('codex_key').eq('user_id', user!.id);
      setEntries(allEntries || []);
      setUnlocked(new Set((userUnlocks || []).map((u: any) => u.codex_key)));
    } else {
      const { data: allRumors } = await supabase.from('rumors_catalog').select('*');
      const { data: userRumors } = await supabase.from('user_rumors').select('rumor_key, level').eq('user_id', user!.id);
      const unlockedKeys = new Set((userRumors || []).map((r: any) => r.rumor_key));
      setEntries(allRumors || []);
      setUnlocked(unlockedKeys);
    }
  };

  const filtered = entries.filter(e => {
    const title = type === 'codex' ? e.title : e.title;
    return title.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25 }}
          className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border z-50 flex flex-col shadow-2xl"
        >
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-display text-lg text-gold tracking-wider uppercase">
              {type === 'codex' ? 'Codex' : 'Rumors'}
            </h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
          </div>

          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-muted/30 border border-border rounded pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filtered.map(entry => {
              const key = type === 'codex' ? entry.codex_key : entry.rumor_key;
              const isUnlocked = unlocked.has(key);

              return (
                <button
                  key={key}
                  onClick={() => isUnlocked && setSelected(entry)}
                  className={`w-full text-left p-3 rounded border transition-colors ${
                    isUnlocked ? 'border-gold-dim bg-muted/20 hover:bg-muted/40' : 'border-border bg-muted/10 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isUnlocked ? <Unlock size={12} className="text-gold" /> : <Lock size={12} className="text-muted-foreground" />}
                    <span className={`font-display text-sm ${isUnlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {isUnlocked ? entry.title : '???'}
                    </span>
                  </div>
                  {isUnlocked && type === 'codex' && entry.tags && (
                    <div className="flex gap-1 mt-1">
                      {entry.tags.map((tag: string) => (
                        <span key={tag} className="text-xs bg-muted rounded px-1.5 py-0.5 text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Detail view */}
          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-card p-6 overflow-y-auto"
              >
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground mb-4 text-sm">
                  ← Back
                </button>
                <h3 className="font-display text-xl text-gold mb-3">{selected.title}</h3>
                {type === 'codex' ? (
                  <p className="font-narrative text-foreground leading-relaxed">{selected.body}</p>
                ) : (
                  <>
                    <p className="font-narrative text-foreground leading-relaxed mb-3">{selected.effect_text}</p>
                    <div className="text-xs text-gold-dim border-t border-border pt-2 mt-2">
                      Mechanical Effect: {JSON.stringify(selected.mechanical_json)}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BookmarkPanel;
