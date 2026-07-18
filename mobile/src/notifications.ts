import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const SAFETY_CHANNEL = "seguranca-trilha";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function initializeSafetyNotifications() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(SAFETY_CHANNEL, {
      name: "Segurança da trilha",
      description: "SOS, pedidos de ajuda e alertas operacionais.",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 180, 500],
      lightColor: "#D96224",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (!current.granted) {
    await Notifications.requestPermissionsAsync();
  }
}

export async function notifySafetyAlert(input: {
  title: string;
  body: string;
  operationId: string;
  memberId?: string;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      sound: "default",
      data: {
        operationId: input.operationId,
        memberId: input.memberId,
      },
      ...(Platform.OS === "android" ? { channelId: SAFETY_CHANNEL } : {}),
    },
    trigger: null,
  });
}
