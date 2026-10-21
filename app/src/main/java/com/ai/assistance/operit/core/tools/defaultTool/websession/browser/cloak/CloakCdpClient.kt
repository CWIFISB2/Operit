package com.ai.assistance.operit.core.tools.defaultTool.websession.browser.cloak

import android.util.Base64
import com.ai.assistance.operit.util.AppLogger
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.net.Socket
import java.net.URI
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/** CDP client for CloakBrowser: JDK Socket only, no extra deps. */
internal class CloakCdpClient(
    private val host: String = "127.0.0.1",
    private val port: Int,
    private val timeoutMs: Int = 30_000
) {
    companion object { private const val TAG = "CloakCdp" }

    private var socket: Socket? = null
    private var input: InputStream? = null
    private var output: OutputStream? = null
    private val nextId = AtomicLong(0)
    private val pending = ConcurrentHashMap<Long, ResultBox>()
    private val listeners = ConcurrentHashMap<String, MutableList<(JSONObject) -> Unit>>()
    @Volatile private var closed = false

    private class ResultBox {
        @Volatile var result: JSONObject? = null
        @Volatile var error: String? = null
        @Volatile var done = false
        val lock = Object()
        fun complete(r: JSONObject?, e: String?) {
            result = r; error = e; done = true
            synchronized(lock) { lock.notifyAll() }
        }
    }

    fun connectToFirstPage(): String {
        val targets = httpJsonArray("/json/list")
        var ws: String? = null
        for (i in 0 until targets.length()) {
            val t = targets.optJSONObject(i) ?: continue
            if (t.optString("type") == "page") {
                val c = t.optString("webSocketDebuggerUrl")
                if (c.isNotEmpty()) { ws = c; break }
            }
        }
        if (ws.isNullOrEmpty()) {
            val created = httpJsonObject("PUT", "/json/new?about:blank")
            ws = created?.optString("webSocketDebuggerUrl")
        }
        if (ws.isNullOrEmpty()) throw IllegalStateException("no page target on port $port")
        openWebSocket(ws!!)
        startReader()
        return ws!!
    }

    private fun openWebSocket(wsUrl: String) {
        val uri = URI(wsUrl)
        val h = uri.host ?: host
        val p = if (uri.port > 0) uri.port else port
        val path = (uri.path ?: "/") + (uri.query?.let { "?$it" } ?: "")
        val s = Socket(h, p)
        s.soTimeout = timeoutMs
        val out = s.getOutputStream()
        val raw = ByteArray(16)
        java.security.SecureRandom().nextBytes(raw)
        val key = Base64.encodeToString(raw, Base64.NO_WRAP)
        val req = "GET $path HTTP/1.1\r\nHost: $h:$p\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: $key\r\nSec-WebSocket-Version: 13\r\n\r\n"
        out.write(req.toByteArray(Charsets.US_ASCII))
        out.flush()
        val bin = BufferedInputStream(s.getInputStream())
        val head = ByteArrayOutputStream()
        var last4 = 0
        while (true) {
            val b = bin.read()
            if (b < 0) throw IllegalStateException("disconnected during handshake")
            head.write(b)
            last4 = (last4 shl 8) or b
            if (last4 == 0x0D0A0D0A) break
        }
        val header = head.toString("US-ASCII")
        if (!header.startsWith("HTTP/1.1 101")) {
            throw IllegalStateException("ws handshake failed: " + header.lineSequence().firstOrNull())
        }
        socket = s; input = bin; output = out
    }

    private fun startReader() {
        Thread({
            try {
                while (!closed) {
                    val msg = readFrame() ?: continue
                    dispatch(msg)
                }
            } catch (e: Throwable) {
                if (!closed) AppLogger.w(TAG, "reader stopped: ${e.message}")
            }
        }, "cloak-cdp-reader").apply { isDaemon = true; start() }
    }

    private fun readFrame(): JSONObject? {
        val ins = input ?: return null
        val b0 = ins.read(); if (b0 < 0) return null
        val b1 = ins.read(); if (b1 < 0) return null
        val opcode = b0 and 0x0F
        val masked = (b1 and 0x80) != 0
        var len = (b1 and 0x7F).toLong()
        if (len == 126L) len = ((ins.read() shl 8) or ins.read()).toLong()
        else if (len == 127L) { len = 0L; for (i in 0 until 8) len = (len shl 8) or ins.read().toLong() }
        val mask = if (masked) ByteArray(4) { ins.read().toByte() } else null
        if (len > 64L * 1024 * 1024) throw IllegalStateException("frame too large: $len")
        val payload = ByteArray(len.toInt())
        var off = 0
        while (off < payload.size) {
            val n = ins.read(payload, off, payload.size - off)
            if (n < 0) return null
            off += n
        }
        if (mask != null) for (i in payload.indices) payload[i] = (payload[i].toInt() xor mask[i % 4].toInt()).toByte()
        return when (opcode) {
            0x1, 0x2 -> runCatching { JSONObject(String(payload, Charsets.UTF_8)) }.getOrNull()
            0x8 -> { closed = true; null }
            0x9 -> { sendFrame(0xA, payload); null }
            else -> null
        }
    }

    private fun sendFrame(opcode: Int, payload: ByteArray) {
        val out = output ?: return
        synchronized(out) {
            val hdr = ByteArrayOutputStream()
            hdr.write(0x80 or opcode)
            when {
                payload.size < 126 -> hdr.write(0x80 or payload.size)
                payload.size < 65536 -> {
                    hdr.write(0x80 or 126)
                    hdr.write((payload.size shr 8) and 0xFF)
                    hdr.write(payload.size and 0xFF)
                }
                else -> {
                    hdr.write(0x80 or 127)
                    for (i in 7 downTo 0) hdr.write(((payload.size.toLong() shr (i * 8)) and 0xFF).toInt())
                }
            }
            val mask = ByteArray(4)
            java.security.SecureRandom().nextBytes(mask)
            hdr.write(mask)
            val masked = ByteArray(payload.size) { i -> (payload[i].toInt() xor mask[i % 4].toInt()).toByte() }
            out.write(hdr.toByteArray())
            out.write(masked)
            out.flush()
        }
    }

    private fun dispatch(msg: JSONObject) {
        val id = msg.optLong("id", -1L)
        if (id >= 0) {
            val err = msg.optJSONObject("error")?.optString("message")
            pending.remove(id)?.complete(msg.optJSONObject("result"), err)
            return
        }
        val method = msg.optString("method")
        if (method.isNotEmpty()) {
            val params = msg.optJSONObject("params") ?: JSONObject()
            listeners[method]?.toList()?.forEach { runCatching { it(params) } }
        }
    }

    fun call(method: String, params: JSONObject = JSONObject(), timeout: Int = timeoutMs): JSONObject {
        if (closed) throw IllegalStateException("CDP closed")
        val id = nextId.incrementAndGet()
        val box = ResultBox()
        pending[id] = box
        val payload = JSONObject().apply { put("id", id); put("method", method); put("params", params) }
        sendFrame(0x1, payload.toString().toByteArray(Charsets.UTF_8))
        synchronized(box.lock) {
            val deadline = System.currentTimeMillis() + timeout
            while (!box.done) {
                val left = deadline - System.currentTimeMillis()
                if (left <= 0) { pending.remove(id); throw IllegalStateException("CDP timeout: $method") }
                box.lock.wait(left)
            }
        }
        box.error?.let { throw IllegalStateException("CDP $method failed: $it") }
        return box.result ?: JSONObject()
    }

    fun on(event: String, listener: (JSONObject) -> Unit) {
        listeners.getOrPut(event) { mutableListOf() }.add(listener)
    }

    private fun httpJsonArray(path: String): JSONArray {
        val text = httpRequest("GET", path) ?: return JSONArray()
        return runCatching { JSONArray(text) }.getOrElse { JSONArray() }
    }

    private fun httpJsonObject(method: String, path: String): JSONObject? {
        val text = httpRequest(method, path) ?: return null
        return runCatching { JSONObject(text) }.getOrNull()
    }

    private fun httpRequest(method: String, path: String): String? = runCatching {
        val s = Socket(host, port)
        s.soTimeout = 10_000
        s.getOutputStream().apply {
            write("$method $path HTTP/1.1\r\nHost: $host:$port\r\nConnection: close\r\n\r\n".toByteArray())
            flush()
        }
        val resp = BufferedInputStream(s.getInputStream()).readBytes().toString(Charsets.UTF_8)
        s.close()
        val idx = resp.indexOf("\r\n\r\n")
        if (idx < 0) null else resp.substring(idx + 4)
    }.getOrNull()

    // ---------------- high level API ----------------

    fun navigate(url: String, timeout: Int = 30_000) {
        call("Page.enable")
        call("Page.navigate", JSONObject().put("url", url), timeout)
        waitForLoad(timeout)
    }

    fun waitForLoad(timeout: Int = 30_000) {
        val deadline = System.currentTimeMillis() + timeout
        while (System.currentTimeMillis() < deadline) {
            val raw = evaluate("document.readyState")
            if (raw?.toString()?.trim('"') == "complete") return
            Thread.sleep(120)
        }
    }

    fun evaluate(script: String, awaitPromise: Boolean = true): Any? {
        val params = JSONObject().apply {
            put("expression", script)
            put("returnByValue", true)
            put("awaitPromise", awaitPromise)
            put("userGesture", true)
        }
        val r = call("Runtime.evaluate", params)
        val exc = r.optJSONObject("exceptionDetails")
        if (exc != null) {
            val d = exc.optJSONObject("exception")?.optString("description") ?: exc.optString("text")
            throw IllegalStateException("JS error: $d")
        }
        val res = r.optJSONObject("result") ?: return null
        if (res.has("value")) {
            val v = res.opt("value")
            return if (v == JSONObject.NULL) null else v
        }
        return null
    }

    fun screenshot(): ByteArray {
        call("Page.enable")
        val r = call("Page.captureScreenshot", JSONObject().put("format", "png"), 60_000)
        val b64 = r.optString("data")
        if (b64.isEmpty()) throw IllegalStateException("empty screenshot")
        return Base64.decode(b64, Base64.DEFAULT)
    }

    fun click(x: Double, y: Double) {
        call("Input.dispatchMouseEvent", JSONObject().apply {
            put("type", "mousePressed"); put("x", x); put("y", y)
            put("button", "left"); put("clickCount", 1)
        })
        call("Input.dispatchMouseEvent", JSONObject().apply {
            put("type", "mouseReleased"); put("x", x); put("y", y)
            put("button", "left"); put("clickCount", 1)
        })
    }

    fun typeText(text: String) {
        call("Input.insertText", JSONObject().put("text", text))
    }

    fun pressKey(key: String, code: String, keyCode: Int) {
        call("Input.dispatchKeyEvent", JSONObject().apply {
            put("type", "keyDown"); put("key", key); put("code", code)
            put("windowsVirtualKeyCode", keyCode)
        })
        call("Input.dispatchKeyEvent", JSONObject().apply {
            put("type", "keyUp"); put("key", key); put("code", code)
            put("windowsVirtualKeyCode", keyCode)
        })
    }

    fun scroll(deltaY: Double, x: Double = 100.0, y: Double = 300.0) {
        call("Input.dispatchMouseEvent", JSONObject().apply {
            put("type", "mouseWheel"); put("x", x); put("y", y)
            put("deltaX", 0); put("deltaY", deltaY)
        })
    }

    fun setUserAgent(ua: String, platform: String = "Win32") {
        call("Emulation.setUserAgentOverride", JSONObject().apply {
            put("userAgent", ua); put("platform", platform)
        })
    }

    fun setTimezone(tz: String) {
        call("Emulation.setTimezoneOverride", JSONObject().put("timezoneId", tz))
    }

    fun setGeolocation(lat: Double, lng: Double, accuracy: Double = 100.0) {
        call("Emulation.setGeolocationOverride", JSONObject().apply {
            put("latitude", lat); put("longitude", lng); put("accuracy", accuracy)
        })
    }

    fun setDeviceMetrics(width: Int, height: Int, scale: Double = 1.0, mobile: Boolean = false) {
        call("Emulation.setDeviceMetricsOverride", JSONObject().apply {
            put("width", width); put("height", height)
            put("deviceScaleFactor", scale); put("mobile", mobile)
        })
    }

    fun enableNetwork(onRequest: ((JSONObject) -> Unit)? = null, onResponse: ((JSONObject) -> Unit)? = null) {
        call("Network.enable")
        onRequest?.let { cb -> on("Network.requestWillBeSent") { cb(it) } }
        onResponse?.let { cb -> on("Network.responseReceived") { cb(it) } }
    }

    fun getCookies(url: String? = null): JSONArray {
        val params = JSONObject()
        if (!url.isNullOrEmpty()) params.put("urls", JSONArray().put(url))
        return call("Network.getCookies", params).optJSONArray("cookies") ?: JSONArray()
    }

    fun setCookie(name: String, value: String, domain: String, path: String = "/") {
        call("Network.setCookie", JSONObject().apply {
            put("name", name); put("value", value); put("domain", domain); put("path", path)
        })
    }

    fun clearCookies() { call("Network.clearBrowserCookies") }

    fun close() {
        closed = true
        runCatching { sendFrame(0x8, ByteArray(0)) }
        runCatching { socket?.close() }
        socket = null; input = null; output = null
        pending.values.forEach { it.complete(null, "closed") }
        pending.clear()
    }
}
