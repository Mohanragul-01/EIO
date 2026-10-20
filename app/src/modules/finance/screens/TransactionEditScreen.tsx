/**
 * TransactionEditScreen - add or edit an expense, an income or a transfer.
 *
 * Logging speed decides whether the ledger is complete, so the form starts
 * from what you did last (defaults.ts): the category and account last used
 * for this kind, a note's remembered category, the categories you use most at
 * the top of the grid, and your recent notes one tap away. "Save & add
 * another" keeps everything but the amount and the note, for a receipt with
 * three lines on it.
 *
 * The AMOUNT FIELD is still the first thing you touch, with an oversized
 * input: a spend is logged at a shop counter, and the number is the point.
 *
 * TWO ROUTES, ONE FORM. `TransactionEdit` is the app's own way in. The capture
 * link (eio://finance/add?amount=…) arrives as `FinanceCapture`, whose params
 * came from outside the app; they go through capture.ts, which turns rupees
 * into paise and drops anything unusable with a reason shown at the top. The
 * link never saves by itself - this form is the review step.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, TextInput, View } from 'react-native';

import { categoriesFor, categoryDef } from '../../../core/categories';
import {
  Button,
  DateField,
  FadeInView,
  FormScroll,
  GlassCard,
  Screen,
  SegmentedControl,
  TextField,
  useToast,
} from '../../../core/components';
import { todayISO } from '../../../core/date';
import { success } from '../../../core/haptics';
import { formatMoney, minorToAmountString, parseAmountToMinor } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { fonts, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { activeAccounts, matchAccount } from '../accounts';
import * as api from '../api';
import { findLikelyDuplicate, parseCaptureParams } from '../capture';
import { ledgerChanged } from '../changes';
import { categoryForNote, lastTransfer, lastUsed, noteSuggestions, orderByUse } from '../defaults';
import { saveEntry } from '../saveEntry';
import type { EntryKind, Transaction, TransactionKind } from '../types';
import { useEntryData } from '../useEntryData';
import { AccountChips } from '../components/AccountChips';
import { CategoryGrid } from '../components/CategoryGrid';
import { Notice } from '../components/Notice';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route =
  | RouteProp<RootStackParamList, 'TransactionEdit'>
  | RouteProp<RootStackParamList, 'FinanceCapture'>;

const KIND_LABEL: Record<TransactionKind, string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
};

/** "250" rather than "250.00" in the field: the paise only when there are some. */
function amountText(minor: number): string {
  return minorToAmountString(minor).replace(/\.00$/, '');
}

export function TransactionEditScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const toast = useToast();
  const amountRef = useRef<TextInput>(null);

  const isCapture = route.name === 'FinanceCapture';
  const editParams = route.name === 'TransactionEdit' ? route.params : undefined;
  const editingId = editParams?.id;
  const editingGroup = editParams?.groupId;
  const isEditing = !!(editingId || editingGroup);

  // Parsed once per link: the params never change under an open form.
  const capture = useMemo(
    () => (route.name === 'FinanceCapture' ? parseCaptureParams(route.params, todayISO()) : null),
    [route.name, route.params],
  );

  const { accounts, recent, editing, ready, error: loadError } = useEntryData({
    id: editingId,
    groupId: editingGroup,
  });
  const active = useMemo(() => activeAccounts(accounts), [accounts]);

  const [kind, setKind] = useState<TransactionKind>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  /** Picked by hand: note memory stops changing it from then on. */
  const [categoryChosen, setCategoryChosen] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState<string | null>(todayISO());
  const [pin, setPin] = useState(false);
  /** What the capture link could not use, as sentences. */
  const [linkNotes, setLinkNotes] = useState<string[]>([]);

  const [amountError, setAmountError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /**
   * Fill the form once, from the first answer. During render rather than in an
   * effect, so nothing paints empty for a frame; and once only, so a reload on
   * focus (after adding an account) never overwrites what you typed.
   */
  const [seeded, setSeeded] = useState(false);
  if (ready && !seeded) {
    setSeeded(true);
    const isActive = (id: string | null | undefined): id is string => !!id && active.some((a) => a.id === id);

    if (editing && editing.length > 0) {
      const first = editing[0];
      setAmount(amountText(first.amount_minor));
      setNote(first.note);
      setDate(first.date);
      if (first.kind === 'transfer') {
        setKind('transfer');
        setFromId(editing.find((r) => r.transfer_direction === 'out')?.account_id ?? null);
        setToId(editing.find((r) => r.transfer_direction === 'in')?.account_id ?? null);
      } else {
        setKind(first.kind);
        setCategory(first.category);
        setCategoryChosen(true);
        setAccountId(first.account_id);
      }
    } else {
      const prefill = capture?.prefill;
      const initialKind: TransactionKind = editParams?.kind ?? prefill?.kind ?? 'expense';
      const initialNote = prefill?.note ?? '';
      const reasons = [...(capture?.ignored ?? [])];

      setKind(initialKind);
      setNote(initialNote);
      setDate(editParams?.date ?? prefill?.date ?? todayISO());
      if (prefill?.amountMinor) setAmount(amountText(prefill.amountMinor));

      if (initialKind === 'transfer') {
        const last = lastTransfer(recent);
        const from = (isActive(editParams?.accountId) && editParams?.accountId) || (isActive(last?.fromId) && last?.fromId) || active[0]?.id || null;
        const to =
          (isActive(last?.toId) && last?.toId !== from && last?.toId) ||
          active.find((a) => a.id !== from)?.id ||
          null;
        setFromId(from);
        setToId(to);
      } else {
        const defaults = lastUsed(recent, initialKind);
        const remembered = categoryForNote(initialNote, recent, initialKind);
        setCategory(prefill?.category ?? remembered ?? defaults.category ?? categoriesFor(initialKind)[0].key);
        setCategoryChosen(!!prefill?.category);

        let chosen: string | null = isActive(editParams?.accountId) ? editParams!.accountId! : null;
        if (prefill?.account) {
          const match = matchAccount(prefill.account, accounts);
          if (match) chosen = match.id;
          else reasons.push(`No account is called "${prefill.account}", so your usual one was picked.`);
        }
        setAccountId(chosen ?? (isActive(defaults.accountId) ? defaults.accountId : null) ?? active[0]?.id ?? null);
      }
      setLinkNotes(reasons);
    }
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing
        ? kind === 'transfer'
          ? 'Edit transfer'
          : 'Edit entry'
        : isCapture
          ? 'Check and save'
          : 'New entry',
    });
  }, [navigation, isEditing, isCapture, kind]);

  const entryKind: EntryKind = kind === 'income' ? 'income' : 'expense';
  const categoryOptions = useMemo(
    () => orderByUse(categoriesFor(entryKind), recent, entryKind),
    [entryKind, recent],
  );
  const suggestions = useMemo(
    () => (isEditing || kind === 'transfer' ? [] : noteSuggestions(note, recent, entryKind)),
    [isEditing, kind, note, recent, entryKind],
  );

  // An archived account still shows on an entry that uses it, so editing an
  // old entry does not silently move it.
  const accountOptions = useMemo(() => {
    const current = [accountId, fromId, toId].filter(Boolean) as string[];
    const archived = accounts.filter((a) => !a.is_active && current.includes(a.id));
    return [...active, ...archived];
  }, [accounts, active, accountId, fromId, toId]);

  const parsedAmount = parseAmountToMinor(amount);
  const duplicate =
    isCapture && kind !== 'transfer'
      ? findLikelyDuplicate({ amountMinor: parsedAmount, kind: entryKind }, recent, new Date())
      : null;

  const changeKind = (next: TransactionKind) => {
    setKind(next);
    setFormError(null);
    if (next === 'transfer') {
      if (!fromId || !toId) {
        const last = lastTransfer(recent);
        const from = fromId ?? accountId ?? last?.fromId ?? active[0]?.id ?? null;
        setFromId(from);
        setToId(toId ?? active.find((a) => a.id !== from)?.id ?? null);
      }
      return;
    }
    // Expense and income have different category lists: a category from the
    // old list would be saved against a kind that does not offer it.
    if (!categoriesFor(next).some((c) => c.key === category)) {
      setCategory(lastUsed(recent, next).category ?? categoriesFor(next)[0].key);
      setCategoryChosen(false);
    }
    if (!accountId) setAccountId(lastUsed(recent, next).accountId ?? active[0]?.id ?? null);
  };

  const changeNote = (text: string) => {
    setNote(text);
    // "Metro" was Transport last time, so it is Transport now - unless you
    // already picked a category yourself.
    if (!categoryChosen && kind !== 'transfer') {
      const remembered = categoryForNote(text, recent, entryKind);
      if (remembered) setCategory(remembered);
    }
  };

  // Picking From = the current To (or the reverse) swaps them, rather than
  // leaving a transfer from an account to itself.
  const pickFrom = (id: string) => {
    if (id === toId) setToId(fromId);
    setFromId(id);
  };
  const pickTo = (id: string) => {
    if (id === fromId) setFromId(toId);
    setToId(id);
  };

  const save = async (another: boolean) => {
    // Null for anything unparseable rather than 0: a silent ₹0 entry is a
    // much worse outcome than a validation message.
    if (parsedAmount === null || parsedAmount <= 0) {
      setAmountError('Enter an amount like 250 or 249.50');
      return;
    }
    if (kind === 'transfer') {
      if (!fromId || !toId) return setFormError('Pick the account it left and the one it reached.');
      if (fromId === toId) return setFormError('A transfer needs two different accounts.');
    }
    setAmountError(null);
    setFormError(null);
    setSaving(true);

    const day = date ?? todayISO();
    let pinError: string | null;
    try {
      ({ pinError } = await saveEntry(
        kind === 'transfer'
          ? {
              type: 'transfer',
              input: {
                amount_minor: parsedAmount,
                from_account_id: fromId!,
                to_account_id: toId!,
                note: note.trim(),
                date: day,
              },
              groupId: editingGroup,
              existing: editing,
            }
          : {
              type: 'entry',
              input: {
                amount_minor: parsedAmount,
                kind: entryKind,
                category,
                note: note.trim(),
                date: day,
                account_id: accountId,
              },
              id: editingId,
              pin:
                pin && !isEditing
                  ? {
                      // The pin's label is the note; with no note, the category says it.
                      note: note.trim() || categoryDef(category).label,
                      amount_minor: parsedAmount,
                      kind: entryKind,
                      category,
                      account_id: accountId,
                    }
                  : null,
            },
      ));
    } catch (e) {
      // Nothing was saved, so the form keeps what you typed for another try.
      setSaving(false);
      setFormError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      return;
    }

    // Saved, and final: from here the form always moves on, so a second Save
    // cannot log it twice. A pin that failed is said, not retried.
    success();
    const label = kind === 'transfer' ? 'Transfer' : categoryDef(category).label;
    const saved = `Saved ${formatMoney(parsedAmount, { compact: true })} · ${label}`;
    const message = pinError
      ? `${saved}, but it could not be pinned. Long-press it in the list to pin it.`
      : saved;

    if (another) {
      // Keep the kind, account, category and date - the next line of the
      // same receipt shares them - and clear what differs.
      setAmount('');
      setNote('');
      setPin(false);
      setCategoryChosen(false);
      setSaving(false);
      toast.show({ message });
      amountRef.current?.focus();
      return;
    }
    navigation.goBack();
    if (pinError) toast.show({ message });
  };

  /** Delete, go back, and offer Undo: deleting is reversible, so it is not confirmed. */
  const remove = async () => {
    if (!editing) return;
    let rows: Transaction[] = editing;
    setDeleting(true);
    try {
      // For Undo, a transfer's halves as the server deleted them: the form
      // read them a while ago, and they may have changed since.
      if (editingGroup) rows = await api.deleteTransfer(editingGroup);
      else if (editingId) await api.deleteTransaction(editingId);
      navigation.goBack();
      const first = rows[0] ?? editing[0];
      const label = first.kind === 'transfer' ? 'transfer' : first.note || categoryDef(first.category).label;
      toast.show({
        message: `Deleted ${formatMoney(first.amount_minor, { compact: true })} · ${label}`,
        actionLabel: 'Undo',
        onAction: () => {
          api
            .restoreTransactions(rows)
            .then(ledgerChanged)
            .catch(() => toast.show({ message: 'Could not undo. The entry is still deleted.' }));
        },
      });
    } catch (e) {
      setDeleting(false);
      setFormError(e instanceof Error ? e.message : 'Could not delete. Please try again.');
    }
  };

  if (loadError) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Ionicons name="warning-outline" size={26} color={colors.danger} />
          <Text style={styles.loadError}>{loadError}</Text>
          <Button label="Go back" variant="glass" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );
  }

  if (!seeded) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const kinds: TransactionKind[] = isEditing
    ? kind === 'transfer'
      ? []
      : ['expense', 'income']
    : ['expense', 'income', 'transfer'];

  return (
    <Screen padded={false}>
      <FormScroll contentContainerStyle={styles.scroll}>
        {capture ? (
          <FadeInView>
            <Notice
              tone="info"
              title={
                capture.provided
                  ? 'Filled in from a link. Check it, then save.'
                  : 'The link had nothing to fill in.'
              }
              lines={linkNotes}
              style={styles.notice}
            />
          </FadeInView>
        ) : null}

        {duplicate ? (
          <Notice
            tone="warning"
            title={`You logged ${formatMoney(duplicate.amount_minor, { compact: true })}${
              duplicate.note ? ` · ${duplicate.note}` : ''
            } a few minutes ago.`}
            lines={['Save this only if it is a second payment. One UPI payment often sends two alerts.']}
            style={styles.notice}
          />
        ) : null}

        {/*  Amount: the hero field  */}
        <FadeInView>
          <GlassCard style={styles.amountCard}>
            <Text style={styles.amountLabel}>Amount</Text>
            <View style={styles.amountRow}>
              <Text style={styles.currency}>₹</Text>
              <TextInput
                ref={amountRef}
                value={amount}
                onChangeText={(text) => {
                  setAmount(text);
                  if (amountError) setAmountError(null);
                }}
                placeholder="0"
                placeholderTextColor={colors.textFaint}
                // 'decimal-pad' gives digits and a decimal point but no comma
                // or +/- keys, which are meaningless here.
                keyboardType="decimal-pad"
                selectionColor={colors.primary}
                style={styles.amountInput}
                autoFocus={!isEditing && !capture?.prefill.amountMinor}
                maxLength={12}
                accessibilityLabel="Amount in rupees"
              />
            </View>
            {amountError ? <Text style={styles.errorText}>{amountError}</Text> : null}
          </GlassCard>
        </FadeInView>

        <FadeInView delay={60}>
          <GlassCard>
            {kinds.length > 0 ? (
              <SegmentedControl
                label="Type"
                options={kinds}
                value={kind}
                onChange={changeKind}
                renderLabel={(k) => KIND_LABEL[k]}
                accentFor={(k) =>
                  k === 'income' ? colors.success : k === 'transfer' ? colors.info : colors.accentRose
                }
              />
            ) : (
              <View style={styles.transferBadge}>
                <Ionicons name="swap-horizontal" size={16} color={colors.textSecondary} />
                <Text style={styles.transferBadgeText}>
                  A transfer between your own accounts. It is not spending or income.
                </Text>
              </View>
            )}

            {kind === 'transfer' ? (
              <>
                <AccountChips
                  label="From"
                  accounts={accountOptions}
                  value={fromId}
                  onChange={pickFrom}
                  onAddAccount={() => navigation.navigate('FinanceAccounts')}
                  style={styles.field}
                />
                <AccountChips
                  label="To"
                  accounts={accountOptions}
                  value={toId}
                  onChange={pickTo}
                  hint={
                    accountOptions.length < 2
                      ? 'A transfer needs two accounts. Add another on the Accounts screen.'
                      : null
                  }
                  style={styles.field}
                />
              </>
            ) : (
              <>
                <AccountChips
                  label={kind === 'income' ? 'Received in' : 'Paid from'}
                  accounts={accountOptions}
                  value={accountId}
                  onChange={setAccountId}
                  onAddAccount={() => navigation.navigate('FinanceAccounts')}
                  hint={accountId ? null : 'Not in an account yet. Pick one so its balance includes this.'}
                  style={styles.field}
                />
                <CategoryGrid
                  label="Category"
                  options={categoryOptions}
                  value={category}
                  onChange={(key) => {
                    setCategory(key);
                    setCategoryChosen(true);
                  }}
                  style={styles.field}
                />
              </>
            )}

            {/* mode="event" + allowClear={false}: an entry records something
                that already happened on a specific day, and the column is NOT
                NULL. */}
            <DateField
              label={kind === 'income' ? 'Received on' : kind === 'transfer' ? 'Moved on' : 'Paid on'}
              value={date}
              onChange={setDate}
              mode="event"
              allowClear={false}
              style={styles.field}
            />

            <TextField
              label="Note"
              value={note}
              onChangeText={changeNote}
              placeholder={kind === 'transfer' ? 'ATM, card bill…' : 'What was it for?'}
              maxLength={200}
              style={styles.field}
            />

            {suggestions.length > 0 ? (
              <View style={styles.suggestions}>
                {suggestions.map((s) => (
                  <Pressable
                    key={s.note}
                    onPress={() => {
                      setNote(s.note);
                      setCategory(s.category);
                      setCategoryChosen(false);
                      // The amount too, if you have not typed one: a repeat
                      // purchase is then a tap on this and a tap on Save.
                      if (!amount.trim()) setAmount(amountText(s.amountMinor));
                    }}
                    hitSlop={4}
                    style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${s.note}, ${categoryDef(s.category).label}, ${formatMoney(s.amountMinor, { compact: true })}`}
                  >
                    <Ionicons
                      name={categoryDef(s.category).icon}
                      size={13}
                      color={categoryDef(s.category).color}
                    />
                    <Text style={styles.suggestionText} numberOfLines={1}>
                      {s.note} · {formatMoney(s.amountMinor, { compact: true })}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {!isEditing && kind !== 'transfer' ? (
              <View style={styles.pinRow}>
                <View style={styles.pinText}>
                  <Text style={styles.pinLabel}>Pin as a quick add</Text>
                  <Text style={styles.pinHint}>Log it again from the Finance screen in one tap.</Text>
                </View>
                <Switch
                  value={pin}
                  onValueChange={setPin}
                  trackColor={{ true: colors.primary, false: colors.glassStrong }}
                  thumbColor={colors.backgroundElevated}
                  accessibilityLabel="Pin as a quick add"
                />
              </View>
            ) : null}
          </GlassCard>
        </FadeInView>

        <FadeInView delay={120}>
          {formError ? (
            <View style={styles.formError} accessibilityRole="alert">
              <Ionicons name="warning-outline" size={16} color={colors.danger} />
              <Text style={styles.formErrorText}>{formError}</Text>
            </View>
          ) : null}

          <Button
            label={isEditing ? 'Save changes' : 'Save'}
            icon="checkmark"
            onPress={() => void save(false)}
            loading={saving}
            style={styles.save}
          />
          {!isEditing ? (
            <Button
              label="Save & add another"
              icon="add"
              variant="glass"
              onPress={() => void save(true)}
              disabled={saving}
              style={styles.secondary}
            />
          ) : (
            <Button
              label={kind === 'transfer' ? 'Delete transfer' : 'Delete entry'}
              icon="trash-outline"
              variant="ghost"
              onPress={() => void remove()}
              loading={deleting}
              style={styles.secondary}
            />
          )}
        </FadeInView>
      </FormScroll>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104,
    paddingBottom: spacing.xxxl,
  },
  notice: {
    marginBottom: spacing.lg,
  },
  amountCard: {
    marginBottom: spacing.lg,
  },
  amountLabel: {
    ...typography.overline,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  currency: {
    fontFamily: fonts.semibold,
    fontSize: 30,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 34,
    letterSpacing: -1,
    color: colors.text,
    padding: 0, // Android adds default padding that misaligns it from the ₹
    ...typography.numeric,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  transferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  transferBadgeText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  field: {
    marginTop: spacing.xxl,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pressed: {
    opacity: 0.7,
  },
  suggestionText: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 12.5,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    marginTop: spacing.xl,
  },
  pinText: {
    flex: 1,
  },
  pinLabel: {
    ...typography.body,
    color: colors.text,
  },
  pinHint: {
    ...typography.caption,
  },
  formError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  formErrorText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
  save: {
    marginTop: spacing.xl,
  },
  secondary: {
    marginTop: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  loadError: {
    ...typography.body,
    textAlign: 'center',
  },
}));
