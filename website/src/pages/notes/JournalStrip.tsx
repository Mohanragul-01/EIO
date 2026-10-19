/**
 * JournalStrip - the top of the Journal view: a streak, the last seven days,
 * On this day, and a prompt while today is blank.
 *
 * The same rules as the phone's Journal header, from the app's journal.ts:
 * a streak survives until a whole day is missed, 29 February shows on the
 * 28th in other years, and the prompt is fixed for the day with a shuffle.
 */
import { useState } from 'react';

import { formatEventDate } from '@app/core/date';
import { journalStreak, onThisDay, promptFor, todaysEntry, weekStrip } from '@app/modules/notes/journal';
import { stripMarkdown } from '@app/modules/notes/markdown';
import type { Note } from '@app/modules/notes/types';

import { Icon } from '../../components/Icon';

export function JournalStrip({
  entries,
  today,
  onOpen,
  onAnswer,
}: {
  entries: Note[];
  today: string;
  onOpen: (note: Note) => void;
  onAnswer: (prompt: string) => void;
}) {
  const [shuffle, setShuffle] = useState(0);

  const streak = journalStreak(entries, today);
  const week = weekStrip(entries, today);
  const memories = onThisDay(entries, today);
  const wroteToday = todaysEntry(entries, today) !== null;
  const prompt = promptFor(today, shuffle);

  return (
    <div className="col" style={{ gap: 'var(--space-md)' }}>
      <div className="card card-pad row-between">
        <span className={`journal-streak${streak > 0 ? ' on' : ''}`}>
          <Icon name="flame" size={14} />
          {streak === 0 ? 'Start a streak' : `${streak}-day streak`}
        </span>
        <div
          className="row"
          style={{ gap: 6 }}
          role="img"
          aria-label={`${week.filter((d) => d.hasEntry).length} of the last 7 days have an entry`}
        >
          {week.map((day) => (
            <span
              key={day.date}
              title={formatEventDate(day.date)}
              className={`journal-day${day.hasEntry ? ' filled' : ''}${day.isToday ? ' today' : ''}`}
            />
          ))}
        </div>
      </div>

      {memories.length > 0 ? (
        <div className="card card-pad">
          <div className="overline" style={{ marginBottom: 'var(--space-sm)' }}>
            On this day
          </div>
          <div className="col" style={{ gap: 4 }}>
            {memories.map(({ note, yearsAgo }) => (
              <button key={note.id} className="list-row bordered" style={{ textAlign: 'left' }} onClick={() => onOpen(note)}>
                <span className="grow">
                  <span className="faint" style={{ fontSize: 12 }}>
                    {yearsAgo === 1 ? '1 year ago' : `${yearsAgo} years ago`} ·{' '}
                    {formatEventDate(note.entry_date ?? today)}
                  </span>
                  <span className="truncate" style={{ display: 'block', fontSize: 13 }}>
                    {note.title || stripMarkdown(note.body).replace(/\s+/g, ' ').trim() || 'Untitled entry'}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!wroteToday ? (
        <div className="card card-pad">
          <div className="row-between" style={{ marginBottom: 'var(--space-sm)' }}>
            <span className="overline">A prompt for today</span>
            <button
              className="icon-btn"
              onClick={() => setShuffle((n) => n + 1)}
              aria-label="Another prompt"
              title="Another prompt"
            >
              <Icon name="shuffle" />
            </button>
          </div>
          <p style={{ fontSize: 15, fontWeight: 550, margin: 0 }} aria-live="polite">
            {prompt}
          </p>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-md)' }} onClick={() => onAnswer(prompt)}>
            <Icon name="edit" size={13} /> Answer
          </button>
        </div>
      ) : null}
    </div>
  );
}
