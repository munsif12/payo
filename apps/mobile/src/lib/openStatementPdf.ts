import { useCallback } from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { apiBase } from './backendUrl';

/**
 * Fetch a statement PDF with the session token and hand it to the share sheet
 * (or the in-app browser where sharing is unavailable). WebBrowser cannot send an
 * Authorization header and the backend does not accept a token in the query, so
 * the bytes come down through fetch and go out through the cache directory.
 * Shared by the Statements screen and the chat `statement` card, so "generate my
 * statement" by voice opens the PDF from the card without leaving the chat.
 */
export function useOpenStatementPdf(): (id: string) => Promise<void> {
  const token = useSelector((s: RootState) => s.auth.token);
  return useCallback(async (id: string) => {
    try {
      const url = `${apiBase()}/statements/${id}/pdf`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onloadend = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.readAsDataURL(blob);
      });
      const FileSystem = await import('expo-file-system/legacy');
      const Sharing = await import('expo-sharing');
      const path = `${FileSystem.cacheDirectory}statement-${id}.pdf`;
      await FileSystem.writeAsStringAsync(path, base64, { encoding: 'base64' });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      else await WebBrowser.openBrowserAsync(path);
    } catch {
      Alert.alert('PDF', 'Could not open the PDF');
    }
  }, [token]);
}
