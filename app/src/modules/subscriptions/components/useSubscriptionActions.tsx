/**
 * useSubscriptionActions - every action on a subscription, with its sheet and
 * its Undo, written once for the list and the detail screen.
 *
 * The flow is the same everywhere: an action that needs input opens a sheet;
 * the sheet closes FIRST and only then does the toast appear (a toast draws
 * beneath an open sheet, its Undo hidden). Reversible actions get "Undo" for
 * five seconds; only Delete asks first, and says what it takes with it.
 */
import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { useToast } from '../../../core/components';
import { success } from '../../../core/haptics';
import { formatMoney } from '../../../core/money';
import {
  archivePatch,
  cancelPatch,
  endTrialPatch,
  keepTrialPatch,
  pausePatch,
  restorePatch,
  resumePatch,
  type LifecyclePatch,
} from '../actions';
import * as api from '../api';
import { shortDate } from '../format';
import { effectiveState } from '../lifecycle';
import type { Account, Subscription } from '../types';
import type { PatchResult } from '../useSubscriptions';
import { ActionsSheet, type ActionKey } from './ActionsSheet';
import { DateActionSheet } from './DateActionSheet';
import { MarkPaidSheet } from './MarkPaidSheet';
import { TrialSheet } from './TrialSheet';

type Deps = {
  today: string;
  accounts: Account[];
  markPaid: (sub: Subscription, input: api.MarkPaidInput) => Promise<api.MarkPaidResult | null>;
  undoMarkPaid: (result: api.MarkPaidResult) => Promise<boolean>;
  applyPatch: (sub: Subscription, patch: LifecyclePatch) => Promise<PatchResult | null>;
  undoPatch: (result: PatchResult) => Promise<boolean>;
  /** Deletes the row; resolves whether it went. */
  remove: (sub: Subscription) => Promise<boolean>;
  onOpen: (sub: Subscription) => void;
  onEdit: (sub: Subscription) => void;
  onDeleted?: (sub: Subscription) => void;
};

export function useSubscriptionActions(deps: Deps) {
  const toast = useToast();
  const [menuFor, setMenuFor] = useState<Subscription | null>(null);
  const [payFor, setPayFor] = useState<Subscription | null>(null);
  const [cancelFor, setCancelFor] = useState<Subscription | null>(null);
  const [pauseFor, setPauseFor] = useState<Subscription | null>(null);
  const [trialFor, setTrialFor] = useState<Subscription | null>(null);

  const { today, applyPatch, undoPatch, markPaid, undoMarkPaid, remove, onOpen, onEdit, onDeleted } =
    deps;

  /** Apply a patch and offer to undo it. */
  const patchWithUndo = useCallback(
    async (sub: Subscription, patch: LifecyclePatch, message: string) => {
      const result = await applyPatch(sub, patch);
      if (!result) return;
      toast.show({
        message,
        actionLabel: 'Undo',
        onAction: () => void undoPatch(result),
      });
    },
    [applyPatch, undoPatch, toast],
  );

  const confirmDelete = useCallback(
    async (sub: Subscription) => {
      // The cascade is stated before it happens: price history goes with it,
      // payments already in Finance do not.
      const changes = await api.countPriceChanges(sub.id).catch(() => 0);
      const history =
        changes > 0
          ? `its price history (${changes} ${changes === 1 ? 'change' : 'changes'})`
          : 'it';
      Alert.alert(
        `Delete ${sub.name}?`,
        `This deletes ${history} for good. Payments already logged to Finance stay there. ` +
          'Archive keeps it out of the way instead, and can be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Archive instead',
            onPress: () => void patchWithUndo(sub, archivePatch(), `${sub.name} archived`),
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              if (await remove(sub)) {
                onDeleted?.(sub);
                toast.show({ message: `${sub.name} deleted` });
              }
            },
          },
        ],
      );
    },
    [patchWithUndo, remove, onDeleted, toast],
  );

  /** Start an action. Ones that need input open their sheet. */
  const run = useCallback(
    (key: ActionKey, sub: Subscription) => {
      setMenuFor(null);
      switch (key) {
        case 'pay':
          setPayFor(sub);
          return;
        case 'keep':
        case 'end_trial':
          setTrialFor(sub);
          return;
        case 'cancel':
          setCancelFor(sub);
          return;
        case 'pause':
          setPauseFor(sub);
          return;
        case 'resume':
          void patchWithUndo(sub, resumePatch(sub, today), `${sub.name} resumed`);
          return;
        case 'restore': {
          const ending = effectiveState(sub, today) === 'ending';
          void patchWithUndo(
            sub,
            restorePatch(sub, today),
            ending ? `${sub.name} is active again` : `${sub.name} restored`,
          );
          return;
        }
        case 'archive':
          void patchWithUndo(sub, archivePatch(), `${sub.name} archived`);
          return;
        case 'open':
          onOpen(sub);
          return;
        case 'edit':
          onEdit(sub);
          return;
        case 'delete':
          void confirmDelete(sub);
          return;
      }
    },
    [patchWithUndo, confirmDelete, onOpen, onEdit, today],
  );

  const confirmPay = async (input: api.MarkPaidInput) => {
    const sub = payFor;
    setPayFor(null);
    if (!sub) return;
    const result = await markPaid(sub, input);
    if (!result) return;
    success();
    toast.show({
      message: result.logged
        ? `${sub.name} paid · ${formatMoney(input.amountInrMinor, { compact: true })}`
        : `Due date moved, but Finance did not get it: ${result.logError}`,
      actionLabel: 'Undo',
      onAction: () => void undoMarkPaid(result),
      durationMs: result.logged ? undefined : 8000,
    });
  };

  const sheets = (
    <>
      <ActionsSheet
        visible={menuFor !== null}
        subscription={menuFor}
        today={today}
        onClose={() => setMenuFor(null)}
        onAction={run}
      />
      <MarkPaidSheet
        visible={payFor !== null}
        subscription={payFor}
        accounts={deps.accounts}
        today={today}
        onClose={() => setPayFor(null)}
        onConfirm={(input) => void confirmPay(input)}
      />
      <TrialSheet
        visible={trialFor !== null}
        subscription={trialFor}
        today={today}
        onClose={() => setTrialFor(null)}
        onKeep={() => {
          const sub = trialFor;
          setTrialFor(null);
          if (sub) void patchWithUndo(sub, keepTrialPatch(sub), `Keeping ${sub.name}`);
        }}
        onCancelled={() => {
          const sub = trialFor;
          setTrialFor(null);
          if (sub) void patchWithUndo(sub, endTrialPatch(sub), `${sub.name} trial ended`);
        }}
      />
      <DateActionSheet
        visible={cancelFor !== null}
        title={cancelFor ? `Cancel ${cancelFor.name}` : ''}
        subtitle="When does your access end?"
        label="Access until"
        initial={cancelFor?.next_due_date ?? null}
        allowClear={false}
        caption="It stays in your totals until then, and no renewal reminder fires. Undo clears it."
        confirmLabel="Mark as cancelled"
        onClose={() => setCancelFor(null)}
        onConfirm={(date) => {
          const sub = cancelFor;
          setCancelFor(null);
          if (sub && date) {
            void patchWithUndo(
              sub,
              cancelPatch(date),
              `${sub.name} cancelled · access until ${shortDate(date, today)}`,
            );
          }
        }}
      />
      <DateActionSheet
        visible={pauseFor !== null}
        title={pauseFor ? `Pause ${pauseFor.name}` : ''}
        subtitle="Leaves your totals while paused"
        label="Resumes on (optional)"
        initial={null}
        allowClear
        caption="With a date, it charges again that day and reminds you first. Without one, it waits for you to resume it."
        confirmLabel="Pause"
        onClose={() => setPauseFor(null)}
        onConfirm={(date) => {
          const sub = pauseFor;
          setPauseFor(null);
          if (sub) {
            void patchWithUndo(
              sub,
              pausePatch(sub, date),
              date
                ? `${sub.name} paused until ${shortDate(date, today)}`
                : `${sub.name} paused`,
            );
          }
        }}
      />
    </>
  );

  return { run, openMenu: setMenuFor, sheets };
}
