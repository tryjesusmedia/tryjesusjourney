import React, { useCallback, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { Card, Eyebrow, GoldButton, OutlineButton } from '@/components/ui';
import {
  addGuestJournalEntry,
  getGuestJournal,
  removeGuestJournalEntry,
  updateGuestJournalEntry,
  type GuestJournal,
} from '@/lib/localStore';

export default function JournalScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<GuestJournal[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<GuestJournal | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setEntries(await getGuestJournal());
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  function openNewEntry() {
    setEditingEntry(null);
    setTitle('');
    setBody('');
    setEditorOpen(true);
  }

  function openEditEntry(entry: GuestJournal) {
    setEditingEntry(entry);
    setTitle(entry.title);
    setBody(entry.body);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingEntry(null);
    setTitle('');
    setBody('');
  }

  async function save() {
    const cleanBody = body.trim();
    if (!cleanBody || saving) return;

    const changes = {
      title: title.trim() || 'Reflection',
      body: cleanBody,
    };

    setSaving(true);
    try {
      if (editingEntry) {
        setEntries(await updateGuestJournalEntry(editingEntry.id, changes));
      } else {
        const next: GuestJournal = {
          id: String(Date.now()),
          ...changes,
          createdAt: new Date().toISOString(),
        };
        setEntries(await addGuestJournalEntry(next));
      }
      closeEditor();
    } catch (error) {
      console.warn('Could not save this prayer journal entry.', error);
      Alert.alert('Could not save your prayer', 'Please try again. Your open entry has not been cleared.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry: GuestJournal) {
    setEntries(await removeGuestJournalEntry(entry.id));
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View>
          <Pressable accessibilityRole="button" accessibilityLabel="Return to Bible" hitSlop={10} onPress={() => router.replace('/(tabs)/bible')} style={styles.backButton}>
            <Text style={styles.back}>‹ Bible</Text>
          </Pressable>
          <Eyebrow>PRIVATE</Eyebrow>
          <Text style={styles.title}>Prayer Journal</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Write a new prayer" style={styles.plus} onPress={openNewEntry}>
          <Text style={styles.plusText}>＋</Text>
        </Pressable>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="on-drag"
        ListEmptyComponent={(
          <Card>
            <Text style={styles.empty}>Your prayers and reflections will appear here. Write what is on your heart or what you want to remember.</Text>
            <GoldButton title="Write My First Prayer" onPress={openNewEntry} />
          </Card>
        )}
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.entryTitle}>{item.title || 'Reflection'}</Text>
            <Text style={styles.entryBody}>{item.body}</Text>
            <View style={styles.entryActions}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.title || 'prayer entry'}`} hitSlop={8} onPress={() => openEditEntry(item)}>
                <Text style={styles.edit}>Edit</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${item.title || 'prayer entry'}`}
                hitSlop={8}
                onPress={() => Alert.alert('Delete entry?', 'This cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => remove(item) },
                ])}
              >
                <Text style={styles.delete}>Delete</Text>
              </Pressable>
            </View>
          </Card>
        )}
      />

      <Modal visible={editorOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeEditor}>
        <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={[styles.modal, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalEyebrow}>{editingEntry ? 'EDIT PRAYER' : 'NEW PRAYER'}</Text>
            <Text style={styles.modalTitle}>{editingEntry ? 'Edit Prayer Journal Entry' : 'New Prayer Journal Entry'}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Title (optional)"
              placeholderTextColor={colors.muted}
              style={styles.input}
              accessibilityLabel="Prayer title"
            />
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="What is on your heart?"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.input, styles.bodyInput]}
              accessibilityLabel="Prayer"
            />
            <View style={styles.editorActions}>
              <GoldButton title={editingEntry ? 'Save Changes' : 'Save to My Prayer Journal'} onPress={save} disabled={!body.trim()} loading={saving} />
              <OutlineButton title="Cancel" onPress={closeEditor} disabled={saving} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.charcoal, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  back: { color: colors.gold, fontWeight: '800', fontSize: 15 },
  title: { color: colors.text, fontSize: 25, fontWeight: '900' },
  plus: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  plusText: { fontSize: 24, color: colors.charcoal, fontWeight: '900' },
  listContent: { gap: 12, paddingBottom: 100 },
  empty: { color: colors.ivory, lineHeight: 22, marginBottom: 16 },
  entryTitle: { color: colors.gold, fontSize: 15, fontWeight: '900', marginBottom: 8 },
  entryBody: { color: colors.ivory, lineHeight: 22 },
  entryActions: { flexDirection: 'row', alignItems: 'center', gap: 26, marginTop: 18 },
  edit: { color: colors.gold, fontWeight: '800' },
  delete: { color: colors.red, fontWeight: '700' },
  modalKeyboard: { flex: 1, backgroundColor: colors.charcoal },
  modal: { flexGrow: 1, backgroundColor: colors.charcoal, paddingHorizontal: 24 },
  modalEyebrow: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.7, marginBottom: 6 },
  modalTitle: { color: colors.text, fontSize: 28, fontWeight: '900', marginBottom: 20 },
  input: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 15, color: colors.text, fontSize: 16, marginBottom: 12 },
  bodyInput: { height: 220, textAlignVertical: 'top' },
  editorActions: { gap: 10 },
});
