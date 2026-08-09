/**
 * api.ts - database calls for user-created modules.
 *
 * Larger than the other modules' api.ts files because it covers three tables
 * (modules, their fields, their records) rather than one. Same conventions
 * throughout: check `error`, throw on failure, stamp the owner id here.
 */
import { getOwnerId } from '../../core/session';
import { supabase } from '../../core/supabase';
import type { CustomField, CustomModule, CustomRecord, FieldDraft } from './types';
import { toFieldKey } from './types';

const MODULES = 'user_modules';
const FIELDS = 'user_module_fields';
const RECORDS = 'user_records';

//  Modules

export async function listModules(): Promise<CustomModule[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(MODULES)
    .select('*')
    .eq('user_id', ownerId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getModule(id: string): Promise<CustomModule> {
  const { data, error } = await supabase.from(MODULES).select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listFields(moduleId: string): Promise<CustomField[]> {
  const { data, error } = await supabase
    .from(FIELDS)
    .select('*')
    .eq('module_id', moduleId)
    .order('position', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Create a module and its fields together.
 *
 * These are two inserts with no surrounding transaction, so the module could
 * in principle exist with no fields if the second call fails. That's a benign
 * failure - you'd see an empty module and could add fields by editing it -
 * unlike the subscription case where a partial failure meant duplicate money.
 * Not worth an edge function to make atomic.
 */
export async function createModule(
  input: { name: string; icon: string; color: string },
  fields: FieldDraft[],
): Promise<CustomModule> {
  const ownerId = await getOwnerId();

  const { data: module, error } = await supabase
    .from(MODULES)
    .insert({ ...input, user_id: ownerId })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (fields.length > 0) {
    await insertFields(module.id, ownerId, fields, []);
  }

  return module;
}

export async function updateModule(
  id: string,
  input: { name: string; icon: string; color: string },
): Promise<CustomModule> {
  const { data, error } = await supabase
    .from(MODULES)
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Save the field list of an existing module.
 *
 * Three cases, handled separately because they behave differently for data
 * already stored:
 *   • new fields  -> inserted; existing records simply have no value for them,
 *                   which reads as blank rather than breaking.
 *   • edited      -> label/required/options updated. The KEY is never touched,
 *                   so stored values stay attached to their field.
 *   • removed     -> the field row is deleted, but the values remain in each
 *                   record's jsonb. Harmless, invisible, and it means an
 *                   accidental delete can be undone by re-adding a field with
 *                   the same key.
 */
export async function saveFields(
  moduleId: string,
  drafts: FieldDraft[],
  existing: CustomField[],
): Promise<void> {
  const ownerId = await getOwnerId();

  const keptIds = drafts.map((d) => d.id).filter(Boolean) as string[];
  const removed = existing.filter((f) => !keptIds.includes(f.id));

  if (removed.length > 0) {
    const { error } = await supabase
      .from(FIELDS)
      .delete()
      .in('id', removed.map((f) => f.id));
    if (error) throw new Error(error.message);
  }

  // Updates, one per changed field. A handful of fields per module makes
  // individual updates simpler and clearer than a bulk upsert.
  for (const [index, draft] of drafts.entries()) {
    if (!draft.id) continue;
    const { error } = await supabase
      .from(FIELDS)
      .update({
        label: draft.label.trim(),
        type: draft.type,
        required: draft.required,
        options: draft.options,
        position: index,
      })
      .eq('id', draft.id);
    if (error) throw new Error(error.message);
  }

  const additions = drafts.filter((d) => !d.id);
  if (additions.length > 0) {
    await insertFields(
      moduleId,
      ownerId,
      additions,
      existing.map((f) => f.key),
      drafts.length - additions.length,
    );
  }
}

/** Shared insert path, so key generation happens in exactly one place. */
async function insertFields(
  moduleId: string,
  ownerId: string,
  drafts: FieldDraft[],
  existingKeys: string[],
  positionOffset = 0,
): Promise<void> {
  const keys = [...existingKeys];

  const rows = drafts.map((draft, index) => {
    const key = toFieldKey(draft.label, keys);
    keys.push(key); // so the next field in this same batch can't collide
    return {
      module_id: moduleId,
      user_id: ownerId,
      key,
      label: draft.label.trim(),
      type: draft.type,
      required: draft.required,
      options: draft.options,
      position: positionOffset + index,
    };
  });

  const { error } = await supabase.from(FIELDS).insert(rows);
  if (error) throw new Error(error.message);
}

/** Deleting a module removes its fields and records too, via ON DELETE CASCADE. */
export async function deleteModule(id: string): Promise<void> {
  const { error } = await supabase.from(MODULES).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

//  Records

export async function listRecords(moduleId: string): Promise<CustomRecord[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(RECORDS)
    .select('*')
    .eq('user_id', ownerId)
    .eq('module_id', moduleId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getRecord(id: string): Promise<CustomRecord> {
  const { data, error } = await supabase.from(RECORDS).select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createRecord(
  moduleId: string,
  data: Record<string, unknown>,
): Promise<CustomRecord> {
  const ownerId = await getOwnerId();

  const { data: row, error } = await supabase
    .from(RECORDS)
    .insert({ module_id: moduleId, user_id: ownerId, data })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return row;
}

export async function updateRecord(
  id: string,
  data: Record<string, unknown>,
): Promise<CustomRecord> {
  const { data: row, error } = await supabase
    .from(RECORDS)
    .update({ data })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return row;
}

export async function deleteRecord(id: string): Promise<void> {
  const { error } = await supabase.from(RECORDS).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Row counts per module, for the home screen tiles. */
export async function countRecordsByModule(): Promise<Record<string, number>> {
  const ownerId = await getOwnerId();

  // Only the module_id column is selected - we're counting, not reading data.
  const { data, error } = await supabase
    .from(RECORDS)
    .select('module_id')
    .eq('user_id', ownerId);

  if (error) throw new Error(error.message);

  const counts: Record<string, number> = {};
  (data ?? []).forEach((row: { module_id: string }) => {
    counts[row.module_id] = (counts[row.module_id] ?? 0) + 1;
  });
  return counts;
}
