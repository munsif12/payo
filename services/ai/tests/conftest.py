import json

import httpx
import pytest


def ok(data, status=200):
    return httpx.Response(status, json={"success": True, "data": data})


def err(status, code, message):
    return httpx.Response(status, json={"success": False, "code": code, "message": message})


class FakeBackend:
    """Programmable fake of the PAYO backend for httpx.MockTransport.

    routes: dict of (method, path) -> data | callable(request) -> Response
    Records every request for assertions.
    """

    def __init__(self):
        self.routes = {}
        self.requests = []

    def route(self, method, path, data=None, responder=None):
        self.routes[(method, path)] = responder or (lambda req: ok(data))

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        key = (request.method, request.url.path)
        if key in self.routes:
            return self.routes[key](request)
        return err(404, "NOT_FOUND", f"no fake route for {key}")

    @property
    def transport(self):
        return httpx.MockTransport(self.handler)


@pytest.fixture
def fake_backend():
    return FakeBackend()


def body_of(request: httpx.Request) -> dict:
    return json.loads(request.content.decode() or "{}")
