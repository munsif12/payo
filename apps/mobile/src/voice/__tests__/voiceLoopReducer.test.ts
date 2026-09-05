import {
  voiceLoopReducer, initialVoiceLoopState,
  type VoiceLoopState, type VoiceLoopMode, type VoiceLoopEvent,
} from '../voiceLoopReducer';
import { MAX_AUTO_TURNS, MAX_SILENT_TURNS } from '../loopConfig';

const at = (mode: VoiceLoopMode, over: Partial<VoiceLoopState> = {}): VoiceLoopState => ({
  ...initialVoiceLoopState, mode, ...over,
});

test('initial state is off and clean', () => {
  expect(initialVoiceLoopState).toEqual({
    mode: 'off', silentTurns: 0, autoTurns: 0, resumeTo: null, endedReason: null,
  });
});

test('off + start → listening, counters cleared', () => {
  const s = voiceLoopReducer(at('off', { silentTurns: 2, autoTurns: 9, endedReason: 'silence' }), { type: 'start' });
  expect(s).toEqual({ mode: 'listening', silentTurns: 0, autoTurns: 0, resumeTo: null, endedReason: null });
});

test('listening + sent → thinking, silentTurns reset', () => {
  const s = voiceLoopReducer(at('listening', { silentTurns: 1 }), { type: 'sent' });
  expect(s.mode).toBe('thinking');
  expect(s.silentTurns).toBe(0);
});

test('listening + noSpeech re-arms until the cap, then ends with reason silence', () => {
  let s = at('listening');
  for (let i = 1; i < MAX_SILENT_TURNS; i++) {
    s = voiceLoopReducer(s, { type: 'noSpeech' });
    expect(s.mode).toBe('listening');
    expect(s.silentTurns).toBe(i);
  }
  s = voiceLoopReducer(s, { type: 'noSpeech' });
  expect(s.mode).toBe('off');
  expect(s.silentTurns).toBe(MAX_SILENT_TURNS);
  expect(s.endedReason).toBe('silence');
});

test('thinking + audioStarted → speaking', () => {
  expect(voiceLoopReducer(at('thinking'), { type: 'audioStarted' }).mode).toBe('speaking');
});

test('thinking + turnDone → listening (text-only reply)', () => {
  expect(voiceLoopReducer(at('thinking'), { type: 'turnDone' }).mode).toBe('listening');
});

test('speaking + audioEnded → listening', () => {
  expect(voiceLoopReducer(at('speaking'), { type: 'audioEnded' }).mode).toBe('listening');
});

test('speaking + interrupt → listening', () => {
  expect(voiceLoopReducer(at('speaking'), { type: 'interrupt' }).mode).toBe('listening');
});

test.each<VoiceLoopMode>(['listening', 'thinking', 'speaking'])('%s + pause → paused with resumeTo listening', (mode) => {
  const s = voiceLoopReducer(at(mode), { type: 'pause' });
  expect(s.mode).toBe('paused');
  expect(s.resumeTo).toBe('listening');
});

test('paused + resume → listening, resumeTo cleared', () => {
  const s = voiceLoopReducer(at('paused', { resumeTo: 'listening' }), { type: 'resume' });
  expect(s.mode).toBe('listening');
  expect(s.resumeTo).toBeNull();
});

test.each<VoiceLoopMode>(['listening', 'thinking', 'speaking', 'paused'])('%s + stop → off with the given reason', (mode) => {
  for (const reason of ['user', 'typed', 'left'] as const) {
    const s = voiceLoopReducer(at(mode), { type: 'stop', reason });
    expect(s.mode).toBe('off');
    expect(s.endedReason).toBe(reason);
  }
});

test.each<VoiceLoopMode>(['listening', 'thinking', 'speaking', 'paused'])('%s + error → off with reason error', (mode) => {
  const s = voiceLoopReducer(at(mode), { type: 'error' });
  expect(s.mode).toBe('off');
  expect(s.endedReason).toBe('error');
});

test('off + sent is a no-op — a tap-per-turn send leaves the loop off', () => {
  const s0 = at('off');
  expect(voiceLoopReducer(s0, { type: 'sent' })).toBe(s0);
});

test('unlisted transitions are no-ops returning the same state object', () => {
  const cases: Array<[VoiceLoopMode, VoiceLoopEvent]> = [
    ['off', { type: 'noSpeech' }],
    ['off', { type: 'audioStarted' }],
    ['off', { type: 'audioEnded' }],
    ['off', { type: 'turnDone' }],
    ['off', { type: 'interrupt' }],
    ['off', { type: 'pause' }],
    ['off', { type: 'resume' }],
    ['off', { type: 'stop', reason: 'user' }],
    ['off', { type: 'error' }],
    ['listening', { type: 'start' }],
    ['listening', { type: 'audioStarted' }],
    ['listening', { type: 'interrupt' }],
    ['listening', { type: 'resume' }],
    ['thinking', { type: 'noSpeech' }],
    ['thinking', { type: 'audioEnded' }],
    ['thinking', { type: 'interrupt' }],
    ['speaking', { type: 'turnDone' }],
    ['speaking', { type: 'sent' }],
    ['paused', { type: 'start' }],
    ['paused', { type: 'sent' }],
    ['paused', { type: 'pause' }],
    ['paused', { type: 'noSpeech' }],
    ['paused', { type: 'audioStarted' }],
    ['paused', { type: 'audioEnded' }],
    ['paused', { type: 'turnDone' }],
    ['paused', { type: 'interrupt' }],
  ];
  for (const [mode, event] of cases) {
    const s = at(mode, mode === 'paused' ? { resumeTo: 'listening' } : {});
    expect(voiceLoopReducer(s, event)).toBe(s);
  }
});

test('paused + error → off with reason error', () => {
  const s = voiceLoopReducer(at('paused', { resumeTo: 'listening' }), { type: 'error' });
  expect(s.mode).toBe('off');
  expect(s.endedReason).toBe('error');
  expect(s.resumeTo).toBeNull();
});

test('each sent counts an automatic turn', () => {
  let s = voiceLoopReducer(at('off'), { type: 'start' });
  s = voiceLoopReducer(s, { type: 'sent' });
  expect(s.autoTurns).toBe(1);
  s = voiceLoopReducer(s, { type: 'turnDone' });
  s = voiceLoopReducer(s, { type: 'sent' });
  expect(s.autoTurns).toBe(2);
});

test('the cost guard ends the loop after the last reply is spoken, not before it', () => {
  // One turn short of the cap: the reply still re-arms the mic.
  const nearly = at('listening', { autoTurns: MAX_AUTO_TURNS - 2 });
  const spoken = voiceLoopReducer(voiceLoopReducer(nearly, { type: 'sent' }), { type: 'audioStarted' });
  expect(voiceLoopReducer(spoken, { type: 'audioEnded' }).mode).toBe('listening');

  // The capping turn: the send goes through and is still spoken…
  const last = voiceLoopReducer(at('listening', { autoTurns: MAX_AUTO_TURNS - 1 }), { type: 'sent' });
  expect(last.mode).toBe('thinking');
  expect(last.autoTurns).toBe(MAX_AUTO_TURNS);
  const speaking = voiceLoopReducer(last, { type: 'audioStarted' });
  expect(speaking.mode).toBe('speaking');
  // …and only then does the loop pause itself.
  const ended = voiceLoopReducer(speaking, { type: 'audioEnded' });
  expect(ended.mode).toBe('off');
  expect(ended.endedReason).toBe('limit');
});

test('the cost guard also applies to a text-only reply', () => {
  const last = voiceLoopReducer(at('listening', { autoTurns: MAX_AUTO_TURNS - 1 }), { type: 'sent' });
  const ended = voiceLoopReducer(last, { type: 'turnDone' });
  expect(ended.mode).toBe('off');
  expect(ended.endedReason).toBe('limit');
});

test('interrupting the capping turn keeps listening — the user is driving', () => {
  const capped = at('speaking', { autoTurns: MAX_AUTO_TURNS });
  expect(voiceLoopReducer(capped, { type: 'audioEnded' }).mode).toBe('off');
  expect(voiceLoopReducer(capped, { type: 'interrupt' }).mode).toBe('listening');
});

test('start after the cap resets the turn counter', () => {
  const ended = voiceLoopReducer(at('speaking', { autoTurns: MAX_AUTO_TURNS }), { type: 'audioEnded' });
  const restarted = voiceLoopReducer(ended, { type: 'start' });
  expect(restarted.autoTurns).toBe(0);
  expect(restarted.endedReason).toBeNull();
});
