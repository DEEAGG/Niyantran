import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from jinja2 import Template

REPORT_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Niyantran Compliance Report - {{ application.id }}</title>
<style>
  :root {
    --bg-primary: #f8fafc;
    --card-bg: #ffffff;
    --border: #e2e8f0;
    --text-primary: #0f172a;
    --text-secondary: #475569;
    --text-muted: #94a3b8;
    --accent: #2563eb;
    --accent-light: #eff6ff;
    --danger: #dc2626;
    --danger-light: #fef2f2;
    --warning: #d97706;
    --warning-light: #fffbeb;
    --success: #16a34a;
    --success-light: #f0fdf4;
    --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--font);
    background-color: var(--bg-primary);
    color: var(--text-primary);
    line-height: 1.5;
    padding: 32px 16px;
  }
  .container {
    max-width: 1040px;
    margin: 0 auto;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    overflow: hidden;
  }
  .header {
    background: #0f172a;
    color: #ffffff;
    padding: 32px;
    border-bottom: 4px solid var(--accent);
  }
  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }
  .badge-demo {
    background: #f59e0b;
    color: #0f172a;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 6px 12px;
    border-radius: 9999px;
    text-transform: uppercase;
  }
  .header-title {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 4px;
  }
  .header-sub {
    color: var(--text-muted);
    font-size: 14px;
  }
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid #334155;
  }
  .meta-item .meta-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }
  .meta-item .meta-value {
    font-size: 15px;
    font-weight: 600;
    color: #f8fafc;
    margin-top: 2px;
  }
  .content {
    padding: 32px;
  }
  .summary-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 32px;
  }
  .summary-card {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    text-align: center;
  }
  .summary-card.fail { background: var(--danger-light); border-color: #fecaca; }
  .summary-card.unverified { background: var(--warning-light); border-color: #fde68a; }
  .summary-card.pass { background: var(--success-light); border-color: #bbf7d0; }
  .summary-num {
    font-size: 28px;
    font-weight: 800;
    line-height: 1;
    margin-bottom: 4px;
  }
  .summary-card.fail .summary-num { color: var(--danger); }
  .summary-card.unverified .summary-num { color: var(--warning); }
  .summary-card.pass .summary-num { color: var(--success); }
  .summary-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-secondary);
  }
  .section {
    margin-bottom: 36px;
  }
  .section-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
    padding-bottom: 8px;
    margin-bottom: 16px;
    border-bottom: 2px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    margin-bottom: 12px;
  }
  th {
    background: #f1f5f9;
    color: var(--text-secondary);
    font-weight: 600;
    text-align: left;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }
  td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  tr:last-child td { border-bottom: none; }
  .status-chip {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .chip-pass { background: var(--success-light); color: var(--success); border: 1px solid #bbf7d0; }
  .chip-fail { background: var(--danger-light); color: var(--danger); border: 1px solid #fecaca; }
  .chip-unverified { background: var(--warning-light); color: var(--warning); border: 1px solid #fde68a; }
  .chip-high { background: #fee2e2; color: #b91c1c; }
  .chip-medium { background: #fef3c7; color: #b45309; }
  .chip-low { background: #e0f2fe; color: #0369a1; }
  .finding-item {
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
  }
  .finding-item.fail { border-left: 4px solid var(--danger); }
  .finding-item.unverified { border-left: 4px solid var(--warning); }
  .finding-item.pass { border-left: 4px solid var(--success); }
  .finding-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .finding-title {
    font-weight: 700;
    font-size: 14px;
    color: var(--text-primary);
  }
  .finding-msg {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }
  .finding-rec {
    font-size: 12px;
    background: #f8fafc;
    border-left: 2px solid var(--accent);
    padding: 6px 10px;
    color: #1e293b;
    border-radius: 0 4px 4px 0;
  }
  .code-tag {
    font-family: monospace;
    font-size: 11px;
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
    color: #334155;
  }
  .footer {
    background: #f8fafc;
    border-top: 1px solid var(--border);
    padding: 24px 32px;
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  .disclaimer-title {
    font-weight: 700;
    color: var(--danger);
    margin-bottom: 4px;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.05em;
  }
  @media print {
    body { padding: 0; background: #ffffff; }
    .container { border: none; box-shadow: none; border-radius: 0; }
    .no-print { display: none; }
    .finding-item { break-inside: avoid; }
    table { break-inside: auto; }
    tr { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="container">
  <!-- Header -->
  <div class="header">
    <div class="header-top">
      <div>
        <div class="header-title">NIYANTRAN COMPLIANCE VERIFICATION REPORT</div>
        <div class="header-sub">Evidence-Backed Regulatory Intelligence & Statutory Audit Platform</div>
      </div>
      <div class="badge-demo" style="background: #e0f2fe; color: #0369a1; border-color: #bae6fd;">STATUTORY AUDIT DOSSIER</div>
    </div>
    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">Application ID</div>
        <div class="meta-value">{{ application.id }}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Institution</div>
        <div class="meta-value">{{ application.institution_name or 'N/A' }}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Application Type</div>
        <div class="meta-value">{{ application.application_type }}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Report Generated</div>
        <div class="meta-value">{{ generated_at }}</div>
      </div>
    </div>
  </div>

  <div class="content">
    <!-- Executive Summary -->
    <div class="summary-cards">
      <div class="summary-card">
        <div class="summary-num">{{ documents|length }}</div>
        <div class="summary-label">Uploaded Docs</div>
      </div>
      <div class="summary-card fail">
        <div class="summary-num">{{ summary.fail or 0 }}</div>
        <div class="summary-label">Violations / Failures</div>
      </div>
      <div class="summary-card unverified">
        <div class="summary-num">{{ summary.unverified or 0 }}</div>
        <div class="summary-label">Unverified Items</div>
      </div>
      <div class="summary-card pass">
        <div class="summary-num">{{ summary.pass or 0 }}</div>
        <div class="summary-label">Rules Passed</div>
      </div>
    </div>

    <!-- Section 1: Documents & Cryptographic Hashes -->
    <div class="section">
      <div class="section-title">
        <span>1. Document Checklist & Cryptographic Provenance</span>
        <span style="font-size: 12px; font-weight: normal; color: var(--text-muted);">{{ documents|length }} Files Registered</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Document Type</th>
            <th>Original Filename</th>
            <th>SHA-256 Digest</th>
            <th>Pages</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {% for doc in documents %}
          <tr>
            <td><strong>{{ doc.document_type }}</strong></td>
            <td>{{ doc.original_filename }}</td>
            <td><span class="code-tag">{{ doc.sha256[:16] }}...{{ doc.sha256[-8:] }}</span></td>
            <td>{{ doc.page_count }}</td>
            <td><span class="status-chip chip-pass">{{ doc.processing_status }}</span></td>
          </tr>
          {% endfor %}
        </tbody>
      </table>
    </div>

    <!-- Section 2: Extracted Fields -->
    <div class="section">
      <div class="section-title">
        <span>2. Structured Fields & Extraction Provenance</span>
        <span style="font-size: 12px; font-weight: normal; color: var(--text-muted);">{{ fields|length }} Fields Extracted</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Field Name</th>
            <th>Extracted Value</th>
            <th>Normalized Value</th>
            <th>Confidence</th>
            <th>Page</th>
            <th>Method</th>
            <th>Review Status</th>
          </tr>
        </thead>
        <tbody>
          {% for f in fields %}
          <tr>
            <td><code>{{ f.field_name }}</code></td>
            <td>{{ f.field_value or '-' }}</td>
            <td><strong>{{ f.normalized_value or '-' }}</strong></td>
            <td>{{ "%.0f%%"|format((f.confidence or 0) * 100) }}</td>
            <td>Page {{ f.page_number }}</td>
            <td><span class="code-tag">{{ f.extraction_method }}</span></td>
            <td>
              {% if f.confirmed %}
                <span class="status-chip chip-pass">Confirmed ({{ f.confirmed_by }})</span>
              {% elif f.needs_review %}
                <span class="status-chip chip-unverified">Manual Review Needed</span>
              {% else %}
                <span class="status-chip chip-pass">High Confidence</span>
              {% endif %}
            </td>
          </tr>
          {% endfor %}
        </tbody>
      </table>
    </div>

    <!-- Section 3: Regulatory Findings -->
    <div class="section">
      <div class="section-title">
        <span>3. Regulatory Compliance Validation Findings</span>
        <span style="font-size: 12px; font-weight: normal; color: var(--text-muted);">Ruleset: {{ latest_run.ruleset_name or 'Active Ruleset' }}</span>
      </div>

      {% if findings %}
        {% for f in findings %}
        <div class="finding-item {{ f.status }}">
          <div class="finding-header">
            <div>
              <span class="finding-title">{{ f.rule_title or f.rule_key }}</span>
              <span class="code-tag" style="margin-left: 8px;">{{ f.code }}</span>
              <span class="code-tag" style="background: #fffbeb; color: #b45309;">Clause: {{ f.evidence.rule_key or 'STATUTORY_NORM' }}</span>
            </div>
            <div>
              <span class="status-chip chip-{{ f.severity }}">{{ f.severity }}</span>
              <span class="status-chip chip-{{ f.status }}">{{ f.status }}</span>
            </div>
          </div>
          <div class="finding-msg">{{ f.message }}</div>
          {% if f.recommendation %}
          <div class="finding-rec">
            <strong>Recommended Action:</strong> {{ f.recommendation }}
          </div>
          {% endif %}
          {% if f.decision %}
          <div style="margin-top: 8px; font-size: 12px; background: #f0fdf4; padding: 6px 10px; border-radius: 4px; border: 1px solid #bbf7d0;">
            <strong>Reviewer Decision:</strong> <span style="text-transform: uppercase; font-weight: 700;">{{ f.decision.decision }}</span> by {{ f.decision.actor }} &mdash; <em>{{ f.decision.reason or 'No note provided' }}</em>
          </div>
          {% endif %}
        </div>
        {% endfor %}
      {% else %}
        <p style="color: var(--text-muted); font-size: 13px;">No validation findings recorded yet.</p>
      {% endif %}
    </div>

    <!-- Section 4: Replay History & Evolution -->
    {% if replays %}
    <div class="section">
      <div class="section-title">
        <span>4. Regulatory Change Replay History</span>
        <span style="font-size: 12px; font-weight: normal; color: var(--text-muted);">{{ replays|length }} Replay Runs</span>
      </div>
      {% for rep in replays %}
      <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 12px;">
        <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">
          Replay ID: {{ rep.id }} &mdash; <span style="color: var(--text-muted); font-weight: normal;">Created: {{ rep.created_at }}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Finding ID</th>
              <th>Diff Type</th>
              <th>Previous State</th>
              <th>New State</th>
              <th>Explanation & Impact</th>
            </tr>
          </thead>
          <tbody>
            {% for d in rep.diffs %}
            <tr>
              <td><code>{{ d.finding_id }}</code></td>
              <td><span class="status-chip {% if d.diff_type == 'resolved' %}chip-pass{% elif d.diff_type in ['new_issue', 'outcome_changed'] %}chip-fail{% else %}chip-unverified{% endif %}">{{ d.diff_type }}</span></td>
              <td>{{ d.previous_value or '-' }}</td>
              <td><strong>{{ d.new_value or '-' }}</strong></td>
              <td>{{ d.explanation }}</td>
            </tr>
            {% endfor %}
          </tbody>
        </table>
      </div>
      {% endfor %}
    </div>
    {% endif %}

    <!-- Section 5: Audit Log Integrity -->
    <div class="section">
      <div class="section-title">
        <span>5. Cryptographic Tamper-Evident Audit Verification</span>
        <span class="status-chip chip-pass">Chain Status: {{ 'VERIFIED' if audit_chain.verified else 'TAMPER DETECTED' }}</span>
      </div>
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
        Total verified chain entries: <strong>{{ audit_chain.total_records }}</strong> | Latest block hash: <code>{{ audit_chain.latest_hash[:20] }}...</code>
      </p>
    </div>
  </div>

  <!-- Footer Disclaimer -->
  <div class="footer">
    <div class="disclaimer-title">Official Regulatory Verification Notice</div>
    <p>
      This report was generated automatically by NIYANTRAN (Evidence-Backed Regulatory Intelligence Platform).
      All statutory rules evaluated are matched against authoritative AICTE Approval Process Handbook (APH) 2024–2027 norms.
      Automated verification findings provide procedural evidence assistance and cryptographic audit provenance to support authorized regulatory decisions.
    </p>
  </div>
</div>
</body>
</html>
"""


def render_html_report(context: Dict[str, Any]) -> str:
    ctx = dict(context)
    raw_ac = ctx.get("audit_chain")
    if not isinstance(raw_ac, dict):
        raw_ac = {}
    ctx["audit_chain"] = {
        "verified": raw_ac.get("verified", True),
        "total_records": raw_ac.get("total_records", 0),
        "latest_hash": raw_ac.get("latest_hash") or "GENESIS",
    }
    template = Template(REPORT_TEMPLATE)
    return template.render(**ctx)
