/**
 * The entry form's inputs after a field's type has changed.
 *
 * Changing a type never touches stored data, so an entry opened afterwards
 * holds a value from the old type. Text can show most of them, and the row
 * does; the form showed an empty box instead, which reads as the value being
 * gone right after the guard promised it shows. A Date field holding text
 * ("next week") must not hand the calendar an Invalid Date. And a custom date
 * can point forward ("Due back") whether or not it has a reminder.
 */
// Mocks gesture handler's native module, which does not exist under Jest.
import 'react-native-gesture-handler/jestSetup';

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider } from '../../../core/ThemeContext';
import { FieldInput } from '../components/FieldInput';
import { makeField } from '../testing';

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

// The native calendar: record what it is handed.
const mockPicker = jest.fn((_props: { value: Date; maximumDate?: Date }) => null);
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: { value: Date; maximumDate?: Date }) => mockPicker(props),
}));

async function renderInput(field: ReturnType<typeof makeField>, value: unknown) {
  await render(
    <ThemeProvider>
      <FieldInput field={field} value={value} onChange={() => {}} />
    </ThemeProvider>,
  );
}

beforeEach(() => mockPicker.mockClear());

it('shows a number kept from a Number field in a Text box, as the row does', async () => {
  await renderInput(makeField({ key: 'pages', label: 'Pages', type: 'text' }), 42);
  expect(screen.getByDisplayValue('42')).toBeTruthy();
});

it('shows tags kept in a Long text box, as the row does', async () => {
  await renderInput(makeField({ key: 'g', label: 'Genre', type: 'longtext' }), [
    'Fiction',
    'Memoir',
  ]);
  expect(screen.getByDisplayValue('Fiction, Memoir')).toBeTruthy();
});

it('keeps text as it was typed, line breaks and all', async () => {
  await renderInput(makeField({ key: 'n', label: 'Notes', type: 'longtext' }), 'one\n two');
  expect(screen.getByDisplayValue('one\n two')).toBeTruthy();
});

it('never hands the calendar a date it cannot read', async () => {
  await renderInput(makeField({ key: 'due', label: 'Due back', type: 'date' }), 'next week');
  await fireEvent.press(screen.getByText('Pick a date'));
  const { value } = mockPicker.mock.calls[0][0];
  expect(Number.isNaN(value.getTime())).toBe(false);
});

it('lets a custom date be set ahead, reminder or not', async () => {
  await renderInput(makeField({ key: 'due', label: 'Due back', type: 'date' }), null);
  await fireEvent.press(screen.getByText('Pick a date'));
  expect(mockPicker.mock.calls[0][0].maximumDate).toBeUndefined();
});
