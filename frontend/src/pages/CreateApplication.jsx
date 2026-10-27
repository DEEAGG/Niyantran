import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Building2, CheckCircle2, ShieldAlert, AlertTriangle, FileText, Info } from 'lucide-react';
import { applicationService } from '../services/applicationService';
import { useToast } from '../context/ToastContext';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import Textarea from '../components/common/Textarea';
import Badge from '../components/common/Badge';
import { REQUIREMENT_MAP } from '../constants/requirementMap';

// RequirementPreview Component
function RequirementPreview({ applicationType }) {
  const mapping = REQUIREMENT_MAP[applicationType];
  if (!mapping) return null;

  if (!mapping.supported) {
    return (
      <div className="rounded-xl border border-[var(--status-pending)]/40 bg-[var(--status-pending)]/5 p-4 space-y-2">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--status-pending)' }} />
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: 'var(--status-pending)' }}>
              Statutory Gazette Adjudication Required
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              {mapping.note}
            </p>
            <p className="text-[11px] text-text-muted mt-2 italic">
              Automated document checklists for this category require compliance officer review against the Approval Process Handbook.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Supported type — show requirements
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-text-primary">
            Required Documents Preview
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info" size="sm">{mapping.sourceDocument}</Badge>
          <Badge variant="neutral" size="sm">v{mapping.version}</Badge>
        </div>
      </div>

      {mapping.disclaimer && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-accent/5 border border-accent/20">
          <Info className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
          <p className="text-[10px] text-text-muted leading-snug">{mapping.disclaimer}</p>
        </div>
      )}

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-surface-elevated/50 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-mono uppercase text-text-muted">Document</th>
              <th className="px-3 py-2 text-left text-[10px] font-mono uppercase text-text-muted">Clause</th>
              <th className="px-3 py-2 text-left text-[10px] font-mono uppercase text-text-muted">Period</th>
              <th className="px-3 py-2 text-right text-[10px] font-mono uppercase text-text-muted">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {mapping.requirements.map((req) => (
              <tr key={req.id} className="hover:bg-surface-elevated/30 transition-colors">
                <td className="px-3 py-2.5">
                  <div className="font-medium text-text-primary">{req.document}</div>
                  <div className="text-[10px] font-mono text-text-muted mt-0.5">{req.id}</div>
                </td>
                <td className="px-3 py-2.5 font-mono text-accent text-[11px]">{req.clause}</td>
                <td className="px-3 py-2.5 text-text-muted text-[11px]">{req.effectivePeriod}</td>
                <td className="px-3 py-2.5 text-right">
                  {req.required ? (
                    <Badge variant="error" size="sm">Required</Badge>
                  ) : req.conditionNotes ? (
                    <Badge variant="warning" size="sm">Conditional</Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">N.A.</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CreateApplication() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    institutionName: '',
    institutionCode: '',
    applicationType: 'Extension of Approval (EoA)',
    academicYear: '2026-2027',
    contactEmail: '',
    contactPhone: '',
    address: '',
    intakeCapacity: '60',
  });

  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!formData.institutionName.trim()) {
      errs.institutionName = 'Institution Name is required';
    }
    if (!formData.institutionCode.trim()) {
      errs.institutionCode = 'Institution Code is required (e.g. INST-1055)';
    } else if (!/^INST-\d{4}$/i.test(formData.institutionCode.trim())) {
      errs.institutionCode = 'Format must be INST-XXXX (e.g. INST-1055)';
    }
    if (!formData.contactEmail.trim()) {
      errs.contactEmail = 'Contact email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.contactEmail)) {
      errs.contactEmail = 'Please provide a valid institutional email';
    }
    if (!formData.contactPhone.trim()) {
      errs.contactPhone = 'Contact phone is required';
    }
    if (!formData.address.trim()) {
      errs.address = 'Full campus address is required';
    }
    if (!formData.intakeCapacity || Number(formData.intakeCapacity) <= 0) {
      errs.intakeCapacity = 'Sanctioned intake capacity must be greater than 0';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      const res = await applicationService.createApplication(formData);
      addToast(`Application ${res.data.id} registered for ${res.data.institutionName}.`, 'success');
      navigate(`/applications/${res.data.id}`);
    } catch (err) {
      addToast(err.message || 'Failed to submit application', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const APPLICATION_TYPES = [
    'Extension of Approval (EoA)',
    'New Institution',
    'New Technical Institution',
    'Increase in Intake Capacity',
    'Introduction of New Programs',
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <Link
            to="/applications"
            className="p-2 rounded-lg border border-border bg-surface text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
              Register Institutional Application
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              Initiate a statutory compliance submission for AICTE approval evaluation.
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-border/60">
          <Building2 className="w-4 h-4 text-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
            Institution &amp; Academic Details
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input
              label="Legal Institution Name"
              required
              placeholder="e.g. National Institute of Technical Sciences"
              value={formData.institutionName}
              onChange={(e) => handleChange('institutionName', e.target.value)}
              error={errors.institutionName}
            />
          </div>

          <div>
            <Input
              label="AICTE Institution Code"
              required
              placeholder="INST-1042"
              value={formData.institutionCode}
              onChange={(e) => handleChange('institutionCode', e.target.value.toUpperCase())}
              error={errors.institutionCode}
              helperText="Format: INST-XXXX"
            />
          </div>

          <div>
            <Input
              label="Sanctioned Intake Capacity"
              type="number"
              required
              placeholder="60"
              value={formData.intakeCapacity}
              onChange={(e) => handleChange('intakeCapacity', e.target.value)}
              error={errors.intakeCapacity}
              helperText="Seats per division"
            />
          </div>

          <div>
            <Select
              label="Application Type"
              required
              value={formData.applicationType}
              onChange={(e) => handleChange('applicationType', e.target.value)}
              options={APPLICATION_TYPES}
            />
          </div>

          <div>
            <Select
              label="Academic Session"
              required
              value={formData.academicYear}
              onChange={(e) => handleChange('academicYear', e.target.value)}
              options={['2026-2027', '2025-2026']}
            />
          </div>
        </div>

        {/* Requirement Preview — shown after application type selected */}
        <div className="pt-2 pb-1 border-t border-border/40 space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <ShieldAlert className="w-3 h-3" />
            Regulatory Document Requirements Preview
          </div>
          <RequirementPreview applicationType={formData.applicationType} />
        </div>

        <div className="flex items-center gap-2 pt-4 pb-2 border-b border-border/60">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
            Contact &amp; Campus Location
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Input
              label="Institutional Contact Email"
              type="email"
              required
              placeholder="registrar@institution.edu.in"
              value={formData.contactEmail}
              onChange={(e) => handleChange('contactEmail', e.target.value)}
              error={errors.contactEmail}
            />
          </div>

          <div>
            <Input
              label="Contact Phone Number"
              required
              placeholder="+91 98765 43210"
              value={formData.contactPhone}
              onChange={(e) => handleChange('contactPhone', e.target.value)}
              error={errors.contactPhone}
            />
          </div>

          <div className="md:col-span-2">
            <Textarea
              label="Campus Address & Postal PIN"
              required
              rows={3}
              placeholder="Survey No. 42, Knowledge Park III, Greater Noida, Uttar Pradesh 201306"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              error={errors.address}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-border/60 flex items-center justify-between">
          <Link to="/applications">
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </Link>

          <Button
            type="submit"
            variant="primary"
            size="md"
            icon={Save}
            isLoading={submitting}
            className="shadow-lg shadow-accent/20"
          >
            Register Application
          </Button>
        </div>
      </form>
    </div>
  );
}
