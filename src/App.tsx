import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CompanyProvider, useCompany } from './contexts/CompanyContext';
import { GoogleAuthProvider } from './contexts/GoogleAuthContext';
import { LoginForm } from './components/auth/LoginForm';
import { Navigation } from './components/layout/Navigation';
import { Dashboard } from './components/dashboard/Dashboard';
import { CustomersList } from './components/customers/CustomersList';
import { LeadsKanban } from './components/leads/LeadsKanban';
import LeadDetailPage from './components/leads/LeadDetailPage';
import { ActivitiesList } from './components/activities/ActivitiesList';
import { ProductsList } from './components/products/ProductsList';
import { Settings } from './components/settings/Settings';
import QuotationsPage from './components/quotations/QuotationsPage';
import QuotationDetailPage from './components/quotations/QuotationDetailPage';
import QuotationModal from './components/quotations/QuotationModal';
import CalendarView from './components/calendar/CalendarView';
import { TemplatesPage } from './components/templates/TemplatesPage';
import { PublicQuotationView } from './components/quotations/PublicQuotationView';
import { ProfilePage } from './components/profile/ProfilePage';

function AppContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { loading: companyLoading, currentCompany, refreshCompanies } = useCompany();
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'google-connected') {
        window.location.reload();
      } else if (e.data?.type === 'google-error') {
        alert(`Google authentication failed: ${e.data.error}`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (authLoading || companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }



  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <div className="print:hidden">
        <Navigation currentView={currentView} onNavigate={setCurrentView} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 print:max-w-none print:p-0">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'customers' && <CustomersList />}
        {currentView === 'leads' && !selectedLeadId && (
          <LeadsKanban
            onViewLead={setSelectedLeadId}
            onViewCalendar={() => setCurrentView('calendar')}
          />
        )}
        {currentView === 'leads' && selectedLeadId && (
          <LeadDetailPage
            leadId={selectedLeadId}
            onBack={() => setSelectedLeadId(null)}
            onViewQuotation={(quotationId) => {
              setSelectedQuotationId(quotationId);
              setCurrentView('quotations');
            }}
          />
        )}
        {currentView === 'quotations' && !selectedQuotationId && (
          <QuotationsPage onViewQuotation={setSelectedQuotationId} />
        )}
        {currentView === 'quotations' && selectedQuotationId && (
          <QuotationDetailPage
            quotationId={selectedQuotationId}
            onBack={() => setSelectedQuotationId(null)}
            onEdit={(id) => setEditingQuotationId(id)}
          />
        )}
        {currentView === 'activities' && <ActivitiesList />}
        {currentView === 'products' && <ProductsList />}
        {currentView === 'templates' && <TemplatesPage />}
        {currentView === 'calendar' && (
          <CalendarView onBack={() => setCurrentView('leads')} />
        )}
        {currentView === 'profile' && <ProfilePage />}
        {currentView === 'settings' && <Settings />}
      </div>

      {editingQuotationId && (
        <QuotationModal
          quotation={{ id: editingQuotationId }}
          onClose={() => setEditingQuotationId(null)}
          onSuccess={() => {
            setEditingQuotationId(null);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const publicToken = params.get('q');

  if (publicToken) {
    return <PublicQuotationView token={publicToken} />;
  }

  return (
    <AuthProvider>
      <CompanyProvider>
        <GoogleAuthProvider>
          <AppContent />
        </GoogleAuthProvider>
      </CompanyProvider>
    </AuthProvider>
  );
}
