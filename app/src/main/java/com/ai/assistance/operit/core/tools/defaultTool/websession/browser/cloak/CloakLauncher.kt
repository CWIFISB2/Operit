package com.ai.assistance.operit.core.tools.defaultTool.websession.browser.cloak

import android.content.Context
import com.ai.assistance.operit.util.AppLogger
import java.io.File
import java.net.Socket

/**
 * 启动 / 停止 proot 内的 CloakBrowser Chromium。
 *
 * 依赖已有的 Operit 终端环境（proot Ubuntu），路径约定：
 *   /root/.cloakbrowser/chrome
 * 若用户环境不同，可通过 [setChromePath] 覆盖。
 */
internal object CloakLauncher {
    private const val TAG = "CloakLauncher"
    private const val DEFAULT_CHROME = "/root/.cloakbrowser/chrome"
    private const val PROFILE_ROOT = "/root/.cloak_profiles"
    private const val BASE_PORT = 9300

    @Volatile private var chromePath: String = DEFAULT_CHROME
    @Volatile private var current: CloakStatus = CloakStatus()
    private var client: CloakCdpClient? = null

    fun setChromePath(path: String) { chromePath = path }
    fun status(): CloakStatus = current
    fun cdp(): CloakCdpClient? = client

    /** 检查端口是否已被监听。 */
    private fun portOpen(port: Int): Boolean = runCatching {
        Socket("127.0.0.1", port).use { true }
    }.getOrDefault(false)

    /** 等待端口就绪。 */
    private fun waitPort(port: Int, timeoutMs: Int = 25_000): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (portOpen(port)) return true
            Thread.sleep(300)
        }
        return false
    }

    /**
     * 启动 CloakBrowser 并建立 CDP 连接。
     * @return 连接好的 CDP 客户端
     */
    fun launch(context: Context, fingerprint: CloakFingerprint): CloakCdpClient {
        if (current.running && client != null) {
            AppLogger.i(TAG, "复用已有 CloakBrowser: port=${current.port}")
            return client!!
        }

        val port = BASE_PORT
        val profileDir = "$PROFILE_ROOT/${fingerprint.profileId}"

        // 构建启动命令（经 proot 执行）
        val args = buildList {
            add(chromePath)
            add("--remote-debugging-port=$port")
            add("--remote-debugging-address=127.0.0.1")
            add("--user-data-dir=$profileDir")
            add("--no-sandbox")
            add("--no-first-run")
            add("--no-default-browser-check")
            add("--disable-dev-shm-usage")
            add("--disable-gpu")
            add("--headless=new")
            addAll(fingerprint.toCliArgs())
            add("about:blank")
        }

        val cmd = buildString {
            append("mkdir -p $profileDir 2>/dev/null; ")
            append("nohup ")
            append(args.joinToString(" ") { quote(it) })
            append(" > /tmp/cloak_$port.log 2>&1 & echo \$!")
        }

        AppLogger.i(TAG, "启动命令: $cmd")

        val pid = execShell(cmd)?.trim()?.toIntOrNull() ?: -1

        if (!waitPort(port)) {
            val log = execShell("tail -30 /tmp/cloak_$port.log 2>/dev/null")
            current = CloakStatus(
                running = false, port = port, pid = pid,
                profileId = fingerprint.profileId,
                lastError = "端口未就绪。日志:\n$log"
            )
            throw IllegalStateException("CloakBrowser 启动失败，端口 $port 未监听。\n$log")
        }

        val cdp = CloakCdpClient(port = port)
        val wsUrl = cdp.connectToFirstPage()
        AppLogger.i(TAG, "CDP 已连接: $wsUrl")

        // 应用指纹覆盖（CDP 层）
        runCatching {
            cdp.setUserAgent(fingerprint.userAgent, fingerprint.platform)
            cdp.setTimezone(fingerprint.timezone)
            cdp.setDeviceMetrics(
                fingerprint.viewportWidth, fingerprint.viewportHeight,
                fingerprint.deviceScale, fingerprint.mobile
            )
            if (fingerprint.latitude != null && fingerprint.longitude != null) {
                cdp.setGeolocation(fingerprint.latitude, fingerprint.longitude)
            }
        }.onFailure { AppLogger.w(TAG, "指纹覆盖部分失败: ${it.message}") }

        client = cdp
        current = CloakStatus(
            running = true, port = port, pid = pid,
            profileId = fingerprint.profileId,
            version = detectVersion()
        )
        return cdp
    }

    private fun detectVersion(): String =
        execShell("$chromePath --version 2>/dev/null")?.trim() ?: "unknown"

    fun shutdown() {
        runCatching { client?.close() }
        client = null
        if (current.pid > 0) {
            execShell("kill ${current.pid} 2>/dev/null")
        }
        current = CloakStatus()
    }

    /** 执行 proot 内 shell 命令，返回 stdout。 */
    private fun execShell(command: String): String? = runCatching {
        val pb = ProcessBuilder("sh", "-c", command)
        pb.redirectErrorStream(true)
        val proc = pb.start()
        val out = proc.inputStream.bufferedReader().readText()
        proc.waitFor()
        out
    }.getOrNull()

    private fun quote(s: String): String =
        if (s.any { it.isWhitespace() || it == '\'' || it == '"' }) "'" + s.replace("'", "'\\''") + "'" else s
}
