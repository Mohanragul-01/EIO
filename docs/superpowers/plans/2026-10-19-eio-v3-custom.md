# Custom modules v3 Implementation Plan

> **For agentic workers:** steps use checkbox (`- [ ]`) syntax for tracking. Built task by task, test first for every pure function.

**Goal:** Make the module builder fast to log into and worth looking back at — spec §11 in full, on the phone and the website: quick log with defaults, a trend chart and home sparkline, Rating / Multi-select / Duration fields and tap-to-toggle yes/no, filter chips and group-by with totals, module reminders, starter templates, row roles, a calendar view, and a type-change guard.

**Architecture:** One migration (`0026_custom_v3.sql`) adds every column the module reads and widens the field-type check. Everything that decides something — defaults, the chart series, filters and groups, row roles, the type-change impact, reminder plans, templates, the tile period — is a pure TypeScript file in `app/src/modules/custom/` with tests, imported unchanged by the website through `@app`. `api.ts` stays the only database code. Screens are rebuilt around those files; no logic is written twice.

**Tech stack:** Expo SDK 57 / RN 0.86 / React 19 (app), Vite + React + recharts (website), Supabase Postgres, Jest. Native: `react-native-svg` (in Expo Go; drawn by hand, no chart-kit), core notifications (DATE triggers only), core haptics.

**Spec:** `docs/superpowers/specs/2026-10-19-eio-v3-design.md` §11 (binding), §2 (ground rules), §3 (foundation), §12 (migration 0026). Evidence: `docs/research/custom-modules.md` §5 and §6.

## Global constraints

- §2 in full: 48dp targets (hitSlop), 8dp gaps, never colour alone, Ionicons / `Icon.tsx` only, no swipe-to-act, undo for reversible, confirm only the permanent (deleting a module and its entries), semantic tokens (a module's own colour is user data, not a theme literal), tabular figures for numbers, a11y labels and states, light and dark.
- jsonb values arrive as `unknown`. Every reader tolerates junk: a value left from an older type is kept and simply "won't show", never deleted and never NaN.
- A field's KEY never changes. Every module setting stores keys, never ids.
- No new dependencies. No `react-hooks/*` suppressions in new code.
- Both clients' six checks after every task that touches shared code.

## File map

New pure logic (each with `__tests__/<name>.test.ts`):
- `custom/defaults.ts` — `DefaultMode`, `defaultModesFor(type)`, `resolveDefaults(fields, records, today)`, `canQuickLog(fields, resolved)`.
- `custom/trend.ts` — `entryDateOf`, `weekStartISO`, `bucketKeyOf`, `buildSeries`, `movingAverage`, `chartFieldOf`, `sparklineFor`, `rangeStartISO`.
- `custom/filters.ts` — `filterChipsFor`, `filterRecords`, `groupRecords`, `groupStatLine`.
- `custom/roles.ts` — `rowRoles(module, fields)` (title, subtitle, badge, toggles, extras).
- `custom/typeChange.ts` — `typeChangeImpact`, `typeChangeMessage`.
- `custom/reminders.ts` — `planReminders(module, fields, records, now)`, `nudgeId`, `dateReminderId`, `parseReminderTime`.
- `custom/templates.ts` — `TEMPLATES` (Books, Sleep, Plants, Films, Habits, Weight).
- `custom/builder.ts` — `draftFromField`, `assignKeys`, `templateDrafts`, `settingsToKeys`.

Extended: `custom/types.ts` (new field types, v3 columns, `isNumericType`, `isGroupableType`), `custom/format.ts` (`readableAs`, `formatDuration`, `splitMinutes`, multiselect/rating/duration display and validation), `custom/summary.ts` (`summarise` with period, numeric sort for rating/duration), `custom/api.ts` (new columns, pre-assigned keys, `setRecordData`), `custom/useCustomRecords.ts`, `custom/useCustomModules.ts`.

New: `custom/notifications.ts` (sync per module + `registerResync('custom')`), components `TrendCard`, `Sparkline`, `StarInput`, `DurationInput`, `FilterChips`, `TypeChangeSheet`, `TemplatePicker`, `ReminderSettings`, `DefaultSettings` in `custom/components/`.

Website: `pages/CustomModulePage.tsx`, `pages/ModuleBuilderPage.tsx`, `modules/custom/useCustomModules.ts`, new `modules/custom/{FieldInput,TrendChart,Sparkline}.tsx`, `pages/Dashboard.tsx` (custom tile sparkline), `components/Icon.tsx` (`star`, `starFilled`, `bell`, `list`), `styles/components.css` (new section at the end).

Shared files: `home/HomeScreen.tsx` (optional sparkline on a tile), `website/src/pages/Dashboard.tsx`, `website/src/components/Icon.tsx`, `website/src/styles/components.css`. No `core/` behaviour change.

---

## Tasks

### C1: Migration `supabase/migrations/0026_custom_v3.sql`
- `user_module_fields`: `default_mode text not null default 'none'` check in (none, fixed, today, last); `default_value jsonb`; `hint text not null default ''` (≤ 120 chars); type check widened to add `rating`, `multiselect`, `duration` (drop `user_module_fields_type_check` if it exists, re-add wider; guarded so a re-run is harmless).
- `user_modules`: `title_field_key`, `subtitle_field_key`, `badge_field_key`, `group_field_key` (text); `chart_field_key text`, `chart_bucket text not null default 'day'` (entry/day/week/month), `chart_agg text not null default 'sum'` (sum/average), `chart_window integer` (null or 2–30), `chart_hidden boolean not null default false`; `summary_period text not null default 'all'` (all/week/month); `reminder_time text` (null = off, `HH:MM`), `reminder_days smallint[] not null default '{0,1,2,3,4,5,6}'`, `reminder_field_key text`, `reminder_offset_days integer not null default 0` (0–30).
- Adds and relaxes only; no new table (so no new policies). Order: needs 0007 and 0012.

### C2: Types and formatting (tests: `format.test.ts`, `customModules.test.ts` extended)
- `FieldType` gains `rating | multiselect | duration`; `FIELD_TYPES` gains their chips (Rating "Stars, 1–5", Tags "Pick several", Duration "Hours and minutes"). `needsOptions` true for select and multiselect. `isNumericType` (number, money, rating, duration). `aggsForFieldType` numeric for all four. `isSortableFieldType` false for boolean and multiselect. `isGroupableType` (select, boolean, rating).
- `CustomModule`/`CustomField`/`FieldDraft` gain the C1 columns.
- `format.ts`: `readableAs(type, value)` is the single answer to "does this value show as this type", and `formatFieldValue` returns null exactly when it is false (or the value is empty / a false boolean). `formatDuration(minutes)` → "7 h 30 m" / "45 m" / "2 h". `emptyValueFor` → `[]` for multiselect. `validateRecord` treats `[]` as empty. Rating shows "4/5". Multi-select joins with ", ".
- Tests: each type round-trips (stored value → display), leftovers from other types return null without throwing, duration formatting, multiselect required validation.

### C3: Summary with period (tests: `summary.test.ts` extended)
- `summarise(module, field, records, { today, dateField })` honours `summary_period` ("₹4,200 this month", "3 this week", "None this week"); duration sums format as durations, rating averages as "4.2/5".
- `sortRecords` sorts rating and duration numerically.

### C4: Defaults and quick log (`defaults.test.ts`)
- `defaultModesFor(type)`: date → none/today/last; everything else → none/fixed/last.
- `resolveDefaults(fields, records, today)` → `{ values, fromLast: string[], missingRequired: string[] }`. "last" takes the newest entry (by created_at) that ANSWERED the field. Invalid fixed values (a fixed value that no longer reads as the field's type) resolve to empty.
- `canQuickLog(fields, resolved)`: at least one field has a default configured AND no required field is missing.

### C5: Trend series (`trend.test.ts`)
- `entryDateOf(record, dateField)`: the date field's value when it is a valid ISO day, else the local day of `created_at`.
- `buildSeries(records, { valueField, dateField, bucket, agg, window, from })` → `{ points: { key, value, smooth }[] }`; day/week(Monday)/month buckets; sums fill empty buckets between first and last with 0, averages leave them out; `entry` keeps each entry; trailing moving average over partial windows; range filter.
- `chartFieldOf(module, fields)`: configured key if it is numeric, else first numeric field, null when hidden or none. `sparklineFor` → last 12 points or null under 2.
- DST-safe: buckets built from (y, m, d), tests in America/New_York.

### C6: Filters, groups, roles (`filters.test.ts`, `roles.test.ts`)
- `filterChipsFor(fields, dateField)`: first choice field's options, first tags field's options, up to two yes/no fields (Label / Not label), then This week / This month when a date field exists.
- `filterRecords(records, { value, period }, fields, dateField, today)`.
- `groupRecords(records, field)` → ordered groups (option order; Yes then No; 5★ to 1★; blank last as "No <label>"), empty groups omitted.
- `groupStatLine(module, summaryField, records)` → "3 · 412 pages".
- `rowRoles(module, fields)` → `{ title, subtitle, badge, toggles, extras }`; configured keys win, deleted keys fall back to the old automatic rule; every yes/no not used as the badge becomes a toggle.

### C7: Type-change guard (`typeChange.test.ts`)
- `typeChangeImpact(records, key, toField)` → `{ withValue, unreadable, samples: { before, after }[] }` (3 samples).
- `typeChangeMessage(impact, typeLabel)` → "14 entries have a value here; 3 won't show as Number. Nothing is deleted."

### C8: Reminders (`reminders.test.ts`) + `notifications.ts`
- `planReminders(module, fields, records, now)` → `{ id, date, title, body }[]`: nudges for the next 14 days on the chosen weekdays at the chosen time, skipping today when today has an entry; date-field reminders on (date − offset) at the nudge time or 09:00, future only, nearest 40 per module.
- Ids: `custom-<moduleId>-nudge-<day>`, `custom-<moduleId>-date-<recordId>`. Channel `{ id: 'custom', name: 'Module reminders' }`.
- `notifications.ts`: `syncModuleReminders(module, fields, records)` (cancelPrefix `custom-<id>-` then schedule), `clearModuleReminders(id)`, `registerResync('custom', …)` rebuilding every module from the database. Imported by `useCustomRecords` and `useCustomModules`, which the navigator imports at launch.

### C9: Templates and builder helpers (`templates.test.ts`, `builder.test.ts`)
- Six templates; every setting references a field in its own template; defaults valid for their type; options present for choice/tags.
- `assignKeys(drafts, existingKeys)` freezes existing keys and generates new ones without collision; `settingsToKeys` maps builder refs (draft local ids) to keys, clearing refs to removed fields.

### C10: api.ts
- `ModuleInput` carries the v3 module columns; field writes carry `default_mode`, `default_value`, `hint`; inserts honour a pre-assigned key. `setRecordData(id, data)` for the in-row toggle.

### C11: Phone screens
- List: trend card (when a numeric field exists and has data), filter chips, group headers with totals (collapsible), list/calendar toggle in the header (calendar only with a date field), rows with title/subtitle/badge and tap-to-toggle yes/no, `+` that quick-logs with "Logged · Undo" (long-press, or TalkBack action, opens the form).
- Form: pre-filled defaults with "↺ last" tags (typing clears), hints, star / tags / duration inputs.
- Builder: template picker (new module only; fills, never saves), per-field type chips with the guard sheet, hint, default (None · Fixed · Today · Last), required; module sections: row layout, home tile (stat + period), chart, group by, sort, reminders (switch, time, weekdays; date-field reminder + offset) with `ensurePermission()` on switch-on.
- Home tile: sparkline under the summary.

### C12: Website
- Module page: same features with the shared logic — chart (recharts area + moving average line), filter chips, grouped table with totals, calendar view, in-row yes/no toggle, quick log button with undo toast, form with defaults/↺ last/hints/new types.
- Builder page: templates, new types, hint, defaults, roles, chart, group, period, reminders (saved; they ring on the phone), the type-change guard as a confirm dialog, and the icon kept when editing (it was reset to the cube on every web save).
- Dashboard: custom tiles get the sparkline.

---

## Rulings

- Ruling: "Same as last entry" means the newest entry (by when it was logged) that answered the field — a blank in the newest entry does not erase the default — because one skipped optional field should not cost every later quick log its value — cost if wrong: someone who blanks a field on purpose sees it come back; they can set the default to None.
- Ruling: `+` logs at once only when at least one field has a default configured AND every required field resolves; otherwise it opens the form pre-filled — because a module with no defaults would otherwise log an empty entry on every tap — cost if wrong: a module whose required fields all have defaults but whose optional fields have none still quick-logs, which is the point.
- Ruling: Today is offered only for date fields, Fixed for every type except dates — because a fixed calendar day is never what a repeating log wants — cost if wrong: one extra mode to add later.
- Ruling: one "date field" per module, the first date field by position, drives the chart's X axis, the calendar, the This week / This month chips, the tile period and "today already has an entry"; with no date field, the day the entry was logged (local day of `created_at`) is used — because a second date picker in the builder answers a question nobody asks before they have two date fields — cost if wrong: a module with "Started" and "Finished" dates charts by Started; reorder the fields to change it.
- Ruling: sums fill empty buckets between the first and last with 0; averages leave them out — because no pages read on a Tuesday is a real zero, but an average of nothing is not — cost if wrong: an average line skips days instead of dipping, which is the honest picture.
- Ruling: the moving average is trailing and averages whatever exists at the start (partial windows), so the line starts with the data — cost if wrong: the first few smoothed points are noisier than the rest.
- Ruling: weeks start on Monday for the chart and the This week chip, matching the month calendar's default — cost if wrong: Sunday-starting weeks would shift one day.
- Ruling: Duration is stored as whole minutes (a number), entered as hours and minutes — because it then sums, averages, sorts and charts exactly like a number with no special case — cost if wrong: seconds-level timing would need a new type.
- Ruling: Rating is a whole number 1–5; a stored number outside 1–5 "won't show as Rating" (kept, not clamped) — because clamping would display a value that was never entered — cost if wrong: a module switched from a 1–10 number shows blanks until switched back, as the guard says.
- Ruling: group-by is offered for Choice, Yes/No and Rating fields only; Tags filter but never group — because an entry with two tags would sit in two groups and be counted twice in the totals — cost if wrong: no per-tag totals.
- Ruling: filter chips are the first Choice field's options, the first Tags field's options, up to two Yes/No fields (as "Label" / "Not label"), and This week / This month when there is a date field; one value chip and one period chip can be on at once, All clears both — because every option of every field would bury the list under chips — cost if wrong: a filter on a second Choice field is not offered (group by it instead).
- Ruling: every Yes/No field not chosen as the Badge shows in the row as a tappable check chip, and the Badge, when it is a Yes/No, is a tappable circle on the right — because a habit module has several yes/no fields and each needs one tap — cost if wrong: a module with many yes/no fields has a taller row.
- Ruling: the automatic Badge is the first Rating field; Title and Subtitle keep the v2 rule (first text field, first date field) until chosen — because v2 rows must not change shape on their own — cost if wrong: none; the builder offers all three.
- Ruling: an in-row toggle shows an Undo toast only when the change hides the row under the current filter; otherwise the toggle is its own undo — because five habit ticks should not produce five toasts — cost if wrong: one more tap to undo a tick that stays on screen (tap it again).
- Ruling: daily/weekly nudges are scheduled as dated one-off reminders for the next 14 days (core notifications schedules DATE triggers only) and rebuilt on every launch and every list load, so "skip today if there is an entry" is just "don't schedule today" — cost if wrong: someone who opens nothing for 14 days stops getting nudges until they open the app.
- Ruling: date-field reminders fire at the module's nudge time if set, else 09:00 (the Subscriptions renewal hour), and only the nearest 40 per module are scheduled — because Android caps an app at about 500 pending alarms and the resync rebuilds the rest later — cost if wrong: the 41st-furthest date waits for a later launch.
- Ruling: tapping a reminder does not open the module yet (it carries `{ moduleId, recordId }` in its data) — because routing a notification tap is an App-level listener every module will share, and adding it is the lead's integration call — cost if wrong: the tap opens the app at home.
- Ruling: builder settings (row roles, tile, chart, group, sort, reminder field) can point at fields that are not saved yet; keys are assigned in the builder before the write, and a setting pointing at a removed field is cleared on save — because templates must pre-fill those settings and a setting you cannot see is one you cannot change — cost if wrong: re-adding a deleted field does not restore a setting that pointed at it (its values still come back).
- Ruling: the chart's range (1M · 3M · 1Y · All) is a view choice, not saved; bucket, sum/average and smoothing are saved in the builder — cost if wrong: one tap per visit.
- Ruling: the list/calendar choice is not remembered — cost if wrong: one tap per visit.
- Ruling: the tile period (all time / this week / this month) also scopes the tile's count — because "3 this week" next to an all-time total reads as a contradiction — cost if wrong: none visible.
- Ruling: a Section/heading pseudo-type, duplicate-entry, recent-value chips and the lock pin (research next tier) are not built — the spec does not ask for them.
