/**
 * The Sheet is an RN Modal: a separate native window. Gesture handler's root
 * view at the top of the app does not reach into it, so on Android every
 * gesture-handler gesture inside a sheet (a swipe, a drag, the grabber) would
 * silently do nothing unless the sheet's content has a root of its own.
 */
// Mocks gesture handler's native module, which does not exist under Jest.
import 'react-native-gesture-handler/jestSetup';

import { render, screen, within } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { Sheet } from '../components/Sheet';
import { ThemeProvider } from '../ThemeContext';

jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
// The icon font pulls in the asset system, which has nothing to load here.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

async function renderSheet(subtitle?: string) {
  await render(
    <ThemeProvider>
      <Sheet visible title="Filter" subtitle={subtitle} onClose={() => {}}>
        <Text>inside</Text>
      </Sheet>
    </ThemeProvider>,
  );
}

describe('Sheet', () => {
  it('gives its content a gesture-handler root of its own', async () => {
    await renderSheet();
    // The content must be INSIDE that root, not beside it.
    const root = screen.getByTestId('sheet-gesture-root');
    expect(within(root).getByText('inside')).toBeTruthy();
  });

  it('keeps the subtitle to one line', async () => {
    await renderSheet('Monday 19 October, a very long context line that would otherwise wrap');
    expect(screen.getByText(/very long context/).props.numberOfLines).toBe(1);
  });
});
