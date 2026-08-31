/**
 * RootNavigator - defines every screen the app can show and how they stack.
 *
 * A "native stack" is the standard phone pattern: screens push on top of each
 * other, the header gets a back arrow automatically, and the Android hardware
 * back button works for free.
 *
 * Structure choice: ONE stack for the whole app rather than a nested stack per
 * module. With one screen per module today that's simpler. When a module grows
 * (Tasks will get list + edit screens), its screens register here too - and if
 * a module ever gets large it can graduate to its own nested navigator without
 * changing how the home screen works.
 */
import { NavigationContainer, type Theme as NavTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../core/auth';
import { SignInScreen } from '../core/screens/SignInScreen';
import { fonts, type ThemeColors } from '../core/theme';
import { HomeScreen } from '../home/HomeScreen';
import { CustomModuleListScreen } from '../modules/custom/screens/CustomModuleListScreen';
import { CustomRecordEditScreen } from '../modules/custom/screens/CustomRecordEditScreen';
import { ModuleBuilderScreen } from '../modules/custom/screens/ModuleBuilderScreen';
import { FinanceListScreen } from '../modules/finance/screens/FinanceListScreen';
import { TransactionEditScreen } from '../modules/finance/screens/TransactionEditScreen';
import { SubscriptionEditScreen } from '../modules/subscriptions/screens/SubscriptionEditScreen';
import { FitnessListScreen } from '../modules/fitness/screens/FitnessListScreen';
import { ExerciseProgressScreen } from '../modules/fitness/screens/ExerciseProgressScreen';
import { RoutineEditScreen } from '../modules/fitness/screens/RoutineEditScreen';
import { WorkoutSessionScreen } from '../modules/fitness/screens/WorkoutSessionScreen';
import { NoteEditScreen } from '../modules/notes/screens/NoteEditScreen';
import { NotesListScreen } from '../modules/notes/screens/NotesListScreen';
import { SubscriptionsListScreen } from '../modules/subscriptions/screens/SubscriptionsListScreen';
import { TodoEditScreen } from '../modules/todo/screens/TodoEditScreen';
import { TodoListScreen } from '../modules/todo/screens/TodoListScreen';
import type { RootStackParamList } from './types';
import { makeStyles, useTheme } from '../core/ThemeContext';

// Passing the param list here is what makes navigate() calls type-safe.
const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const { session, initializing } = useAuth();

  /**
   *  THE AUTH GATE
   * Three states, rendered as three different trees:
   *
   *   initializing -> we're still reading the stored session off disk. Show a
   *                  spinner. Skipping this would flash the sign-in screen for
   *                  one frame on every launch, even when already signed in.
   *   no session   -> the sign-in screen, with no navigator at all. There's
   *                  nowhere else to go, so a stack would be pointless - and
   *                  this makes it structurally impossible to reach an app
   *                  screen while signed out.
   *   signed in    -> the real app.
   *
   * Note there's no navigate() call anywhere in the sign-in flow. Signing in
   * updates the session, this component re-renders, and the tree swaps. State
   * drives navigation - that's the React Navigation idiom for auth, and it's
   * why the back button can never return you to the sign-in screen.
   */
  if (initializing) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <SignInScreen />;
  }

  return (
    // NavigationContainer owns the navigation state. Exactly one, at the root.
    <NavigationContainer theme={makeNavigationTheme(colors, isDark)}>
      <Stack.Navigator
        // screenOptions applies to EVERY screen - set header styling once here
        // rather than repeating it per screen.
        screenOptions={{
          // A transparent header lets each screen's aurora run up behind the
          // title, so the header doesn't sit as an opaque bar on top of it.
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          // Note: the native-stack header title only accepts fontFamily,
          // fontSize, fontWeight and color - it's rendered by the platform's
          // native header, not by a React Native <Text>, so letterSpacing and
          // other text styles aren't available here.
          headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17 },
          headerBackButtonDisplayMode: 'minimal', // arrow only, no "Home" label
          contentStyle: { backgroundColor: colors.background },
          // Slide-from-right is the platform-native push. It's also what makes
          // the back gesture feel correct.
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }} // home draws its own title block
        />
        <Stack.Screen name="TodoList" component={TodoListScreen} options={{ title: 'Tasks' }} />
        <Stack.Screen
          name="TodoEdit"
          component={TodoEditScreen}
          // The title is set by the screen itself, since it depends on whether
          // we're creating or editing.
          options={{ presentation: 'card' }}
        />
        <Stack.Screen name="NotesList" component={NotesListScreen} options={{ title: 'Notes' }} />
        <Stack.Screen name="NoteEdit" component={NoteEditScreen} />
        <Stack.Screen
          name="FinanceList"
          component={FinanceListScreen}
          options={{ title: 'Finance' }}
        />
        <Stack.Screen name="TransactionEdit" component={TransactionEditScreen} />
        <Stack.Screen
          name="SubscriptionsList"
          component={SubscriptionsListScreen}
          options={{ title: 'Subscriptions' }}
        />
        <Stack.Screen name="SubscriptionEdit" component={SubscriptionEditScreen} />
        <Stack.Screen
          name="FitnessList"
          component={FitnessListScreen}
          options={{ title: 'Fitness' }}
        />
        {/* Titles are set by the screens themselves, from data the navigator
            does not have. */}
        <Stack.Screen name="WorkoutSession" component={WorkoutSessionScreen} />
        <Stack.Screen name="RoutineEdit" component={RoutineEditScreen} />
        <Stack.Screen name="ExerciseProgress" component={ExerciseProgressScreen} />

        {/* Three screens covering every module you create. Their titles are
            set at runtime from the module's own data, so none are declared
            here. */}
        <Stack.Screen name="ModuleBuilder" component={ModuleBuilderScreen} />
        <Stack.Screen name="CustomModuleList" component={CustomModuleListScreen} />
        <Stack.Screen name="CustomRecordEdit" component={CustomRecordEditScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
}));

/**
 * React Navigation keeps its own small theme (used for the background behind
 * screens during transitions). Mapping our colors onto it prevents a white
 * flash between dark screens mid-push.
 */
function makeNavigationTheme(colors: ThemeColors, isDark: boolean): NavTheme {
  return {
  dark: isDark,
  colors: {
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.glassBorder,
    notification: colors.primary,
  },
    fonts: {
      regular: { fontFamily: fonts.regular, fontWeight: '400' },
      medium: { fontFamily: fonts.medium, fontWeight: '500' },
      bold: { fontFamily: fonts.semibold, fontWeight: '600' },
      heavy: { fontFamily: fonts.bold, fontWeight: '700' },
    },
  };
}
