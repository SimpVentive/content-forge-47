// Mouth timing from a narration clip, ported to TypeScript from the team's tools/make_lipsync.py.
// Runs once per narration (at export, or when the app loads the audio). The browser then only reads the track.
//
// Track format: 3 digits per frame, 50 frames per second:
//   digit 1  jaw opening      0–9   (from the first formant, F1, scaled by loudness)
//   digit 2  lip spread       0–9   (from the second formant, F2: 0 rounded … 9 wide)
//   digit 3  flag             0 voiced, 1 fricative (teeth together), 2 silence (mouth closed)

export const MOUTH_TRACK_FPS = 50;
const ORD = 16;          // LPC order (same as the Python tool)
const FFT_N = 1024;      // analysis FFT size

// ---------- small DSP helpers ----------

function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/** Magnitude spectrum (bins 0..N/2) of a segment, zero-padded to FFT_N. */
function magnitudeSpectrum(seg: Float64Array): Float64Array {
  const re = new Float64Array(FFT_N), im = new Float64Array(FFT_N);
  re.set(seg.subarray(0, Math.min(seg.length, FFT_N)));
  fftInPlace(re, im);
  const mag = new Float64Array(FFT_N / 2 + 1);
  for (let k = 0; k <= FFT_N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
  return mag;
}

/** Levinson–Durbin: LPC coefficients a[1..ORD] (a[0] = 1 implied) from autocorrelation r. */
function levinson(r: Float64Array, order: number): Float64Array | null {
  const a = new Float64Array(order + 1);
  a[0] = 1;
  let err = r[0];
  if (err <= 1e-12) return null;
  const tmp = new Float64Array(order + 1);
  for (let i = 1; i <= order; i++) {
    let acc = r[i];
    for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
    const k = -acc / err;
    tmp.set(a);
    for (let j = 1; j < i; j++) a[j] = tmp[j] + k * tmp[i - j];
    a[i] = k;
    err *= 1 - k * k;
    if (err <= 1e-12) break;
  }
  return a;
}

/**
 * Roots of a monic polynomial (coefficients from the highest power down), by Durand–Kerner iteration.
 * Same job as numpy.roots in the team's make_lipsync.py.
 */
function polynomialRoots(c: number[]): Array<{ re: number; im: number }> {
  const n = c.length - 1;
  let z = Array.from({ length: n }, (_, k) => {
    const ang = 0.4 + (2 * Math.PI * k) / n;
    return { re: 0.9 * Math.cos(ang), im: 0.9 * Math.sin(ang) };
  });
  for (let iter = 0; iter < 500; iter++) {
    let maxStep = 0;
    const next = z.map((zi, i) => {
      // p(zi) by Horner
      let pr = c[0], pi = 0;
      for (let k = 1; k <= n; k++) {
        const nr = pr * zi.re - pi * zi.im + c[k];
        const ni = pr * zi.im + pi * zi.re;
        pr = nr; pi = ni;
      }
      // product of (zi - zj), j != i
      let dr = 1, di = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const ar = zi.re - z[j].re, ai = zi.im - z[j].im;
        const nr = dr * ar - di * ai, ni = dr * ai + di * ar;
        dr = nr; di = ni;
      }
      const den = dr * dr + di * di || 1e-30;
      const qr = (pr * dr + pi * di) / den, qi = (pi * dr - pr * di) / den;
      const step = Math.hypot(qr, qi);
      if (step > maxStep) maxStep = step;
      return { re: zi.re - qr, im: zi.im - qi };
    });
    z = next;
    if (maxStep < 1e-10) break;
  }
  return z;
}

/**
 * First two formants, as in make_lipsync.py: roots of the LPC polynomial, keep the upper-half-plane roots,
 * frequency = angle × sr / 2π, bandwidth = −ln|z| × sr / π, keep 200–3600 Hz with bandwidth under 450 Hz.
 */
function formantsFromLpc(a: Float64Array, sampleRate: number): number[] {
  const roots = polynomialRoots(Array.from(a));
  const fs: number[] = [];
  for (const z of roots) {
    if (z.im <= 0.01) continue;
    const f = (Math.atan2(z.im, z.re) * sampleRate) / (2 * Math.PI);
    const bw = (-Math.log(Math.hypot(z.re, z.im) + 1e-9) * sampleRate) / Math.PI;
    if (f > 200 && f < 3600 && bw < 450) fs.push(f);
  }
  return fs.sort((p, q) => p - q);
}

/** Median filter with edge padding (the Python tool's med(x, k=5)). */
function medianFilter(x: Float64Array, k: number): Float64Array {
  const half = Math.floor(k / 2);
  const out = new Float64Array(x.length);
  const win: number[] = [];
  for (let i = 0; i < x.length; i++) {
    win.length = 0;
    for (let d = -half; d <= half; d++) win.push(x[Math.min(x.length - 1, Math.max(0, i + d))]);
    win.sort((p, q) => p - q);
    out[i] = win[half];
  }
  return out;
}

function resampleLinear(x: Float32Array | Float64Array, from: number, to: number): Float64Array {
  const n = Math.floor((x.length * to) / from);
  const out = new Float64Array(n);
  const step = from / to;
  for (let i = 0; i < n; i++) {
    const pos = i * step;
    const k = Math.floor(pos);
    const a = pos - k;
    out[i] = x[k] * (1 - a) + (k + 1 < x.length ? x[k + 1] : x[k]) * a;
  }
  return out;
}

// ---------- the analysis ----------

/**
 * Turns mono samples into the mouth track. Same steps as make_lipsync.py: per 20 ms frame, LPC formants,
 * loudness, spectral centroid and periodicity give voiced / fricative / silence, the opening (F1) and
 * spread (F2); then a fill, median filter and 3-tap smoothing.
 */
export function computeMouthTrackFromSamples(input: Float32Array | Float64Array, inputRate: number): string {
  // The Python tool analysed at 16 kHz; do the same (linear resampling keeps this fast in the browser).
  const sampleRate = 16000;
  const samples = inputRate === sampleRate ? input : resampleLinear(input, inputRate, sampleRate);
  const hop = Math.max(1, Math.round(sampleRate / MOUTH_TRACK_FPS));
  const win = Math.round(0.032 * sampleRate);
  const frames = Math.floor(samples.length / hop);
  if (frames === 0) return "";
  const lagLo = Math.max(2, Math.round((40 * sampleRate) / 16000));
  const lagHi = Math.max(lagLo + 1, Math.round((200 * sampleRate) / 16000));
  const hann = new Float64Array(win).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1)));
  const hamming = new Float64Array(win).map((_, i) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (win - 1)));

  const rms = new Float64Array(frames), cen = new Float64Array(frames), per = new Float64Array(frames);
  const F1 = new Float64Array(frames).fill(NaN), F2 = new Float64Array(frames).fill(NaN);
  const seg = new Float64Array(win);

  for (let i = 0; i < frames; i++) {
    const c = i * hop + Math.floor(hop / 2);
    for (let j = 0; j < win; j++) {
      const idx = c - Math.floor(win / 2) + j;
      seg[j] = idx >= 0 && idx < samples.length ? samples[idx] : 0;
    }
    let energy = 0;
    for (let j = 0; j < win; j++) energy += seg[j] * seg[j];
    rms[i] = Math.sqrt(energy / win + 1e-12);

    // spectral centroid of the Hann-windowed frame
    const windowed = new Float64Array(win);
    let mean = 0;
    for (let j = 0; j < win; j++) { windowed[j] = seg[j] * hann[j]; mean += seg[j]; }
    mean /= win;
    const mag = magnitudeSpectrum(windowed);
    let num = 0, den = 0;
    for (let k = 0; k < mag.length; k++) { const f = (k * sampleRate) / FFT_N; num += f * mag[k]; den += mag[k]; }
    cen[i] = num / (den + 1e-9);

    // periodicity: best normalised autocorrelation in the voice-pitch lag range
    let ac0 = 0;
    for (let j = 0; j < win; j++) { const v = seg[j] - mean; ac0 += v * v; }
    if (ac0 > 1e-9) {
      let best = 0;
      for (let lag = lagLo; lag <= lagHi && lag < win; lag++) {
        let s = 0;
        for (let j = 0; j + lag < win; j++) s += (seg[j] - mean) * (seg[j + lag] - mean);
        if (s > best) best = s;
      }
      per[i] = best / ac0;
    }

    // LPC formants: pre-emphasis, Hamming window, autocorrelation, Levinson–Durbin
    const pre = new Float64Array(win);
    pre[0] = seg[0] * hamming[0];
    for (let j = 1; j < win; j++) pre[j] = (seg[j] - 0.97 * seg[j - 1]) * hamming[j];
    const r = new Float64Array(ORD + 1);
    for (let lag = 0; lag <= ORD; lag++) {
      let s = 0;
      for (let j = 0; j + lag < win; j++) s += pre[j] * pre[j + lag];
      r[lag] = s;
    }
    if (r[0] >= 1e-9) {
      r[0] *= 1.0001;
      const a = levinson(r, ORD);
      if (a) {
        const fs = formantsFromLpc(a, sampleRate);
        if (fs.length >= 2) { F1[i] = fs[0]; F2[i] = fs[1]; }
        else if (fs.length === 1) F1[i] = fs[0];
      }
    }
  }

  // loudness reference, as in the Python tool
  const dbs = Array.from(rms, (v) => 20 * Math.log10(v + 1e-9));
  const loud = dbs.filter((d) => d > -60).sort((p, q) => p - q);
  const ref = loud.length ? loud[Math.min(loud.length - 1, Math.floor(loud.length * 0.95))] : -20;
  const amp = new Float64Array(frames), sil = new Array<boolean>(frames), voiced = new Array<boolean>(frames), fric = new Array<boolean>(frames);
  for (let i = 0; i < frames; i++) {
    amp[i] = Math.max(0, Math.min(1, (dbs[i] - (ref - 38)) / 38));
    sil[i] = dbs[i] < ref - 34;
    voiced[i] = per[i] > 0.4 && !sil[i];
    fric[i] = !voiced[i] && !sil[i] && cen[i] > 2600;
  }

  // fill missing formants with the last value (defaults 500 / 1400 Hz), then median-filter them
  const fill = (arr: Float64Array, fallback: number) => {
    const out = new Float64Array(arr.length);
    let last = fallback;
    for (let i = 0; i < arr.length; i++) {
      if (Number.isNaN(arr[i])) out[i] = last;
      else { out[i] = arr[i]; last = arr[i]; }
    }
    return out;
  };
  const F1f = medianFilter(fill(F1, 500), 5);
  const F2f = medianFilter(fill(F2, 1400), 5);

  const o = new Float64Array(frames), s = new Float64Array(frames), f = new Int8Array(frames);
  for (let i = 0; i < frames; i++) {
    const open = Math.max(0, Math.min(1, (F1f[i] - 300) / (850 - 300))) ** 0.9 * (0.4 + 0.6 * amp[i]);
    let spread = Math.max(0, Math.min(1, (F2f[i] - 950) / (2300 - 950)));
    const openV = voiced[i] ? open : fric[i] ? 0.12 : sil[i] ? 0 : 0.22 * amp[i];
    if (fric[i]) spread = Math.max(0, Math.min(1, (cen[i] - 2600) / 2400)) * 0.4 + 0.6;
    if (sil[i]) spread = 0.5;
    o[i] = openV;
    s[i] = spread;
    f[i] = sil[i] ? 2 : fric[i] ? 1 : 0;
  }

  // 3-tap smoothing on opening and spread, with edge padding
  const smooth = (x: Float64Array) => {
    const out = new Float64Array(x.length);
    for (let i = 0; i < x.length; i++) {
      const a = x[Math.max(0, i - 1)], b = x[i], c = x[Math.min(x.length - 1, i + 1)];
      out[i] = 0.25 * a + 0.5 * b + 0.25 * c;
    }
    return out;
  };
  const os = smooth(o), ss = smooth(s);
  let track = "";
  for (let i = 0; i < frames; i++) {
    const open = f[i] === 2 ? 0 : os[i];
    const qo = Math.max(0, Math.min(9, Math.round(open * 9)));
    const qs = Math.max(0, Math.min(9, Math.round(ss[i] * 9)));
    track += `${qo}${qs}${f[i]}`;
  }
  return track;
}

/** Decodes a narration clip (mp3, wav, …) to mono samples. Needs a browser AudioContext. */
export async function decodeNarrationSamples(bytes: ArrayBuffer): Promise<{ samples: Float32Array; sampleRate: number } | null> {
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor();
  try {
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    return { samples: buffer.getChannelData(0).slice(0), sampleRate: buffer.sampleRate };
  } finally {
    void ctx.close();
  }
}

/** Track for one narration clip, or null if the browser can't decode it. */
export async function computeMouthTrackFromAudio(bytes: ArrayBuffer): Promise<string | null> {
  try {
    const decoded = await decodeNarrationSamples(bytes);
    if (!decoded) return null;
    return computeMouthTrackFromSamples(decoded.samples, decoded.sampleRate);
  } catch (err) {
    console.warn("Mouth track could not be measured:", err);
    return null;
  }
}
