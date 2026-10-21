package com.ai.assistance.operit.core.tools.defaultTool.websession.browser.cloak

import android.content.Context
import com.ai.assistance.operit.util.AppLogger

/**
 * 统一浏览器操作门面。
 *
 * 设计目标：**一个浏览器，双引擎**。
 * 调用方只面对本接口，内部根据 WebSession.engine 分发到：
 *   - WEBVIEW   → 原有 Android WebView 路径
 *   - CLOAK     → proot 内 CloakBrowser（CDP 控制）
 *
 * 这样 UI、工具、AI 调用方都不需要感知引擎差异。
 */
internal object BrowserEngineBridge {
    private const val TAG = "BrowserBridge"

    // ---------------------------------------------------------------- 生命周期

    /**
     * 确保指定会话的引擎已就绪。
     * CLOAK 引擎会按需启动 Chromium 并建立 CDP 连接。
     */
    fun ensureEngine(context: Context, sessionId: String, engine: BrowserEngine): String {
        if (engine != BrowserEngine.CLOAK) return "webview"
        val cdp = CloakLauncher.launch(context, currentFingerprint(sessionId))
        CloakBrowserTools.attach(sessionId, cdp)
        return "cloak"
    }

    /** 切换引擎。会关闭旧引擎资源。 */
    fun switchEngine(context: Context, sessionId: String, target: BrowserEngine): String {
        AppLogger.i(TAG, "会话 $sessionId 切换引擎 → $target")
        return when (target) {
            BrowserEngine.CLOAK -> {
                val cdp = CloakLauncher.launch(context, currentFingerprint(sessionId))
                CloakBrowserTools.attach(sessionId, cdp)
                "cloak"
            }
            BrowserEngine.WEBVIEW -> "webview"
        }
    }

    /** 释放某会话的引擎资源。 */
    fun releaseEngine(sessionId: String) {
        CloakBrowserTools.detach(sessionId)
    }

    // ---------------------------------------------------------------- 统一操作

    /** 导航。 */
    fun navigate(context: Context, sessionId: String, engine: BrowserEngine, url: String): String {
        return if (engine == BrowserEngine.CLOAK) {
            ensureEngine(context, sessionId, engine)
            CloakBrowserTools.navigate(sessionId, url)
        } else {
            "webview:navigate:$url"
        }
    }

    /** 执行 JS。 */
    fun evaluate(sessionId: String, engine: BrowserEngine, script: String): String =
        if (engine == BrowserEngine.CLOAK) CloakBrowserTools.eval(sessionId, script)
        else throw IllegalStateException("WEBVIEW 引擎请走原有 evaluateJavascript 路径")

    /** 截图，返回文件路径。 */
    fun screenshot(context: Context, sessionId: String, engine: BrowserEngine): String =
        if (engine == BrowserEngine.CLOAK) CloakBrowserTools.screenshot(sessionId, context)
        else throw IllegalStateException("WEBVIEW 引擎请走原有截图路径")

    /** 点击选择器。 */
    fun clickSelector(sessionId: String, engine: BrowserEngine, selector: String): String =
        if (engine == BrowserEngine.CLOAK) CloakBrowserTools.clickSelector(sessionId, selector)
        else throw IllegalStateException("WEBVIEW 引擎请走原有 JS 点击路径")

    /** 输入文本。 */
    fun typeInto(sessionId: String, engine: BrowserEngine, selector: String, text: String): String =
        if (engine == BrowserEngine.CLOAK) CloakBrowserTools.typeInto(sessionId, selector, text)
        else throw IllegalStateException("WEBVIEW 引擎请走原有 JS 输入路径")

    /** 页面文本。 */
    fun pageText(sessionId: String, engine: BrowserEngine, maxChars: Int = 8000): String =
        if (engine == BrowserEngine.CLOAK) CloakBrowserTools.text(sessionId, maxChars)
        else throw IllegalStateException("WEBVIEW 引擎请走原有 innerText 路径")

    /** 设置指纹（仅 CLOAK 生效）。 */
    fun applyFingerprint(sessionId: String, config: CloakFingerprint): String {
        CloakBrowserTools.setFingerprint(sessionId, config)
        return "applied"
    }

    /** 引擎状态。 */
    fun status(): String = CloakBrowserTools.status()

    // ---------------------------------------------------------------- 内部

    private fun currentFingerprint(sessionId: String): CloakFingerprint =
        CloakBrowserTools.fingerprintOf(sessionId) ?: CloakFingerprint(profileId = sessionId)
}
