import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

from app.db import add_audit_entry


def classify_diff(old_f: Optional[Dict[str, Any]], new_f: Optional[Dict[str, Any]]) -> Tuple[str, bool, str]:
    """
    Returns (diff_type, needs_attention, explanation)
    """
    if old_f is None and new_f is not None:
        if new_f["status"] == "fail":
            return "new_issue", True, f"New violation under updated ruleset: {new_f['message']}"
        elif new_f["status"] == "unverified":
            return "outcome_changed", True, f"New unverified requirement under updated ruleset: {new_f['message']}"
        else:
            return "unchanged", False, f"Rule passed under updated ruleset: {new_f['message']}"

    if old_f is not None and new_f is None:
        return "rule_removed", False, "Rule was retired or omitted in the updated ruleset."

    # Both exist
    old_status = old_f["status"]
    new_status = new_f["status"]
    old_sev = old_f.get("severity", "medium")
    new_sev = new_f.get("severity", "medium")

    if old_status == "fail" and new_status == "pass":
        return "resolved", False, f"Previously failing condition is now satisfied: {new_f['message']}"
    elif old_status == "fail" and new_status == "unverified":
        return "outcome_changed", True, f"Status changed from 'fail' to 'unverified': {new_f['message']}"
    elif old_status == "pass" and new_status == "fail":
        return "new_issue", True, f"New non-compliance under updated rule parameters: {new_f['message']}"
    elif old_status != new_status:
        return "outcome_changed", True, f"Outcome changed from '{old_status}' to '{new_status}': {new_f['message']}"
    elif old_sev != new_sev:
        return "severity_changed", (new_status in ("fail", "unverified")), f"Rule severity changed from '{old_sev}' to '{new_sev}'."
    else:
        return "unchanged", False, f"Outcome remained consistent ({new_status})."


def execute_replay_for_application(
    conn,
    application_id: str,
    to_ruleset_id: str,
    from_ruleset_id: Optional[str] = None,
    actor: str = "local-reviewer",
    validate_func = None,
) -> Dict[str, Any]:
    # 1. Resolve old validation run
    if from_ruleset_id:
        old_run = conn.execute(
            "SELECT * FROM validation_runs WHERE application_id = ? AND ruleset_id = ? ORDER BY started_at DESC LIMIT 1",
            (application_id, from_ruleset_id),
        ).fetchone()
    else:
        old_run = conn.execute(
            "SELECT * FROM validation_runs WHERE application_id = ? ORDER BY started_at DESC LIMIT 1",
            (application_id,),
        ).fetchone()

    # If no prior validation exists, run it under from_ruleset_id (or active ruleset)
    if not old_run:
        base_rs = from_ruleset_id
        if not base_rs:
            act_rs = conn.execute("SELECT id FROM rulesets WHERE status = 'active' ORDER BY version DESC LIMIT 1").fetchone()
            base_rs = act_rs["id"] if act_rs else None
        if base_rs and validate_func:
            old_run_res = validate_func(application_id, ruleset_id=base_rs, actor=actor)
            old_run = conn.execute("SELECT * FROM validation_runs WHERE id = ?", (old_run_res["id"],)).fetchone()

    if not old_run:
        raise ValueError("Cannot perform replay: no baseline validation run found and unable to generate one.")

    # 2. Execute new validation run under to_ruleset_id (preserving all old runs)
    if validate_func:
        new_run_res = validate_func(application_id, ruleset_id=to_ruleset_id, actor=actor)
        new_run = conn.execute("SELECT * FROM validation_runs WHERE id = ?", (new_run_res["id"],)).fetchone()
    else:
        raise ValueError("validate_func required to execute validation for target ruleset.")

    # 3. Load findings for both runs
    old_findings_rows = conn.execute(
        """
        SELECT f.*, r.rule_key, r.title, r.rule_type
        FROM findings f
        JOIN rules r ON f.rule_id = r.id
        WHERE f.validation_run_id = ?
        """,
        (old_run["id"],),
    ).fetchall()

    new_findings_rows = conn.execute(
        """
        SELECT f.*, r.rule_key, r.title, r.rule_type
        FROM findings f
        JOIN rules r ON f.rule_id = r.id
        WHERE f.validation_run_id = ?
        """,
        (new_run["id"],),
    ).fetchall()

    def parse_f(r):
        ev = {}
        if r["evidence_json"]:
            try:
                ev = json.loads(r["evidence_json"])
            except Exception:
                pass
        fp = ev.get("fingerprint") or f"{r['rule_key']}:{ev.get('subject', '')}"
        return {
            "id": r["id"],
            "rule_id": r["rule_id"],
            "rule_key": r["rule_key"],
            "title": r["title"],
            "status": r["status"],
            "severity": r["severity"],
            "message": r["message"],
            "recommendation": r["recommendation"],
            "evidence": ev,
            "fingerprint": fp,
        }

    old_by_fp = {parse_f(r)["fingerprint"]: parse_f(r) for r in old_findings_rows}
    new_by_fp = {parse_f(r)["fingerprint"]: parse_f(r) for r in new_findings_rows}

    # 4. Create replay record
    replay_id = f"RPLY-{uuid.uuid4().hex[:12].upper()}"
    now = datetime.now(timezone.utc).isoformat()

    conn.execute(
        """
        INSERT INTO replays (id, application_id, previous_validation_run_id, new_validation_run_id, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (replay_id, application_id, old_run["id"], new_run["id"], "completed", now),
    )

    diffs = []
    all_fps = set(old_by_fp.keys()) | set(new_by_fp.keys())

    for fp in all_fps:
        o = old_by_fp.get(fp)
        n = new_by_fp.get(fp)
        diff_type, needs_att, explanation = classify_diff(o, n)

        diff_id = f"DIFF-{uuid.uuid4().hex[:12].upper()}"
        target_f = n if n is not None else o
        prev_val_str = f"status: {o['status']}, severity: {o['severity']}" if o else "none"
        new_val_str = f"status: {n['status']}, severity: {n['severity']}" if n else "none"

        conn.execute(
            """
            INSERT INTO replay_diffs (id, replay_id, finding_id, diff_type, previous_value, new_value, explanation)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (diff_id, replay_id, target_f["id"], diff_type, prev_val_str, new_val_str, explanation),
        )

        diffs.append({
            "id": diff_id,
            "replay_id": replay_id,
            "finding_id": target_f["id"],
            "rule_key": target_f.get("rule_key"),
            "fingerprint": fp,
            "diff_type": diff_type,
            "previous_outcome": o["status"] if o else None,
            "new_outcome": n["status"] if n else None,
            "previous_value": prev_val_str,
            "new_value": new_val_str,
            "explanation": explanation,
            "needs_attention": needs_att,
        })

    changed_count = sum(1 for d in diffs if d["diff_type"] != "unchanged")

    # 5. Audit log
    add_audit_entry(
        conn=conn,
        event_type="REPLAY_COMPLETED",
        entity_type="replay",
        entity_id=replay_id,
        event_data={
            "application_id": application_id,
            "previous_validation_run_id": old_run["id"],
            "new_validation_run_id": new_run["id"],
            "total_diffs": len(diffs),
            "changed_count": changed_count,
        },
        actor=actor,
    )

    return {
        "id": replay_id,
        "application_id": application_id,
        "previous_validation_run_id": old_run["id"],
        "new_validation_run_id": new_run["id"],
        "status": "completed",
        "created_at": now,
        "has_changes": (changed_count > 0),
        "total_rules_compared": len(diffs),
        "changed_rules_count": changed_count,
        "diffs": diffs,
    }
