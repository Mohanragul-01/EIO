/**
 * Quick add's Enter, while a save is still on the wire (found in review).
 *
 * Enter adds and keeps the keyboard up, because tasks arrive in batches. On a
 * slow connection that meant a double Enter added the task twice, and a task
 * typed straight after the first was wiped when the first save came back.
 * What must hold: one Enter, one task; the field is clear for the next line at
 * once; a failed save gives the line back, but never over newer typing.
 */
// Mocks gesture handler's native module, which does not exist under Jest.
import 'react-native-gesture-handler/jestSetup';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider } from '../../../core/ThemeContext';
import { QuickAddSheet } from '../components/QuickAddSheet';

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
jest.mock('../../../core/haptics', () => ({ success: jest.fn(), tap: jest.fn() }));
jest.mock('../api', () => ({ createTodo: jest.fn() }));

const api = jest.requireMock('../api') as { createTodo: jest.Mock };

/** A save that stays on the wire until the test says how it ends. */
function pendingSave() {
  let resolve: (value: unknown) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  api.createTodo.mockImplementationOnce(
    () =>
      new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      }),
  );
  return {
    succeed: (title: string) => resolve({ id: title, title, due_date: null, due_time: null }),
    fail: () => reject(new Error('offline')),
  };
}

async function open() {
  await render(
    <ThemeProvider>
      <QuickAddSheet
        visible
        defaultFrequency="daily"
        defaultDueDate={null}
        contextLabel="Daily"
        onClose={() => {}}
        onAdded={() => {}}
        onOpenEditor={() => {}}
      />
    </ThemeProvider>,
  );
}

const field = () => screen.getByPlaceholderText('Pay rent every 1st !high');

async function type(text: string) {
  await act(async () => {
    fireEvent.changeText(field(), text);
  });
}

async function enter() {
  await act(async () => {
    fireEvent(field(), 'submitEditing');
  });
}

beforeEach(() => {
  api.createTodo.mockReset();
  // Anything not held by pendingSave saves at once.
  api.createTodo.mockImplementation((input: { title: string }) =>
    Promise.resolve({ id: input.title, title: input.title, due_date: null, due_time: null }),
  );
});

it('a second Enter while the first is saving adds nothing', async () => {
  const save = pendingSave();
  await open();

  await type('Buy milk');
  await enter();
  await enter();
  await act(async () => save.succeed('Buy milk'));

  expect(api.createTodo).toHaveBeenCalledTimes(1);
});

it('clears the field at Enter, and keeps what is typed while the first saves', async () => {
  const save = pendingSave();
  await open();

  await type('Buy milk');
  await enter();
  expect(field().props.value).toBe('');

  await type('Call');
  await act(async () => save.succeed('Buy milk'));

  expect(field().props.value).toBe('Call');
  expect(api.createTodo.mock.calls[0][0]).toMatchObject({ title: 'Buy milk' });
});

it('gives the line back when the save fails', async () => {
  const save = pendingSave();
  await open();

  await type('Buy milk');
  await enter();
  await act(async () => save.fail());

  expect(field().props.value).toBe('Buy milk');
  expect(screen.getByText('offline')).toBeTruthy();
});

it('but not over what was typed since', async () => {
  const save = pendingSave();
  await open();

  await type('Buy milk');
  await enter();
  await type('Call');
  await act(async () => save.fail());

  expect(field().props.value).toBe('Call');
});
