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
import ScrollReveal from '../components/common/ScrollReveal';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';

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
      {/* Page header */}
      <PageHeader
        eyebrow="Institutional Filings"
        title="Cases"
        description="Review approval filings, examine evidentiary proof, and track statutory decisions."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => navigate('/applications/new')}
          >
            New Application
          </Button>
        }
      />

      {/* Unified KPI Ribbon */}
      <ScrollReveal stagger={1} className="bg-surface rounded-2xl border border-border overflow-hidden shadow-xs">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border">
          <button
            type="button"
            onClick={() => setStatusFilter('All')}
            className={`p-5 text-left transition-colors cursor-pointer ${statusFilter === 'All' ? 'bg-surface-elevated font-semibold' : 'hover:bg-surface-hover'
              }`}
          >
            <div className="text-xs sm:text-sm font-semibold text-text-secondary">All Active Cases</div>
            <div className="text-2xl sm:text-3xl font-bold text-text-primary mt-1 font-mono tracking-tight">{totalCount}</div>
            <div className="text-xs text-text-muted mt-1.5 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span>Full workload</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('Verified')}
            className={`p-5 text-left transition-colors cursor-pointer ${statusFilter === 'Verified' ? 'bg-surface-elevated font-semibold' : 'hover:bg-surface-hover'
              }`}
          >
            <div className="text-xs sm:text-sm font-semibold text-text-secondary">Verified Clear</div>
            <div className="text-2xl sm:text-3xl font-bold text-text-primary mt-1 font-mono tracking-tight">{verifiedCount}</div>
            <div className="text-xs text-text-muted mt-1.5 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-status-success" />
              <span>Zero violations</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('Discrepancy Detected')}
            className={`p-5 text-left transition-colors cursor-pointer ${statusFilter === 'Discrepancy Detected' ? 'bg-surface-elevated font-semibold' : 'hover:bg-surface-hover'
              }`}
          >
            <div className="text-xs sm:text-sm font-semibold text-text-secondary">Issues Flagged</div>
            <div className="text-2xl sm:text-3xl font-bold text-text-primary mt-1 font-mono tracking-tight">{reviewCount}</div>
            <div className="text-xs text-text-muted mt-1.5 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-status-error" />
              <span>Officer action needed</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('Missing Documents')}
            className={`p-5 text-left transition-colors cursor-pointer ${statusFilter === 'Missing Documents' ? 'bg-surface-elevated font-semibold' : 'hover:bg-surface-hover'
              }`}
          >
            <div className="text-xs sm:text-sm font-semibold text-text-secondary">Missing Documents</div>
            <div className="text-2xl sm:text-3xl font-bold text-text-primary mt-1 font-mono tracking-tight">{missingDocsCount}</div>
            <div className="text-xs text-text-muted mt-1.5 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-status-warning" />
              <span>Incomplete filing</span>
            </div>
          </button>
        </div>
      </ScrollReveal>

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
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'table' ? 'bg-surface text-accent shadow-xs' : 'text-text-muted hover:text-text-primary'
                }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Card Grid View"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'cards' ? 'bg-surface text-accent shadow-xs' : 'text-text-muted hover:text-text-primary'
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
        <ScrollReveal stagger={2} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedApplications.map((app) => (
              <div
                key={app.id}
                onClick={() => navigate(`/applications/${app.id}`)}
                className="bg-surface rounded-2xl border border-border p-5 hover:border-accent/40 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-lg bg-surface-elevated text-accent font-bold border border-border">
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
        </ScrollReveal>
      ) : (
        /* TABLE VIEW */
        <ScrollReveal stagger={2}>
          <DataTable
            columns={[
              {
                key: 'institutionName',
                label: 'Institution & program',
                sortable: true,
                render: (_, app) => (
                  <div>
                    <div className="font-medium text-text-primary group-hover:text-accent transition-colors">
                      {getDisplayName(app)}
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      {app.applicationType || 'Technical Approval'} &bull; {app.applicantName || 'Institutional Filing'}
                    </div>
                  </div>
                ),
              },
              {
                key: 'id',
                label: 'Case reference',
                sortable: true,
                render: (v) => (
                  <span className="font-mono font-medium text-text-secondary">{v}</span>
                ),
              },
              {
                key: 'intakeCapacity',
                label: 'Intake',
                sortable: true,
                render: (v) => (
                  <span className="font-mono text-text-secondary">{v ? `${v} seats` : 'Standard intake'}</span>
                ),
              },
              {
                key: 'documentCount',
                label: 'Documents',
                render: (v) => (
                  <span className="font-mono text-text-secondary">{v || 1} docs</span>
                ),
              },
              {
                key: 'complianceStatus',
                label: 'Compliance status',
                render: (_, app) => (
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
                ),
              },
              {
                key: 'actions',
                label: '',
                align: 'right',
                render: (_, app) => (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/applications/${app.id}`);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface border border-border hover:bg-accent hover:text-accent-foreground hover:border-accent text-xs font-semibold text-text-primary transition-colors cursor-pointer shadow-xs"
                  >
                    <span>Open case</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ),
              },
            ]}
            data={paginatedApplications}
            keyField="id"
            sortColumn={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            onRowClick={(app) => navigate(`/applications/${app.id}`)}
          />

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={sortedApplications.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          )}
        </ScrollReveal>
      )}
    </div>
  );
}
