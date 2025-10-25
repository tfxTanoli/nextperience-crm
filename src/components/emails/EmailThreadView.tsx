import { useState, useEffect } from 'react';
import { ArrowLeft, Reply, Loader2, Trash2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useGoogleAuth } from '../../contexts/GoogleAuthContext';

interface EmailMessage {
  id: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  date: string;
}

interface EmailThreadViewProps {
  threadId: string;
  onBack: () => void;
  onRefresh: () => void;
}

export function EmailThreadView({ threadId, onBack, onRefresh }: EmailThreadViewProps) {
  const { user } = useAuth();
  const { fetchThread, markAsRead, markAsUnread, deleteMessage } = useGoogleAuth();
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReply, setShowReply] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadThread();
  }, [threadId]);

  const loadThread = async () => {
    setLoading(true);
    try {
      const thread = await fetchThread(threadId);
      
      const msgs: EmailMessage[] = thread.messages.map((m: any) => {
        const headers = m.payload.headers;
        return {
          id: m.id,
          from: headers.find((h: any) => h.name === 'From')?.value || '',
          to: [headers.find((h: any) => h.name === 'To')?.value || ''],
          subject: headers.find((h: any) => h.name === 'Subject')?.value || '',
          body: getMessageBody(m.payload),
          date: new Date(parseInt(m.internalDate)).toLocaleString()
        };
      });
      setMessages(msgs);
    } catch (error) {
      console.error('Error loading thread:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMessageBody = (payload: any): string => {
    if (payload.body.data) return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
          return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
      }
    }
    return '';
  };

  const handleReply = async () => {
    if (!replyBody.trim()) return;
    setSending(true);
    try {
      const lastMsg = messages[messages.length - 1];
      const { data: tokenData } = await supabase.from('google_tokens').select('access_token').eq('user_id', user!.id).single();

      const email = `To: ${lastMsg.from}\r\nSubject: Re: ${lastMsg.subject}\r\nIn-Reply-To: ${lastMsg.id}\r\nReferences: ${lastMsg.id}\r\n\r\n${replyBody}`;
      const base64Email = btoa(unescape(encodeURIComponent(email))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: base64Email, threadId })
      });

      setReplyBody('');
      setShowReply(false);
      await loadThread();
      onRefresh();
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setSending(false);
    }
  };

  const handleMarkAsRead = async (messageId: string) => {
    setActionLoading(messageId);
    try {
      await markAsRead(messageId);
      setMessages(messages.map(m => m.id === messageId ? { ...m } : m));
    } catch (error) {
      console.error('Error marking as read:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAsUnread = async (messageId: string) => {
    setActionLoading(messageId);
    try {
      await markAsUnread(messageId);
      setMessages(messages.map(m => m.id === messageId ? { ...m } : m));
    } catch (error) {
      console.error('Error marking as unread:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this email?')) return;
    setActionLoading(messageId);
    try {
      await deleteMessage(messageId);
      setMessages(messages.filter(m => m.id !== messageId));
      if (messages.length === 1) {
        onBack();
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-slate-600">Loading thread...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to inbox
      </button>

      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">{messages[0]?.subject || '(No subject)'}</h2>
              <p className="text-sm text-slate-600">{messages.length} message{messages.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleMarkAsRead(messages[0]?.id)}
                disabled={actionLoading === messages[0]?.id}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                title="Mark as read"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleMarkAsUnread(messages[0]?.id)}
                disabled={actionLoading === messages[0]?.id}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                title="Mark as unread"
              >
                <EyeOff className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(messages[0]?.id)}
                disabled={actionLoading === messages[0]?.id}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                title="Delete thread"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {messages.map((msg) => (
            <div key={msg.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-medium text-slate-900">{msg.from}</div>
                  <div className="text-sm text-slate-500">To: {msg.to.join(', ')}</div>
                </div>
                <div className="text-sm text-slate-500">{msg.date}</div>
              </div>
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: msg.body }} />
            </div>
          ))}
        </div>

        {showReply ? (
          <div className="p-6 border-t border-slate-200 bg-slate-50">
            <textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} rows={6} placeholder="Type your reply..." className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent mb-3" />
            <div className="flex gap-3">
              <button onClick={handleReply} disabled={sending || !replyBody.trim()} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50">
                {sending ? <><Loader2 className="w-4 h-4 animate-spin" />Sending...</> : <><Reply className="w-4 h-4" />Send Reply</>}
              </button>
              <button onClick={() => setShowReply(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="p-6 border-t border-slate-200">
            <button onClick={() => setShowReply(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
              <Reply className="w-4 h-4" />
              Reply
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
