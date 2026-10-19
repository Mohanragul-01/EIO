/**
 * DigestSheet - the "plan your day" notification: on or off, and when.
 *
 * Off until turned on here, and turning it on is the moment permission is
 * asked for - never at launch. A refusal is explained in place rather than
 * leaving a switch that is on and silent.
 */
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { Sheet } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import * as api from '../api';
import {
  DEFAULT_DIGEST,
  ensurePermission,
  loadDigestSettings,
  type DigestSettings,
} from '../notifications';
import { formatTime } from '../today';
import { Chip } from './Chip';

type DigestSheetProps = { visible: boolean; onClose: () => void };

const pad = (n: number) => String(n).padStart(2, '0');

export function DigestSheet({ visible, onClose }: DigestSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [settings, setSettings] = useState<DigestSettings>(DEFAULT_DIGEST);
  const [notice, setNotice] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    (async () => {
      const stored = await loadDigestSettings();
      if (active) setSettings(stored);
    })();
    return () => {
      active = false;
    };
  }, [visible]);

  const apply = async (next: DigestSettings) => {
    setSettings(next);
    try {
      await api.applyDigestSettings(next);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not update the digest');
    }
  };

  const toggle = async () => {
    setNotice(null);
    if (settings.enabled) {
      await apply({ ...settings, enabled: false });
      return;
    }
    const permission = await ensurePermission();
    if (permission === 'granted') {
      await apply({ ...settings, enabled: true });
    } else if (permission === 'denied') {
      setNotice('Notifications are off for EIO. Turn them on in Android Settings, Apps, EIO, then try again.');
    } else {
      setNotice('This build cannot show notifications (Expo Go cannot). The installed app can.');
    }
  };

  const time = `${pad(settings.hour)}:${pad(settings.minute)}`;

  return (
    <Sheet
      visible={visible}
      title="Plan your day"
      subtitle="A morning notification: what is overdue and what is due"
      onClose={onClose}
    >
      <Pressable
        onPress={() => void toggle()}
        style={styles.toggleRow}
        accessibilityRole="switch"
        accessibilityState={{ checked: settings.enabled }}
        accessibilityLabel="Daily digest"
      >
        <Ionicons
          name={settings.enabled ? 'notifications' : 'notifications-off-outline'}
          size={20}
          color={settings.enabled ? colors.primary : colors.textMuted}
        />
        <View style={styles.toggleText}>
          <Text style={styles.toggleTitle}>Daily digest</Text>
          <Text style={styles.toggleCaption}>
            {settings.enabled
              ? `On, at ${formatTime(time)}. Days with nothing due are skipped.`
              : 'Off'}
          </Text>
        </View>
        <View style={[styles.switch, settings.enabled && styles.switchOn]}>
          <View style={[styles.knob, settings.enabled && styles.knobOn]} />
        </View>
      </Pressable>

      {settings.enabled ? (
        <Chip
          label="Time"
          detail={formatTime(time)}
          icon="time-outline"
          onPress={() => setPicking(true)}
          style={styles.time}
        />
      ) : null}

      {notice ? (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Ionicons name="information-circle-outline" size={16} color={colors.info} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      {picking ? (
        <DateTimePicker
          value={new Date(2000, 0, 1, settings.hour, settings.minute)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={(_event, date) => {
            setPicking(false);
            if (date) void apply({ ...settings, hour: date.getHours(), minute: date.getMinutes() });
          }}
          onDismiss={() => setPicking(false)}
        />
      ) : null}
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  toggleRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  toggleText: { flex: 1 },
  toggleTitle: { ...typography.title, fontSize: 14 },
  toggleCaption: { ...typography.caption, fontSize: 11.5, marginTop: 2 },
  switch: {
    width: 46,
    height: 27,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  switchOn: { backgroundColor: colors.primary + '4D', borderColor: colors.primary + '99' },
  knob: { width: 19, height: 19, borderRadius: radius.pill, backgroundColor: colors.textMuted },
  knobOn: { backgroundColor: colors.primary, transform: [{ translateX: 19 }] },
  time: { marginTop: spacing.md, alignSelf: 'flex-start' },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
  },
  noticeText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
}));
