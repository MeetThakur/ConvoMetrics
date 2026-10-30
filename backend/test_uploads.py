import unittest
from unittest.mock import patch

from fastapi import HTTPException
from starlette.datastructures import Headers
from starlette.requests import Request

from backend.main import MemoryUploadParser, analyze_chat


def multipart(payload):
    return (
        b'--test\r\nContent-Disposition: form-data; name="file"; filename="chat.txt"\r\n\r\n'
        + payload + b'\r\n--test--\r\n'
    )


def upload_request(payload):
    body = multipart(payload)

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    return Request({
        "type": "http", "method": "POST", "path": "/api/analyze",
        "headers": [(b"content-type", b"multipart/form-data; boundary=test")],
    }, receive)


class UploadTests(unittest.IsolatedAsyncioTestCase):
    async def test_large_upload_stays_in_memory(self):
        async def stream():
            yield multipart(b"a" * (1024 * 1024 + 1))

        form = await MemoryUploadParser(
            Headers({"content-type": "multipart/form-data; boundary=test"}), stream()
        ).parse()
        try:
            self.assertFalse(form["file"].file._rolled)
        finally:
            await form.close()

    async def test_large_whitespace_continuation_is_analyzed(self):
        payload = b"01/20/2024, 10:00 - A: hello\n" + b" " * (1024 * 1024 + 1)
        result = await analyze_chat(upload_request(payload))
        self.assertEqual(result["overview"]["total_messages"], 1)
        self.assertEqual(result["overview"]["total_words"], 1)

    async def test_file_limit(self):
        with patch("backend.main.MAX_FILE_SIZE", 64):
            with self.assertRaises(HTTPException) as error:
                await analyze_chat(upload_request(b"a" * 65))
        self.assertEqual(error.exception.status_code, 413)

    async def test_body_limit_before_multipart_parsing(self):
        with patch("backend.main.MAX_FILE_SIZE", 64):
            with self.assertRaises(HTTPException) as error:
                await analyze_chat(upload_request(b"a" * (64 + 64 * 1024)))
        self.assertEqual(error.exception.status_code, 413)


if __name__ == "__main__":
    unittest.main()
