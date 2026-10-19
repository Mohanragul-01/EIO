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
import {
  NavigationContainer,
  type LinkingOptions,
  type Theme as NavTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../core/auth';
import { SignInScreen } from '../core/screens/SignInScreen';
import { fonts, type ThemeColors } from '../core/theme';
import { HomeScreen } from '../home/HomeScreen';
import { CustomModuleListScreen } from '../modules/custom/screens/CustomModuleListScreen';
import { CustomRecordEditScreen } from '../modules/custom/screens/CustomRecordEditScreen';
import { ModuleBuilderScreen } from '../modules/custom/screens/ModuleBuilderScreen';
import { FinanceListScreen } from '../modules/finance/screens/FinanceListScreen';
import { TransactionEditScreen } from '../modules/finance/screens/TransactionEditScreen';
import { AccountsScreen } from '../modules/finance/screens/AccountsScreen';
import { CategoryDetailScreen } from '../modules/finance/screens/CategoryDetailScreen';
import { FinanceSearchScreen } from '../modules/finance/screens/FinanceSearchScreen';
import { SubscriptionEditScreen } from '../modules/subscriptions/screens/SubscriptionEditScreen';
import { BucketListScreen } from '../modules/bucket/screens/BucketListScreen';
import { FitnessListScreen } from '../modules/fitness/screens/FitnessListScreen';
import { ProductDetailScreen } from '../modules/products/screens/ProductDetailScreen';
import { ProductEditScreen } from '../modules/products/screens/ProductEditScreen';
import { ProductsListScreen } from '../modules/products/screens/ProductsListScreen';
import { ExerciseDetailScreen } from '../modules/fitness/screens/ExerciseDetailScreen';
import { RoutineEditScreen } from '../modules/fitness/screens/RoutineEditScreen';
import { WorkoutSessionScreen } from '../modules/fitness/screens/WorkoutSessionScreen';
import { WorkoutSummaryScreen } from '../modules/fitness/screens/WorkoutSummaryScreen';
import { BandsScreen } from '../modules/fitness/screens/BandsScreen';
import { LadderScreen } from '../modules/fitness/screens/LadderScreen';
import { LadderEditScreen } from '../modules/fitness/screens/LadderEditScreen';
import { PlateCalculatorScreen } from '../modules/fitness/screens/PlateCalculatorScreen';
import { NoteEditScreen } from '../modules/notes/screens/NoteEditScreen';
import { NotesListScreen } from '../modules/notes/screens/NotesListScreen';
import { NotesShelfScreen } from '../modules/notes/screens/NotesShelfScreen';
import { SubscriptionsListScreen } from '../modules/subscriptions/screens/SubscriptionsListScreen';
import { SubscriptionCatalogueScreen } from '../modules/subscriptions/screens/SubscriptionCatalogueScreen';
import { SubscriptionDetailScreen } from '../modules/subscriptions/screens/SubscriptionDetailScreen';
import { TodoEditScreen } from '../modules/todo/screens/TodoEditScreen';
import { TodoListScreen } from '../modules/todo/screens/TodoListScreen';
import type { RootStackParamList } from './types';
import { flushPendingNavigation, navigationRef } from './navigationRef';
import { useNotificationRoutes } from './useNotificationRoutes';
import { makeStyles, useTheme } from '../core/ThemeContext';

// Passing the param list here is what makes navigate() calls type-safe.
const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * DEEP LINKS - eio://finance/add?amount=250&note=Swiggy&category=food opens a
 * pre-filled add form, so an automation app (MacroDroid, Tasker) can turn a
 * bank SMS into an entry without EIO holding an SMS or notification
 * permission. The `eio` scheme is set in app.json, which is build-time: it
 * exists only in an APK built after it was added, and never in Expo Go.
 *
 * Only these paths are mapped. Any other eio:// link matches nothing and is
 * ignored, and the capture screen reads its own parameters through
 * modules/finance/capture.ts, which treats every one as untrusted.
 *
 * initialRouteName puts Home underneath when the link cold-starts the app, so
 * Back after saving lands somewhere. When the app is already open the form
 * opens on top of wherever you were, and saving returns you there.
 *
 * Module scope, as React Navigation asks: a new object every render would
 * look like a new config.
 */
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['eio://'],
  config: {
    initialRouteName: 'Home',
    screens: {
      FinanceCapture: 'finance/add',
      FinanceList: 'finance',
    },
  },
};

export function RootNavigator() {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const { session, initializing } = useAuth();

  // A tapped reminder opens the screen its data names (a subscription, its
  // Mark paid sheet). Only once the navigator is ready, and ready for THIS
  // person: the container remounts on every sign-in. Up here, above the early
  // returns, because hooks must run on every render.
  const [readyFor, setReadyFor] = useState<string | null>(null);
  useNotificationRoutes(navigationRef, !!session && readyFor === session.user.id);

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
    // The ref lets a notification tap navigate from outside a screen; onReady
    // runs one that arrived before the container mounted (see navigationRef)
    // and switches on tap routing for this signed-in session.
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        flushPendingNavigation();
        setReadyFor(session.user.id);
      }}
      theme={makeNavigationTheme(colors, isDark)}
      linking={linking}
      // Shown for the moment it takes to read the link that opened the app
      // (none, usually); the same spinner as the auth boot, so launch does not
      // flash an empty frame.
      fallback={
        <View style={styles.boot}>
          <ActivityIndicator color={colors.primary} />
        </View>
      }
    >
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
        <Stack.Screen name="NotesShelf" component={NotesShelfScreen} />
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
        {/* Titles set by the screens: the subscription's name, and the
            catalogue's own. */}
        <Stack.Screen
          name="SubscriptionDetail"
          component={SubscriptionDetailScreen}
          // One route per subscription: a reminder for another subscription
          // must open its own screen, not swap the params of the one on top
          // (which kept showing the old subscription for a render, and ran
          // the reminder's action against it).
          getId={({ params }) => params.id}
        />
        <Stack.Screen name="SubscriptionCatalogue" component={SubscriptionCatalogueScreen} />
        <Stack.Screen
          name="FitnessList"
          component={FitnessListScreen}
          options={{ title: 'Fitness' }}
        />
        <Stack.Screen
          name="BucketList"
          component={BucketListScreen}
          options={{ title: 'B-List' }}
        />
        <Stack.Screen
          name="ProductsList"
          component={ProductsListScreen}
          options={{ title: 'Products' }}
        />
        <Stack.Screen name="ProductEdit" component={ProductEditScreen} />
        {/* Title is the product's name, set by the screen once it has loaded. */}
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        {/* Titles are set by the screens themselves, from data the navigator
            does not have. */}
        <Stack.Screen name="WorkoutSession" component={WorkoutSessionScreen} />
        <Stack.Screen name="RoutineEdit" component={RoutineEditScreen} />
        <Stack.Screen name="ExerciseProgress" component={ExerciseDetailScreen} />
        <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryScreen} />
        <Stack.Screen name="Bands" component={BandsScreen} options={{ title: 'Bands' }} />
        <Stack.Screen name="Ladder" component={LadderScreen} />
        <Stack.Screen name="LadderEdit" component={LadderEditScreen} />
        <Stack.Screen
          name="PlateCalculator"
          component={PlateCalculatorScreen}
          options={{ title: 'Plates' }}
        />

        {/* Three screens covering every module you create. Their titles are
            set at runtime from the module's own data, so none are declared
            here. */}
        <Stack.Screen name="ModuleBuilder" component={ModuleBuilderScreen} />
        <Stack.Screen name="CustomModuleList" component={CustomModuleListScreen} />
        <Stack.Screen name="CustomRecordEdit" component={CustomRecordEditScreen} />

        {/* Finance v3. The capture link's form is the same screen as the
            add form; it reads which route it is on. */}
        <Stack.Screen
          name="FinanceAccounts"
          component={AccountsScreen}
          options={{ title: 'Accounts' }}
        />
        <Stack.Screen
          name="FinanceSearch"
          component={FinanceSearchScreen}
          options={{ title: 'Search' }}
        />
        <Stack.Screen name="FinanceCategory" component={CategoryDetailScreen} />
        <Stack.Screen
          name="FinanceCapture"
          component={TransactionEditScreen}
          // One payment often fires two automations (the UPI app's alert and
          // the bank's SMS). Without an id, the second link would land on the
          // form already open and replace its params under it, silently losing
          // one. Keyed by its params, a different link opens its own form on
          // top, and an identical one lands on the form already showing it.
          getId={({ params }) => JSON.stringify(params ?? {})}
        />
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
