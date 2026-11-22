package app.ottline.data.local

import android.content.Context
import android.content.SharedPreferences
import app.ottline.model.RecommendationExclusionItem
import java.util.UUID
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
enum class RecommendationOperationKind {
    @SerialName("exclude") EXCLUDE,
    @SerialName("restore") RESTORE
}

@Serializable
data class RecommendationPendingOperation(
    val id: String,
    val kind: RecommendationOperationKind,
    val item: RecommendationExclusionItem,
    val key: String? = null,
    val sourceId: String? = null
)

@Serializable
data class RecommendationQueue(
    val legacyImported: Boolean = false,
    val operations: List<RecommendationPendingOperation> = emptyList(),
    val generationRequestIds: Map<String, String> = emptyMap()
) {
    fun pendingRequestId(locale: String): String? = generationRequestIds[normalizeLocale(locale)]

    fun withRequestId(locale: String, requestId: String?): RecommendationQueue {
        val norm = normalizeLocale(locale)
        val nextIds = generationRequestIds.toMutableMap()
        if (requestId.isNullOrBlank()) {
            nextIds.remove(norm)
        } else {
            nextIds[norm] = requestId
        }
        return copy(generationRequestIds = nextIds)
    }

    companion object {
        fun normalizeLocale(locale: String): String =
            if (locale.lowercase().startsWith("en")) "en" else "ko"
    }
}

/**
 * Account-scoped durable store for recommendation generation idempotency (`requestId` per account+locale)
 * and pending offline exclude/restore intentions. Survives process death and isolates accounts cleanly.
 */
class RecommendationStore(context: Context) {
    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    fun readQueue(userId: String): RecommendationQueue {
        val raw = prefs.getString("$KEY_QUEUE_PREFIX$userId", null) ?: return RecommendationQueue()
        return runCatching {
            val parsed = json.decodeFromString<RecommendationQueue>(raw)
            val validIds = parsed.generationRequestIds.filter { (lang, id) ->
                (lang == "ko" || lang == "en") && UUID_REGEX.matches(id)
            }
            val validOps = parsed.operations.filter { op ->
                op.id.isNotBlank() && op.item.name.isNotBlank()
            }
            parsed.copy(
                operations = validOps,
                generationRequestIds = validIds
            )
        }.getOrDefault(RecommendationQueue())
    }

    fun saveQueue(userId: String, queue: RecommendationQueue) {
        prefs.edit()
            .putString("$KEY_QUEUE_PREFIX$userId", json.encodeToString(queue))
            .apply()
    }

    /**
     * Imports legacy 2.0.4 name-only dismissed titles at most once per device, attributing them to the
     * first account that claims them without erasing the legacy preference key.
     */
    fun importLegacyDismissedOnce(
        userId: String,
        legacyDismissedNames: Set<String>,
        newId: () -> String = { UUID.randomUUID().toString() }
    ): RecommendationQueue {
        val existing = readQueue(userId)
        if (existing.legacyImported) return existing

        val legacyOwner = prefs.getString(KEY_LEGACY_OWNER, null)?.takeIf { it.isNotBlank() }
        val namesToImport = if (legacyOwner == null || legacyOwner == userId) {
            legacyDismissedNames
                .map { it.trim() }
                .filter { it.isNotEmpty() && it.length <= 255 }
                .distinct()
        } else {
            emptyList()
        }

        if (namesToImport.isNotEmpty() && legacyOwner == null) {
            prefs.edit().putString(KEY_LEGACY_OWNER, userId).apply()
        }

        val migratedOps = namesToImport.map { name ->
            RecommendationPendingOperation(
                id = newId(),
                kind = RecommendationOperationKind.EXCLUDE,
                item = RecommendationExclusionItem(name = name, type = null)
            )
        }
        val next = existing.copy(
            legacyImported = true,
            operations = existing.operations + migratedOps
        )
        saveQueue(userId, next)
        return next
    }

    fun clearUser(userId: String) {
        prefs.edit()
            .remove("$KEY_QUEUE_PREFIX$userId")
            .apply()
    }

    companion object {
        internal const val PREFS_NAME = "ottline.recommendations_v1"
        private const val KEY_QUEUE_PREFIX = "queue:"
        private const val KEY_LEGACY_OWNER = "legacy_owner"
        private val UUID_REGEX = Regex("^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$")
    }
}
