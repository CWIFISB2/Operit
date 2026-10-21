package com.ai.assistance.operit.core.tools.defaultTool.websession.browser.cloak

/** 浏览器引擎类型。 */
enum class BrowserEngine {
    /** Android 系统 WebView（默认，原生流畅）。 */
    WEBVIEW,
    /** proot 内 CloakBrowser Chromium（反检测 / 指纹伪装）。 */
    CLOAK;

    companion object {
        fun fromName(raw: String?): BrowserEngine =
            when (raw?.trim()?.lowercase()) {
                "cloak", "chromium", "cloakbrowser" -> CLOAK
                else -> WEBVIEW
            }
    }
}

/** 指纹配置，映射到 CloakBrowser 启动参数与 CDP Emulation。 */
data class CloakFingerprint(
    val profileId: String = "default",
    val platform: String = "Win32",
    val userAgent: String =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    val timezone: String = "Asia/Shanghai",
    val language: String = "zh-CN",
    val latitude: Double? = null,
    val longitude: Double? = null,
    val viewportWidth: Int = 1280,
    val viewportHeight: Int = 800,
    val deviceScale: Double = 1.0,
    val mobile: Boolean = false,
    /** 传入 --fingerprint 种子，CloakBrowser 会据此派生 Canvas/WebGL/字体指纹。 */
    val fingerprintSeed: Int? = null,
    val proxyServer: String? = null
) {
    fun toCliArgs(): List<String> = buildList {
        add("--user-agent=$userAgent")
        add("--lang=$language")
        add("--window-size=$viewportWidth,$viewportHeight")
        if (mobile) add("--fingerprint-mobile=true")
        fingerprintSeed?.let { add("--fingerprint=$it") }
        proxyServer?.let { add("--proxy-server=$it") }
    }
}

/** CloakBrowser 运行状态快照。 */
data class CloakStatus(
    val running: Boolean = false,
    val port: Int = 0,
    val pid: Int = -1,
    val profileId: String = "",
    val version: String = "",
    val lastError: String? = null
)
