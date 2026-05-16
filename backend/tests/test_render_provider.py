import unittest
from unittest.mock import patch, MagicMock
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from integrations.providers.render_provider import RenderProvider

class TestRenderProvider(unittest.TestCase):
    def setUp(self):
        self.provider = RenderProvider()
        self.provider.api_key = "test_key"

    @patch('requests.post')
    def test_deploy_success(self, mock_post):
        mock_post.return_value.status_code = 201
        mock_post.return_value.json.return_value = {
            "service": {"id": "srv-123", "serviceDetails": {"url": "https://test.render.com"}}
        }
        
        res = self.provider.deploy("test-proj", "https://github.com/test/repo", "React")
        
        self.assertTrue(res["success"])
        self.assertEqual(res["provider_deployment_id"], "srv-123")
        self.assertEqual(res["deployment_url"], "https://test.render.com")

    @patch('requests.post')
    def test_deploy_failure_invalid_token(self, mock_post):
        mock_post.return_value.status_code = 401
        mock_post.return_value.json.return_value = {"message": "Invalid token"}
        
        res = self.provider.deploy("test-proj", "https://github.com/test/repo", "React")
        
        self.assertFalse(res["success"])
        self.assertIn("Invalid token", res["error"])

    @patch('requests.get')
    def test_get_status_live(self, mock_get):
        # Mocking two calls: one for deploys, one for service details
        mock_get.side_effect = [
            MagicMock(status_code=200, json=lambda: [{"deploy": {"status": "live", "id": "dep-1"}}]),
            MagicMock(status_code=200, json=lambda: {"service": {"serviceDetails": {"url": "https://live.com"}}})
        ]
        
        res = self.provider.get_deployment_status("srv-123")
        
        self.assertEqual(res["status"], "ready")
        self.assertTrue(res["ready"])
        self.assertEqual(res["deployment_url"], "https://live.com")

    @patch('requests.get')
    def test_get_status_failed(self, mock_get):
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = [{"deploy": {"status": "build_failed", "id": "dep-1"}}]
        
        res = self.provider.get_deployment_status("srv-123")
        
        self.assertEqual(res["status"], "error")
        self.assertFalse(res["ready"])

    @patch('requests.post')
    @patch('requests.get')
    def test_cancel_deployment(self, mock_get, mock_post):
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = [{"deploy": {"id": "dep-1"}}]
        mock_post.return_value.status_code = 204
        
        res = self.provider.cancel_deployment("srv-123")
        
        self.assertTrue(res["success"])

if __name__ == '__main__':
    unittest.main()
