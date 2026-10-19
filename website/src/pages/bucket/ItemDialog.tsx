/**
 * ItemDialog - add something, or change everything about it.
 *
 * About / Plan / Memory, as on the phone: the common edit stays short, Plan
 * is for the Now and Next few, and Memory appears once it is done. Save
 * writes all three together and waits for the answer, so a refusal (the same
 * title twice in a category) shows here. Steps save as you go.
 */
import { useState } from 'react';

import { parseAmountToMinor } from '@app/core/money';
import type { ItemPatch } from '@app/modules/bucket/api';
import { amountText, choiceOf, targetFor } from '@app/modules/bucket/plan';
import { NOW_CAP } from '@app/modules/bucket/shelf';
import {
  COSTS,
  COST_LABEL,
  WANTS,
  WANT_LABEL,
  wantOf,
  type BucketInput,
  type BucketItem,
  type BucketStep,
  type Cost,
  type Want,
} from '@app/modules/bucket/types';
import { whenFromDone, whenToDone } from '@app/modules/bucket/when';

import { Icon } from '../../components/Icon';
import { ErrorBanner, Modal, Segmented, TextArea, TextField } from '../../components/ui';
import { CategoryIcon } from './CategoryIcon';
import { MemoryFields, type MemoryDraft } from './MemoryFields';
import { PlanFields, type PlanDraft } from './PlanFields';

export type ItemTab = 'about' | 'plan' | 'memory';

export type StepActions = {
  add: (itemId: string, title: string) => void;
  toggle: (step: BucketStep) => void;
  remove: (step: BucketStep) => void;
  restore: (step: BucketStep) => void;
  move: (step: BucketStep, direction: -1 | 1) => void;
};

export function memoryDraftOf(item: BucketItem, today: string): MemoryDraft {
  return {
    when: whenFromDone(item.done_on, item.done_precision, today),
    memory: item.memory,
    place: item.place,
    again: item.again,
  };
}

export function ItemDialog({
  item,
  initialTab = 'about',
  categories,
  defaultCategory,
  steps,
  today,
  shelfFull,
  onClose,
  onSave,
  onDelete,
  onMarkUndone,
  stepActions,
  actionError,
}: {
  /** Null when adding. The dialog is mounted per open, so state seeds once. */
  item: BucketItem | null;
  initialTab?: ItemTab;
  categories: string[];
  defaultCategory: string;
  steps: BucketStep[];
  today: string;
  shelfFull: boolean;
  onClose: () => void;
  onSave: (fields: BucketInput & ItemPatch) => Promise<void>;
  onDelete: (item: BucketItem) => void;
  onMarkUndone: (item: BucketItem) => void;
  stepActions: StepActions;
  /** A failed step change, which the page would only show behind this dialog. */
  actionError?: string | null;
}) {
  const [tab, setTab] = useState<ItemTab>(initialTab);
  const [title, setTitle] = useState(item?.title ?? '');
  const [category, setCategory] = useState(
    item?.category ?? (defaultCategory !== 'any' ? defaultCategory : (categories[0] ?? '')),
  );
  const [cost, setCost] = useState<Cost>(item?.cost ?? 'moderate');
  const [want, setWant] = useState<Want>(item ? wantOf(item) : 'someday');
  const [note, setNote] = useState(item?.note ?? '');
  const [plan, setPlan] = useState<PlanDraft>({
    target: choiceOf(item?.target_on ?? null, item?.target_precision ?? null),
    est: amountText(item?.est_cost_minor ?? null),
    saved: amountText(item?.saved_minor ?? null),
  });
  const [memory, setMemory] = useState<MemoryDraft | null>(
    item?.is_done ? memoryDraftOf(item, today) : null,
  );

  /**
   * Whether "When" was touched. An item done with no date reads back as
   * "Today", and writing that back on an unrelated save would stamp it.
   */
  const [whenTouched, setWhenTouched] = useState(false);

  const [titleError, setTitleError] = useState<string | null>(null);
  const [estError, setEstError] = useState<string | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tabs: ItemTab[] = item ? (item.is_done ? ['about', 'plan', 'memory'] : ['about', 'plan']) : [];
  const planEditable = want === 'now' || want === 'next';
  // A done item takes no place on Now, so it never has to ask.
  const askingToSwap = want === 'now' && item?.focus !== 'now' && !item?.is_done && shelfFull;

  const save = async () => {
    const cleanTitle = title.trim();
    const cleanCategory = category.trim();
    setTitleError(cleanTitle ? null : 'What is the thing?');
    if (!cleanTitle || !cleanCategory) {
      setTab('about');
      if (!cleanCategory) setError('Give it a category');
      return;
    }

    const fields: BucketInput & ItemPatch = {
      title: cleanTitle,
      category: cleanCategory,
      cost,
      note: note.trim(),
      focus: want === 'someday' ? null : want,
    };

    // Written only while it can be seen: back to Someday hides a plan
    // without erasing it.
    if (item && planEditable) {
      const est = plan.est.trim() ? parseAmountToMinor(plan.est) : null;
      const saved = plan.saved.trim() ? parseAmountToMinor(plan.saved) : 0;
      const estBad = plan.est.trim() !== '' && est === null;
      const savedBad = saved === null;
      setEstError(estBad ? 'Digits only, like 38000' : null);
      setSavedError(savedBad ? 'Digits only, like 12000' : null);
      if (estBad || savedBad) {
        setTab('plan');
        return;
      }
      Object.assign(fields, targetFor(plan.target), { est_cost_minor: est, saved_minor: saved ?? 0 });
    }

    if (item?.is_done && memory) {
      if (item.done_on || whenTouched) Object.assign(fields, whenToDone(memory.when, today));
      Object.assign(fields, {
        memory: memory.memory.trim(),
        place: memory.place.trim(),
        again: memory.again,
      });
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(fields);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={item ? item.title : 'Add to the list'}
      onClose={onClose}
      width={560}
      footer={
        <>
          {item ? (
            <button
              type="button"
              className="btn btn-ghost bl-delete"
              onClick={() => onDelete(item)}
            >
              <Icon name="trash" size={14} /> Delete
            </button>
          ) : null}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : item ? 'Save' : 'Add'}
          </button>
        </>
      }
    >
      {tabs.length > 0 ? (
        <Segmented
          value={tab}
          onChange={setTab}
          options={tabs.map((t) => ({
            value: t,
            label: t === 'about' ? 'About' : t === 'plan' ? 'Plan' : 'Memory',
          }))}
        />
      ) : null}

      {tab === 'about' ? (
        <>
          <TextField
            label="What"
            value={title}
            error={titleError}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Learn to surf"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
            }}
          />

          <label className="field">
            <span className="label">Category</span>
            <div className="bl-category-input">
              <CategoryIcon category={category} size={15} className="bl-category-icon" />
              <input
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                list="bucket-categories"
                placeholder="Water Adventures"
              />
            </div>
            {/* A datalist, not a select: the existing categories are
                suggestions, and a new one should not need a schema change. */}
            <datalist id="bucket-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <div className="field">
            <span className="label">What it costs to do</span>
            <Segmented
              value={cost}
              onChange={setCost}
              options={COSTS.map((c) => ({ value: c, label: COST_LABEL[c] }))}
            />
          </div>

          <div className="field">
            <span className="label">How much you want it now</span>
            <Segmented
              value={want}
              onChange={setWant}
              options={WANTS.map((w) => ({ value: w, label: WANT_LABEL[w] }))}
            />
            {askingToSwap ? (
              <span className="faint bl-small">
                Now holds {NOW_CAP} already. Saving asks which one to swap out.
              </span>
            ) : null}
          </div>

          <TextArea
            label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional - where, who with, what it needs"
            rows={3}
          />
        </>
      ) : null}

      {tab === 'plan' && item ? (
        planEditable ? (
          <PlanFields
            draft={plan}
            onChange={setPlan}
            today={today}
            steps={steps}
            onAddStep={(stepTitle) => stepActions.add(item.id, stepTitle)}
            onToggleStep={stepActions.toggle}
            onRemoveStep={stepActions.remove}
            onRestoreStep={stepActions.restore}
            onMoveStep={stepActions.move}
            estError={estError}
            savedError={savedError}
          />
        ) : (
          <div className="bl-someday">
            <p className="secondary">
              Plans are for the few things you are actually doing. Put this on Now or Next to give
              it a date, steps and a budget.
            </p>
            <div className="row">
              <button type="button" className="btn btn-secondary" onClick={() => setWant('next')}>
                Make it Next
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setWant('now')}>
                Make it Now
              </button>
            </div>
          </div>
        )
      ) : null}

      {tab === 'memory' && item && memory ? (
        <>
          <MemoryFields
            draft={memory}
            onChange={(next) => {
              if (next.when !== memory.when) setWhenTouched(true);
              setMemory(next);
            }}
            today={today}
          />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMarkUndone(item)}>
            Not done after all? Mark it not done
          </button>
        </>
      ) : null}

      <ErrorBanner message={error ?? actionError ?? null} />
    </Modal>
  );
}
