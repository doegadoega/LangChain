import pytest
from app.store import FileStore


@pytest.fixture
def store(tmp_path):
    return FileStore(base_dir=tmp_path)


def test_save_and_load_agents(store):
    agent = {"id": "test-agent", "name": "Test", "org_roles": ["worker"]}
    store.save_agent(agent)
    agents = store.load_agents()
    assert len(agents) == 1
    assert agents[0]["id"] == "test-agent"


def test_save_and_load_projects(store):
    project = {"id": "proj-1", "name": "Test Project", "working_directory": "/tmp", "status": "active"}
    store.save_project(project)
    projects = store.load_projects()
    assert len(projects) == 1
    assert projects[0]["name"] == "Test Project"


def test_delete_agent(store):
    agent = {"id": "del-me", "name": "Delete"}
    store.save_agent(agent)
    assert len(store.load_agents()) == 1
    store.delete_agent("del-me")
    assert len(store.load_agents()) == 0
