import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGameState } from '@/hooks/useGameState';
import { motion } from 'framer-motion';
import { Skull, BookOpen, Key, LogIn, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import heroBg from '@/assets/hero-bg.png';

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
    <div className="relative min-h-screen overflow-hidden">
      {/* Layer 1: Hero background image */}
      <img
        src={heroBg}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {/* Layer 2: Dark radial gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, hsl(30 15% 10% / 0.55) 0%, hsl(30 15% 6% / 0.88) 60%, hsl(0 0% 0% / 0.95) 100%)',
        }}
      />

      {/* Layer 3: CSS-only noise grain */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay">
        <svg width="100%" height="100%">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </div>

      {/* Layer 4: Candlelight bloom */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute animate-candle-flicker"
          style={{
            width: '800px',
            height: '800px',
            top: '-15%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'radial-gradient(ellipse at center, hsl(40 50% 45% / 0.08) 0%, hsl(30 40% 30% / 0.03) 40%, transparent 70%)',
          }}
        />
      </div>

      {/* Layer 5: Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-lg"
        >
          {/* Title */}
          <div className="mb-8">
            <Skull className="mx-auto mb-4 opacity-60" size={48} style={{ color: 'hsl(var(--gold))' }} />
            <h1
              className="font-display text-4xl sm:text-5xl tracking-wider mb-2"
              style={{
                color: 'hsl(var(--gold))',
                textShadow: '0 0 30px hsl(40 50% 45% / 0.4), 0 0 60px hsl(40 50% 45% / 0.15)',
              }}
            >
              Gloam Courts
            </h1>
            <p className="font-display text-sm text-muted-foreground tracking-[0.35em] uppercase">
              Living Gamebook
            </p>
          </div>

          {/* Content card with glassmorphism */}
          <div className="backdrop-blur-sm bg-background/30 rounded-lg border border-border/40 p-6 sm:p-8">
            {/* Pitch */}
            <p className="font-narrative text-foreground text-lg leading-relaxed mb-6 max-w-md mx-auto">
              The Gloam Courts await — a lattice of decaying aristocratic domains where twilight never ends
              and every invitation is a death sentence wrapped in good manners. Roll dice. Make choices.
              Die memorably. Try again.
            </p>

            {/* Ornamental divider */}
            <div className="flex items-center gap-3 mb-6 max-w-xs mx-auto">
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, hsl(var(--gold-dim)), transparent)' }} />
              <Skull size={12} className="text-muted-foreground opacity-40" />
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, hsl(var(--gold-dim)), transparent)' }} />
            </div>

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
                  className="w-full max-w-xs mx-auto flex items-center justify-center gap-2 px-6 py-3 rounded border font-display tracking-wider transition-all duration-300 backdrop-blur-sm"
                  style={{
                    borderColor: 'hsl(var(--gold))',
                    background: 'hsl(var(--gold) / 0.1)',
                    color: 'hsl(var(--gold))',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'hsl(var(--gold) / 0.2)';
                    e.currentTarget.style.boxShadow = '0 0 20px hsl(40 50% 45% / 0.25)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'hsl(var(--gold) / 0.1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <BookOpen size={18} /> New Run
                </button>

                {latestRunId && (
                  <button
                    onClick={handleContinue}
                    className="w-full max-w-xs mx-auto flex flex-col items-center justify-center gap-1 px-6 py-3 rounded border border-border/60 text-foreground font-display tracking-wider hover:bg-muted/20 transition-all duration-300 backdrop-blur-sm"
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
                    className="flex-1 bg-muted/20 border border-border/60 rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground backdrop-blur-sm"
                  />
                  <button
                    onClick={handleRunCode}
                    disabled={!runCode.trim()}
                    className="px-3 py-2 rounded border border-border/60 text-muted-foreground hover:text-foreground disabled:opacity-30 backdrop-blur-sm transition-colors"
                  >
                    <Key size={16} />
                  </button>
                </div>

                <p className="text-xs text-muted-foreground mt-4">
                  Signed in as {user.email}
                  <button onClick={handleSignOut} className="ml-2 hover:text-foreground underline inline-flex items-center gap-1 transition-colors" style={{ color: 'hsl(var(--gold-dim))' }}>
                    <LogOut size={10} /> Sign out
                  </button>
                </p>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <button
                  onClick={() => navigate('/auth')}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded border font-display tracking-wider transition-all duration-300 mx-auto backdrop-blur-sm"
                  style={{
                    borderColor: 'hsl(var(--gold))',
                    background: 'hsl(var(--gold) / 0.1)',
                    color: 'hsl(var(--gold))',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'hsl(var(--gold) / 0.2)';
                    e.currentTarget.style.boxShadow = '0 0 20px hsl(40 50% 45% / 0.25)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'hsl(var(--gold) / 0.1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <LogIn size={18} /> Sign in to play
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Footer */}
        <p className="absolute bottom-4 text-xs text-muted-foreground font-narrative italic">
          "The Courts enjoyed having you. However briefly."
        </p>
      </div>
    </div>
  );
};

export default Index;
