import pytest

from app.backend_client import BackendClient, BackendError
from tests.conftest import ok, err

pytestmark = pytest.mark.asyncio


async def test_me_happy_path(fake_backend):
    fake_backend.route("GET", "/api/v1/me", {"user": {"name": "Ammi Jaan"}, "account": {"balancePaisa": 8_450_000}})
    client = BackendClient("jwt-123", transport=fake_backend.transport)
    data = await client.me()
    assert data["account"]["balancePaisa"] == 8_450_000
    assert fake_backend.requests[0].headers["Authorization"] == "Bearer jwt-123"
    await client.aclose()


async def test_api_error_maps_to_backend_error(fake_backend):
    fake_backend.route("GET", "/api/v1/me", responder=lambda req: err(401, "UNAUTHORIZED", "Invalid token"))
    client = BackendClient("bad", transport=fake_backend.transport)
    with pytest.raises(BackendError) as e:
        await client.me()
    assert e.value.code == "UNAUTHORIZED"
    assert e.value.status == 401
    await client.aclose()
