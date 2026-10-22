package com.ai.assistance.operit.ui.features.settings.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ai.assistance.operit.core.chat.guard.GuardMode
import com.ai.assistance.operit.core.chat.guard.OutputGuardStore
import com.ai.assistance.operit.core.chat.guard.OutputGuardTools

/**
 * 内置输出守卫的设置页。
 *
 * 分为六块：
 * 1. 总开关 + 工作模式
 * 2. 分类检测开关
 * 3. 自定义规则（多行编辑 + 语法说明）
 * 4. 规则分组启停
 * 5. 白名单
 * 6. 试跑 + 统计 + 诊断
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OutputGuardSettingsScreen(
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val store = remember { OutputGuardStore.getInstance(context) }

    var enabled by remember { mutableStateOf(store.isEnabled()) }
    var mode by remember { mutableStateOf(store.mode()) }
    var rulesRaw by remember { mutableStateOf(store.rulesRaw()) }
    var whitelist by remember { mutableStateOf(store.whitelistRaw()) }
    var retryMsg by remember { mutableStateOf(store.retryMessageTemplate()) }

    // 分类开关
    var tKeywords by remember { mutableStateOf(store.toggleValue("keywords")) }
    var tBuiltin by remember { mutableStateOf(store.toggleValue("builtin")) }
    var tStructure by remember { mutableStateOf(store.toggleValue("structure")) }
    var tRole by remember { mutableStateOf(store.toggleValue("role")) }
    var tFold by remember { mutableStateOf(store.toggleValue("foldFullWidth")) }
    var tInvisible by remember { mutableStateOf(store.toggleValue("stripInvisible")) }

    // 分组
    var groups by remember { mutableStateOf(store.ruleGroups()) }
    var enabledGroups by remember { mutableStateOf(store.enabledGroups()) }

    // 试跑
    var probeText by remember { mutableStateOf("") }
    var probeResult by remember { mutableStateOf("") }

    // 统计
    var hitCount by remember { mutableStateOf(store.hitCount()) }
    var lastHit by remember { mutableStateOf(store.lastHit()) }
    var diag by remember { mutableStateOf(store.lastDiagnostics()) }

    fun refreshMeta() {
        groups = store.ruleGroups()
        enabledGroups = store.enabledGroups()
        hitCount = store.hitCount()
        lastHit = store.lastHit()
        diag = store.lastDiagnostics()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("输出守卫") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // ---------- 1. 总开关 + 模式 ----------
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("启用输出守卫", fontWeight = FontWeight.SemiBold)
                            Text(
                                "拦截模型输出中的协议残留、截断结构、角色标记泄漏",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Switch(
                            checked = enabled,
                            onCheckedChange = {
                                enabled = it
                                OutputGuardTools.setEnabled(context, it)
                            }
                        )
                    }

                    Spacer(Modifier.height(4.dp))
                    Text("工作模式", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = mode == GuardMode.OBSERVE,
                            onClick = {
                                mode = GuardMode.OBSERVE
                                OutputGuardTools.setMode(context, "observe")
                            },
                            label = { Text("观察") }
                        )
                        FilterChip(
                            selected = mode == GuardMode.RETRY,
                            onClick = {
                                mode = GuardMode.RETRY
                                OutputGuardTools.setMode(context, "retry")
                            },
                            label = { Text("重出") }
                        )
                        FilterChip(
                            selected = mode == GuardMode.REPAIR,
                            onClick = {
                                mode = GuardMode.REPAIR
                                OutputGuardTools.setMode(context, "repair")
                            },
                            label = { Text("修复") }
                        )
                    }
                    Text(
                        when (mode) {
                            GuardMode.OBSERVE -> "只记录命中，不改动输出。用来调规则，确认不误拦。"
                            GuardMode.RETRY -> "命中即作废本轮，追加重出指令。与旧版守卫一致。"
                            GuardMode.REPAIR -> "命中片段就地删除，不重出。省 token，但可能留下语义缺口。"
                        },
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // ---------- 2. 分类开关 ----------
            Card {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("检测项", fontWeight = FontWeight.SemiBold)
                    ToggleRow("自定义规则", tKeywords, "只检测你写的规则") {
                        tKeywords = it
                        OutputGuardTools.setToggle(context, "keywords", it)
                    }
                    ToggleRow("内置残片", tBuiltin, "invoke / param / im_start 等协议标签残片") {
                        tBuiltin = it
                        OutputGuardTools.setToggle(context, "builtin", it)
                    }
                    ToggleRow("结构完整性", tStructure, "标签未闭合、错配、截断") {
                        tStructure = it
                        OutputGuardTools.setToggle(context, "structure", it)
                    }
                    ToggleRow("角色标记", tRole, "行首 user: / assistant: 等泄漏") {
                        tRole = it
                        OutputGuardTools.setToggle(context, "role", it)
                    }
                    ToggleRow("全角归一", tFold, "把 ＡＢＣ 当 ABC 匹配，防绕过") {
                        tFold = it
                        OutputGuardTools.setToggle(context, "foldFullWidth", it)
                    }
                    ToggleRow("去不可见字符", tInvisible, "零宽空格 / BOM / NBSP 不参与匹配") {
                        tInvisible = it
                        OutputGuardTools.setToggle(context, "stripInvisible", it)
                    }
                }
            }

            // ---------- 3. 自定义规则 ----------
            Card {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("自定义规则", fontWeight = FontWeight.SemiBold)
                    Text(
                        "一行一条。支持前缀：\n" +
                            "  assistant::文字   只对模型输出生效\n" +
                            "  user::文字 / system::文字 / tool::文字 / summary::文字\n" +
                            "  re::正则          按正则匹配\n" +
                            "  g:分组::文字      归入分组，可按组启停\n" +
                            "  不带前缀 = 所有条目都检测\n" +
                            "行内写字面 \\n 表示要求两个 token 连续出现。",
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    OutlinedTextField(
                        value = rulesRaw,
                        onValueChange = { rulesRaw = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(180.dp),
                        textStyle = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                        placeholder = { Text("例如：\nassistant::测试关键词\ng:脏话::某词\nre::^\\s*---\\s*$") },
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.None)
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = {
                            OutputGuardTools.setRules(context, rulesRaw)
                            refreshMeta()
                        }) { Text("保存规则") }
                        OutlinedButton(onClick = {
                            rulesRaw = store.rulesRaw()
                            refreshMeta()
                        }) { Text("重新载入") }
                    }
                    Text(
                        "当前解析到 " + groups.size + " 个分组；保存后自动重新解析。",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // ---------- 4. 分组启停 ----------
            if (groups.isNotEmpty()) {
                Card {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("规则分组", fontWeight = FontWeight.SemiBold)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            groups.forEach { g ->
                                FilterChip(
                                    selected = g in enabledGroups,
                                    onClick = {
                                        val next = if (g in enabledGroups) {
                                            enabledGroups - g
                                        } else {
                                            enabledGroups + g
                                        }
                                        enabledGroups = next
                                        OutputGuardTools.setGroups(context, next.toList())
                                    },
                                    label = { Text(g) }
                                )
                            }
                        }
                    }
                }
            }

            // ---------- 5. 白名单 ----------
            Card {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("白名单块", fontWeight = FontWeight.SemiBold)
                    Text(
                        "这些标签包裹的内容不参与检测。逗号分隔。",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    OutlinedTextField(
                        value = whitelist,
                        onValueChange = { whitelist = it },
                        modifier = Modifier.fillMaxWidth(),
                        textStyle = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace)
                    )
                    Button(onClick = { OutputGuardTools.setWhitelist(context, whitelist) }) {
                        Text("保存白名单")
                    }
                }
            }

            // ---------- 6. 试跑 ----------
            Card {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("试跑检测", fontWeight = FontWeight.SemiBold)
                    Text(
                        "粘贴一段模型输出，看看当前规则会不会拦。不消耗 token。",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    OutlinedTextField(
                        value = probeText,
                        onValueChange = { probeText = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(110.dp),
                        textStyle = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                        placeholder = { Text("粘贴待检测文本") }
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = {
                            probeResult = runCatching {
                                val r = OutputGuardTools.dryRun(context, probeText)
                                val n = (r["hitCount"] as? Int) ?: 0
                                val hits = r["hits"] as? List<*>
                                if (n == 0) {
                                    "未命中，会被放行。"
                                } else {
                                    buildString {
                                        append("命中 ")
                                        append(n)
                                        append(" 项：\n")
                                        hits?.forEach { h ->
                                            val m = h as? Map<*, *> ?: return@forEach
                                            append("  ")
                                            append(m["rule"])
                                            append("  @")
                                            append(m["index"])
                                            append("  → ")
                                            append(m["snippet"])
                                            append("\n")
                                        }
                                    }.trimEnd()
                                }
                            }.getOrElse { "试跑失败: " + it.message }
                        }) { Text("试跑") }
                        OutlinedButton(onClick = { probeText = ""; probeResult = "" }) {
                            Text("清空")
                        }
                    }
                    if (probeResult.isNotEmpty()) {
                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                            Text(
                                probeResult,
                                modifier = Modifier.padding(12.dp),
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }
                }
            }

            // ---------- 7. 重出指令模板 ----------
            Card {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("重出指令", fontWeight = FontWeight.SemiBold)
                    Text(
                        "重出模式下追加给模型的指令。{n} 会替换为命中数。留空用默认。",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    OutlinedTextField(
                        value = retryMsg,
                        onValueChange = { retryMsg = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(100.dp),
                        textStyle = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                        placeholder = { Text("留空 = 默认指令") }
                    )
                    Button(onClick = { OutputGuardTools.setRetryMessage(context, retryMsg) }) {
                        Text("保存")
                    }
                }
            }

            // ---------- 8. 统计与诊断 ----------
            Card {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("累计命中 " + hitCount + " 次", fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.weight(1f))
                        TextButton(onClick = {
                            OutputGuardTools.resetStats(context)
                            refreshMeta()
                        }) { Text("清零") }
                    }
                    if (lastHit.isNotEmpty()) {
                        Text(
                            "最近一次：" + lastHit,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    if (diag.isNotEmpty()) {
                        Text("诊断记录", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant
                            )
                        ) {
                            Text(
                                diag,
                                modifier = Modifier.padding(12.dp),
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }
                    TextButton(onClick = { refreshMeta() }) { Text("刷新") }
                }
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun ToggleRow(
    title: String,
    checked: Boolean,
    hint: String,
    onChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 13.sp)
            Text(hint, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Spacer(Modifier.width(8.dp))
        Switch(checked = checked, onCheckedChange = onChange)
    }
}