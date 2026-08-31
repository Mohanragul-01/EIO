/**
 * SignInScreen - shown only when there's no stored session.
 *
 * You should see this exactly once per install. After a successful sign-in the
 * session is written to AsyncStorage and refreshed automatically, so every
 * later launch goes straight to the home screen.
 *
 * It lives in core/ rather than in a module because it isn't part of any
 * module - it gates all of them.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../auth';
import { Button, FadeInView, GlassCard, Screen, TextField } from '../components';
import { radius, spacing } from '../theme';
import { makeStyles, useTheme } from '../ThemeContext';

type Mode = 'signIn' | 'signUp';

export function SignInScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    // Supabase enforces this too, but catching it here saves a round trip and
    // gives a clearer message than the server's.
    if (mode === 'signUp' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signUp') {
        await signUp(email, password);
        // If email confirmation is ON in your Supabase project, signUp returns
        // successfully but no session is created until the link is clicked -
        // so there's nothing to navigate to yet. Say so rather than appearing
        // to hang.
        setError('Account created. If your project requires email confirmation, confirm it, then sign in.');
        setMode('signIn');
      } else {
        await signIn(email, password);
        // No navigation call needed: AuthProvider's listener fires, the
        // session becomes non-null, and RootNavigator swaps this screen for
        // the app. State drives navigation, not the other way round.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeInView>
            <View style={styles.brand}>
              <View style={styles.logo}>
                <Ionicons name="layers-outline" size={26} color={colors.primary} />
              </View>
              <Text style={styles.title}>EIO</Text>
              <Text style={styles.subtitle}>
                Sign in once. This device stays signed in from then on.
              </Text>
            </View>
          </FadeInView>

          <FadeInView delay={80}>
            <GlassCard>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                // These four props matter more than they look: without them
                // Android capitalises the first letter and autocorrects the
                // domain, which silently breaks sign-in.
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
              />

              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
                style={styles.field}
              />

              {error ? (
                <View style={styles.errorRow}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Button
                label={mode === 'signIn' ? 'Sign in' : 'Create account'}
                icon={mode === 'signIn' ? 'log-in-outline' : 'person-add-outline'}
                onPress={handleSubmit}
                loading={busy}
                style={styles.submit}
              />
            </GlassCard>
          </FadeInView>

          <FadeInView delay={140}>
            <Pressable
              onPress={() => {
                setMode(mode === 'signIn' ? 'signUp' : 'signIn');
                setError(null);
              }}
              style={styles.toggle}
              hitSlop={8}
            >
              <Text style={styles.toggleText}>
                {mode === 'signIn'
                  ? "First time on this device? Create an account"
                  : 'Already have an account? Sign in'}
              </Text>
            </Pressable>
          </FadeInView>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  logo: {
    width: 62,
    height: 62,
    borderRadius: radius.lg,
    backgroundColor: colors.primary + '1F',
    borderWidth: 1,
    borderColor: colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 280,
  },
  field: {
    marginTop: spacing.xl,
  },
  submit: {
    marginTop: spacing.xxl,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  errorText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
  toggle: {
    alignSelf: 'center',
    marginTop: spacing.xxl,
    padding: spacing.sm,
  },
  toggleText: {
    ...typography.caption,
    color: colors.primary,
  },
}));
