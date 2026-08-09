/**
 * CustomRecordEditScreen - the generated form.
 *
 * There is no hand-written layout here. It loads the module's field
 * definitions, holds one object of values keyed by field key, and renders
 * <FieldInput> per field. That's the entire form: whatever you defined in the
 * builder is what appears.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Button, FadeInView, GlassCard, Screen } from '../../../core/components';
import { spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { FieldInput } from '../components/FieldInput';
import { emptyValueFor, validateRecord } from '../format';
import type { CustomField, CustomModule } from '../types';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CustomRecordEdit'>;
type Route = RouteProp<RootStackParamList, 'CustomRecordEdit'>;

export function CustomRecordEditScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { moduleId, recordId } = route.params;
  const isEditing = !!recordId;

  const [module, setModule] = useState<CustomModule | null>(null);
  const [fields, setFields] = useState<CustomField[]>([]);

  /**
   * ALL the form's values live in one object, keyed by field key - rather
   * than one useState per field, which is impossible here because we don't
   * know the fields until runtime. This is the shape that gets saved into the
   * record's jsonb, so what you see is literally what gets stored.
   */
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit entry' : module ? `New ${module.name.toLowerCase()}` : 'New entry',
    });
  }, [navigation, isEditing, module]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [moduleRow, fieldRows] = await Promise.all([
          api.getModule(moduleId),
          api.listFields(moduleId),
        ]);
        if (!active) return;

        setModule(moduleRow);
        setFields(fieldRows);

        if (recordId) {
          const record = await api.getRecord(recordId);
          if (!active) return;
          // Seed from the saved data, but fill any field that has no stored
          // value - fields added to the module AFTER this entry was created
          // would otherwise be undefined and render as uncontrolled inputs.
          const seeded: Record<string, unknown> = {};
          fieldRows.forEach((f) => {
            seeded[f.key] = record.data[f.key] ?? emptyValueFor(f.type);
          });
          setValues(seeded);
        } else {
          const blank: Record<string, unknown> = {};
          fieldRows.forEach((f) => {
            blank[f.key] = emptyValueFor(f.type);
          });
          setValues(blank);
        }
      } catch (e) {
        if (active) setLoadError(e instanceof Error ? e.message : 'Could not load this entry');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [moduleId, recordId]);

  const setValue = (key: string, value: unknown) => {
    setValues((current) => ({ ...current, [key]: value }));
    // Clear that field's error as soon as it's touched, rather than making
    // the user submit again to find out whether they fixed it.
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleSave = async () => {
    const validationErrors = validateRecord(fields, values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await api.updateRecord(recordId, values);
      } else {
        await api.createRecord(moduleId, values);
      }
      navigation.goBack();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const handleDelete = () => {
    if (!recordId) return;
    Alert.alert('Delete entry', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteRecord(recordId);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Could not delete', e instanceof Error ? e.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Ionicons name="warning-outline" size={26} color={colors.danger} />
          <Text style={styles.loadError}>{loadError}</Text>
          <Button label="Go back" variant="glass" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );
  }

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
            <GlassCard>
              {fields.map((field, index) => (
                <View key={field.id} style={index > 0 ? styles.field : undefined}>
                  <FieldInput
                    field={field}
                    value={values[field.key]}
                    onChange={(value) => setValue(field.key, value)}
                    error={errors[field.key]}
                  />
                </View>
              ))}
            </GlassCard>
          </FadeInView>

          <FadeInView delay={80}>
            <Button
              label={isEditing ? 'Save changes' : 'Save entry'}
              icon="checkmark"
              onPress={handleSave}
              loading={saving}
              style={styles.save}
            />

            {isEditing ? (
              <Button
                label="Delete entry"
                icon="trash-outline"
                variant="ghost"
                onPress={handleDelete}
                style={styles.delete}
              />
            ) : null}
          </FadeInView>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104,
    paddingBottom: spacing.xxxl,
  },
  field: {
    marginTop: spacing.xxl,
  },
  save: {
    marginTop: spacing.xxl,
  },
  delete: {
    marginTop: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  loadError: {
    ...typography.body,
    textAlign: 'center',
  },
}));
