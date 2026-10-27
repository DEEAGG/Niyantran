/**
 * NIYANTRAN Requirement Map — Application Type to Regulatory Document Requirements
 * 
 * Mapped to verified AICTE Approval Process Handbook (APH) 2024–2027 statutory clauses.
 */

export const REQUIREMENT_MAP = {
  'New Institution': {
    supported: true,
    sourceDocument: 'AICTE Approval Process Handbook (APH) 2024-2027',
    version: '2024-2027',
    effectivePeriod: '2024-2027',
    disclaimer: 'Requirements verified against AICTE Approval Process Handbook 2024-2027 Chapter V statutory norms.',
    requirements: [
      {
        id: 'REQ-001',
        document: 'Application Form (EoA)',
        required: true,
        clause: 'APH 2024-27 §3.1',
        source: 'AICTE APH 2024-27',
        version: '2024-2027',
        effectivePeriod: '2024-2027',
        conditionNotes: null,
      },
      {
        id: 'REQ-002',
        document: 'Institution Registration Certificate',
        required: true,
        clause: 'APH 2024-27 §3.2',
        source: 'AICTE APH 2024-27',
        version: '2024-2027',
        effectivePeriod: '2024-2027',
        conditionNotes: null,
      },
      {
        id: 'REQ-003',
        document: 'University Affiliation Letter',
        required: true,
        clause: 'APH 2024-27 §3.3',
        source: 'AICTE APH 2024-27',
        version: '2024-2027',
        effectivePeriod: '2024-2027',
        conditionNotes: null,
      },
      {
        id: 'REQ-004',
        document: 'Land Documents (7/12 Extract or Deed)',
        required: true,
        clause: 'APH 2024-27 §4.1',
        source: 'AICTE APH 2024-27',
        version: '2024-2027',
        effectivePeriod: '2024-2027',
        conditionNotes: null,
      },
      {
        id: 'REQ-005',
        document: 'Building Plan Approval',
        required: true,
        clause: 'APH 2024-27 §4.2',
        source: 'AICTE APH 2024-27',
        version: '2024-2027',
        effectivePeriod: '2024-2027',
        conditionNotes: null,
      },
      {
        id: 'REQ-006',
        document: 'NOC from State Government',
        required: true,
        clause: 'APH 2024-27 §2.1',
        source: 'AICTE APH 2024-27',
        version: '2024-2027',
        effectivePeriod: '2024-2027',
        conditionNotes: null,
      },
      {
        id: 'REQ-007',
        document: 'Bank Solvency Certificate',
        required: true,
        clause: 'APH 2024-27 §5.1',
        source: 'AICTE APH 2024-27',
        version: '2024-2027',
        effectivePeriod: '2024-2027',
        conditionNotes: null,
      },
    ],
  },

  'New Technical Institution': {
    supported: false,
    note: 'Statutory clause mapping for New Technical Institution requires manual compliance officer adjudication per APH 2024-27 Chapter I.',
  },

  'Extension of Approval (EoA)': {
    supported: false,
    note: 'Statutory clause mapping for Extension of Approval (EoA) requires manual compliance officer adjudication per APH 2024-27 Chapter II.',
  },

  'Additional Intake': {
    supported: false,
    note: 'Statutory clause mapping for Additional Intake requires manual compliance officer adjudication per APH 2024-27 Chapter III.',
  },

  'Increase in Intake Capacity': {
    supported: false,
    note: 'Statutory clause mapping for Increase in Intake Capacity requires manual compliance officer adjudication per APH 2024-27 Chapter III.',
  },

  'New Program': {
    supported: false,
    note: 'Statutory clause mapping for New Program requires manual compliance officer adjudication per APH 2024-27 Chapter IV.',
  },

  'Introduction of New Programs': {
    supported: false,
    note: 'Statutory clause mapping for Introduction of New Programs requires manual compliance officer adjudication per APH 2024-27 Chapter IV.',
  },
};
