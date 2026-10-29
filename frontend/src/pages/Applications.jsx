import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowUpDown,
  ChevronRight,
  Eye,
  FileCheck2,
  Building2,
  LayoutGrid,
  List,
  FileText,
  Clock,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { applicationService } from '../services/applicationService';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Pagination from '../components/common/Pagination';
import { DocumentStackDoodle } from '../components/common/Doodles';

export default function Applications() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') === 'missing' ? 'Missing Documents' : 'All';

  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState(null);

  // View mode: 'table' or 'cards'
  const [viewMode, setViewMode] = useState('table');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilter);
  const [sortField, setSortField] = useState('submittedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await applicationService.getApplications({
        search: searchQuery,
        status: statusFilter,
      });
      setApplications(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [searchQuery, statusFilter]);

  // Sort logic
  const sortedApplications = [...applications].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (typeof aVal === 'string') {
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const totalPages = Math.ceil(sortedApplications.length / pageSize) || 1;
  const paginatedApplications = sortedApplications.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Helper for human-readable institution display name
  const getDisplayName = (app) => {
    if (app.institutionName && app.institutionName.trim()) {
      return app.institutionName;
    }
    if (app.applicantName && app.applicantName.trim()) {
      return `${app.applicantName} (${app.applicationType || 'Institutional Filing'})`;
    }
    return `${app.applicationType || 'Institutional Application'} • Case #${app.id.replace('APP-', '')}`;
  };

  // Status counters
  const totalCount = applications.length;
  const verifiedCount = applications.filter((a) => a.status === 'Verified' || a.status === 'validated').length;
  const reviewCount = applications.filter((a) => a.status === 'Under Review' || a.status === 'Discrepancy Detected').length;
  const missingDocsCount = applications.filter((a) => a.status === 'Missing Documents' || a.documentCount === 0).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3.5">
          <div className="hidden sm:block">
            <DocumentStackDoodle className="w-11 h-11" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Institutional Cases
            </h1>
            <p className="text-xs text-text-secondary mt-0.5">
              Review institutional approval applications, examine submitted evidence, and track verification decisions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => navigate('/applications/new')}
            className="bg-[#E43D12] hover:bg-[#CC340E] text-white font-semibold"
          >
            New Application
          </Button>
        </div>
      </div>

      {/* Unified KPI Ribbon */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-xs">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border">
          <button
            type="button"
            onClick={() => setStatusFilter('All')}
            className={`p-4 text-left transition-colors cursor-pointer ${
              statusFilter === 'All' ? 'bg-surface-elevated font-semibold' : 'hover:bg-surface-hover'
            }`}
          >
            <div className="text-xs font-medium text-text-secondary">All Active Cases</div>
            <div className="text-2xl font-semibold text-text-primary mt-1 font-mono">{totalCount}</div>
            <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>Full Workload</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('Verified')}
            className={`p-4 text-left transition-colors cursor-pointer ${
              statusFilter === 'Verified' ? 'bg-surface-elevated font-semibold' : 'hover:bg-surface-hover'
            }`}
          >
            <div className="text-xs font-medium text-text-secondary">Verified Clear</div>
            <div className="text-2xl font-semibold text-text-primary mt-1 font-mono">{verifiedCount}</div>
            <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Zero Violations</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('Discrepancy Detected')}
            className={`p-4 text-left transition-colors cursor-pointer ${
              statusFilter === 'Discrepancy Detected' ? 'bg-surface-elevated font-semibold' : 'hover:bg-surface-hover'
            }`}
          >
            <div className="text-xs font-medium text-text-secondary">Issues Flagged</div>
            <div className="text-2xl font-semibold text-text-primary mt-1 font-mono">{reviewCount}</div>
            <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>Officer Action Needed</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('Missing Documents')}
            className={`p-4 text-left transition-colors cursor-pointer ${
              statusFilter === 'Missing Documents' ? 'bg-surface-elevated font-semibold' : 'hover:bg-surface-hover'
            }`}
          >
            <div className="text-xs font-medium text-text-secondary">Missing Documents</div>
            <div className="text-2xl font-semibold text-text-primary mt-1 font-mono">{missingDocsCount}</div>
            <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Incomplete Filing</span>
            </div>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-surface p-4 rounded-xl border border-border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by college name, application reference, or program..."
            className="w-full bg-surface-elevated pl-10 pr-4 py-2 rounded-lg border border-border text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Status Dropdown */}
          <div className="relative flex-1 sm:flex-initial">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-text-primary px-3 py-2 pr-8 rounded-lg border border-border text-xs focus:outline-none focus:border-accent appearance-none cursor-pointer bg-surface-elevated"
            >
              <option value="All">All Statuses</option>
              <option value="Verified">Verified Compliant</option>
              <option value="Discrepancy Detected">Issues Flagged</option>
              <option value="Missing Documents">Missing Documents</option>
              <option value="Under Review">Under Review</option>
            </select>
            <Filter className="w-3.5 h-3.5 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Table / Card View Toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden bg-surface-elevated p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table View"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-surface text-accent shadow-xs' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Card Grid View"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'cards' ? 'bg-surface text-accent shadow-xs' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Reset Filters */}
          {(searchQuery || statusFilter !== 'All') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('All');
                setCurrentPage(1);
              }}
              className="text-xs text-accent hover:underline px-2 py-1 font-medium cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Applications Content: Table or Cards */}
      {loading ? (
        <div className="bg-surface rounded-xl border border-border p-6 space-y-3">
          <Skeleton className="h-6 w-48" />
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchApplications} />
      ) : paginatedApplications.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No institutional cases match your criteria"
          description="Try clearing search filters or create a new approval filing."
          action={{
            label: 'Clear Filters',
            onClick: () => {
              setSearchQuery('');
              setStatusFilter('All');
            },
          }}
        />
      ) : viewMode === 'cards' ? (
        /* CARD GRID VIEW */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedApplications.map((app) => (
              <div
                key={app.id}
                onClick={() => navigate(`/applications/${app.id}`)}
                className="bg-surface rounded-2xl border border-border p-5 hover:border-accent/40 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-elevated text-accent font-bold border border-border">
                      {app.id}
                    </span>
                    <Badge
                      variant={
                        app.complianceStatus === 'Passed' || app.status === 'validated' || app.status === 'Verified'
                          ? 'success'
                          : app.complianceStatus === 'Discrepancy Detected'
                          ? 'danger'
                          : 'warning'
                      }
                    >
                      {app.complianceStatus || (app.status === 'validated' ? 'Verified Clear' : app.status)}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-text-primary group-hover:text-accent transition-colors line-clamp-1">
                      {getDisplayName(app)}
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {app.applicationType || 'Technical Approval'} &bull; {app.intakeCapacity ? `${app.intakeCapacity} seats` : "Standard intake"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="p-2 rounded-lg bg-surface-elevated border border-border">
                      <span className="text-text-muted block text-[10px]">Documents</span>
                      <span className="font-semibold text-text-primary">
                        {app.documentCount || 1} Uploaded
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-surface-elevated border border-border">
                      <span className="text-text-muted block text-[10px]">Findings</span>
                      <span className="font-semibold text-text-primary">
                        {app.findingCount || 0} Issues
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-border/60 flex items-center justify-between">
                  <span className="text-[11px] text-text-muted font-mono">
                    {app.created_at ? new Date(app.created_at).toLocaleDateString() : 'Active'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent group-hover:underline">
                    <span>Open Case</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={sortedApplications.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-elevated text-text-muted border-b border-border/70 font-medium">
                  <th
                    onClick={() => handleSort('institutionName')}
                    className="py-3 px-4 cursor-pointer hover:text-text-primary transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Institution &amp; Program</span>
                      <ArrowUpDown className="w-3 h-3 text-text-muted" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('id')}
                    className="py-3 px-4 cursor-pointer hover:text-text-primary transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Case Reference</span>
                      <ArrowUpDown className="w-3 h-3 text-text-muted" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('intakeCapacity')}
                    className="py-3 px-4 cursor-pointer hover:text-text-primary transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Intake</span>
                      <ArrowUpDown className="w-3 h-3 text-text-muted" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Documents</th>
                  <th className="py-3 px-4">Compliance Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paginatedApplications.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => navigate(`/applications/${app.id}`)}
                    className="hover:bg-surface-elevated/60 transition-colors group cursor-pointer"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-text-primary text-xs group-hover:text-accent transition-colors">
                        {getDisplayName(app)}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {app.applicationType || 'Technical Approval'} &bull; {app.applicantName || 'Institutional Filing'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-text-secondary text-xs">
                      {app.id}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-text-secondary">
                      {app.intakeCapacity ? `${app.intakeCapacity} seats` : "Standard intake"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-text-secondary">
                        {app.documentCount || 1} docs
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          app.complianceStatus === 'Passed' || app.status === 'validated' || app.status === 'Verified'
                            ? 'success'
                            : app.complianceStatus === 'Discrepancy Detected'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {app.complianceStatus || (app.status === 'validated' ? 'Verified Clear' : app.status)}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/applications/${app.id}`);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface border border-border group-hover:bg-accent group-hover:text-accent-foreground group-hover:border-accent text-xs font-semibold text-text-primary transition-all cursor-pointer shadow-xs"
                      >
                        <span>Open Case</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={sortedApplications.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
