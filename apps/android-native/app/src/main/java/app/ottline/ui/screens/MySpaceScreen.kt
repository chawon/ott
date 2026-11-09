package app.ottline.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.AutoStories
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.DeleteForever
import androidx.compose.material.icons.outlined.Devices
import androidx.compose.material.icons.outlined.Dns
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.MailOutline
import androidx.compose.material.icons.outlined.NotificationsActive
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.ottline.BuildConfig
import app.ottline.RevisitReminderScheduler
import app.ottline.data.OttlineRepository
import app.ottline.data.local.AppPreferences
import app.ottline.data.local.PreferencesSnapshot
import app.ottline.domain.CsvExporter
import app.ottline.domain.RecordDate
import app.ottline.model.DeviceInfo
import app.ottline.model.PersonaKey
import app.ottline.model.TitleType
import app.ottline.model.WatchLog
import app.ottline.ui.components.PersonaAvatar
import app.ottline.ui.i18n.LocalAppLocale
import app.ottline.ui.i18n.OttlineStrings
import app.ottline.ui.i18n.tr
import app.ottline.ui.theme.LocalOttlinePalette
import app.ottline.ui.util.CardExporter
import kotlinx.coroutines.launch

/**
 * My Space (`/account`) aligned with mobile web v2 progressive disclosure (U03):
 * 1. Compact Profile Summary (`내 모습 고르기` collapsed by default)
 * 2. `내 기록 이어보기` (Connection Code + Recovery Card + Pair + Collapsible Lost Code & Devices)
 * 3. Secondary Navigation Hub (Report, Bookshelf, Post-watch Reminder, Support, Guides)
 * 4. Display, Language (`LocaleManager` synced, A03), Revisit Reminder (`PATCH` + retry state, F03), & CSV
 * 5. Local Reset & Permanent Server Account Deletion
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MySpaceScreen(
    allLogs: List<WatchLog>,
    prefsSnapshot: PreferencesSnapshot,
    repository: OttlineRepository,
    onOpenReport: () -> Unit,
    onOpenBookshelf: () -> Unit,
    onOpenFeedback: () -> Unit,
    onOpenWatchReminder: () -> Unit,
    onOpenGuides: () -> Unit
) {
    val context = LocalContext.current
    val locale = LocalAppLocale.current
    val palette = LocalOttlinePalette.current
    val scope = rememberCoroutineScope()

    // Profile editor progressive disclosure state (collapsed by default — U03)
    var profileEditorOpen by rememberSaveable { mutableStateOf(false) }
    var nicknameInput by remember {
        mutableStateOf(prefsSnapshot.nickname.orEmpty())
    }
    var selectedPersona by remember {
        mutableStateOf(prefsSnapshot.personaKey ?: PersonaKey.CINEMA_KEEPER)
    }
    var savingProfile by remember { mutableStateOf(false) }

    LaunchedEffect(prefsSnapshot.userId, prefsSnapshot.nickname, prefsSnapshot.personaKey) {
        nicknameInput = prefsSnapshot.nickname.orEmpty()
        selectedPersona = prefsSnapshot.personaKey ?: PersonaKey.CINEMA_KEEPER
        if (prefsSnapshot.userId.isNullOrBlank()) {
            profileEditorOpen = false
        }
    }

    // Pairing & Devices state
    var pairCodeInput by rememberSaveable { mutableStateOf("") }
    var showMergeConfirm by remember { mutableStateOf(false) }
    var pairingBusy by remember { mutableStateOf(false) }
    var pairMessage by remember { mutableStateOf<String?>(null) }
    var devices by remember { mutableStateOf<List<DeviceInfo>>(emptyList()) }
    var lostCodeExpanded by rememberSaveable { mutableStateOf(false) }
    var devicesExpanded by rememberSaveable { mutableStateOf(false) }

    // Revisit reminder live sync state (F03)
    val revisitUiState by RevisitReminderScheduler.uiState.collectAsState()
    var revisitSyncing by remember { mutableStateOf(false) }

    // Account danger dialogs
    var showLocalResetDialog by remember { mutableStateOf(false) }
    var showServerDeleteDialog by remember { mutableStateOf(false) }

    // Debug server switcher state
    var debugServerInput by remember(prefsSnapshot.apiBaseUrl) {
        mutableStateOf(prefsSnapshot.apiBaseUrl)
    }
    var pingStatus by remember { mutableStateOf<String?>(null) }

    suspend fun reloadDevices() {
        if (prefsSnapshot.userId.isNullOrBlank()) {
            devices = emptyList()
            return
        }
        runCatching { repository.api.getDevices() }
            .onSuccess { devices = it }
    }

    LaunchedEffect(Unit) {
        RevisitReminderScheduler.refreshUiState(context)
    }

    LaunchedEffect(prefsSnapshot.userId) {
        if (!prefsSnapshot.userId.isNullOrBlank()) {
            repository.refreshProfile()
            reloadDevices()
        } else {
            devices = emptyList()
        }
    }

    fun executePair(code: String) {
        val successToast = if (locale == "en") "Connected! Your timeline is synced." else "연결 완료! 타임라인을 이어왔어요."
        scope.launch {
            pairingBusy = true
            pairMessage = null
            runCatching { repository.pairWithCode(code) }
                .onSuccess {
                    pairCodeInput = ""
                    pairingBusy = false
                    Toast.makeText(context, successToast, Toast.LENGTH_SHORT).show()
                    reloadDevices()
                }
                .onFailure { err ->
                    pairMessage = err.message
                    pairingBusy = false
                }
        }
    }

    LazyColumn(
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = tr("나만의 수첩 설정", "PERSONAL NOTEBOOK"),
                    style = MaterialTheme.typography.labelSmall,
                    color = palette.mutedInk
                )
                Text(
                    text = tr("내 공간", "My space"),
                    style = MaterialTheme.typography.headlineMedium,
                    color = palette.ink
                )
            }
        }

        // 1. Compact Storybook Profile Summary + Progressive Disclosure Editor (U03)
        item {
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = palette.card,
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    modifier = Modifier.padding(16.dp)
                ) {
                    val canEditProfile = !prefsSnapshot.userId.isNullOrBlank() || allLogs.isNotEmpty()
                    val displayPersona = if (profileEditorOpen) selectedPersona else prefsSnapshot.personaKey
                    val displayTitle = prefsSnapshot.nickname?.takeIf { it.isNotBlank() }
                        ?: tr("나의 타임라인에, 나다운 모습", "A familiar face for your timeline")
                    val displaySubtitle = if (prefsSnapshot.personaKey != null) {
                        "${OttlineStrings.personaLabel(prefsSnapshot.personaKey, locale)} · ${OttlineStrings.personaDescription(prefsSnapshot.personaKey, locale)}"
                    } else {
                        tr("닉네임과 아바타로 내 공간을 꾸며보세요.", "Make this space yours with a nickname and avatar.")
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        PersonaAvatar(
                            personaKey = displayPersona,
                            nickname = prefsSnapshot.nickname,
                            size = 56.dp
                        )
                        Spacer(Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = displayTitle,
                                style = MaterialTheme.typography.titleMedium,
                                color = palette.ink
                            )
                            Text(
                                text = displaySubtitle,
                                style = MaterialTheme.typography.bodySmall,
                                color = palette.mutedInk
                            )
                        }
                        if (canEditProfile) {
                            Spacer(Modifier.width(8.dp))
                            OutlinedButton(
                                onClick = { profileEditorOpen = !profileEditorOpen },
                                shape = RoundedCornerShape(8.dp),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = if (profileEditorOpen) tr("닫기", "Close") else tr("내 모습 고르기", "Choose my look"),
                                    style = MaterialTheme.typography.labelMedium
                                )
                            }
                        }
                    }

                    if (!canEditProfile) {
                        Text(
                            text = tr(
                                "첫 기록을 남기거나 기존 기록을 연결한 뒤 내 모습을 고를 수 있어요.",
                                "Leave your first record or connect your existing records to choose your profile."
                            ),
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.mutedInk
                        )
                    }

                    AnimatedVisibility(visible = profileEditorOpen) {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text(
                                text = tr("동화풍 아바타 고르기", "Choose your storybook avatar"),
                                style = MaterialTheme.typography.labelLarge,
                                color = palette.ink
                            )

                            FlowRow(
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                PersonaKey.entries.forEach { pk ->
                                    val isSelected = selectedPersona == pk
                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(8.dp))
                                            .clickable { selectedPersona = pk }
                                            .padding(4.dp)
                                    ) {
                                        PersonaAvatar(
                                            personaKey = pk,
                                            size = 46.dp,
                                            shape = RoundedCornerShape(8.dp),
                                            modifier = if (isSelected) {
                                                Modifier.border(2.5.dp, palette.brandNavy, RoundedCornerShape(8.dp))
                                            } else Modifier
                                        )
                                        Spacer(Modifier.height(4.dp))
                                        Text(
                                            text = OttlineStrings.personaLabel(pk, locale),
                                            style = MaterialTheme.typography.labelSmall,
                                            color = if (isSelected) palette.brandNavy else palette.mutedInk
                                        )
                                    }
                                }
                            }

                            OutlinedTextField(
                                value = nicknameInput,
                                onValueChange = { nicknameInput = it.take(32) },
                                label = { Text(tr("닉네임 (최대 32자)", "Nickname (up to 32 chars)")) },
                                singleLine = true,
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            )

                            val profileSavedMsg = tr("프로필을 저장했어요.", "Profile saved.")
                            Button(
                                onClick = {
                                    if (nicknameInput.trim().isEmpty() || savingProfile) return@Button
                                    scope.launch {
                                        savingProfile = true
                                        runCatching {
                                            repository.saveUserProfile(nicknameInput.trim(), selectedPersona)
                                        }.onSuccess {
                                            profileEditorOpen = false
                                            Toast.makeText(context, profileSavedMsg, Toast.LENGTH_SHORT).show()
                                        }.onFailure { err ->
                                            repository.prefs.saveProfile(nicknameInput.trim(), selectedPersona)
                                            profileEditorOpen = false
                                            Toast.makeText(context, err.message ?: profileSavedMsg, Toast.LENGTH_SHORT).show()
                                        }
                                        savingProfile = false
                                    }
                                },
                                enabled = nicknameInput.trim().isNotEmpty() && !savingProfile,
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = palette.brandNavy,
                                    contentColor = palette.onBrandNavy
                                ),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(min = 48.dp)
                            ) {
                                Text(tr("프로필 저장", "Save profile"), fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        // 2. `내 기록 이어보기` — Connection Code, Recovery Card, Pairing & Collapsible Devices (Moved up per U03!)
        item {
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = palette.paperStrong,
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.padding(16.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Key, contentDescription = null, tint = palette.brandNavy)
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = tr("내 기록 이어보기 · 연결 코드", "Continue your timeline · Code"),
                            style = MaterialTheme.typography.titleMedium,
                            color = palette.ink
                        )
                    }

                    Text(
                        text = tr(
                            "이메일이나 비밀번호 없이 연결 코드 하나로 휴대폰·태블릿·웹을 이어줘요. 코드는 혼자만 보관해 주세요.",
                            "Link your phones and browsers with a single private code—no email sign-up required."
                        ),
                        style = MaterialTheme.typography.bodySmall,
                        color = palette.mutedInk
                    )

                    if (!prefsSnapshot.pairingCode.isNullOrBlank()) {
                        val code = prefsSnapshot.pairingCode
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = palette.card,
                            border = BorderStroke(1.dp, palette.brandNavy.copy(alpha = 0.35f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)
                            ) {
                                Text(
                                    text = code,
                                    style = MaterialTheme.typography.titleLarge.copy(
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold
                                    ),
                                    color = palette.ink
                                )
                                val copiedMsg = tr("연결 코드를 복사했어요.", "Copied connection code.")
                                TextButton(
                                    onClick = {
                                        val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                        cm.setPrimaryClip(ClipData.newPlainText("ottline code", code))
                                        Toast.makeText(context, copiedMsg, Toast.LENGTH_SHORT).show()
                                    }
                                ) {
                                    Icon(Icons.Outlined.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text(tr("복사", "Copy"))
                                }
                            }
                        }

                        val savedRecoveryMsg = tr("보관 카드를 갤러리에 저장했어요.", "Saved recovery card to gallery.")
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    val bmp = CardExporter.renderRecoveryCardBitmap(
                                        context = context,
                                        pairingCode = code,
                                        nickname = prefsSnapshot.nickname,
                                        locale = locale
                                    )
                                    CardExporter.saveBitmapToGallery(context, bmp, "ottline_recovery")
                                        .onSuccess {
                                            repository.prefs.markSingleDeviceReminderShown()
                                            Toast.makeText(context, savedRecoveryMsg, Toast.LENGTH_SHORT).show()
                                        }
                                }
                            },
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 46.dp)
                        ) {
                            Icon(Icons.Outlined.Download, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(tr("보관 카드 이미지로 저장", "Save private recovery card PNG"))
                        }
                    } else {
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    runCatching { repository.ensureAuthenticated() }
                                    reloadDevices()
                                }
                            },
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 46.dp)
                        ) {
                            Text(tr("내 연결 코드 발급받기", "Generate my connection code"))
                        }
                    }

                    // Pair with another device's code
                    OutlinedTextField(
                        value = pairCodeInput,
                        onValueChange = { pairCodeInput = it.uppercase().take(24) },
                        label = { Text(tr("다른 기기의 연결 코드 입력", "Enter code from another device")) },
                        singleLine = true,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Button(
                        onClick = {
                            if (pairCodeInput.trim().isEmpty() || pairingBusy) return@Button
                            if (allLogs.isNotEmpty()) {
                                showMergeConfirm = true
                            } else {
                                executePair(pairCodeInput)
                            }
                        },
                        enabled = pairCodeInput.trim().isNotEmpty() && !pairingBusy,
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = palette.brandNavy,
                            contentColor = palette.onBrandNavy
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp)
                    ) {
                        Text(tr("연결 코드로 이어받기", "Link with code"), fontWeight = FontWeight.SemiBold)
                    }

                    if (pairMessage != null) {
                        Text(pairMessage!!, style = MaterialTheme.typography.bodySmall, color = palette.danger)
                    }

                    // Collapsible "Lost your code?" helper
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = palette.card,
                        border = BorderStroke(1.dp, palette.border),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { lostCodeExpanded = !lostCodeExpanded }
                                    .padding(horizontal = 12.dp, vertical = 10.dp)
                            ) {
                                Text(
                                    text = tr("코드를 잃어버렸나요?", "Lost your connection code?"),
                                    style = MaterialTheme.typography.labelLarge,
                                    color = palette.ink
                                )
                                Icon(
                                    imageVector = if (lostCodeExpanded) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
                                    contentDescription = null,
                                    tint = palette.mutedInk
                                )
                            }
                            AnimatedVisibility(visible = lostCodeExpanded) {
                                Column(
                                    verticalArrangement = Arrangement.spacedBy(6.dp),
                                    modifier = Modifier.padding(start = 12.dp, end = 12.dp, bottom = 12.dp)
                                ) {
                                    Text(
                                        text = tr(
                                            "이전에 로그인해 둔 웹 브라우저(ottline.app/account)나 다른 기기가 남아 있다면 그곳에서 동일한 연결 코드를 다시 확인할 수 있어요. 모든 기기 기록이 지워졌다면 내 문의함으로 알려주세요.",
                                            "If you still have an active browser session (ottline.app/account) or tablet, open My Space there to view the same code—or reach out via Feedback."
                                        ),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = palette.mutedInk
                                    )
                                    TextButton(
                                        onClick = onOpenFeedback,
                                        contentPadding = PaddingValues(0.dp)
                                    ) {
                                        Text(tr("내 문의함 열기", "Open Support"), color = palette.brandNavy)
                                    }
                                }
                            }
                        }
                    }

                    // Collapsible Connected Devices List
                    if (devices.isNotEmpty()) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = palette.card,
                            border = BorderStroke(1.dp, palette.border),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { devicesExpanded = !devicesExpanded }
                                        .padding(horizontal = 12.dp, vertical = 10.dp)
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Outlined.Devices, contentDescription = null, modifier = Modifier.size(18.dp), tint = palette.ink)
                                        Spacer(Modifier.width(6.dp))
                                        Text(
                                            text = tr("연결된 기기 (${devices.size})", "Linked devices (${devices.size})"),
                                            style = MaterialTheme.typography.labelLarge,
                                            color = palette.ink
                                        )
                                    }
                                    Icon(
                                        imageVector = if (devicesExpanded) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
                                        contentDescription = null,
                                        tint = palette.mutedInk
                                    )
                                }

                                AnimatedVisibility(visible = devicesExpanded) {
                                    Column(
                                        verticalArrangement = Arrangement.spacedBy(8.dp),
                                        modifier = Modifier.padding(start = 12.dp, end = 12.dp, bottom = 12.dp)
                                    ) {
                                        if (devices.size > 1) {
                                            Row(
                                                horizontalArrangement = Arrangement.End,
                                                modifier = Modifier.fillMaxWidth()
                                            ) {
                                                TextButton(
                                                    onClick = {
                                                        scope.launch {
                                                            runCatching { repository.api.unlinkAllDevices() }
                                                                .onSuccess { repository.resetLocalData() }
                                                        }
                                                    },
                                                    contentPadding = PaddingValues(0.dp)
                                                ) {
                                                    Text(tr("전체 기기 연결 해제", "Unlink all devices"), color = palette.danger)
                                                }
                                            }
                                        }
                                        devices.forEach { dev ->
                                            val isCurrent = dev.id == prefsSnapshot.deviceId
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(vertical = 4.dp)
                                            ) {
                                                Column(modifier = Modifier.weight(1f)) {
                                                    val label = listOfNotNull(dev.os, dev.browser)
                                                        .joinToString(" · ")
                                                        .ifBlank { "Android" }
                                                    Text(
                                                        text = if (isCurrent) "$label · ${tr("현재 기기", "This device")}" else label,
                                                        style = MaterialTheme.typography.labelMedium,
                                                        color = if (isCurrent) palette.brandNavy else palette.ink
                                                    )
                                                    Text(
                                                        text = RecordDate.formatDisplayDate(dev.lastSeenAt ?: dev.createdAt, locale),
                                                        style = MaterialTheme.typography.labelSmall,
                                                        color = palette.subtleInk
                                                    )
                                                }
                                                if (!isCurrent) {
                                                    TextButton(
                                                        onClick = {
                                                            scope.launch {
                                                                runCatching { repository.api.unlinkDevice(dev.id) }
                                                                    .onSuccess { reloadDevices() }
                                                            }
                                                        }
                                                    ) {
                                                        Text(tr("해제", "Unlink"), color = palette.danger)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 3. Quick Navigation Hub (Report, Bookshelf, Watch Reminder, Feedback, Guides)
        item {
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = palette.card,
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(vertical = 4.dp)) {
                    NavRowItem(
                        icon = Icons.Outlined.BarChart,
                        title = tr("내 이용 리포트", "My Timeline Report"),
                        subtitle = tr("주간·월간 리캡 스토리 카드와 감상 통계", "Weekly & monthly recap cards and stats"),
                        onClick = onOpenReport
                    )
                    NavRowItem(
                        icon = Icons.Outlined.AutoStories,
                        title = tr("내 서가", "My Bookshelf"),
                        subtitle = tr("KDC 십진분류로 정리된 나만의 책장", "Books organized by KDC subjects"),
                        onClick = onOpenBookshelf
                    )
                    NavRowItem(
                        icon = Icons.Outlined.NotificationsActive,
                        title = tr("감상 후 기록 알림", "Post-watch Reminder"),
                        subtitle = tr("넷플릭스·티빙 등 감상 직후 부드러운 알림", "Gentle prompt after watching on OTT apps"),
                        onClick = onOpenWatchReminder
                    )
                    NavRowItem(
                        icon = Icons.Outlined.MailOutline,
                        title = tr("내 문의함", "Feedback & Support"),
                        subtitle = tr("의견 남기기 · 신고 접수 · 운영팀 답변 확인", "Questions, ideas, and support replies"),
                        onClick = onOpenFeedback
                    )
                    NavRowItem(
                        icon = Icons.AutoMirrored.Outlined.HelpOutline,
                        title = tr("기록 가이드 · 서비스 안내", "Guides & Privacy"),
                        subtitle = tr("오프라인 보관 원리와 개인정보 처리 안내", "How local-first sync & privacy work"),
                        onClick = onOpenGuides
                    )
                }
            }
        }

        // 4. App Preferences (Revisit Notifications + F03 Retry, CSV Export)
        item {
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = palette.card,
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = tr("알림 및 데이터 설정", "Notifications & Data"),
                        style = MaterialTheme.typography.titleMedium,
                        color = palette.ink
                    )

                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = tr("기록 돌아보기 알림", "Timeline revisit reminders"),
                                    style = MaterialTheme.typography.titleSmall,
                                    color = palette.ink
                                )
                                Text(
                                    text = tr("이어보는 작품이나 남겨둔 추억을 가끔 알려드려요.", "Occasional gentle nudges for stories in progress."),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = palette.mutedInk
                                )
                            }
                            Switch(
                                checked = revisitUiState.enabled,
                                onCheckedChange = { enabled ->
                                    scope.launch {
                                        revisitSyncing = true
                                        RevisitReminderScheduler.setEnabledAwait(context, enabled)
                                        revisitSyncing = false
                                    }
                                }
                            )
                        }

                        if (revisitUiState.lastSyncError != null) {
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = palette.paperStrong,
                                border = BorderStroke(1.dp, palette.border),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                                ) {
                                    Text(
                                        text = tr(
                                            "알림 설정은 기기에 저장됐지만 서버 동기화가 지연되고 있어요.",
                                            "Saved on device; server preference sync is pending."
                                        ),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = palette.mutedInk,
                                        modifier = Modifier.weight(1f)
                                    )
                                    TextButton(
                                        onClick = {
                                            scope.launch {
                                                revisitSyncing = true
                                                RevisitReminderScheduler.bindDeviceIfAuthenticated(context, force = true)
                                                RevisitReminderScheduler.flushPendingPreferenceIfNeeded(context)
                                                revisitSyncing = false
                                            }
                                        },
                                        enabled = !revisitSyncing
                                    ) {
                                        Icon(Icons.Outlined.Refresh, contentDescription = null, modifier = Modifier.size(15.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text(tr("재시도", "Retry"))
                                    }
                                }
                            }
                        }
                    }

                    // CSV Export (All / Video / Book)
                    if (allLogs.isNotEmpty()) {
                        Text(tr("CSV로 내보내기", "Export CSV"), style = MaterialTheme.typography.labelLarge, color = palette.mutedInk)
                        val chooser = tr("CSV 내보내기", "Export CSV")
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf(
                                Triple("all", tr("전체", "All"), allLogs),
                                Triple("video", tr("영상만", "Video"), allLogs.filter { it.title.type != TitleType.BOOK }),
                                Triple("book", tr("책만", "Book"), allLogs.filter { it.title.type == TitleType.BOOK })
                            ).forEach { (key, label, targetLogs) ->
                                OutlinedButton(
                                    onClick = {
                                        if (targetLogs.isEmpty()) return@OutlinedButton
                                        scope.launch {
                                            val csv = CsvExporter.buildCsv(targetLogs, locale)
                                            CardExporter.shareCsvText(
                                                context = context,
                                                csvContent = csv,
                                                fileName = "ottline-$key-${RecordDate.todayInputDate()}.csv",
                                                chooserTitle = chooser
                                            )
                                        }
                                    },
                                    shape = RoundedCornerShape(8.dp),
                                    enabled = targetLogs.isNotEmpty(),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text(label)
                                }
                            }
                        }
                    }
                }
            }
        }

        // 5. Debug API Server Switcher (Debug only)
        if (BuildConfig.ALLOW_SERVER_SWITCHER) {
            item {
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = palette.paperStrong,
                    border = BorderStroke(1.dp, palette.brandNavy.copy(alpha = 0.35f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.Dns, contentDescription = null, tint = palette.brandNavy)
                            Spacer(Modifier.width(8.dp))
                            Text(
                                text = "Debug API Server Switcher",
                                style = MaterialTheme.typography.titleMedium,
                                color = palette.ink
                            )
                        }
                        Text(
                            text = "현재 연결 대상: ${prefsSnapshot.apiBaseUrl}",
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.brandNavy
                        )

                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            AppPreferences.DEBUG_SERVER_PRESETS.forEach { (label, url) ->
                                FilterChip(
                                    selected = prefsSnapshot.apiBaseUrl == url,
                                    onClick = {
                                        debugServerInput = url
                                        repository.prefs.setDebugApiBaseUrl(url)
                                        pingStatus = null
                                    },
                                    shape = RoundedCornerShape(8.dp),
                                    label = { Text(label, style = MaterialTheme.typography.labelSmall) }
                                )
                            }
                        }

                        OutlinedTextField(
                            value = debugServerInput,
                            onValueChange = { debugServerInput = it },
                            label = { Text("Custom API Base URL") },
                            singleLine = true,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        OutlinedButton(
                            onClick = {
                                repository.prefs.setDebugApiBaseUrl(debugServerInput)
                                scope.launch {
                                    pingStatus = "Pinging..."
                                    repository.api.pingHealth()
                                        .onSuccess { pingStatus = "OK · $it" }
                                        .onFailure { pingStatus = "FAILED · ${it.message}" }
                                }
                            },
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("적용 및 연결 확인 (Ping)")
                        }

                        if (pingStatus != null) {
                            Text(
                                text = pingStatus!!,
                                style = MaterialTheme.typography.labelMedium,
                                color = if (pingStatus!!.startsWith("OK")) palette.success else palette.danger
                            )
                        }
                    }
                }
            }
        }

        // 6. Local Reset & Full Account Deletion (per 낙장불입 policy, individual log deletion is absent; only full reset/deletion remain)
        item {
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = palette.card,
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = tr("데이터 초기화 및 계정 삭제", "Reset & Account Deletion"),
                        style = MaterialTheme.typography.titleSmall,
                        color = palette.ink
                    )
                    OutlinedButton(
                        onClick = { showLocalResetDialog = true },
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 46.dp)
                    ) {
                        Text(tr("이 기기 연결 해제 (서버 기록 유지)", "Reset local device only"))
                    }
                    TextButton(
                        onClick = { showServerDeleteDialog = true },
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 46.dp)
                    ) {
                        Icon(Icons.Outlined.DeleteForever, contentDescription = null, tint = palette.danger)
                        Spacer(Modifier.width(4.dp))
                        Text(
                            text = tr("서버 계정 및 모든 기록 영구 삭제", "Permanently delete account & server data"),
                            color = palette.danger
                        )
                    }
                }
            }
        }
    }

    if (showMergeConfirm) {
        AlertDialog(
            onDismissRequest = { showMergeConfirm = false },
            title = { Text(tr("기존 기록과 합칠까요?", "Merge with existing records?")) },
            text = {
                Text(
                    tr(
                        "이미 이 기기에 남긴 기록 ${allLogs.size}개가 있어요. 연결하면 두 타임라인이 하나로 합쳐지고, 같은 작품은 더 최근에 고친 기록이 남아요. 합친 뒤에는 되돌릴 수 없어요.",
                        "You have ${allLogs.size} records on this device. Linking will merge both timelines (newest edit wins on duplicates) and cannot be undone."
                    )
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showMergeConfirm = false
                        executePair(pairCodeInput)
                    }
                ) {
                    Text(tr("합치고 연결하기", "Merge & link"), fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showMergeConfirm = false }) {
                    Text(tr("취소", "Cancel"))
                }
            }
        )
    }

    if (showLocalResetDialog) {
        AlertDialog(
            onDismissRequest = { showLocalResetDialog = false },
            title = { Text(tr("이 기기에서 연결을 해제할까요?", "Reset this device?")) },
            text = {
                Text(
                    tr(
                        "이 기기의 로컬 기록만 비워지며, 연결 코드를 보관해 두셨다면 언제든 다시 이어볼 수 있어요.",
                        "Clears local data on this device only. Keep your connection code to restore anytime."
                    )
                )
            },
            confirmButton = {
                val resetDoneMsg = tr("로컬 데이터가 초기화되었어요.", "Local data has been reset.")
                TextButton(
                    onClick = {
                        showLocalResetDialog = false
                        profileEditorOpen = false
                        nicknameInput = ""
                        selectedPersona = PersonaKey.CINEMA_KEEPER
                        scope.launch {
                            repository.resetLocalData()
                            Toast.makeText(context, resetDoneMsg, Toast.LENGTH_SHORT).show()
                        }
                    }
                ) {
                    Text(tr("초기화", "Reset"), color = palette.danger)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLocalResetDialog = false }) {
                    Text(tr("취소", "Cancel"))
                }
            }
        )
    }

    if (showServerDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showServerDeleteDialog = false },
            title = { Text(tr("모든 기록을 영구 삭제할까요?", "Delete account permanently?")) },
            text = {
                Text(
                    tr(
                        "서버에 저장된 타임라인, 연결된 모든 기기, 프로필이 즉시 삭제되며 복구할 수 없어요.",
                        "Your server timeline, profile, and all linked devices will be permanently deleted and cannot be recovered."
                    )
                )
            },
            confirmButton = {
                val deletedMsg = tr("서버 데이터 전체 삭제가 완료되었어요.", "All server data has been deleted.")
                val deleteFailedMsg = tr("서버 데이터 전체 삭제에 실패했어요. 연결 상태를 확인해 주세요.", "Failed to delete all server data.")
                TextButton(
                    onClick = {
                        showServerDeleteDialog = false
                        scope.launch {
                            runCatching { repository.deleteServerAccountAndLocalData() }
                                .onSuccess {
                                    profileEditorOpen = false
                                    nicknameInput = ""
                                    selectedPersona = PersonaKey.CINEMA_KEEPER
                                    devices = emptyList()
                                    Toast.makeText(context, deletedMsg, Toast.LENGTH_SHORT).show()
                                }
                                .onFailure { err ->
                                    Toast.makeText(context, err.message ?: deleteFailedMsg, Toast.LENGTH_LONG).show()
                                }
                        }
                    }
                ) {
                    Text(tr("영구 삭제", "Delete forever"), color = palette.danger)
                }
            },
            dismissButton = {
                TextButton(onClick = { showServerDeleteDialog = false }) {
                    Text(tr("취소", "Cancel"))
                }
            }
        )
    }
}

@Composable
private fun NavRowItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    val palette = LocalOttlinePalette.current
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        Icon(icon, contentDescription = null, tint = palette.brandNavy, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall, color = palette.ink)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = palette.mutedInk)
        }
        Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, contentDescription = null, tint = palette.subtleInk)
    }
}
