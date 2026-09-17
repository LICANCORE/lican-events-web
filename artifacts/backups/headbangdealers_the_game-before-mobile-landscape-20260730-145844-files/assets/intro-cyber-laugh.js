const PATCH_FLAG = "__headbangCyberLaughPatched";
const SIXTH_SLIDE_INDEX = 5;

function createDistortionCurve(amount = 38) {
  const samples = 2048;
  const curve = new Float32Array(samples);
  const degrees = Math.PI / 180;

  for (let index = 0; index < samples; index += 1) {
    const x = (index * 2) / samples - 1;
    curve[index] =
      ((3 + amount) * x * 20 * degrees) /
      (Math.PI + amount * Math.abs(x));
  }

  return curve;
}

function playCyberEvilLaugh(scene) {
  if (scene.sfxEnabled === false) {
    return;
  }

  const context = scene.sound?.context;
  if (!context?.createOscillator || context.state !== "running") {
    return;
  }

  const startAt = context.currentTime + 0.025;
  const master = context.createGain();
  const distortion = context.createWaveShaper();
  const tone = context.createBiquadFilter();
  const delay = context.createDelay(0.4);
  const feedback = context.createGain();
  const wet = context.createGain();

  distortion.curve = createDistortionCurve();
  distortion.oversample = "2x";
  tone.type = "lowpass";
  tone.frequency.value = 1850;
  tone.Q.value = 1.4;
  delay.delayTime.value = 0.145;
  feedback.gain.value = 0.26;
  wet.gain.value = 0.34;

  master.gain.setValueAtTime(0.0001, startAt);
  master.gain.exponentialRampToValueAtTime(0.2, startAt + 0.035);
  master.gain.setValueAtTime(0.2, startAt + 1.18);
  master.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.72);

  master.connect(distortion);
  distortion.connect(tone);
  tone.connect(context.destination);
  tone.connect(delay);
  delay.connect(wet);
  wet.connect(context.destination);
  delay.connect(feedback);
  feedback.connect(delay);

  const syllables = [
    { offset: 0, pitch: 112, duration: 0.22 },
    { offset: 0.24, pitch: 101, duration: 0.23 },
    { offset: 0.5, pitch: 91, duration: 0.25 },
    { offset: 0.79, pitch: 81, duration: 0.28 },
    { offset: 1.12, pitch: 70, duration: 0.34 },
  ];

  for (const [index, syllable] of syllables.entries()) {
    const onset = startAt + syllable.offset;
    const end = onset + syllable.duration;
    const voiceGain = context.createGain();
    const formant = context.createBiquadFilter();
    const carrier = context.createOscillator();
    const undertone = context.createOscillator();
    const vibrato = context.createOscillator();
    const vibratoDepth = context.createGain();

    carrier.type = "sawtooth";
    undertone.type = "square";
    vibrato.type = "sine";
    carrier.frequency.setValueAtTime(syllable.pitch * 1.22, onset);
    carrier.frequency.exponentialRampToValueAtTime(syllable.pitch * 0.82, end);
    undertone.frequency.setValueAtTime(syllable.pitch * 0.5, onset);
    undertone.frequency.exponentialRampToValueAtTime(syllable.pitch * 0.42, end);
    vibrato.frequency.value = 7.2 - index * 0.45;
    vibratoDepth.gain.value = 9 + index * 1.8;

    formant.type = "bandpass";
    formant.frequency.setValueAtTime(690 - index * 42, onset);
    formant.frequency.exponentialRampToValueAtTime(470 - index * 22, end);
    formant.Q.value = 2.3;

    voiceGain.gain.setValueAtTime(0.0001, onset);
    voiceGain.gain.exponentialRampToValueAtTime(0.38, onset + 0.025);
    voiceGain.gain.setValueAtTime(0.31, onset + syllable.duration * 0.55);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, end);

    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(carrier.frequency);
    carrier.connect(formant);
    undertone.connect(formant);
    formant.connect(voiceGain);
    voiceGain.connect(master);

    carrier.start(onset);
    undertone.start(onset);
    vibrato.start(onset);
    carrier.stop(end);
    undertone.stop(end);
    vibrato.stop(end);
  }

  window.setTimeout(() => {
    master.disconnect();
    distortion.disconnect();
    tone.disconnect();
    delay.disconnect();
    feedback.disconnect();
    wet.disconnect();
  }, 2400);
}

function patchIntroScene() {
  const game = window.__HEADBANG_GAME__;
  const scene = game?.scene?.getScenes?.(false)?.find(
    (candidate) => typeof candidate.renderIntroPage === "function",
  );

  if (!scene) {
    window.setTimeout(patchIntroScene, 80);
    return;
  }

  if (scene[PATCH_FLAG]) {
    return;
  }

  const originalRenderIntroPage = scene.renderIntroPage;
  scene.renderIntroPage = function renderIntroPageWithCyberLaugh(...args) {
    const result = originalRenderIntroPage.apply(this, args);

    if (this.introPage === SIXTH_SLIDE_INDEX) {
      playCyberEvilLaugh(this);
    }

    return result;
  };
  scene[PATCH_FLAG] = true;
}

patchIntroScene();
