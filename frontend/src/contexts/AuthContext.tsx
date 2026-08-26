import React, { createContext, useState, useEffect, useContext } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { storage } from '@/src/utils/storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Register for push notifications - non-blocking
async function registerForPush(userId: string, token: string) {
  if (Platform.OS === 'web') return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    const tokenResp = await Notifications.getDevicePushTokenAsync();
    await fetch(`${BACKEND_URL}/api/register-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        user_id: userId,
        platform: Platform.OS,
        device_token: tokenResp.data,
      }),
    });
  } catch (e) {
    console.warn('Push registration failed (non-blocking):', e);
  }
}

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  sessionToken: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  sessionToken: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    checkExistingSession();
  }, []);

  // Handle deep links (mobile only)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleDeepLink = async (event: { url: string }) => {
      await processAuthRedirect(event.url);
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check for cold start
    Linking.getInitialURL().then((url) => {
      if (url) {
        processAuthRedirect(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Handle web redirects
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleWebAuth = async () => {
      if (typeof window === 'undefined') return;

      const hash = window.location.hash;
      const search = window.location.search;
      
      let sessionId = null;
      
      if (hash.includes('session_id=')) {
        sessionId = hash.split('session_id=')[1]?.split('&')[0];
      } else if (search.includes('session_id=')) {
        sessionId = new URLSearchParams(search).get('session_id');
      }

      if (sessionId) {
        await exchangeSessionId(sessionId);
        // Clean URL
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    handleWebAuth();
  }, []);

  const checkExistingSession = async () => {
    try {
      const token = Platform.OS === 'web' 
        ? localStorage.getItem('session_token')
        : await storage.secureGet('session_token', null);

      if (token) {
        setSessionToken(token);
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          // Register for push (non-blocking, native only)
          registerForPush(userData.user_id, token);
        } else {
          // Clear invalid token
          if (Platform.OS === 'web') {
            localStorage.removeItem('session_token');
          } else {
            await storage.secureRemove('session_token');
          }
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      const redirectUrl = Platform.OS === 'web'
        ? `${window.location.origin}/`
        : Linking.createURL('');

      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === 'web') {
        window.location.href = authUrl;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

        if (result.type === 'success' && result.url) {
          await processAuthRedirect(result.url);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const processAuthRedirect = async (url: string) => {
    try {
      let sessionId = null;

      if (url.includes('session_id=')) {
        if (url.includes('#session_id=')) {
          sessionId = url.split('#session_id=')[1]?.split('&')[0];
        } else if (url.includes('?session_id=')) {
          sessionId = url.split('?session_id=')[1]?.split('&')[0];
        }
      }

      if (sessionId) {
        await exchangeSessionId(sessionId);
      }
    } catch (error) {
      console.error('Error processing auth redirect:', error);
    }
  };

  const exchangeSessionId = async (sessionId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/session`, {
        method: 'POST',
        headers: {
          'X-Session-Token': sessionId,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to exchange session ID');
      }

      const data = await response.json();
      const token = data.session_token;

      // Store token
      if (Platform.OS === 'web') {
        localStorage.setItem('session_token', token);
      } else {
        await storage.secureSet('session_token', token);
      }

      setSessionToken(token);
      setUser({
        user_id: data.user_id,
        email: data.email,
        name: data.name,
        picture: data.picture,
      });
      // Register for push (non-blocking, native only)
      registerForPush(data.user_id, token);
    } catch (error) {
      console.error('Error exchanging session ID:', error);
    }
  };

  const logout = async () => {
    try {
      if (sessionToken) {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        });
      }

      // Clear token
      if (Platform.OS === 'web') {
        localStorage.removeItem('session_token');
      } else {
        await storage.secureRemove('session_token');
      }

      setUser(null);
      setSessionToken(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, sessionToken }}>
      {children}
    </AuthContext.Provider>
  );
};
