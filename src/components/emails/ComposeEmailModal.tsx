import { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';

interface ComposeEmailModalProps {
  onClose: () => void;
  onSuccess: () => void;
  defaultTo?: string;
  defaultSubject?: string;
}

export function ComposeEmailModal({ onClose, onSuccess, defaultTo = '', defaultSubject = '' }: ComposeEmailModalProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim() || !subject.trim() || !body.trim()) return;

    setSending(true);
    setError('');

    try {
      const { data: tokenData } = await supabase.from('google_tokens').select('access_token').eq('user_id', user!.id).single();
      if (!tokenData) throw new Error('Not connected to Gmail');

      const email = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${body.replace(/\n/g, '<br>')}`;
      const base64Email = btoa(unescape(encodeURIComponent(email))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: base64Email })
      });

      if (!response.ok) throw new Error('Failed to send email');

      const gmailResponse = await response.json();
      const gmailMessageId = gmailResponse.id;

      const { error: insertError } = await supabase.from('email_messages').insert({
        company_id: currentCompany?.id,
        sender_user_id: user?.id,
        recipient_email: to,
        direction: 'outbound',
        from_address: user?.email || '',
        to_addresses: [to],
        subject,
        body,
        gmail_message_id: gmailMessageId,
        sent_at: new Date().toISOString()
      });

      if (insertError) {
        console.error('Error inserting email message:', insertError);
        throw new Error(`Failed to save email: ${insertError.message}`);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Compose Email</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSend} className="p-6">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm">{error}</div>}

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">To</label>
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent" required />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent" required />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Message</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent" required />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={sending} className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50">
              {sending ? <><Loader2 className="w-4 h-4 animate-spin" />Sending...</> : <><Send className="w-4 h-4" />Send</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
