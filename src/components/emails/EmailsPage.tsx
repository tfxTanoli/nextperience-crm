import { useState, useEffect } from 'react';
import { Mail, Inbox, Send, RefreshCw, Search, X, Trash2, Eye, EyeOff } from 'lucide-react';
import { useGoogleAuth } from '../../contexts/GoogleAuthContext';
import { EmailThreadView } from './EmailThreadView';
import { ComposeEmailModal } from './ComposeEmailModal';

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  date: string;
  unread: boolean;
}

export function EmailsPage() {
  const { isConnected, connectGoogle, disconnectGoogle, fetchMessages, markAsRead, markAsUnread, deleteMessage, searchMessages } = useGoogleAuth();
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (isConnected) loadMessages();
  }, [isConnected]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const msgs = await fetchGmailMessages();
      setMessages(msgs);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGmailMessages = async (): Promise<GmailMessage[]> => {
    try {
      return await fetchMessages(50);
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadMessages();
      return;
    }
    setLoading(true);
    try {
      const results = await searchMessages(searchQuery);
      setMessages(results);
    } catch (error) {
      console.error('Error searching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (e: React.MouseEvent, messageId: string) => {
    e.stopPropagation();
    setActionLoading(messageId);
    try {
      await markAsRead(messageId);
      setMessages(messages.map(m => m.id === messageId ? { ...m, unread: false } : m));
    } catch (error) {
      console.error('Error marking as read:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAsUnread = async (e: React.MouseEvent, messageId: string) => {
    e.stopPropagation();
    setActionLoading(messageId);
    try {
      await markAsUnread(messageId);
      setMessages(messages.map(m => m.id === messageId ? { ...m, unread: true } : m));
    } catch (error) {
      console.error('Error marking as unread:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, messageId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this email?')) return;
    setActionLoading(messageId);
    try {
      await deleteMessage(messageId);
      setMessages(messages.filter(m => m.id !== messageId));
    } catch (error) {
      console.error('Error deleting message:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (filter === 'unread' && !msg.unread) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return msg.subject.toLowerCase().includes(q) || msg.from.toLowerCase().includes(q) || msg.snippet.toLowerCase().includes(q);
    }
    return true;
  });

  if (!isConnected) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center py-12">
          <Mail className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Connect Gmail</h2>
          <p className="text-slate-600 mb-6">Connect your Gmail account to view and reply to emails</p>
          <button onClick={connectGoogle} className="px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium">
            Connect with Google
          </button>
        </div>
      </div>
    );
  }

  if (selectedThreadId) {
    return <EmailThreadView threadId={selectedThreadId} onBack={() => setSelectedThreadId(null)} onRefresh={loadMessages} />;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Emails</h1>
        <div className="flex items-center gap-3">
          <button onClick={loadMessages} disabled={loading} className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setShowCompose(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
            <Send className="w-4 h-4" />
            Compose
          </button>
          <button onClick={disconnectGoogle} className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50">
            Disconnect
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <form onSubmit={handleSearch} className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search emails..."
                className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    loadMessages();
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </form>
            <div className="flex gap-2">
              <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>All</button>
              <button onClick={() => setFilter('unread')} className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === 'unread' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Unread</button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-600">Loading emails...</div>
        ) : filteredMessages.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600">No emails found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredMessages.map((msg) => (
              <div key={msg.id} className="p-4 hover:bg-slate-50 transition-colors group">
                <button onClick={() => setSelectedThreadId(msg.threadId)} className="w-full text-left">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {msg.unread && <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />}
                      <span className={`font-medium text-slate-900 truncate ${msg.unread ? 'font-semibold' : ''}`}>{msg.from}</span>
                    </div>
                    <span className="text-sm text-slate-500 flex-shrink-0 ml-2">{msg.date}</span>
                  </div>
                  <div className={`text-sm mb-1 ${msg.unread ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{msg.subject || '(No subject)'}</div>
                  <div className="text-sm text-slate-500 truncate">{msg.snippet}</div>
                </button>
                <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {msg.unread ? (
                    <button
                      onClick={(e) => handleMarkAsRead(e, msg.id)}
                      disabled={actionLoading === msg.id}
                      className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors disabled:opacity-50"
                      title="Mark as read"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleMarkAsUnread(e, msg.id)}
                      disabled={actionLoading === msg.id}
                      className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors disabled:opacity-50"
                      title="Mark as unread"
                    >
                      <EyeOff className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(e, msg.id)}
                    disabled={actionLoading === msg.id}
                    className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    title="Delete email"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCompose && <ComposeEmailModal onClose={() => setShowCompose(false)} onSuccess={() => { setShowCompose(false); loadMessages(); }} />}
    </div>
  );
}
