"""Tests for master roadmap JSON loading and validation."""

import pytest

from app.services.master_roadmap import (
    ROADMAPS_DIR,
    load_master_document,
    load_master_roadmap,
    resolve_role_key,
    validate_dependency_dag,
)


@pytest.mark.parametrize(
    "target_role,expected_key",
    [
        ("Backend Developer", "backend-developer"),
        ("Frontend Developer", "frontend-developer"),
        ("DevOps Engineer", "devops-engineer"),
        ("AI / ML Engineer", "ai-ml-engineer"),
    ],
)
def test_resolve_role_key(target_role, expected_key):
    assert resolve_role_key(target_role) == expected_key


def test_all_json_roadmaps_load_and_validate_dag():
    assert ROADMAPS_DIR.is_dir()
    json_files = list(ROADMAPS_DIR.glob("*.json"))
    assert len(json_files) >= 9

    for path in json_files:
        doc = load_master_document(path.stem)
        validate_dependency_dag(doc.phases)
        assert doc.phases
        node_ids = [node.id for phase in doc.phases for node in phase.nodes]
        assert len(node_ids) == len(set(node_ids)), f"duplicate ids in {path.name}"


def test_load_master_roadmap_returns_skill_path_plan():
    plan, doc = load_master_roadmap("Backend Developer")
    assert plan.phases
    assert doc.role_key == "backend-developer"
    skills = [node.skill for phase in plan.phases for node in phase.nodes]
    assert "Python" in skills
    assert "Git" in skills
