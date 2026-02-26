let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function playPageFlip() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;

    // White noise burst (paper rustle)
    const bufferSize = ctx.sampleRate * 0.15;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    // Filter for paper-like quality
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3000, now);
    filter.Q.setValueAtTime(0.8, now);

    // Envelope
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noiseSource.start(now);
    noiseSource.stop(now + 0.15);

    // Soft "tick" (page landing)
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);

    const tickGain = ctx.createGain();
    tickGain.gain.setValueAtTime(0, now + 0.08);
    tickGain.gain.linearRampToValueAtTime(0.06, now + 0.09);
    tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(tickGain);
    tickGain.connect(ctx.destination);

    osc.start(now + 0.08);
    osc.stop(now + 0.15);
  } catch {
    // Silently fail if audio not available
  }
}

export function playDiceRoll() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      const freq = 200 + Math.random() * 400;
      osc.frequency.setValueAtTime(freq, now + i * 0.05);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.04, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.05);
    }
  } catch {
    // Silently fail
  }
}
