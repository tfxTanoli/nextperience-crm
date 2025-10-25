import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface GoogleAuthContextType {
  isConnected: boolean;
  loading: boolean;
  unreadCount: number;
  connectGoogle: () => void;
  disconnectGoogle: () => Promise<void>;
  sendEmail: (params: SendEmailParams) => Promise<void>;
  fetchMessages: (maxResults?: number) => Promise<any[]>;
  fetchThread: (threadId: string) => Promise<any>;
  markAsRead: (messageId: string) => Promise<void>;
  markAsUnread: (messageId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  getLabels: () => Promise<any[]>;
  searchMessages: (query: string, maxResults?: number) => Promise<any[]>;
  subscribeToUnreadCount: () => void;
  unsubscribeFromUnreadCount: () => void;
}

interface SendEmailParams {
  to: string[];
  subject: string;
  body: string;
  attachments?: { filename: string; content: string; mimeType: string }[];
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

// Global state for storing tokens from postMessage
let pendingTokens: any = null;

// Set up global message listener (outside of component to avoid re-renders)
if (typeof window !== 'undefined') {
  window.addEventListener('message', (e: MessageEvent) => {
    console.log('[GoogleAuth] Global message received:', e.origin, e.data?.type);

    const t = e?.data?.type;
    if (!t) return;

    // Allow both variations while stabilizing
    if (t !== 'gmail-connected' && t !== 'google-connected') return;

    // Allow known origins
    const okOrigins = [
      'https://hsftnenijlcpqbqzpyhk.supabase.co',
      'https://nexperience-crm-mul-xopl.bolt.host',
      'http://localhost:5173',
      'http://localhost:54321'
    ];
    const ok = okOrigins.some(o => (e.origin || '').startsWith(o));
    if (!ok) {
      console.warn('[GoogleAuth] Unexpected origin:', e.origin);
      return;
    }

    // Store tokens for the component to pick up
    if (e.data.data && e.data.data.tokens) {
      console.log('[GoogleAuth] Tokens received via postMessage, storing for component');
      pendingTokens = e.data.data;
    }
  });
}

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (user) {
      checkGoogleConnection();
    } else {
      setIsConnected(false);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      console.log('[GoogleAuth] message received:', e.origin, e.data);

      const t = e?.data?.type;
      if (!t) return;

      // Allow both variations while stabilizing
      if (t !== 'gmail-connected' && t !== 'google-connected') return;

      // Allow known origins (relax during setup)
      const okOrigins = [
        'https://hsftnenijlcpqbqzpyhk.supabase.co',
        'https://nexperience-crm-mul-xopl.bolt.host',
        'http://localhost:5173',
        'http://localhost:54321'
      ];
      const ok = okOrigins.some(o => (e.origin || '').startsWith(o));
      if (!ok) {
        console.warn('[GoogleAuth] Unexpected origin:', e.origin);
      }

      // Save tokens if provided in the message
      if (e.data.data && e.data.data.tokens && user) {
        console.log('[GoogleAuth] Saving tokens from postMessage');
        saveTokensFromCallback(e.data.data);
      }

      // Update states to mark as connected
      try {
        setIsConnected(true);
        localStorage.setItem('google_connected', 'true');
        console.log('[GoogleAuth] Connection confirmed!');
      } catch (err) {
        console.error('[GoogleAuth] Error updating state:', err);
      }
    }

    window.addEventListener('message', onMsg);
    console.log('[GoogleAuth] Message listener attached');

    return () => {
      window.removeEventListener('message', onMsg);
      console.log('[GoogleAuth] Message listener removed');
    };
  }, [user]);

  // Set up localStorage fallback check (independent of user)
  useEffect(() => {
    function checkLocalStorageFallback() {
      try {
        const storedTokens = localStorage.getItem('google_oauth_tokens');
        if (storedTokens && user) {
          console.log('[GoogleAuth] Found tokens in localStorage (fallback)');
          const payload = JSON.parse(storedTokens);
          if (payload.data && payload.data.tokens) {
            saveTokensFromCallback(payload.data);
            localStorage.removeItem('google_oauth_tokens'); // Clean up
          }
        }
      } catch (err) {
        console.error('[GoogleAuth] Error checking localStorage fallback:', err);
      }
    }

    // Check localStorage periodically as fallback
    const fallbackInterval = setInterval(checkLocalStorageFallback, 500);

    return () => {
      clearInterval(fallbackInterval);
    };
  }, [user]);

  const checkGoogleConnection = async () => {
    if (!user) return;

    try {
      const localCheck = localStorage.getItem('google_connected');
      if (localCheck === 'true') {
        console.log('[GoogleAuth] LocalStorage indicates connected');
        setIsConnected(true);
      }

      const { data } = await supabase
        .from('google_tokens')
        .select('id, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        const expiresAt = new Date(data.expires_at);
        const connected = expiresAt > new Date();
        console.log('[GoogleAuth] Database check - connected:', connected);
        setIsConnected(connected);
        if (connected) {
          localStorage.setItem('google_connected', 'true');
        } else {
          localStorage.removeItem('google_connected');
        }
      } else {
        console.log('[GoogleAuth] No tokens found in database');
        setIsConnected(false);
        localStorage.removeItem('google_connected');
      }
    } catch (error) {
      console.error('[GoogleAuth] Error checking connection:', error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const saveTokensFromCallback = async (data: any) => {
    if (!user) return;

    try {
      console.log('[GoogleAuth] Saving tokens from callback:', data);

      const { error } = await supabase
        .from('google_tokens')
        .upsert({
          user_id: user.id,
          access_token: data.tokens.access_token,
          refresh_token: data.tokens.refresh_token,
          expires_at: data.tokens.expires_at,
          scope: data.tokens.scope,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('[GoogleAuth] Error saving tokens:', error);
      } else {
        console.log('[GoogleAuth] Tokens saved successfully');
        setIsConnected(true);
        localStorage.setItem('google_connected', 'true');
      }
    } catch (err) {
      console.error('[GoogleAuth] Error in saveTokensFromCallback:', err);
    }
  };

  const connectGoogle = async () => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[GoogleAuth] No active session');
        return;
      }

      const startUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-start`;

      const response = await fetch(startUrl, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GoogleAuth] Failed to start OAuth - Status:', response.status, 'Response:', errorText);
        return;
      }

      const data = await response.json();
      console.log('[GoogleAuth] OAuth start response:', data);
      const authUrl = data.authUrl;

      if (!authUrl) {
        console.error('[GoogleAuth] No auth URL in response:', data);
        return;
      }

      console.log('[GoogleAuth] Opening OAuth window with URL:', authUrl);
      const w = window.open(authUrl, 'google-oauth', 'width=520,height=640');

      if (!w || w.closed || typeof w.closed === 'undefined') {
        console.log('[GoogleAuth] Window blocked or closed, redirecting');
        window.location.href = authUrl;
      }

      // Poll for tokens to be saved (fallback for COOP issues)
      let pollCount = 0;
      const maxPolls = 120; // 120 seconds (increased from 60)
      const pollInterval = setInterval(async () => {
        pollCount++;
        console.log('[GoogleAuth] Polling for tokens... attempt', pollCount);

        try {
          // Check if tokens were received via postMessage
          if (pendingTokens) {
            console.log('[GoogleAuth] Tokens received via postMessage! Saving...');
            await saveTokensFromCallback(pendingTokens);
            pendingTokens = null; // Clear pending tokens
            clearInterval(pollInterval);
            return;
          }

          // Use authenticated request with session token
          const { data: tokenData, error: queryError } = await supabase
            .from('google_tokens')
            .select('id, access_token, expires_at')
            .eq('user_id', user.id)
            .maybeSingle();

          if (queryError) {
            console.error('[GoogleAuth] Query error:', queryError);
          }

          if (tokenData) {
            console.log('[GoogleAuth] Tokens found! Connection successful');
            setIsConnected(true);
            clearInterval(pollInterval);
            localStorage.setItem('google_connected', 'true');
          }
        } catch (err) {
          console.error('[GoogleAuth] Error polling for tokens:', err);
        }

        if (pollCount >= maxPolls) {
          console.log('[GoogleAuth] Polling timeout after', pollCount, 'attempts');
          clearInterval(pollInterval);
          // Try one final check with explicit error logging
          try {
            const { data: finalCheck, error: finalError } = await supabase
              .from('google_tokens')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();

            if (finalError) {
              console.error('[GoogleAuth] Final check error:', finalError);
            } else if (!finalCheck) {
              console.error('[GoogleAuth] No tokens found after timeout - OAuth may have failed');
            }
          } catch (err) {
            console.error('[GoogleAuth] Final check exception:', err);
          }
        }
      }, 1000);
    } catch (error) {
      console.error('[GoogleAuth] Error connecting to Google:', error);
    }
  };

  const disconnectGoogle = async () => {
    if (!user) return;

    try {
      await supabase
        .from('google_tokens')
        .delete()
        .eq('user_id', user.id);

      setIsConnected(false);
    } catch (error) {
      console.error('Error disconnecting Google:', error);
      throw error;
    }
  };

  const sendEmail = async (params: SendEmailParams) => {
    if (!user) throw new Error('User not authenticated');
    if (!isConnected) throw new Error('Google account not connected');

    const { data: tokenData } = await supabase
      .from('google_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tokenData) throw new Error('No Google token found');

    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);

    if (expiresAt <= new Date()) {
      accessToken = await refreshAccessToken(tokenData.refresh_token);
    }

    const email = createEmailMessage(params);
    const base64Email = btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64Email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to send email');
    }

    return await response.json();
  };

  const refreshAccessToken = async (refreshToken: string): Promise<string> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session found');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-token-refresh`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to refresh access token');
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('[GoogleAuth] Token refresh error:', error);
      throw error;
    }
  };

  const createEmailMessage = (params: SendEmailParams): string => {
    const boundary = '----=_Part_' + Date.now();
    let message = '';

    message += `To: ${params.to.join(', ')}\r\n`;
    message += `Subject: ${params.subject}\r\n`;
    message += `MIME-Version: 1.0\r\n`;

    if (params.attachments && params.attachments.length > 0) {
      message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
      message += `--${boundary}\r\n`;
      message += `Content-Type: text/html; charset=UTF-8\r\n\r\n`;
      message += `${params.body}\r\n\r\n`;

      for (const attachment of params.attachments) {
        message += `--${boundary}\r\n`;
        message += `Content-Type: ${attachment.mimeType}\r\n`;
        message += `Content-Transfer-Encoding: base64\r\n`;
        message += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n\r\n`;
        message += `${attachment.content}\r\n\r\n`;
      }

      message += `--${boundary}--`;
    } else {
      message += `Content-Type: text/html; charset=UTF-8\r\n\r\n`;
      message += params.body;
    }

    return message;
  };

  const fetchMessages = async (maxResults: number = 50): Promise<any[]> => {
    if (!user) throw new Error('User not authenticated');
    if (!isConnected) throw new Error('Google account not connected');

    const { data: tokenData } = await supabase
      .from('google_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tokenData) throw new Error('No Google token found');

    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);

    if (expiresAt <= new Date()) {
      accessToken = await refreshAccessToken(tokenData.refresh_token);
    }

    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) throw new Error('Failed to fetch messages');
    const data = await response.json();

    const messages = await Promise.all(
      (data.messages || []).map(async (msg: any) => {
        const msgResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        return msgResponse.json();
      })
    );

    return messages.map((m: any) => {
      const headers = m.payload.headers;
      return {
        id: m.id,
        threadId: m.threadId,
        snippet: m.snippet,
        from: headers.find((h: any) => h.name === 'From')?.value || '',
        subject: headers.find((h: any) => h.name === 'Subject')?.value || '',
        date: new Date(parseInt(m.internalDate)).toLocaleDateString(),
        unread: m.labelIds?.includes('UNREAD') || false
      };
    });
  };

  const fetchThread = async (threadId: string): Promise<any> => {
    if (!user) throw new Error('User not authenticated');
    if (!isConnected) throw new Error('Google account not connected');

    const { data: tokenData } = await supabase
      .from('google_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tokenData) throw new Error('No Google token found');

    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);

    if (expiresAt <= new Date()) {
      accessToken = await refreshAccessToken(tokenData.refresh_token);
    }

    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) throw new Error('Failed to fetch thread');
    return response.json();
  };

  const markAsRead = async (messageId: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    if (!isConnected) throw new Error('Google account not connected');

    const { data: tokenData } = await supabase
      .from('google_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tokenData) throw new Error('No Google token found');

    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);

    if (expiresAt <= new Date()) {
      accessToken = await refreshAccessToken(tokenData.refresh_token);
    }

    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
    });

    if (!response.ok) throw new Error('Failed to mark message as read');

    // Decrement unread count
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAsUnread = async (messageId: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    if (!isConnected) throw new Error('Google account not connected');

    const { data: tokenData } = await supabase
      .from('google_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tokenData) throw new Error('No Google token found');

    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);

    if (expiresAt <= new Date()) {
      accessToken = await refreshAccessToken(tokenData.refresh_token);
    }

    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ addLabelIds: ['UNREAD'] }),
    });

    if (!response.ok) throw new Error('Failed to mark message as unread');

    // Increment unread count
    setUnreadCount((prev) => prev + 1);
  };

  const deleteMessage = async (messageId: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    if (!isConnected) throw new Error('Google account not connected');

    const { data: tokenData } = await supabase
      .from('google_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tokenData) throw new Error('No Google token found');

    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);

    if (expiresAt <= new Date()) {
      accessToken = await refreshAccessToken(tokenData.refresh_token);
    }

    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) throw new Error('Failed to delete message');
  };

  const getLabels = async (): Promise<any[]> => {
    if (!user) throw new Error('User not authenticated');
    if (!isConnected) throw new Error('Google account not connected');

    const { data: tokenData } = await supabase
      .from('google_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tokenData) throw new Error('No Google token found');

    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);

    if (expiresAt <= new Date()) {
      accessToken = await refreshAccessToken(tokenData.refresh_token);
    }

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) throw new Error('Failed to fetch labels');
    const data = await response.json();
    return data.labels || [];
  };

  const searchMessages = async (query: string, maxResults: number = 50): Promise<any[]> => {
    if (!user) throw new Error('User not authenticated');
    if (!isConnected) throw new Error('Google account not connected');

    const { data: tokenData } = await supabase
      .from('google_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tokenData) throw new Error('No Google token found');

    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);

    if (expiresAt <= new Date()) {
      accessToken = await refreshAccessToken(tokenData.refresh_token);
    }

    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodedQuery}&maxResults=${maxResults}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) throw new Error('Failed to search messages');
    const data = await response.json();

    const messages = await Promise.all(
      (data.messages || []).map(async (msg: any) => {
        const msgResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        return msgResponse.json();
      })
    );

    return messages.map((m: any) => {
      const headers = m.payload.headers;
      return {
        id: m.id,
        threadId: m.threadId,
        snippet: m.snippet,
        from: headers.find((h: any) => h.name === 'From')?.value || '',
        subject: headers.find((h: any) => h.name === 'Subject')?.value || '',
        date: new Date(parseInt(m.internalDate)).toLocaleDateString(),
        unread: m.labelIds?.includes('UNREAD') || false
      };
    });
  };

  const subscribeToUnreadCount = () => {
    if (!user) return;

    console.log('[GoogleAuth] Subscribing to unread count updates');

    try {
      // Subscribe to unread_email_count table changes
      const subscription = supabase
        .channel(`unread-count-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'unread_email_count',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('[GoogleAuth] Unread count updated:', payload);
            if (payload.new && typeof payload.new.unread_count === 'number') {
              setUnreadCount(payload.new.unread_count);
            }
          }
        )
        .subscribe((status) => {
          console.log('[GoogleAuth] Subscription status:', status);
        });

      subscriptionRef.current = subscription;
    } catch (error) {
      console.error('[GoogleAuth] Error subscribing to unread count:', error);
    }
  };

  const unsubscribeFromUnreadCount = () => {
    console.log('[GoogleAuth] Unsubscribing from unread count updates');
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }
  };

  const fetchUnreadCount = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('unread_email_count')
        .select('unread_count')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setUnreadCount(data.unread_count);
      } else {
        // Initialize if doesn't exist
        await supabase
          .from('unread_email_count')
          .insert({ user_id: user.id, unread_count: 0 });
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('[GoogleAuth] Error fetching unread count:', error);
    }
  };

  // Set up real-time subscriptions when connected
  useEffect(() => {
    if (isConnected && user) {
      subscribeToUnreadCount();
      // Fetch initial unread count
      fetchUnreadCount();
    }

    return () => {
      if (user) {
        unsubscribeFromUnreadCount();
      }
    };
  }, [isConnected, user]);

  return (
    <GoogleAuthContext.Provider
      value={{
        isConnected,
        loading,
        unreadCount,
        connectGoogle,
        disconnectGoogle,
        sendEmail,
        fetchMessages,
        fetchThread,
        markAsRead,
        markAsUnread,
        deleteMessage,
        getLabels,
        searchMessages,
        subscribeToUnreadCount,
        unsubscribeFromUnreadCount,
      }}
    >
      {children}
    </GoogleAuthContext.Provider>
  );
}

export function useGoogleAuth() {
  const context = useContext(GoogleAuthContext);
  if (context === undefined) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
}
