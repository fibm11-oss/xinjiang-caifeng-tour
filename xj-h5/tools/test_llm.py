#!/usr/bin/env python3
# tools/test_llm.py — 多供應商 LLM 適配層測試（純標準庫，無需 pip install）
#
# 執行：  python tools/test_llm.py
#
# 覆蓋：
#   A) 模型名防呆：不可用已下线的 deepseek-chat / deepseek-reasoner
#   B) 供應商解析：mock / custom / local 各種環境變數組合
#   C) 寬鬆 JSON 解析：純 JSON、``` 圍欄、前綴廢話、壞格式
#   D) 提示詞約束：必須含「不得杜撰」類規則、必須帶入 zone 事實與順序
#   E) 快取往返
#   F) 真連本機 OpenAI 相容端點（LM Studio）—— 端點不可用時自動略過

import json
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "..", "server"))
import llm  # noqa: E402

LOCAL_BASE = "http://127.0.0.1:8081/v1"


def clean_env(**overrides):
    """乾淨環境：清掉所有 XJ_LLM_* 與各廠 key，再套用 overrides。"""
    env = dict(os.environ)
    for k in list(env.keys()):
        if k.startswith("XJ_LLM_") or k in ("DEEPSEEK_API_KEY", "DASHSCOPE_API_KEY",
                                           "OPENAI_API_KEY"):
            env.pop(k, None)
    env.update(overrides)
    return env


class TestProviderRegistry(unittest.TestCase):
    def test_no_retired_models(self):
        """deepseek-chat / deepseek-reasoner 已於 2026-07-24 下線，不可當預設。"""
        retired = ("deepseek-chat", "deepseek-reasoner")
        for name, spec in llm.PROVIDERS.items():
            self.assertNotIn(spec.get("default_model", ""), retired,
                             "%s 的預設模型是已下線的模型" % name)
            for m in spec.get("models") or []:
                self.assertNotIn(m, retired,
                                 "%s 的模型清單含已下線模型 %s" % (name, m))

    def test_current_models_present(self):
        self.assertEqual(llm.PROVIDERS["deepseek"]["default_model"],
                         "deepseek-v4-flash")
        self.assertTrue(llm.PROVIDERS["openai"]["default_model"].startswith("gpt-5.6"))
        self.assertEqual(llm.PROVIDERS["qwen"]["default_model"], "qwen-plus")


class TestResolve(unittest.TestCase):
    def test_mock_mode(self):
        with mock.patch.dict(os.environ, clean_env(XJ_LLM_PROVIDER="mock"), clear=True):
            self.assertIsNone(llm.resolve())
            self.assertEqual(llm.provider_status()["mode"], "mock")

    def test_custom_provider(self):
        env = clean_env(XJ_LLM_PROVIDER="custom", XJ_LLM_BASE_URL="https://x.example/v1",
                        XJ_LLM_MODEL="my-model", XJ_LLM_API_KEY="k")
        with mock.patch.dict(os.environ, env, clear=True):
            cfg = llm.resolve()
            self.assertIsNotNone(cfg)
            self.assertEqual(cfg["name"], "custom")
            self.assertEqual(cfg["base_url"], "https://x.example/v1")
            self.assertEqual(cfg["model"], "my-model")
            self.assertEqual(cfg["api_key"], "k")

    def test_cloud_provider_auto_by_key(self):
        env = clean_env(DEEPSEEK_API_KEY="sk-test")
        with mock.patch.dict(os.environ, env, clear=True):
            cfg = llm.resolve()
            self.assertIsNotNone(cfg)
            self.assertEqual(cfg["name"], "deepseek")
            self.assertEqual(cfg["model"], "deepseek-v4-flash")

    def test_provider_needing_key_without_key_is_skipped(self):
        """需要 key 的供應商在無 key 時不可被選中（避免送出無效請求）。"""
        with mock.patch.dict(os.environ, clean_env(XJ_LLM_PROVIDER="deepseek"), clear=True):
            self.assertIsNone(llm.resolve())

    def test_status_never_leaks_key(self):
        env = clean_env(XJ_LLM_PROVIDER="custom", XJ_LLM_BASE_URL="https://x.example/v1",
                        XJ_LLM_MODEL="m", XJ_LLM_API_KEY="sk-secret-value")
        with mock.patch.dict(os.environ, env, clear=True):
            st = llm.provider_status()
            dumped = json.dumps(st)
            self.assertNotIn("sk-secret-value", dumped)
            self.assertTrue(st["api_key_present"])


class TestExtractJson(unittest.TestCase):
    def test_plain(self):
        self.assertEqual(llm.extract_json('{"a":1}'), {"a": 1})

    def test_fenced(self):
        self.assertEqual(llm.extract_json('```json\n{"a":2}\n```'), {"a": 2})

    def test_preamble(self):
        text = '好的，以下是您要的結果：\n{"summary":"x","chapters":[]}\n希望有幫助！'
        obj = llm.extract_json(text)
        self.assertIsNotNone(obj)
        self.assertEqual(obj["summary"], "x")

    def test_nested_braces(self):
        obj = llm.extract_json('{"a":{"b":[1,2]},"c":"}"}')
        self.assertEqual(obj["a"]["b"], [1, 2])

    def test_invalid(self):
        self.assertIsNone(llm.extract_json("完全沒有 JSON"))


class TestPrompts(unittest.TestCase):
    def test_guide_contains_facts_and_no_fabrication_rule(self):
        req = {"zoneId": "Z3", "lang": "zh", "name": "喀納斯 / 禾木",
               "intro": "喀納斯湖藏在阿爾泰山深處。",
               "context": {"timeOfDay": "morning", "photoCount": 3}}
        msgs = llm.build_guide_messages(req)
        system = msgs[0]["content"]
        user = msgs[1]["content"]
        self.assertIn("不得杜撰", system)
        self.assertIn("繁體中文", system)
        self.assertIn("喀納斯", user)
        self.assertIn("morning", user)

    def test_guide_english_rules(self):
        req = {"zoneId": "Z3", "lang": "en", "name": "Kanas",
               "intro": "Kanas Lake hides in the Altai.",
               "context": {"timeOfDay": "evening"}}
        system = llm.build_guide_messages(req)[0]["content"]
        self.assertIn("never invent", system)
        self.assertIn("English", system)

    def test_roadbook_prompt_has_order_and_counts(self):
        req = {
            "lang": "zh",
            "photos": [{"zoneId": "Z1", "ts": 1}, {"zoneId": "Z1", "ts": 2},
                       {"zoneId": "Z3", "ts": 3}, {"zoneId": "unknown", "ts": 4}],
            "zones": [{"zoneId": "Z1", "name": "烏魯木齊", "intro": "首府"},
                      {"zoneId": "Z3", "name": "喀納斯 / 禾木", "intro": "湖泊"}],
        }
        msgs = llm.build_roadbook_messages(req, "zh")
        system = msgs[0]["content"]
        user = msgs[1]["content"]
        self.assertIn("不得杜撰", system)
        self.assertIn("JSON", system)
        self.assertIn("烏魯木齊", user)
        self.assertIn("喀納斯 / 禾木", user)
        # 照片數要反映在提示詞裡
        self.assertIn('"照片數": 2', user)
        self.assertIn('"照片數": 1', user)
        # 未分類照片數要被帶上
        self.assertIn("未分類照片數：1", user)

    def test_roadbook_prompt_never_includes_base64(self):
        """照片縮圖不可進提示詞（token 爆走 + 浪費）。"""
        req = {
            "lang": "zh",
            "photos": [{"zoneId": "Z1", "ts": 1, "thumb": "data:image/png;base64," + "A" * 500}],
            "zones": [{"zoneId": "Z1", "name": "烏魯木齊", "intro": "首府"}],
        }
        user = llm.build_roadbook_messages(req, "zh")[1]["content"]
        self.assertNotIn("base64", user)
        self.assertNotIn("A" * 100, user)


class TestCache(unittest.TestCase):
    def test_roundtrip(self):
        llm.cache_clear()
        llm.cache_set("k1", {"x": 1})
        self.assertEqual(llm.cache_get("k1"), {"x": 1})
        llm.cache_clear()
        self.assertIsNone(llm.cache_get("k1"))

    def test_hash_stable(self):
        self.assertEqual(llm.cache_key_hash("a", "b"), llm.cache_key_hash("a", "b"))
        self.assertNotEqual(llm.cache_key_hash("a", "b"), llm.cache_key_hash("a", "c"))


class TestAiLabelling(unittest.TestCase):
    """AI 生成內容標識（《人工智能生成合成內容標識辦法》2025-09-01 施行）。

    - 第四條：AI 生成文本須加「可被使用者明顯感知」的顯式標識
    - 第五條：隱式標識須含屬性資訊 / 服務提供者 / 內容編號三要素
    """

    def _server(self):
        import roadbook_server as rs
        return rs

    def test_roadbook_html_has_explicit_notice_zh(self):
        rs = self._server()
        tpl = {"chapters": [{"zoneId": "Z1", "title": "烏魯木齊", "intro": "首府", "count": 2}]}
        html = rs._compose_roadbook_html(
            {"summary": "總述", "chapters": [{"zoneId": "Z1", "narrative": "敘事"}]},
            tpl, "zh", 0)
        self.assertIn("ai-notice", html)
        self.assertIn("AI 生成", html)

    def test_roadbook_html_has_explicit_notice_en(self):
        rs = self._server()
        tpl = {"chapters": [{"zoneId": "Z1", "title": "Urumqi", "intro": "Capital", "count": 2}]}
        html = rs._compose_roadbook_html(
            {"summary": "s", "chapters": [{"zoneId": "Z1", "narrative": "n"}]},
            tpl, "en", 0)
        self.assertIn("ai-notice", html)
        self.assertIn("AI-generated", html)

    def test_template_roadbook_is_not_labelled_as_ai(self):
        """模板路書是人工撰寫文案（zones.js），不得宣稱 AI 生成。"""
        rs = self._server()
        tpl = rs.template_roadbook([{"zoneId": "Z1", "ts": 1}], "zh")
        self.assertNotIn("ai-notice", tpl["html"])


class TestProviderRouting(unittest.TestCase):
    """請求級 provider 路由 —— 多區域部署的前置接縫。

    場景：境外客戶在新疆現場，網路可能是「本地 SIM / 機場 WiFi」（被過濾，只能連境內節點）
    或「旅行 eSIM / 國際漫遊」（流量出境，不被過濾，可連境外模型）。
    邊緣層依客戶網路決定走哪個供應商，前端不變。
    """

    def test_build_chain_preferred_first(self):
        env = clean_env(XJ_LLM_PROVIDER="mock",
                        XJ_LLM_BASE_URL="https://a.example/v1", XJ_LLM_MODEL="m1",
                        XJ_LLM_API_KEY="k1")
        with mock.patch.dict(os.environ, env, clear=True):
            chain = llm.build_chain(preferred="custom", chain=["mock"])
            self.assertTrue(chain)
            self.assertEqual(chain[0]["name"], "custom")

    def test_build_chain_falls_back_to_auto_resolve(self):
        # 不設 XJ_LLM_PROVIDER，只給 base_url → resolve() 自動偵測成 custom
        env = clean_env(XJ_LLM_BASE_URL="https://a.example/v1", XJ_LLM_MODEL="m1")
        with mock.patch.dict(os.environ, env, clear=True):
            chain = llm.build_chain()
            self.assertTrue(chain)
            self.assertEqual(chain[0]["name"], "custom")

    def test_build_chain_empty_in_mock_mode(self):
        """mock 模式（未接 LLM）→ 鏈路為空，由上層走模板降級。"""
        env = clean_env(XJ_LLM_PROVIDER="mock")
        with mock.patch.dict(os.environ, env, clear=True):
            self.assertEqual(llm.build_chain(), [])

    def test_build_chain_ignores_unknown_and_mock(self):
        env = clean_env(XJ_LLM_PROVIDER="mock",
                        XJ_LLM_BASE_URL="https://a.example/v1", XJ_LLM_MODEL="m1")
        with mock.patch.dict(os.environ, env, clear=True):
            chain = llm.build_chain(preferred=["nosuchprovider", "mock", "custom"])
            names = [c["name"] for c in chain]
            self.assertNotIn("nosuchprovider", names)
            self.assertNotIn("mock", names)
            self.assertIn("custom", names)

    def test_available_providers_reports_configured_flag(self):
        env = clean_env(XJ_LLM_PROVIDER="mock",
                        XJ_LLM_BASE_URL="https://a.example/v1", XJ_LLM_MODEL="m1")
        with mock.patch.dict(os.environ, env, clear=True):
            lst = llm.available_providers()
            names = [p["name"] for p in lst]
            for want in ("deepseek", "qwen", "openai", "local", "custom"):
                self.assertIn(want, names)
            # 需要 key 但沒 key → configured 必須為 False
            d = next(p for p in lst if p["name"] == "deepseek")
            self.assertFalse(d["configured"])
            # 有 base_url 的 custom 應為 configured
            c = next(p for p in lst if p["name"] == "custom")
            self.assertTrue(c["configured"])

    def test_server_provider_hint_precedence(self):
        """HTTP 標頭優先於請求體（邊緣層的決定權高於前端）。"""
        import roadbook_server as rs
        self.assertEqual(rs._provider_hint({"_providerHeader": "local",
                                             "provider": "openai"}), "local")
        self.assertEqual(rs._provider_hint({"provider": "OpenAI"}), "openai")
        self.assertEqual(rs._provider_hint({}), "")
        self.assertEqual(rs._provider_hint({"provider": ["a", "b"]}), "a,b")

    def test_server_provider_chain_parsing(self):
        import roadbook_server as rs
        self.assertEqual(rs._provider_chain({"providerChain": ["A", "b"]}), ["a", "b"])
        self.assertEqual(rs._provider_chain({}), [])

    def test_cache_key_separates_by_provider_hint(self):
        """不同 provider 偏好不得共用同一份快取。"""
        import roadbook_server as rs
        k1 = rs._roadbook_cache_key([{"zoneId": "Z1", "ts": 1}], "zh", [], "")
        k2 = rs._roadbook_cache_key([{"zoneId": "Z1", "ts": 1}], "zh", [], "local")
        self.assertNotEqual(k1, k2)


class TestNoProvider(unittest.TestCase):
    def test_call_without_provider_fails_gracefully(self):
        env = clean_env(XJ_LLM_PROVIDER="mock")
        with mock.patch.dict(os.environ, env, clear=True):
            res = llm.call_chat([{"role": "user", "content": "hi"}])
            self.assertFalse(res["ok"])
            self.assertEqual(res["error"], "no_provider_configured")
            self.assertEqual(res["text"], "")


class TestLiveLocal(unittest.TestCase):
    """真連本機 OpenAI 相容端點（LM Studio）—— 端點不在就略過。"""

    def test_live_chat(self):
        env = clean_env(XJ_LLM_PROVIDER="local", XJ_LLM_BASE_URL=LOCAL_BASE,
                        XJ_LLM_MODEL="qwen/qwen3.6-35b-a3b")
        with mock.patch.dict(os.environ, env, clear=True):
            cfg = llm.resolve()
            if cfg is None:
                self.skipTest("本機 OpenAI 相容端點不可用，略過真連測試")
            res = llm.call_chat(
                [{"role": "system", "content": "只回傳兩個字：你好"},
                 {"role": "user", "content": "回你好"}],
                max_tokens=16, temperature=0.1, timeout=180)
            self.assertTrue(res["ok"], "LLM 呼叫失敗：%s" % res.get("error"))
            self.assertTrue(res["text"].strip())
            print("\n    [live] provider=%s model=%s 回應=%r"
                  % (res["provider"], res["model"], res["text"][:40]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
