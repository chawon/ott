package app.ottline.ui.screens

import android.graphics.Bitmap
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.ottline.model.PersonaKey
import app.ottline.model.WatchLog
import app.ottline.ui.i18n.LocalAppLocale
import app.ottline.ui.i18n.tr
import app.ottline.ui.theme.LocalOttlinePalette
import app.ottline.ui.util.CardExporter
import app.ottline.ui.util.ShareCardRatio
import kotlinx.coroutines.launch

@Composable
fun ShareCardDialog(
    log: WatchLog,
    nickname: String?,
    personaKey: PersonaKey?,
    onDismiss: () -> Unit,
    onExported: ((String) -> Unit)? = null
) {
    val context = LocalContext.current
    val locale = LocalAppLocale.current
    val palette = LocalOttlinePalette.current
    val scope = rememberCoroutineScope()

    val canIncludeSignature = !nickname.isNullOrBlank() && personaKey != null
    val hasNote = !log.note.isNullOrBlank()

    var ratio by remember { mutableStateOf(ShareCardRatio.STORY_9_16) }
    var includeMoment by remember { mutableStateOf(true) }
    var includeNote by remember(log.id, log.note) { mutableStateOf(hasNote) }
    var includeSignature by remember(nickname, personaKey) { mutableStateOf(false) }
    var previewBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var rendering by remember { mutableStateOf(true) }

    LaunchedEffect(log, ratio, includeMoment, includeNote, includeSignature, nickname, personaKey, locale) {
        rendering = true
        previewBitmap = CardExporter.renderShareCardBitmap(
            context = context,
            log = log,
            ratio = ratio,
            includeMoment = includeMoment,
            includeNote = includeNote && hasNote,
            includeSignature = includeSignature && canIncludeSignature,
            nickname = nickname,
            personaKey = personaKey,
            locale = locale
        )
        rendering = false
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            shape = RoundedCornerShape(22.dp),
            color = palette.background,
            border = BorderStroke(1.dp, palette.border),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 24.dp)
        ) {
            Column(
                modifier = Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(18.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = tr("공유 카드 만들기", "Create share card"),
                            style = MaterialTheme.typography.titleLarge,
                            color = palette.ink
                        )
                        Text(
                            text = tr("저장한 기록을 공유 카드로 나눠보세요.", "Share your saved record as a card."),
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.mutedInk
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Outlined.Close, contentDescription = tr("닫기", "Close"), tint = palette.mutedInk)
                    }
                }

                Spacer(Modifier.height(14.dp))

                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 240.dp, max = 380.dp)
                ) {
                    val bmp = previewBitmap
                    if (bmp != null && !rendering) {
                        Image(
                            bitmap = bmp.asImageBitmap(),
                            contentDescription = log.title.name,
                            contentScale = ContentScale.Fit,
                            modifier = Modifier
                                .aspectRatio(ratio.width.toFloat() / ratio.height.toFloat())
                                .clip(RoundedCornerShape(14.dp))
                        )
                    } else {
                        CircularProgressIndicator(color = palette.brandNavy)
                    }
                }

                Spacer(Modifier.height(14.dp))

                Text(
                    text = tr("이미지 비율", "Image ratio"),
                    style = MaterialTheme.typography.labelMedium,
                    color = palette.mutedInk
                )
                Spacer(Modifier.height(6.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = ratio == ShareCardRatio.STORY_9_16,
                        onClick = { ratio = ShareCardRatio.STORY_9_16 },
                        label = { Text(tr("스토리 9:16", "Story 9:16")) }
                    )
                    FilterChip(
                        selected = ratio == ShareCardRatio.FEED_4_5,
                        onClick = { ratio = ShareCardRatio.FEED_4_5 },
                        label = { Text(tr("피드 4:5", "Feed 4:5")) }
                    )
                }

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(top = 6.dp)
                ) {
                    FilterChip(
                        selected = includeMoment,
                        onClick = { includeMoment = !includeMoment },
                        label = { Text(tr("느낌 포함", "Include feeling")) }
                    )
                    FilterChip(
                        selected = includeNote && hasNote,
                        onClick = { if (hasNote) includeNote = !includeNote },
                        enabled = hasNote,
                        label = { Text(tr("한 줄 메모 포함", "Include note")) }
                    )
                }

                if (canIncludeSignature) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(top = 4.dp)
                    ) {
                        FilterChip(
                            selected = includeSignature,
                            onClick = { includeSignature = !includeSignature },
                            label = { Text(tr("아바타와 닉네임 포함", "Include avatar and nickname")) }
                        )
                    }
                }

                Spacer(Modifier.height(16.dp))

                val savedMsg = tr("갤러리에 저장했어요.", "Saved to gallery.")
                val shareChooser = tr("공유 카드 보내기", "Share card")
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedButton(
                        onClick = {
                            val bmp = previewBitmap ?: return@OutlinedButton
                            scope.launch {
                                CardExporter.saveBitmapToGallery(context, bmp, "ottline_card")
                                    .onSuccess {
                                        Toast.makeText(context, savedMsg, Toast.LENGTH_SHORT).show()
                                        onExported?.invoke("save")
                                    }
                            }
                        },
                        enabled = previewBitmap != null && !rendering,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Outlined.Download, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(tr("이미지 저장", "Save image"))
                    }

                    Button(
                        onClick = {
                            val bmp = previewBitmap ?: return@Button
                            scope.launch {
                                CardExporter.shareBitmap(context, bmp, "ottline_card", shareChooser)
                                onExported?.invoke("share")
                            }
                        },
                        enabled = previewBitmap != null && !rendering,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = palette.brandNavy,
                            contentColor = palette.onBrandNavy
                        ),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Outlined.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(tr("공유하기", "Share"))
                    }
                }

                Spacer(Modifier.height(10.dp))

                val sizeLabel = if (ratio == ShareCardRatio.STORY_9_16) "1080×1920 (Story)" else "1080×1350 (Feed)"
                Text(
                    text = tr("이미지 크기: $sizeLabel", "Image size: $sizeLabel"),
                    style = MaterialTheme.typography.labelSmall,
                    color = palette.mutedInk
                )
            }
        }
    }
}
