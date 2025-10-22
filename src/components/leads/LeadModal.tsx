import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import type { Lead, Customer, EventType } from '../../lib/database.types';
import { X, Save, AlertCircle, Calendar } from 'lucide-react';
import { CustomerSelector } from './CustomerSelector';

interface LeadModalProps {
  lead: Lead | null;
  onClose: (shouldRefresh?: boolean) => void;
  onSuccess?: () => void;
}

export function LeadModal({ lead, onClose, onSuccess }: LeadModalProps) {
  const { currentCompany, permissions } = useCompany();
  const { user } = useAuth();

  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<Customer | null>(null);

  const [customerFormData, setCustomerFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: ''
  });

  const [formData, setFormData] = useState({
    event_name: lead?.event_name || '',
    event_date: lead?.event_date || '',
    event_type: lead?.event_type || '',
    event_value: lead?.event_value?.toString() || '',
    expected_pax: lead?.expected_pax?.toString() || '',
    source: lead?.source || '',
    notes: lead?.notes || ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentCompany) {
      loadEventTypes();
    }
    if (lead?.customer_id) {
      loadCustomer(lead.customer_id);
    }
  }, [currentCompany, lead]);

  const loadEventTypes = async () => {
    if (!currentCompany) return;

    const { data } = await supabase
      .from('event_types')
      .select('*')
      .eq('company_id', currentCompany.id)
      .eq('is_active', true)
      .order('order');

    if (data) setEventTypes(data);
  };

  const loadCustomer = async (customerId: string) => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .maybeSingle();

    if (data) setSelectedCustomer(data);
  };

  const checkDuplicateCustomer = async (email: string, phone: string) => {
    if (!currentCompany || (!email && !phone)) return null;

    const query = supabase
      .from('customers')
      .select('*')
      .eq('company_id', currentCompany.id)
      .eq('is_archived', false);

    if (email && phone) {
      query.or(`email.eq.${email},phone.eq.${phone}`);
    } else if (email) {
      query.eq('email', email);
    } else if (phone) {
      query.eq('phone', phone);
    }

    const { data } = await query.limit(1).maybeSingle();
    return data;
  };

  const handleCustomerFormSubmit = async () => {
    if (!customerFormData.name.trim()) {
      setError('Customer name is required');
      return;
    }

    const duplicate = await checkDuplicateCustomer(
      customerFormData.email,
      customerFormData.phone
    );

    if (duplicate && !duplicateWarning) {
      setDuplicateWarning(duplicate);
      return;
    }

    setDuplicateWarning(null);
    return customerFormData;
  };

  const handleUseDuplicateCustomer = () => {
    if (duplicateWarning) {
      setSelectedCustomer(duplicateWarning);
      setShowCustomerForm(false);
      setDuplicateWarning(null);
      setCustomerFormData({
        name: '',
        email: '',
        phone: '',
        company_name: ''
      });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentCompany || !user) return;

    if (!lead && !selectedCustomer && !showCustomerForm) {
      setError('Please select a customer or create a new one');
      return;
    }

    setLoading(true);
    setError('');

    let customerId = selectedCustomer?.id;

    if (showCustomerForm) {
      const customerData = await handleCustomerFormSubmit();
      if (!customerData) {
        setLoading(false);
        return;
      }

      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert([{
          company_id: currentCompany.id,
          name: customerData.name,
          email: customerData.email || null,
          phone: customerData.phone || null,
          company_name: customerData.company_name || null,
          created_by: user.id
        }])
        .select()
        .single();

      if (customerError) {
        setError(customerError.message);
        setLoading(false);
        return;
      }

      customerId = newCustomer.id;

      await supabase.from('audit_logs').insert({
        company_id: currentCompany.id,
        user_id: user.id,
        entity_type: 'customer',
        entity_id: newCustomer.id,
        action: 'create',
        changed_fields: newCustomer
      });
    }

    if (!customerId && !lead) {
      setError('Customer is required');
      setLoading(false);
      return;
    }

    const eventDate = formData.event_date || null;
    if (eventDate && !lead) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(eventDate);

      if (selectedDate < today) {
        const confirmed = confirm('The event date is in the past. Do you want to continue?');
        if (!confirmed) {
          setLoading(false);
          return;
        }
      }
    }

    const leadData = {
      customer_id: customerId || lead?.customer_id,
      event_name: formData.event_name || null,
      event_date: eventDate,
      event_type: formData.event_type || null,
      event_value: formData.event_value ? parseFloat(formData.event_value) : 0,
      expected_pax: formData.expected_pax ? parseInt(formData.expected_pax) : null,
      source: formData.source || null,
      notes: formData.notes || null,
      company_id: currentCompany.id,
      created_by: user.id
    };

    if (lead) {
      const { error: updateError } = await supabase
        .from('leads')
        .update(leadData)
        .eq('id', lead.id);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      await supabase.from('audit_logs').insert({
        company_id: currentCompany.id,
        user_id: user.id,
        entity_type: 'lead',
        entity_id: lead.id,
        action: 'updated',
        changed_fields: leadData
      });
    } else {
      const { data: firstStage } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('company_id', currentCompany.id)
        .order('order')
        .limit(1)
        .maybeSingle();

      const { error: insertError } = await supabase
        .from('leads')
        .insert([{
          ...leadData,
          stage_id: firstStage?.id || null
        }]);

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      if (customerId && selectedCustomer) {
        await supabase.from('audit_logs').insert({
          company_id: currentCompany.id,
          user_id: user.id,
          entity_type: 'lead',
          entity_id: customerId,
          action: 'update',
          changed_fields: { customer_id: customerId, customer_name: selectedCustomer.name }
        });
      }
    }

    setLoading(false);
    if (onSuccess) {
      onSuccess();
    }
    onClose(true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {lead ? 'Edit Lead' : 'New Lead'}
          </h2>
          <button
            onClick={() => onClose(false)}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          {!lead && !showCustomerForm && (
            <CustomerSelector
              selectedCustomerId={selectedCustomer?.id || null}
              onSelectCustomer={(customer) => setSelectedCustomer(customer)}
              onCreateNew={() => setShowCustomerForm(true)}
            />
          )}

          {lead && selectedCustomer && (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-2">Customer</label>
              <div>
                <div className="font-medium text-slate-900">{selectedCustomer.name}</div>
                {selectedCustomer.email && (
                  <div className="text-sm text-slate-600">{selectedCustomer.email}</div>
                )}
                {selectedCustomer.phone && (
                  <div className="text-sm text-slate-600">{selectedCustomer.phone}</div>
                )}
                {selectedCustomer.company_name && (
                  <div className="text-xs text-slate-500">{selectedCustomer.company_name}</div>
                )}
              </div>
            </div>
          )}

          {showCustomerForm && (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-slate-900">New Customer</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomerForm(false);
                    setDuplicateWarning(null);
                  }}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
              </div>

              {duplicateWarning && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3 mb-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-amber-900">Possible Duplicate Customer</div>
                      <div className="text-sm text-amber-800 mt-1">
                        A customer with similar contact info already exists:
                      </div>
                      <div className="mt-2 p-2 bg-white rounded border border-amber-200">
                        <div className="font-medium">{duplicateWarning.name}</div>
                        {duplicateWarning.email && (
                          <div className="text-sm text-slate-600">{duplicateWarning.email}</div>
                        )}
                        {duplicateWarning.phone && (
                          <div className="text-sm text-slate-600">{duplicateWarning.phone}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleUseDuplicateCustomer}
                      className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                    >
                      Use Existing Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateWarning(null)}
                      className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                    >
                      Create New Anyway
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerFormData.name}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={customerFormData.company_name}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, company_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={customerFormData.email}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={customerFormData.phone}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-medium text-slate-900 mb-4">Event Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Event Name / Title
                </label>
                <input
                  type="text"
                  value={formData.event_name}
                  onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                  placeholder="e.g., John & Jane Wedding"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Event Date
                </label>
                <input
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kind of Event</label>
                <select
                  value={formData.event_type}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="">Select event type...</option>
                  {eventTypes.map((type) => (
                    <option key={type.id} value={type.name}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Expected PAX
                </label>
                <input
                  type="number"
                  value={formData.expected_pax}
                  onChange={(e) => setFormData({ ...formData, expected_pax: e.target.value })}
                  placeholder="Number of attendees"
                  min="0"
                  step="1"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Projected Event Value (₱)
                </label>
                <input
                  type="number"
                  value={formData.event_value}
                  onChange={(e) => setFormData({ ...formData, event_value: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
            <input
              type="text"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              placeholder="e.g., Website, Referral, Cold Call"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
              placeholder="Add any additional notes..."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
