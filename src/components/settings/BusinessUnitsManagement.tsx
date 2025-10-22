import { useState, useEffect } from 'react';
import { Building2, Users, Plus } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface Company {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface BusinessUnitsManagementProps {
  onManageAccess: (companyId: string, companyName: string) => void;
}

export default function BusinessUnitsManagement({ onManageAccess }: BusinessUnitsManagementProps) {
  const { user } = useAuth();
  const { permissions, companies, loading, hasAllAccess } = useCompany();
  const [userCompanyRoles, setUserCompanyRoles] = useState<Map<string, string>>(new Map());
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    const loadUserRoles = async () => {
      if (!user || hasAllAccess) {
        setRolesLoading(false);
        return;
      }

      const { data: roles } = await supabase
        .from('user_company_roles')
        .select('company_id, roles(name)')
        .eq('user_id', user.id)
        .eq('is_active', true);

      const rolesMap = new Map<string, string>();
      roles?.forEach((role: any) => {
        rolesMap.set(role.company_id, role.roles?.name || '');
      });
      
      setUserCompanyRoles(rolesMap);
      setRolesLoading(false);
    };

    loadUserRoles();
  }, [user, hasAllAccess]);

  if (loading || rolesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500">Loading business units...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Business Units Management</h2>
          <p className="text-slate-600 text-sm mt-0.5">
            Manage business units and their user access
          </p>
        </div>
        {permissions?.users?.create && (
          <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Add Business Unit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {companies.map((company) => (
          <div
            key={company.id}
            className="bg-white border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors flex flex-col h-full"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-50 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">{company.name}</h3>
                  <p className="text-xs text-slate-500">{company.slug}</p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                  company.is_active
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {company.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            {(hasAllAccess || userCompanyRoles.get(company.id) === 'Admin') && (
              <button
                onClick={() => onManageAccess(company.id, company.name)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors mt-auto"
              >
                <Users className="w-4 h-4" />
                Manage User Access
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
