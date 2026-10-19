/**
 * NoteMarkdown - a note body, read, on the website.
 *
 * Draws exactly what the app's markdown.ts parses, so a note reads the same on
 * the phone and here, and a box ticked here is the same line the phone ticks.
 * Links are real anchors only because safeHref has already refused anything
 * that is not a web or mail address; they open in a new tab with no opener,
 * so a note can never navigate this page away or reach back into it.
 */
import type { ReactNode } from 'react';

import { parseMarkdown, type Span } from '@app/modules/notes/markdown';

import { Icon } from '../../components/Icon';

export function NoteMarkdown({
  body,
  onToggleTask,
}: {
  body: string;
  /** Omit to show boxes that cannot be ticked (a note in the Trash). */
  onToggleTask?: (line: number) => void;
}) {
  const blocks = parseMarkdown(body);

  return (
    <div className="note-md">
      {blocks.map((block) => {
        switch (block.kind) {
          case 'blank':
            return <div key={block.line} className="note-md-blank" />;
          case 'heading': {
            const Tag = block.level === 1 ? 'h3' : block.level === 2 ? 'h4' : 'h5';
            return (
              <Tag key={block.line} className={`note-md-h${block.level}`}>
                <Spans spans={block.spans} />
              </Tag>
            );
          }
          case 'paragraph':
            return (
              <p key={block.line} className="note-md-p">
                <Spans spans={block.spans} />
              </p>
            );
          case 'quote':
            return (
              <blockquote key={block.line} className="note-md-quote">
                <Spans spans={block.spans} />
              </blockquote>
            );
          case 'bullet':
            return (
              <div key={block.line} className="note-md-li" style={{ paddingLeft: block.depth * 18 }}>
                <span className={`note-md-bullet${block.depth > 0 ? ' hollow' : ''}`} aria-hidden />
                <span className="grow">
                  <Spans spans={block.spans} />
                </span>
              </div>
            );
          case 'numbered':
            return (
              <div key={block.line} className="note-md-li" style={{ paddingLeft: block.depth * 18 }}>
                <span className="note-md-number numeric">{block.number}.</span>
                <span className="grow">
                  <Spans spans={block.spans} />
                </span>
              </div>
            );
          case 'task': {
            const label = block.spans.map((s) => s.text).join('') || 'Empty item';
            return (
              <div key={block.line} className="note-md-li note-md-task" style={{ paddingLeft: block.depth * 18 }}>
                <button
                  type="button"
                  className={`check${block.checked ? ' on' : ''}`}
                  onClick={onToggleTask ? () => onToggleTask(block.line) : undefined}
                  disabled={!onToggleTask}
                  role="checkbox"
                  aria-checked={block.checked}
                  aria-label={label}
                >
                  {block.checked ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
                </button>
                <span className={`grow${block.checked ? ' note-md-done' : ''}`}>
                  <Spans spans={block.spans} />
                </span>
              </div>
            );
          }
        }
      })}
    </div>
  );
}

function Spans({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((span, i) => {
        let node: ReactNode = span.text;
        if (span.italic) node = <em>{node}</em>;
        if (span.bold) node = <strong>{node}</strong>;
        if (span.href) {
          node = (
            <a href={span.href} target="_blank" rel="noopener noreferrer">
              {node}
            </a>
          );
        }
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}
