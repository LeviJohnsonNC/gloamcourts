import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGameState } from '@/hooks/useGameState';
import { motion } from 'framer-motion';
import { Skull, BookOpen, Key, LogIn, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Index: React.FC = () => {
  const { user, loading, signOut } = useAuth();
  const { loadLatestRun } = useGameState();
  const navigate = useNavigate();
  const [runCode, setRunCode] = useState('');
  const [latestRunId, setLatestRunId] = useState<string | null>(null);
  const [latestRunTitle, setLatestRunTitle] = useState<string>('');

  useEffect(() => {
    if (user) {
      loadLatestRun(user.id).then(async (id) => {
        setLatestRunId(id);
        if (id) {
          const { data } = await supabase.from('runs').select('title, is_shared_replay').eq('id', id).single();
          if (data) setLatestRunTitle(data.is_shared_replay ? `Replay: ${data.title}` : data.title);
        }
      });
    }
  }, [user]);

  const handleNewRun = () => navigate('/book/new');
  const handleContinue = () => latestRunId && navigate(`/book/${latestRunId}`);
  const handleRunCode = () => {
    if (runCode.trim()) navigate(`/book/new-seed?seed=${encodeURIComponent(runCode.trim())}`);
  };
  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center max-w-lg"
      >
        {/* Title */}
        <div className="mb-8">
          <Skull className="mx-auto mb-4 text-gold opacity-60" size={48} />
          <h1 className="font-display text-4xl sm:text-5xl text-gold tracking-wider mb-2">
            Gloam Courts
          </h1>
          <p className="font-display text-sm text-muted-foreground tracking-[0.3em] uppercase">
            Living Gamebook
          </p>
        </div>

        {/* Pitch */}
        <p className="font-narrative text-foreground text-lg leading-relaxed mb-10 max-w-md mx-auto">
          The Gloam Courts await — a lattice of decaying aristocratic domains where twilight never ends
          and every invitation is a death sentence wrapped in good manners. Roll dice. Make choices.
          Die memorably. Try again.
        </p>

        {/* Actions */}
        {loading ? (
          <p className="text-muted-foreground animate-pulse font-display text-sm">Loading...</p>
        ) : user ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <button
              onClick={handleNewRun}
              className="w-full max-w-xs mx-auto flex items-center justify-center gap-2 px-6 py-3 rounded border border-gold bg-gold/10 text-gold font-display tracking-wider hover:bg-gold/20 transition-colors"
            >
              <BookOpen size={18} /> New Run
            </button>

            {latestRunId && (
              <button
                onClick={handleContinue}
                className="w-full max-w-xs mx-auto flex flex-col items-center justify-center gap-1 px-6 py-3 rounded border border-border text-foreground font-display tracking-wider hover:bg-muted/30 transition-colors"
              >
                <span className="flex items-center gap-2">Continue</span>
                {latestRunTitle && <span className="text-xs text-muted-foreground">{latestRunTitle}</span>}
              </button>
            )}

            <div className="flex items-center gap-2 max-w-xs mx-auto">
              <input
                value={runCode}
                onChange={e => setRunCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRunCode()}
                placeholder="Enter Run Code..."
                className="flex-1 bg-muted/30 border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={handleRunCode}
                disabled={!runCode.trim()}
                className="px-3 py-2 rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <Key size={16} />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              Signed in as {user.email}
              <button onClick={handleSignOut} className="ml-2 text-gold-dim hover:text-gold underline inline-flex items-center gap-1">
                <LogOut size={10} /> Sign out
              </button>
            </p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <button
              onClick={() => navigate('/auth')}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded border border-gold bg-gold/10 text-gold font-display tracking-wider hover:bg-gold/20 transition-colors mx-auto"
            >
              <LogIn size={18} /> Sign in to play
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* Footer */}
      <p className="absolute bottom-4 text-xs text-muted-foreground font-narrative italic">
        "The Courts enjoyed having you. However briefly."
      </p>
    </div>
  );
};

export default Index;
