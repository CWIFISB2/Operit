package com.ai.assistance.operit.core.tools.defaultTool.websession.browser.cloak

import android.content.Context
import com.ai.assistance.operit.util.AppLogger
import org.json.JSONObject

/**
 * CloakBrowser 工具门面：把 CDP 能力包装成 v1 工具可直接调用的方法。
 * 所有方法都是同步阻塞，调用方需放到后台线程。
 */
internal object CloakBrowserTools {
    private const val TAG = "CloakTools"

    @Volatile private var client: CloakCdpClient? = null
    @Volatile private var fingerprint: CloakFingerprint = CloakFingerprint()

    /** 启动（或复用）CloakBrowser。 */
    fun start(context: Context, config: CloakFingerprint = fingerprint): String {
        fingerprint = config
        val c = CloakLauncher.launch(context, config)
        client = c
        return JSONObject().apply {
            put("engine", "cloak")
            put("port", CloakLauncher.status().port)
            put("pid", CloakLauncher.status().pid)
            put("version", CloakLauncher.status().version)
            put("profile", config.profileId)
        }.toString()
    }

    /** 导航。 */
    fun navigate(url: String, timeoutMs: Int = 30_000): String {
        val c = requireClient()
        c.navigate(url, timeoutMs)
        return JSONObject().apply {
            put("url", c.evaluate("location.href")?.toString() ?: url)
            put("title", c.evaluate("document.title")?.toString() ?: "")
            put("readyState", c.evaluate("document.readyState")?.toString() ?: "")
        }.toString()
    }

    /** 执行 JS。 */
    fun eval(script: String): String {
        val v = requireClient().evaluate(script)
        return v?.toString() ?: "null"
    }

    /** 截图，返回 PNG 文件路径。 */
    fun screenshot(context: Context): String {
        val bytes = requireClient().screenshot()
        val dir = java.io.File(context.cacheDir, "cloak_shots").apply { mkdirs() }
        val f = java.io.File(dir, "shot_${System.currentTimeMillis()}.png")
        f.writeBytes(bytes)
        return f.absolutePath
    }

    /** 点击 CSS 选择器匹配的元素。 */
    fun clickSelector(selector: String): String {
        val c = requireClient()
        val box = c.evaluate(
            """
            (function(){
              var el = document.querySelector(${JSONObject.quote(selector)});
              if (!el) return null;
              var r = el.getBoundingClientRect();
              return {x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height};
            })()
            """.trimIndent()
        ) as? JSONObject ?: throw IllegalStateException("选择器无匹配: $selector")
        c.click(box.optDouble("x"), box.optDouble("y"))
        return JSONObject().put("clicked", selector)
            .put("x", box.optDouble("x")).put("y", box.optDouble("y")).toString()
    }

    /** 点击坐标。 */
    fun clickAt(x: Double, y: Double): String {
        requireClient().click(x, y)
        return JSONObject().put("clicked", "$x,$y").toString()
    }

    /** 在指定选择器输入文本（聚焦后 insertText）。 */
    fun typeInto(selector: String, text: String): String {
        val c = requireClient()
        c.evaluate(
            "(function(){var el=document.querySelector(${JSONObject.quote(selector)});if(!el)return false;el.focus();return true;})()"
        )
        c.typeText(text)
        return JSONObject().put("typed", text).put("into", selector).toString()
    }

    /** 回车。 */
    fun pressEnter(): String {
        requireClient().pressKey("Enter", "Enter", 13)
        return "{\"key\":\"Enter\"}"
    }

    /** 滚动。 */
    fun scroll(deltaY: Double): String {
        requireClient().scroll(deltaY)
        return JSONObject().put("scrolled", deltaY).toString()
    }

    /** 页面文本。 */
    fun text(maxChars: Int = 8000): String {
        val t = requireClient().evaluate("document.body ? document.body.innerText : ''")?.toString() ?: ""
        return if (t.length > maxChars) t.substring(0, maxChars) else t
    }

    /** 页面 HTML。 */
    fun html(maxChars: Int = 20000): String {
        val t = requireClient().evaluate("document.documentElement.outerHTML")?.toString() ?: ""
        return if (t.length > maxChars) t.substring(0, maxChars) else t
    }

    /** 设置指纹。 */
    fun setFingerprint(config: CloakFingerprint): String {
        fingerprint = config
        val c = client ?: return "{\"applied\":false,\"reason\":\"not started\"}"
        c.setUserAgent(config.userAgent, config.platform)
        c.setTimezone(config.timezone)
        c.setDeviceMetrics(config.viewportWidth, config.viewportHeight, config.deviceScale, config.mobile)
        if (config.latitude != null && config.longitude != null) {
            c.setGeolocation(config.latitude, config.longitude)
        }
        return JSONObject().apply {
            put("applied", true)
            put("platform", config.platform)
            put("timezone", config.timezone)
            put("ua", config.userAgent)
        }.toString()
    }

    /** 状态。 */
    fun status(): String {
        val s = CloakLauncher.status()
        return JSONObject().apply {
            put("running", s.running)
            put("port", s.port)
            put("pid", s.pid)
            put("profile", s.profileId)
            put("version", s.version)
            put("error", s.lastError ?: "")
        }.toString()
    }

    /** 关闭。 */
    fun stop(): String {
        client = null
        CloakLauncher.shutdown()
        return "{\"stopped\":true}"
    }

    private fun requireClient(): CloakCdpClient =
        client ?: throw IllegalStateException("CloakBrowser 未启动，请先调用 cloak_start")
}
