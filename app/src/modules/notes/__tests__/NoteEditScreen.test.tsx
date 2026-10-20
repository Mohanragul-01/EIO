/**
 * NoteEditScreen: what you typed or ticked is what the note keeps.
 *
 * Rendered whole, with navigation and api.ts mocked, because each bug here
 * lived in how the screen's pieces meet: a draft line the Save never saw,
 * and (below) read-mode ticks whose writes and rollbacks met text typed in
 * edit mode afterwards.
 */
import 'react-native-gesture-handler/jestSetup';

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { ToastProvider } from '../../../core/components';
import { ThemeProvider } from '../../../core/ThemeContext';
import { NoteEditScreen } from '../screens/NoteEditScreen';

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

type Listener = (event: { preventDefault: () => void; data: { action: unknown } }) => void;

const mockNavigation = {
  setOptions: jest.fn(),
  addListener: jest.fn((_event: string, _listener: Listener) => () => {}),
  goBack: jest.fn(),
  dispatch: jest.fn(),
};
let mockParams: Record<string, unknown> = {};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockParams }),
}));

jest.mock('../api', () => ({
  getNote: jest.fn(),
  createNote: jest.fn(() => Promise.resolve({})),
  updateNote: jest.fn(() => Promise.resolve({})),
  setChecklistItems: jest.fn(() => Promise.resolve()),
  setBody: jest.fn(() => Promise.resolve()),
}));
const api = jest.requireMock('../api') as Record<string, jest.Mock>;

async function open(params: Record<string, unknown>) {
  mockParams = params;
  await render(
    <ThemeProvider>
      <ToastProvider>
        <NoteEditScreen />
      </ToastProvider>
    </ThemeProvider>,
  );
}

/** The back gesture, as the screen's discard guard sees it. */
function leave() {
  const calls = mockNavigation.addListener.mock.calls.filter(([event]) => event === 'beforeRemove');
  const listener = calls[calls.length - 1][1];
  const event = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };
  listener(event);
  return event;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('a checklist line typed into "Add an item" but not added', () => {
  it('is saved by Save', async () => {
    await open({ type: 'checklist' });
    await fireEvent.changeText(screen.getByPlaceholderText('Add an item'), ' eggs ');
    await fireEvent.press(screen.getByText('Save'));

    expect(api.createNote).toHaveBeenCalledWith(
      expect.objectContaining({ checklist_items: [{ text: 'eggs', done: false }] }),
    );
  });

  it('is added after the items already there', async () => {
    await open({ type: 'checklist' });
    const add = screen.getByPlaceholderText('Add an item');
    await fireEvent.changeText(add, 'milk');
    await fireEvent(add, 'submitEditing');
    await fireEvent.changeText(screen.getByPlaceholderText('Add an item'), 'eggs');
    await fireEvent.press(screen.getByText('Save'));

    expect(api.createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        checklist_items: [
          { text: 'milk', done: false },
          { text: 'eggs', done: false },
        ],
      }),
    );
  });

  it('counts as a change, so leaving asks first', async () => {
    await open({ type: 'checklist' });
    await fireEvent.changeText(screen.getByPlaceholderText('Add an item'), 'eggs');

    const event = leave();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Discard this?',
      expect.any(String),
      expect.any(Array),
    );
  });
});
