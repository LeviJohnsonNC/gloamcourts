import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const Auth: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (isSignUp) {
      const { error } = await signUp(email, password, displayName);
      if (error) setError(error.message);
      else setMessage('Check your email for a confirmation link.');
    } else {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
      else navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm page-parchment rounded-lg border-ornate p-8"
      >
        <h1 className="font-display text-2xl text-gold text-center mb-1">Gloam Courts</h1>
        <p className="text-center text-muted-foreground text-sm font-narrative mb-6">
          {isSignUp ? 'Create your account' : 'Sign in to continue'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <input
              type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder="Display Name"
              className="w-full bg-muted/30 border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          )}
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)} required
            placeholder="Email"
            className="w-full bg-muted/30 border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)} required
            placeholder="Password" minLength={6}
            className="w-full bg-muted/30 border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          {message && <p className="text-xs text-gold">{message}</p>}
          <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-blood-glow text-primary-foreground font-display tracking-wider">
            {loading ? '...' : isSignUp ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        <button onClick={() => setIsSignUp(!isSignUp)} className="w-full text-center text-xs text-muted-foreground mt-4 hover:text-foreground">
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </motion.div>
    </div>
  );
};

export default Auth;
