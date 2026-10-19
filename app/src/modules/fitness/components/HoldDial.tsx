/**
 * HoldDial - the timer that IS the input for a held exercise.
 *
 * Tap the dial (a big target, easy to hit with a knuckle), get 3-2-1, hold,
 * tap again to stop: the seconds become the set. The ring fills toward the
 * goal and keeps going past it in a second colour. Ticks every five seconds
 * and a distinct cue at the goal come as haptics, and as a voice if you turn
 * it on - hands are busy and the phone is on the floor. Everything spoken or
 * felt is also written large on the dial, for silent use.
 *
 * Time comes from timestamps (holdTimer.ts), so a dropped frame or a locked
 * screen cannot lose a second. The session screen keeps the phone awake.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Button, Sheet } from '../../../core/components';
import { success, tap } from '../../../core/haptics';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { holdCues, holdPhase } from '../holdTimer';
import { formatHoldShort } from '../load';

const VOICE_KEY = 'eio.fitness.hold-voice';
const TICKS_KEY = 'eio.fitness.hold-ticks';
const SIZE = 220;
const STROKE = 12;

type Run = { startedAt: number } | null;

function say(text: string) {
  try {
    Speech.speak(text, { rate: 1.05 });
  } catch {
    // No speech engine: the dial still shows everything.
  }
}

export function HoldDial({
  visible,
  exerciseName,
  goalSeconds,
  bestSeconds,
  lastSeconds,
  onSave,
  onClose,
}: {
  visible: boolean;
  exerciseName: string;
  goalSeconds: number | null;
  bestSeconds: number | null;
  lastSeconds: number | null;
  /** Called with the held seconds; the sheet closes itself. */
  onSave: (seconds: number) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [target, setTarget] = useState(goalSeconds ?? 30);
  const [run, setRun] = useState<Run>(null);
  const [now, setNow] = useState(() => Date.now());
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const [manual, setManual] = useState('');
  const [voice, setVoice] = useState(false);
  const [ticks, setTicks] = useState(true);
  const lastElapsed = useRef(0);
  const lastCount = useRef<number | null>(null);

  // Remembered per device: whether you want to hear it, and feel the ticks.
  useEffect(() => {
    AsyncStorage.multiGet([VOICE_KEY, TICKS_KEY])
      .then((pairs) => {
        const map = Object.fromEntries(pairs);
        setVoice(map[VOICE_KEY] === '1');
        setTicks(map[TICKS_KEY] !== '0');
      })
      .catch(() => {});
  }, []);

  // While running: a frame clock, plus every cue the clock crossed since the
  // last frame, each exactly once.
  useEffect(() => {
    if (!run || stoppedAt !== null) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const phase = holdPhase(t, run.startedAt);
      if (phase.phase === 'leadIn') {
        if (lastCount.current !== phase.count) {
          lastCount.current = phase.count;
          tap();
          if (voice) say(String(phase.count));
        }
        return;
      }
      if (lastCount.current !== 0) {
        lastCount.current = 0;
        success();
        if (voice) say('Go');
      }
      for (const cue of holdCues(lastElapsed.current, phase.elapsedMs, target, ticks ? 5 : null)) {
        if (cue.kind === 'target') {
          success();
          if (voice) say('Target');
        } else {
          tap();
          if (voice) say(String(cue.atSeconds));
        }
      }
      lastElapsed.current = phase.elapsedMs;
    }, 100);
    return () => clearInterval(timer);
  }, [run, stoppedAt, target, ticks, voice]);

  // Stop speaking when the sheet goes away.
  useEffect(() => {
    if (!visible) void Speech.stop().catch(() => {});
  }, [visible]);

  const start = () => {
    lastElapsed.current = 0;
    lastCount.current = null;
    setStoppedAt(null);
    const t = Date.now();
    setNow(t);
    setRun({ startedAt: t });
  };

  const stop = () => {
    const t = Date.now();
    setNow(t);
    setStoppedAt(t);
    tap();
  };

  const reset = () => {
    setRun(null);
    setStoppedAt(null);
  };

  const phase = run ? holdPhase(stoppedAt ?? now, run.startedAt) : null;
  const holdingMs = phase?.phase === 'holding' ? phase.elapsedMs : 0;
  const heldSeconds = Math.floor(holdingMs / 1000);
  const stopped = stoppedAt !== null;
  const pastTarget = heldSeconds >= target;

  const r = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const fraction = target > 0 ? Math.min(1, holdingMs / (target * 1000)) : 0;
  // Past the goal, a second ring laps the first in the success colour.
  const overFraction =
    target > 0 && pastTarget ? Math.min(1, (holdingMs - target * 1000) / (target * 1000)) : 0;

  const centre =
    phase?.phase === 'leadIn'
      ? String(phase.count)
      : run
        ? formatHoldShort(heldSeconds)
        : `${target}s`;
  const caption =
    phase?.phase === 'leadIn'
      ? 'Get ready'
      : stopped
        ? 'Stopped'
        : run
          ? pastTarget
            ? 'Past your goal'
            : `Goal ${target}s`
          : 'Tap to start';

  const save = (seconds: number) => {
    if (seconds <= 0) return;
    onSave(seconds);
    reset();
    onClose();
  };

  const manualSeconds = Number(manual.trim());

  return (
    <Sheet
      visible={visible}
      title={exerciseName}
      subtitle="Hold timer: tap the dial to start and stop"
      onClose={() => {
        reset();
        onClose();
      }}
      footer={
        stopped ? (
          <View style={styles.footerRow}>
            <Button
              label="Again"
              variant="glass"
              icon="refresh"
              onPress={reset}
              style={styles.flex}
            />
            <Button
              label={`Save ${formatHoldShort(heldSeconds)}`}
              onPress={() => save(heldSeconds)}
              style={styles.flex}
            />
          </View>
        ) : null
      }
    >
      <View style={styles.dialRow}>
        {!run ? (
          <Pressable
            onPress={() => setTarget((t) => Math.max(5, t - 5))}
            accessibilityRole="button"
            accessibilityLabel="Goal 5 seconds less"
            style={styles.step}
          >
            <Text style={styles.stepText}>−5</Text>
          </Pressable>
        ) : (
          <View style={styles.step} />
        )}

        <Pressable
          onPress={() =>
            !run ? start() : stopped ? undefined : phase?.phase === 'leadIn' ? reset() : stop()
          }
          accessibilityRole="button"
          accessibilityLabel={
            !run
              ? `Start a ${target} second hold`
              : stopped
                ? `Held ${heldSeconds} seconds`
                : 'Stop'
          }
          accessibilityLiveRegion="polite"
          style={styles.dial}
        >
          <Svg width={SIZE} height={SIZE} style={styles.svg}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              stroke={colors.glassStrong}
              strokeWidth={STROKE}
              fill="none"
            />
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              stroke={colors.accentCyan}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - fraction)}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
            {overFraction > 0 ? (
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={r}
                stroke={colors.success}
                strokeWidth={STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference * (1 - overFraction)}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
            ) : null}
          </Svg>
          <Text style={[styles.centre, phase?.phase === 'leadIn' && styles.countdown]}>
            {centre}
          </Text>
          <Text style={[styles.caption, pastTarget && run ? { color: colors.success } : null]}>
            {caption}
          </Text>
        </Pressable>

        {!run ? (
          <Pressable
            onPress={() => setTarget((t) => Math.min(600, t + 5))}
            accessibilityRole="button"
            accessibilityLabel="Goal 5 seconds more"
            style={styles.step}
          >
            <Text style={styles.stepText}>+5</Text>
          </Pressable>
        ) : (
          <View style={styles.step} />
        )}
      </View>

      <View style={styles.stats}>
        <Stat label="Goal" value={goalSeconds ? `${goalSeconds}s` : '—'} />
        <Stat label="Best" value={bestSeconds ? formatHoldShort(bestSeconds) : '—'} />
        <Stat label="Last" value={lastSeconds ? formatHoldShort(lastSeconds) : '—'} />
      </View>

      <View style={styles.toggle}>
        <Text style={styles.toggleLabel}>Say the count out loud</Text>
        <Switch
          value={voice}
          onValueChange={(v) => {
            setVoice(v);
            AsyncStorage.setItem(VOICE_KEY, v ? '1' : '0').catch(() => {});
          }}
          accessibilityLabel="Say the count out loud"
          trackColor={{ true: colors.accentCyan, false: colors.glassStrong }}
        />
      </View>
      <View style={styles.toggle}>
        <Text style={styles.toggleLabel}>Tick every 5 seconds</Text>
        <Switch
          value={ticks}
          onValueChange={(v) => {
            setTicks(v);
            AsyncStorage.setItem(TICKS_KEY, v ? '1' : '0').catch(() => {});
          }}
          accessibilityLabel="Tick every 5 seconds"
          trackColor={{ true: colors.accentCyan, false: colors.glassStrong }}
        />
      </View>

      {!run ? (
        <View style={styles.manual}>
          <TextInput
            value={manual}
            onChangeText={setManual}
            placeholder="Or type the seconds"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            style={styles.input}
            accessibilityLabel="Seconds held"
          />
          <Button
            label="Save"
            variant="glass"
            disabled={!(Number.isInteger(manualSeconds) && manualSeconds > 0)}
            onPress={() => save(manualSeconds)}
          />
        </View>
      ) : null}
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  flex: { flex: 1 },
  footerRow: { flexDirection: 'row', gap: spacing.md },
  dialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  step: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
  },
  stepText: { ...typography.title, ...typography.numeric },
  dial: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  svg: { position: 'absolute' },
  centre: { ...typography.display, ...typography.numeric, fontSize: 48 },
  countdown: { color: colors.accentCyan, fontSize: 64 },
  caption: { ...typography.caption, color: colors.textSecondary },
  stats: { flexDirection: 'row', marginTop: spacing.lg },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.title, ...typography.numeric },
  statLabel: { ...typography.overline },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  toggleLabel: { ...typography.body, color: colors.text },
  manual: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.sm },
  input: {
    ...typography.title,
    ...typography.numeric,
    flex: 1,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    color: colors.text,
  },
}));
