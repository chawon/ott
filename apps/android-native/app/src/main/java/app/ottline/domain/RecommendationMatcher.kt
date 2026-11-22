package app.ottline.domain

import app.ottline.data.local.RecommendationOperationKind
import app.ottline.data.local.RecommendationPendingOperation
import app.ottline.model.Provider
import app.ottline.model.RecommendationExclusion
import app.ottline.model.RecommendationExclusionItem
import app.ottline.model.RecommendationItem
import app.ottline.model.Title
import app.ottline.model.TitleType
import java.text.Normalizer
import kotlin.math.abs

/**
 * Cross-platform parity matcher mirroring `apps/web/lib/recommendations.ts` and
 * `RecommendationTitleMatcher.java` for typed exclusions, book ISBN/author matching,
 * and local recorded-title filtering.
 */
object RecommendationMatcher {

    data class Identity(
        val name: String,
        val type: TitleType?,
        val provider: Provider? = null,
        val providerId: String? = null,
        val alternateNames: List<String> = emptyList(),
        val originalName: String? = null,
        val author: String? = null,
        val isbn10: String? = null,
        val isbn13: String? = null,
        val year: Int? = null
    )

    fun fromRecommendation(item: RecommendationItem): Identity = Identity(
        name = item.name,
        type = item.type,
        provider = item.provider,
        providerId = item.providerId,
        alternateNames = item.alternateNames,
        originalName = item.originalName,
        author = item.author,
        isbn10 = item.isbn10,
        isbn13 = item.isbn13,
        year = item.year
    )

    fun fromExclusionItem(item: RecommendationExclusionItem): Identity = Identity(
        name = item.name,
        type = item.type,
        provider = item.provider,
        providerId = item.providerId,
        alternateNames = item.alternateNames,
        originalName = item.originalName,
        author = item.author,
        isbn10 = item.isbn10,
        isbn13 = item.isbn13,
        year = item.year
    )

    fun fromExclusion(item: RecommendationExclusion): Identity = Identity(
        name = item.name,
        type = item.type,
        provider = item.provider,
        providerId = item.providerId,
        alternateNames = item.alternateNames,
        originalName = item.originalName,
        author = item.author,
        isbn10 = item.isbn10,
        isbn13 = item.isbn13,
        year = item.year
    )

    fun fromTitle(title: Title): Identity = Identity(
        name = title.name,
        type = title.type,
        provider = title.provider,
        providerId = title.providerId,
        author = title.author,
        isbn10 = title.isbn10,
        isbn13 = title.isbn13,
        year = title.year
    )

    fun normalizeName(value: String): String {
        val nfkc = Normalizer.normalize(value, Normalizer.Form.NFKC).lowercase()
        val sb = StringBuilder(nfkc.length)
        for (ch in nfkc) {
            if (Character.isLetterOrDigit(ch)) {
                sb.append(ch)
            }
        }
        return sb.toString()
    }

    private fun normalizedNames(item: Identity): List<String> =
        buildList {
            add(item.name)
            item.originalName?.let { add(it) }
            addAll(item.alternateNames)
        }.map(::normalizeName).filter { it.isNotEmpty() }

    private fun providerIdentity(item: Identity): String? {
        val prov = item.provider ?: return null
        val provId = item.providerId?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        return "${item.type?.wireValue.orEmpty()}:${prov.name.lowercase()}:$provId"
    }

    private fun authorTokens(author: String?): List<String> =
        author.orEmpty()
            .split("/")
            .map(::normalizeName)
            .filter { it.isNotEmpty() }

    private fun normalizeIsbn13(isbn13: String?, isbn10: String?): String? {
        val thirteen = isbn13.orEmpty().filter { it.isDigit() }
        if (thirteen.length == 13) return thirteen
        val ten = isbn10.orEmpty().filter { it.isDigit() || it == 'X' || it == 'x' }
        if (ten.length != 10) return null
        val prefix = "978${ten.substring(0, 9)}"
        var sum = 0
        for (i in prefix.indices) {
            val digit = prefix[i] - '0'
            sum += digit * if (i % 2 == 1) 3 else 1
        }
        val check = (10 - (sum % 10)) % 10
        return "$prefix$check"
    }

    fun matches(item: Identity, candidates: List<Identity>): Boolean {
        val itemNames = normalizedNames(item).toSet()
        val itemProvId = providerIdentity(item)
        return candidates.any { prev ->
            if (item.type != null && prev.type != null && item.type != prev.type) {
                return@any false
            }
            val overlap = normalizedNames(prev).any { it in itemNames }
            if (item.type == null || prev.type == null) {
                return@any overlap
            }
            if (item.type == TitleType.BOOK) {
                val isbn = normalizeIsbn13(item.isbn13, item.isbn10)
                val prevIsbn = normalizeIsbn13(prev.isbn13, prev.isbn10)
                if (isbn != null && isbn == prevIsbn) return@any true

                val authors = authorTokens(item.author)
                val prevAuthors = authorTokens(prev.author)
                if (authors.isNotEmpty() && prevAuthors.isNotEmpty()) {
                    if (authors.none { it in prevAuthors }) return@any false
                    if (overlap) return@any true
                }

                val prevProvId = providerIdentity(prev)
                if (itemProvId != null && prevProvId != null && itemProvId == prevProvId) {
                    return@any true
                }
                return@any overlap &&
                    authors.isEmpty() &&
                    prevAuthors.isEmpty() &&
                    isbn == null &&
                    prevIsbn == null
            }

            val prevProvId = providerIdentity(prev)
            if (itemProvId != null && prevProvId != null) {
                return@any itemProvId == prevProvId
            }
            if (item.year != null && prev.year != null && abs(item.year - prev.year) > 1) {
                return@any false
            }
            overlap
        }
    }

    fun isDismissed(item: RecommendationItem, dismissed: List<Identity>): Boolean =
        matches(fromRecommendation(item), dismissed)

    fun effectiveExclusions(
        server: List<RecommendationExclusion>,
        operations: List<RecommendationPendingOperation>
    ): List<RecommendationExclusion> {
        val result = server.toMutableList()
        for (op in operations) {
            when (op.kind) {
                RecommendationOperationKind.EXCLUDE -> {
                    val opId = fromExclusionItem(op.item)
                    if (!matches(opId, result.map(::fromExclusion))) {
                        result.add(
                            RecommendationExclusion(
                                key = op.key ?: "pending:${op.id}",
                                name = op.item.name,
                                type = op.item.type,
                                reason = op.item.reason,
                                genres = op.item.genres,
                                posterUrl = op.item.posterUrl,
                                provider = op.item.provider,
                                providerId = op.item.providerId,
                                year = op.item.year,
                                alternateNames = op.item.alternateNames,
                                author = op.item.author,
                                isbn10 = op.item.isbn10,
                                isbn13 = op.item.isbn13,
                                originalName = op.item.originalName,
                                catalogTitle = op.item.catalogTitle
                            )
                        )
                    }
                }
                RecommendationOperationKind.RESTORE -> {
                    val opId = fromExclusionItem(op.item)
                    result.removeAll { existing ->
                        (op.key != null && existing.key == op.key) ||
                            matches(opId, listOf(fromExclusion(existing)))
                    }
                }
            }
        }
        return result
    }
}
