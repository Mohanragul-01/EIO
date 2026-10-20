/**
 * MemorySheet: a memory is never lost to a failed save.
 *
 * The sheet used to close before the write, so on a weak signal the paragraph
 * you had just written went with it and the item quietly reverted. Now Save
 * waits: the sheet closes only once the memory is stored, and a failure is
 * said inside the sheet with everything you wrote still there.
 */
import 'react-native-gesture-handler/jestSetup';

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider } from '../../../core/ThemeContext';
import { MemorySheet } from '../components/MemorySheet';
import type { BucketItem } from '../types';

jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
// The icon font pulls in the asset system, which has nothing to load here.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const DIVE: BucketItem = {
  id: 'dive',
  user_id: 'u1',
  category: 'Water Adventures',
  title: 'Scuba dive',
  cost: 'high',
  is_done: true,
  done_on: '2026-10-20',
  done_precision: 'day',
  note: '',
  memory: '',
  place: '',
  again: null,
  snoozed_until: null,
  focus: null,
  target_on: null,
  target_precision: null,
  est_cost_minor: null,
  saved_minor: 0,
  position: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

/** The "What happened?" field, found by its placeholder. */
const MEMORY_FIELD = 'Optional - a line is plenty';

async function openSheet(onSave: jest.Mock, onClose: jest.Mock) {
  await render(
    <ThemeProvider>
      <MemorySheet item={DIVE} today="2026-10-20" onClose={onClose} onSave={onSave} />
    </ThemeProvider>,
  );
  await fireEvent.changeText(screen.getByPlaceholderText(MEMORY_FIELD), 'Turtles at the reef');
}

describe('MemorySheet', () => {
  it('a failed save keeps the sheet open, the words in it, and says why', async () => {
    const onSave = jest.fn(() => Promise.reject(new Error('You are offline')));
    const onClose = jest.fn();
    await openSheet(onSave, onClose);

    await fireEvent.press(screen.getByText('Save'));

    expect(onSave).toHaveBeenCalledWith(
      DIVE,
      expect.objectContaining({ memory: 'Turtles at the reef' }),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('You are offline')).toBeTruthy();
    expect(screen.getByPlaceholderText(MEMORY_FIELD).props.value).toBe('Turtles at the reef');
  });

  it('closes once the memory is stored', async () => {
    const onSave = jest.fn(() => Promise.resolve());
    const onClose = jest.fn();
    await openSheet(onSave, onClose);

    await fireEvent.press(screen.getByText('Save'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
