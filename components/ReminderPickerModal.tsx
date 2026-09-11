import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { Eyebrow, GoldButton, OutlineButton } from '@/components/ui';

type ReminderPickerModalProps = {
  visible: boolean;
  onRequestClose: () => void;
  onSelect: (minutes: number) => void;
};

export function ReminderPickerModal({ visible, onRequestClose, onSelect }: ReminderPickerModalProps) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onRequestClose}>
      <Pressable accessible={false} focusable={false} style={styles.backdrop} onPress={onRequestClose}>
        <Pressable
          accessible={false}
          focusable={false}
          accessibilityViewIsModal
          style={styles.modal}
          onPress={(event) => event.stopPropagation()}
        >
          <Eyebrow>CHOOSE A REMINDER</Eyebrow>
          <Text style={styles.title}>When should we remind you?</Text>
          <View style={styles.choices}>
            <GoldButton title="24 hours before" onPress={() => onSelect(1440)} />
            <OutlineButton title="1 hour before" onPress={() => onSelect(60)} />
            <OutlineButton title="15 minutes before" onPress={() => onSelect(15)} />
            <OutlineButton title="At start time" onPress={() => onSelect(0)} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel reminder" hitSlop={12} onPress={onRequestClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: colors.panel, borderColor: colors.gold, borderWidth: 1, borderRadius: 22, padding: 22 },
  title: { color: colors.text, fontSize: 23, fontWeight: '800', lineHeight: 29, marginBottom: 16 },
  choices: { gap: 10 },
  cancel: { color: colors.muted, fontSize: 15, fontWeight: '800', textAlign: 'center', paddingTop: 18, paddingBottom: 4 },
});
