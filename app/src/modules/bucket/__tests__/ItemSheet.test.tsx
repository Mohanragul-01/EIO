/**
 * ItemSheet: a step typed into "Add a step" is not lost to Save.
 *
 * Steps save as you go, each one when you press Add or the keyboard's done.
 * Typing one and then pressing the sheet's Save instead used to drop it
 * without a word: Save never saw the half-added step. Now Save adds it first.
 */
import 'react-native-gesture-handler/jestSetup';

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider } from '../../../core/ThemeContext';
import { ItemSheet, type StepActions } from '../components/ItemSheet';
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

const TRIP: BucketItem = {
  id: 'trip',
  user_id: 'u1',
  category: 'Travel',
  title: 'See Iceland',
  cost: 'high',
  is_done: false,
  done_on: null,
  done_precision: null,
  note: '',
  memory: '',
  place: '',
  again: null,
  snoozed_until: null,
  focus: 'now',
  target_on: null,
  target_precision: null,
  est_cost_minor: null,
  saved_minor: 0,
  position: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function stepActions(): StepActions {
  return {
    add: jest.fn(),
    toggle: jest.fn(),
    remove: jest.fn(),
    restore: jest.fn(),
    move: jest.fn(),
  };
}

async function openPlan(actions: StepActions, onSave: jest.Mock) {
  const sheet = (visible: boolean) => (
    <ThemeProvider>
      <ItemSheet
        visible={visible}
        item={visible ? TRIP : null}
        initialTab="plan"
        categories={['Travel']}
        steps={[]}
        today="2026-10-20"
        shelfFull={false}
        onClose={jest.fn()}
        onSave={onSave}
        stepActions={actions}
      />
    </ThemeProvider>
  );
  // Mounted closed and then opened, as the screen does: opening is what
  // seeds the fields from the item.
  await render(sheet(false));
  await screen.rerender(sheet(true));
}

describe('ItemSheet', () => {
  it('Save adds a step that was typed but not added', async () => {
    const actions = stepActions();
    const onSave = jest.fn(() => Promise.resolve());
    await openPlan(actions, onSave);

    await fireEvent.changeText(screen.getByLabelText('New step'), '  Book flights ');
    await fireEvent.press(screen.getByText('Save'));

    expect(actions.add).toHaveBeenCalledWith('trip', 'Book flights');
    expect(onSave).toHaveBeenCalled();
  });

  it('Save adds nothing when the step field is empty', async () => {
    const actions = stepActions();
    const onSave = jest.fn(() => Promise.resolve());
    await openPlan(actions, onSave);

    await fireEvent.changeText(screen.getByLabelText('New step'), '   ');
    await fireEvent.press(screen.getByText('Save'));

    expect(actions.add).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalled();
  });
});
