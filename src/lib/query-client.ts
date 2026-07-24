import NetInfo from "@react-native-community/netinfo";
import { focusManager, MutationCache, onlineManager, QueryCache, QueryClient } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

import { captureServerStateError } from "@/commonFunctions";

if (Platform.OS !== "web") {
  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener("change", (state) => setFocused(state === "active"));
    return () => subscription.remove();
  });
}

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false && state.isInternetReachable !== false);
  }),
);

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => captureServerStateError(error, "query"),
  }),
  mutationCache: new MutationCache({
    onError: (error) => captureServerStateError(error, "mutation"),
  }),
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
      networkMode: "online",
    },
  },
});
