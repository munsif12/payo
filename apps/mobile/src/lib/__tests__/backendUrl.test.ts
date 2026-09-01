import { Platform } from 'react-native';
import { backendUrl, apiBase } from '../backendUrl';

afterEach(() => { delete process.env.EXPO_PUBLIC_API_URL; });

test('default url per platform', () => {
  const expected = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://127.0.0.1:4000';
  expect(backendUrl()).toBe(expected);
  expect(apiBase()).toBe(`${expected}/api/v1`);
});

test('env override wins', () => {
  process.env.EXPO_PUBLIC_API_URL = 'http://192.168.0.9:4000';
  expect(backendUrl()).toBe('http://192.168.0.9:4000');
});
