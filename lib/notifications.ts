import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('live-discussion', {
      name: 'Live Bible discussion',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  let status = (await Notifications.getPermissionsAsync()).status;
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  return status === 'granted';
}

export async function scheduleDiscussionReminder(target: Date, minutesBefore: number) {
  const allowed = await ensureNotificationPermission();
  if (!allowed) throw new Error('Notifications are not enabled.');
  const date = new Date(target.getTime() - minutesBefore * 60_000);
  if (date.getTime() <= Date.now()) throw new Error('That reminder time has already passed.');
  return Notifications.scheduleNotificationAsync({
    content: {
      title: minutesBefore === 0 ? 'The Thursday discussion is live' : 'Thursday Bible discussion reminder',
      body: minutesBefore === 0 ? 'Tap to join the live discussion now.' : `The live discussion begins in ${minutesBefore >= 60 ? `${minutesBefore / 60} hour${minutesBefore === 60 ? '' : 's'}` : `${minutesBefore} minutes`}.`,
      data: { url: 'https://us06web.zoom.us/j/4700414908' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      ...(Platform.OS === 'android' ? { channelId: 'live-discussion' } : {}),
    },
  });
}
