import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_HEX,
  sortBibleHighlights,
  type BibleHighlight,
  type HighlightColor,
  type HighlightSort,
} from '@/lib/bibleHighlightsCore';
import type { UpdateBibleHighlightInput } from '@/lib/bibleHighlights';
import { parseBibleHighlightCreationDate } from '@/lib/bibleHighlightDateCore';

type BibleHighlightsWindowProps = {
  highlights: BibleHighlight[];
  ready: boolean;
  notesVisible: boolean;
  selectedHighlightId: string | null;
  onCloseNotes: () => void;
  onSelectHighlight: (id: string | null) => void;
  onUpdate: (highlight: BibleHighlight, changes: UpdateBibleHighlightInput) => Promise<BibleHighlight>;
  onDelete: (highlight: BibleHighlight) => Promise<void>;
};

const SORT_LABELS: { id: HighlightSort; label: string }[] = [
  { id: 'created', label: 'Date Created' },
  { id: 'canonical', label: 'Bible Order' },
  { id: 'chronological', label: 'Chronological' },
  { id: 'color', label: 'Color' },
];

function friendlyDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
    : value;
}

function dateInputValue(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function BibleNotesButton({ count, bottom, onPress }: { count: number; bottom: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open notes, ${count} highlight${count === 1 ? '' : 's'}`}
      onPress={onPress}
      style={({ pressed }) => [styles.floatingButton, { bottom }, pressed && styles.pressed]}
    >
      <Text style={styles.floatingIcon}>✎</Text>
      <Text style={styles.floatingLabel}>Notes</Text>
      {count ? <Text style={styles.floatingCount}>{count}</Text> : null}
    </Pressable>
  );
}

export function BibleHighlightsWindow(props: BibleHighlightsWindowProps) {
  const selected = props.highlights.find((highlight) => highlight.id === props.selectedHighlightId) ?? null;
  return <BibleHighlightsWindowContent key={selected?.id ?? 'notes-list'} {...props} selected={selected} />;
}

function BibleHighlightsWindowContent({
  highlights,
  ready,
  notesVisible,
  selectedHighlightId,
  onCloseNotes,
  onSelectHighlight,
  onUpdate,
  onDelete,
  selected,
}: BibleHighlightsWindowProps & { selected: BibleHighlight | null }) {
  const insets = useSafeAreaInsets();
  const [sort, setSort] = useState<HighlightSort>('created');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState(selected?.note ?? '');
  const [dateDraft, setDateDraft] = useState(selected ? dateInputValue(selected.createdAt) : '');
  const [colorDraft, setColorDraft] = useState<HighlightColor>(selected?.color ?? 'yellow');
  const [busy, setBusy] = useState(false);
  const sorted = useMemo(() => sortBibleHighlights(highlights, sort), [highlights, sort]);

  function closeDetail() {
    setEditing(false);
    setMenuOpen(false);
    onSelectHighlight(null);
    if (!notesVisible) onCloseNotes();
  }

  async function saveChanges() {
    if (!selected || busy) return;
    const createdAt = parseBibleHighlightCreationDate(dateDraft);
    if (!createdAt) {
      Alert.alert('Check the creation date', 'Enter the date as YYYY-MM-DD.');
      return;
    }
    setBusy(true);
    try {
      const saved = await onUpdate(selected, {
        note: noteDraft,
        color: colorDraft,
        createdAt,
      });
      onSelectHighlight(saved.id);
      setEditing(false);
      setMenuOpen(false);
    } catch (caught) {
      Alert.alert('Could not save changes', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!selected || busy) return;
    setMenuOpen(false);
    Alert.alert('Delete this highlight?', 'The highlighted text and its note will be removed.', [
      { text: 'Keep It', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await onDelete(selected);
            onSelectHighlight(null);
          } catch (caught) {
            Alert.alert('Could not delete highlight', caught instanceof Error ? caught.message : 'Please try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <Modal
      visible={notesVisible || Boolean(selected)}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={selected ? closeDetail : onCloseNotes}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.modalPage, { paddingTop: Math.max(insets.top, 14), paddingBottom: Math.max(insets.bottom, 14) }]}
      >
        {selected ? (
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <View style={styles.detailTitleCopy}>
                <Text style={styles.eyebrow}>{selected.reference} · {selected.translation}</Text>
                <Text style={styles.detailTitle}>Highlight & Note</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Highlight menu"
                accessibilityState={{ expanded: menuOpen }}
                onPress={() => setMenuOpen((open) => !open)}
                style={styles.menuButton}
              >
                <View style={styles.menuBar} /><View style={styles.menuBar} /><View style={styles.menuBar} />
              </Pressable>
              {menuOpen ? (
                <View style={styles.menu}>
                  <Pressable onPress={() => { setEditing(true); setMenuOpen(false); }} style={styles.menuItem}><Text style={styles.menuItemText}>Edit</Text></Pressable>
                  <Pressable onPress={confirmDelete} style={styles.menuItem}><Text style={styles.deleteText}>Delete</Text></Pressable>
                  <Pressable onPress={closeDetail} style={styles.menuItem}><Text style={styles.menuItemText}>Close</Text></Pressable>
                </View>
              ) : null}
            </View>

            <View style={styles.columns}>
              <View style={[styles.column, styles.quoteColumn]}>
                <Text style={styles.columnLabel}>HIGHLIGHTED TEXT</Text>
                <ScrollView style={styles.columnScroll} contentContainerStyle={styles.columnContent} horizontal={false}>
                  <Text selectable style={styles.quoteText}>{selected.selectedText}</Text>
                </ScrollView>
              </View>
              <View style={[styles.column, styles.noteColumn]}>
                <Text style={styles.columnLabel}>YOUR NOTE</Text>
                {editing ? (
                  <TextInput
                    value={noteDraft}
                    onChangeText={setNoteDraft}
                    multiline
                    scrollEnabled
                    selectTextOnFocus={false}
                    placeholder="Write your note…"
                    placeholderTextColor={colors.muted}
                    style={[styles.noteInput, styles.noteInputEditing]}
                  />
                ) : (
                  <ScrollView style={styles.columnScroll} contentContainerStyle={styles.columnContent} horizontal={false}>
                    <Text selectable style={styles.noteReadText}>{noteDraft || 'No note yet. Choose Edit from the menu to add one.'}</Text>
                  </ScrollView>
                )}
              </View>
            </View>

            <View style={styles.detailFooter}>
              {editing ? (
                <>
                  <View style={styles.editRow}>
                    <View style={styles.dateField}>
                      <Text style={styles.fieldLabel}>CREATION DATE</Text>
                      <TextInput
                        value={dateDraft}
                        onChangeText={setDateDraft}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.muted}
                        autoCorrect={false}
                        keyboardType="numbers-and-punctuation"
                        style={styles.dateInput}
                      />
                    </View>
                    <View style={styles.colorField}>
                      <Text style={styles.fieldLabel}>HIGHLIGHT COLOR</Text>
                      <View style={styles.colors}>
                        {HIGHLIGHT_COLORS.map((color) => (
                          <Pressable
                            key={color}
                            accessibilityRole="radio"
                            accessibilityLabel={`${color} highlight`}
                            accessibilityState={{ selected: colorDraft === color }}
                            onPress={() => setColorDraft(color)}
                            style={[
                              styles.colorButton,
                              { backgroundColor: HIGHLIGHT_COLOR_HEX[color] },
                              colorDraft === color && styles.colorButtonSelected,
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                  <Pressable disabled={busy} onPress={saveChanges} style={styles.saveButton}>
                    {busy ? <ActivityIndicator color={colors.charcoal} /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                  </Pressable>
                </>
              ) : (
                <View style={styles.readOnlyMeta}>
                  <View style={[styles.colorDot, { backgroundColor: HIGHLIGHT_COLOR_HEX[selected.color] }]} />
                  <Text style={styles.metaText}>Created {friendlyDate(selected.createdAt)}</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.notesCard}>
            <View style={styles.notesHeader}>
              <View>
                <Text style={styles.eyebrow}>YOUR BIBLE HIGHLIGHTS</Text>
                <Text style={styles.notesTitle}>Notes</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close notes" onPress={onCloseNotes} style={styles.closeButton}><Text style={styles.closeButtonText}>×</Text></Pressable>
            </View>
            <Text style={styles.sortLabel}>SORT BY</Text>
            <View style={styles.sortOptions}>
              {SORT_LABELS.map((option) => (
                <Pressable key={option.id} onPress={() => setSort(option.id)} style={[styles.sortButton, sort === option.id && styles.sortButtonActive]}>
                  <Text style={[styles.sortButtonText, sort === option.id && styles.sortButtonTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            <ScrollView style={styles.notesList} contentContainerStyle={styles.notesListContent} horizontal={false}>
              {!ready ? <ActivityIndicator color={colors.gold} style={styles.loader} /> : null}
              {ready && !sorted.length ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No highlights yet</Text>
                  <Text style={styles.emptyBody}>Hold and drag across Bible text, then choose a color. Your highlighted passage will appear here.</Text>
                </View>
              ) : null}
              {sorted.map((highlight) => (
                <Pressable key={highlight.id} onPress={() => onSelectHighlight(highlight.id)} style={({ pressed }) => [styles.noteItem, pressed && styles.pressed]}>
                  <View style={[styles.noteStripe, { backgroundColor: HIGHLIGHT_COLOR_HEX[highlight.color] }]} />
                  <View style={styles.noteItemCopy}>
                    <View style={styles.noteItemMeta}>
                      <Text style={styles.noteReference}>{highlight.reference} · {highlight.translation}</Text>
                      <Text style={styles.noteDate}>{friendlyDate(highlight.createdAt)}</Text>
                    </View>
                    <Text numberOfLines={4} style={styles.noteQuote}>{highlight.selectedText}</Text>
                    {highlight.note ? <Text numberOfLines={2} style={styles.notePreview}>Note: {highlight.note}</Text> : null}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  floatingButton: { position: 'absolute', zIndex: 50, elevation: 18, right: 18, minWidth: 102, height: 54, borderRadius: 27, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.gold, borderWidth: 2, borderColor: '#FFF2BF', shadowColor: '#000', shadowOpacity: .32, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  floatingIcon: { color: colors.charcoal, fontSize: 19, fontWeight: '900' },
  floatingLabel: { color: colors.charcoal, fontSize: 14, fontWeight: '900' },
  floatingCount: { minWidth: 21, height: 21, borderRadius: 11, paddingHorizontal: 5, overflow: 'hidden', color: colors.ivory, backgroundColor: colors.plum, textAlign: 'center', textAlignVertical: 'center', fontSize: 10, fontWeight: '900' },
  pressed: { opacity: .72 },
  modalPage: { flex: 1, backgroundColor: 'rgba(20,14,18,.98)', paddingHorizontal: 14 },
  notesCard: { flex: 1, width: '100%', maxWidth: 900, alignSelf: 'center', backgroundColor: colors.panel, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 16, overflow: 'hidden' },
  notesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  eyebrow: { color: colors.gold, fontSize: 10, lineHeight: 15, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
  notesTitle: { color: colors.text, fontSize: 30, lineHeight: 36, fontWeight: '900' },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border },
  closeButtonText: { color: colors.gold, fontSize: 30, lineHeight: 32, fontWeight: '600' },
  sortLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.3, marginTop: 5, marginBottom: 7 },
  sortOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  sortButton: { minHeight: 34, justifyContent: 'center', borderRadius: 17, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel2 },
  sortButtonActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  sortButtonText: { color: colors.ivory, fontSize: 11, fontWeight: '800' },
  sortButtonTextActive: { color: colors.charcoal },
  notesList: { flex: 1 },
  notesListContent: { paddingBottom: 12, gap: 10 },
  loader: { marginTop: 40 },
  emptyState: { marginTop: 24, padding: 20, borderRadius: 16, backgroundColor: colors.panel2 },
  emptyTitle: { color: colors.text, fontSize: 19, fontWeight: '900', marginBottom: 5 },
  emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  noteItem: { minHeight: 112, flexDirection: 'row', overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel2 },
  noteStripe: { width: 8 },
  noteItemCopy: { flex: 1, padding: 13 },
  noteItemMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 7 },
  noteReference: { flex: 1, color: colors.gold, fontSize: 11, fontWeight: '900' },
  noteDate: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  noteQuote: { color: colors.text, fontFamily: 'serif', fontSize: 15, lineHeight: 22 },
  notePreview: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  detailCard: { flex: 1, width: '100%', maxWidth: 1000, alignSelf: 'center', backgroundColor: colors.panel, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 14 },
  detailHeader: { position: 'relative', zIndex: 20, elevation: 20, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2, marginBottom: 10 },
  detailTitleCopy: { flex: 1 },
  detailTitle: { color: colors.text, fontSize: 23, fontWeight: '900' },
  menuButton: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.gold },
  menuBar: { width: 21, height: 2, borderRadius: 2, backgroundColor: colors.charcoal },
  menu: { position: 'absolute', zIndex: 30, elevation: 30, right: 2, top: 52, width: 180, padding: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel2 },
  menuItem: { minHeight: 45, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 9 },
  menuItemText: { color: colors.ivory, fontSize: 14, fontWeight: '800' },
  deleteText: { color: colors.red, fontSize: 14, fontWeight: '900' },
  columns: { flex: 1, minHeight: 0, flexDirection: 'row', gap: 10 },
  column: { flex: 1, minWidth: 0, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  quoteColumn: { borderColor: '#D6C49C', backgroundColor: '#F7F0E2' },
  noteColumn: { borderColor: colors.border, backgroundColor: colors.panel2 },
  columnLabel: { color: colors.gold, backgroundColor: colors.plum, paddingHorizontal: 11, paddingVertical: 8, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  columnScroll: { flex: 1 },
  columnContent: { padding: 13 },
  quoteText: { color: '#292126', fontFamily: 'serif', fontSize: 16, lineHeight: 25 },
  noteInput: { flex: 1, minHeight: 150, padding: 13, color: colors.ivory, fontSize: 15, lineHeight: 23, textAlignVertical: 'top' },
  noteInputEditing: { backgroundColor: '#291F27' },
  noteReadText: { color: colors.ivory, fontSize: 15, lineHeight: 23 },
  detailFooter: { paddingTop: 10 },
  readOnlyMeta: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9 },
  colorDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,.45)' },
  metaText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  editRow: { gap: 10 },
  dateField: { flex: 1 },
  colorField: { width: '100%' },
  fieldLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
  dateInput: { minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: colors.gold, paddingHorizontal: 10, color: colors.text, backgroundColor: colors.panel2, fontSize: 13, fontWeight: '800' },
  colors: { minHeight: 42, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  colorButton: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  colorButtonSelected: { borderColor: '#FFFFFF', transform: [{ scale: 1.14 }] },
  saveButton: { minHeight: 46, marginTop: 10, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold },
  saveButtonText: { color: colors.charcoal, fontSize: 14, fontWeight: '900' },
});
