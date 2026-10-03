import json
import unittest
from unittest.mock import patch

from app import OLLAMA_MODEL, app


class AIServiceTests(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    @patch("app.call_ollama")
    def test_health_reports_model_availability(self, _mock_ollama):
        _mock_ollama.return_value = {"models": [{"name": OLLAMA_MODEL}]}
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json["ollama"]["reachable"])
        self.assertTrue(response.json["ollama"]["modelAvailable"])

    @patch("app.call_ollama")
    def test_chat_uses_retrieved_evidence_and_trusted_citations(self, mock_ollama):
        mock_ollama.return_value = {
            "message": {
                "content": json.dumps({"answer": "The story covers a benchmark.", "sourceIndices": [1, 50]})
            }
        }
        article = {
            "title": "A research benchmark",
            "url": "https://publisher.example/report",
            "source": "Example Publisher",
            "description": "The publisher describes an evaluation benchmark.",
            "category": "Research",
        }
        response = self.client.post("/chat", json={
            "messages": [{"role": "user", "content": "What is this about?"}],
            "articles": [article],
        })

        prompt = mock_ollama.call_args.args[1]["messages"][0]["content"]
        self.assertIn("evaluation benchmark", prompt)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["sources"][0]["url"], article["url"])
        self.assertEqual(len(response.json["sources"]), 1)

    def test_chat_requires_retrieved_articles(self):
        response = self.client.post("/chat", json={
            "messages": [{"role": "user", "content": "Tell me the news"}],
            "articles": [],
        })

        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()